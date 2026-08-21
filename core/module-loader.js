const fs = require('fs');
const path = require('path');
const config = require('./config');
const database = require('./database');
const eventBus = require('./event-bus');
const container = require('./container');
const manifestValidator = require('./services/manifest-validator');

/**
 * Module status lifecycle:
 *   discovered → installed → enabled → active (loaded)
 *   enabled → disabled
 *   any → failed
 */
const STATUS = {
  DISCOVERED: 'discovered',
  INSTALLED: 'installed',
  ENABLED: 'enabled',
  ACTIVE: 'active',
  DISABLED: 'disabled',
  FAILED: 'failed',
};

class ModuleLoader {
  constructor() {
    this.modules = new Map();       // name → { manifest, status, path, error, loadTimeMs }
    this.menuItems = [];
    this.dashboardWidgets = [];
    this.dashboardCards = [];
    this.permissions = [];
    this.memberProfileTabs = [];
    this.quickActions = [];
    this.automationRules = [];
    this.notificationTemplates = [];
    this.scheduledJobs = [];
    this.bootErrors = [];
  }

  // ═══════════════════════════════════════════════════
  // DISCOVERY
  // ═══════════════════════════════════════════════════
  discover() {
    const dir = config.paths.modules;
    if (!fs.existsSync(dir)) { fs.mkdirSync(dir, { recursive: true }); return []; }
    return fs.readdirSync(dir, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name);
  }

  loadManifest(moduleName) {
    const p = path.join(config.paths.modules, moduleName, 'manifest.json');
    if (!fs.existsSync(p)) return null;
    try { return JSON.parse(fs.readFileSync(p, 'utf-8')); }
    catch (err) { this.logModule(moduleName, 'error', 'Invalid manifest JSON: ' + err.message); return null; }
  }

  // ═══════════════════════════════════════════════════
  // DEPENDENCY RESOLUTION
  // ═══════════════════════════════════════════════════

  /**
   * Topological sort with strict dependency validation.
   * - Blocks modules whose dependencies are missing from disk entirely.
   * - Detects and reports circular dependencies.
   * - Returns { sorted: string[], blocked: { name, reason }[] }
   */
  resolveDependencyOrder(moduleNames) {
    const manifests = new Map();
    for (const name of moduleNames) {
      const m = this.loadManifest(name);
      if (m) manifests.set(m.name || name, { dirName: name, manifest: m });
    }

    // First pass: identify modules whose dependencies are entirely absent from
    // the discovered set. These cannot load regardless of ordering.
    const blocked = [];
    const eligible = new Map();
    for (const [name, entry] of manifests) {
      const deps = entry.manifest.dependencies || [];
      const missing = deps.filter(d => !manifests.has(d));
      if (missing.length > 0) {
        const reason = `Missing dependencies not found on disk: ${missing.join(', ')}`;
        blocked.push({ name, dirName: entry.dirName, reason });
        this.logModule(name, 'error', reason);
      } else {
        eligible.set(name, entry);
      }
    }

    // Second pass: topological sort on eligible modules with cycle detection.
    const visited = new Set();
    const visiting = new Set();
    const sorted = [];

    const visit = (name) => {
      if (visited.has(name)) return true;
      if (visiting.has(name)) {
        // Build a readable cycle path
        const chain = [...visiting, name];
        const cycleStart = chain.indexOf(name);
        const cycle = chain.slice(cycleStart).join(' → ');
        throw new Error(`Circular dependency: ${cycle}`);
      }
      if (!eligible.has(name)) return false; // already blocked
      visiting.add(name);
      const mod = eligible.get(name);
      for (const dep of (mod.manifest.dependencies || [])) {
        if (!visit(dep)) {
          // Dependency was blocked — cascade the block
          const reason = `Dependency "${dep}" is blocked or failed`;
          blocked.push({ name, dirName: mod.dirName, reason });
          this.logModule(name, 'error', reason);
          visiting.delete(name);
          eligible.delete(name);
          return false;
        }
      }
      visiting.delete(name);
      visited.add(name);
      sorted.push(eligible.get(name).dirName);
      return true;
    };

    for (const name of eligible.keys()) {
      visit(name);
    }

    // Dirs with no manifest get appended (they'll fail at loadModule's manifest check)
    for (const name of moduleNames) {
      if (!sorted.includes(name) && !blocked.find(b => b.dirName === name)) {
        sorted.push(name);
      }
    }

    return { sorted, blocked };
  }

  /**
   * Validate that all dependencies are loaded and active.
   * Called during loadModule after topological sort, so deps should already
   * be in this.modules if they loaded successfully.
   */
  validateDependencies(manifest) {
    if (!manifest.dependencies?.length) return { valid: true, missing: [], disabled: [], failed: [] };
    const missing = [];
    const disabled = [];
    const failed = [];

    for (const dep of manifest.dependencies) {
      const mod = this.modules.get(dep);
      if (!mod) {
        missing.push(dep);
      } else if (mod.status === STATUS.DISABLED) {
        disabled.push(dep);
      } else if (mod.status === STATUS.FAILED) {
        failed.push(dep);
      } else if (mod.status !== STATUS.ACTIVE) {
        // Not loaded for any other reason (discovered only, etc.)
        failed.push(dep);
      }
    }

    const valid = missing.length === 0 && disabled.length === 0 && failed.length === 0;
    return { valid, missing, disabled, failed };
  }

  // ═══════════════════════════════════════════════════
  // MODULE LIFECYCLE
  // ═══════════════════════════════════════════════════

  getModuleStatus(name) {
    const row = database.getOne('SELECT enabled FROM modules_registry WHERE name = ?', [name]);
    if (!row) return STATUS.DISCOVERED;
    return row.enabled === 1 ? STATUS.ENABLED : STATUS.DISABLED;
  }

  registerInDb(manifest) {
    const existing = database.getOne('SELECT id, version FROM modules_registry WHERE name = ?', [manifest.name]);
    if (!existing) {
      database.run(
        `INSERT INTO modules_registry (name, version, description, author, enabled, meta, installed_at) 
         VALUES (?, ?, ?, ?, 1, ?, datetime('now'))`,
        [manifest.name, manifest.version, manifest.description || '', manifest.author || '',
         JSON.stringify({ dependencies: manifest.dependencies || [] })]
      );
      this.logModuleVersion(manifest.name, manifest.version, null, 'installed');
    } else {
      // Version upgrade detection
      const oldVersion = existing.version;
      if (oldVersion !== manifest.version) {
        const cmp = manifestValidator.compareVersions(manifest.version, oldVersion);
        if (cmp > 0) {
          this.logModule(manifest.name, 'info', `Upgrading from v${oldVersion} to v${manifest.version}`);
          this.logModuleVersion(manifest.name, manifest.version, oldVersion, 'upgraded');
        } else if (cmp < 0) {
          this.logModule(manifest.name, 'warn', `Downgrade detected: v${oldVersion} → v${manifest.version}`);
          this.logModuleVersion(manifest.name, manifest.version, oldVersion, 'downgraded');
        }
      }
      database.run(
        'UPDATE modules_registry SET version = ?, description = ?, author = ?, meta = ?, updated_at = datetime("now") WHERE name = ?',
        [manifest.version, manifest.description || '', manifest.author || '',
         JSON.stringify({ dependencies: manifest.dependencies || [] }), manifest.name]
      );
    }
  }

  // ═══════════════════════════════════════════════════
  // MIGRATIONS (with tracking)
  // ═══════════════════════════════════════════════════

  runMigrations(moduleName) {
    const dir = path.join(config.paths.modules, moduleName, 'migrations');
    if (!fs.existsSync(dir)) return { run: 0, failed: 0 };
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.js')).sort();
    let run = 0, failed = 0;

    for (const file of files) {
      const key = moduleName + ':' + file;
      if (database.getOne('SELECT id FROM _migrations WHERE key = ?', [key])) continue;

      try {
        const migration = require(path.join(dir, file));
        if (typeof migration.up === 'function') {
          migration.up(database.get());
          database.save();
        }
        database.run('INSERT INTO _migrations (key, module, ran_at) VALUES (?, ?, datetime("now"))', [key, moduleName]);
        this.logModule(moduleName, 'info', `Migration complete: ${file}`);
        console.log('    📦 Migrated:', key);
        run++;
      } catch (err) {
        this.logModule(moduleName, 'error', `Migration failed [${file}]: ${err.message}`);
        console.error('    ❌ Migration error [' + key + ']:', err.message);
        failed++;
        // On migration failure, attempt rollback if down() exists
        try {
          const migration = require(path.join(dir, file));
          if (typeof migration.down === 'function') {
            migration.down(database.get());
            database.save();
            this.logModule(moduleName, 'info', `Migration rolled back: ${file}`);
          }
        } catch (_) {}
        break; // Stop running further migrations
      }
    }

    this.updateModuleHealth(moduleName, { migrations_run: run });
    return { run, failed };
  }

  getMigrationStatus(moduleName) {
    const dir = path.join(config.paths.modules, moduleName, 'migrations');
    if (!fs.existsSync(dir)) return { total: 0, run: 0, pending: 0 };
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.js'));
    const run = files.filter(f => {
      return !!database.getOne('SELECT id FROM _migrations WHERE key = ?', [moduleName + ':' + f]);
    }).length;
    return { total: files.length, run, pending: files.length - run };
  }


  scanFrontendAssets(moduleDirName, moduleName = moduleDirName) {
    const baseDir = path.join(config.paths.modules, moduleDirName, 'frontend');
    const assets = { js: [], pages: [], optional: {}, i18n: {}, exists: false };
    if (!fs.existsSync(baseDir)) return assets;

    assets.exists = true;
    const urlFor = (rel) => `/module-assets/${encodeURIComponent(moduleName)}/${rel.replace(/\\/g, '/')}`;
    const optionalFiles = ['routes.js', 'menu.js', 'widgets.js', 'settings.js', 'profile-tabs.js', 'actions.js', 'index.js'];

    const pagesDir = path.join(baseDir, 'pages');
    if (fs.existsSync(pagesDir)) {
      const pageFiles = fs.readdirSync(pagesDir)
        .filter(f => f.endsWith('.js'))
        .sort();
      for (const file of pageFiles) {
        const rel = `frontend/pages/${file}`;
        assets.pages.push({ file, rel, url: urlFor(rel) });
        assets.js.push(urlFor(rel));
      }
    }

    for (const file of optionalFiles) {
      const abs = path.join(baseDir, file);
      if (!fs.existsSync(abs)) continue;
      const rel = `frontend/${file}`;
      assets.optional[file] = { file, rel, url: urlFor(rel) };
      assets.js.push(urlFor(rel));
    }

    for (const locale of ['en', 'ar']) {
      const abs = path.join(baseDir, 'i18n', `${locale}.json`);
      if (!fs.existsSync(abs)) continue;
      const rel = `frontend/i18n/${locale}.json`;
      assets.i18n[locale] = { rel, url: urlFor(rel) };
    }

    return assets;
  }

  // ═══════════════════════════════════════════════════
  // MODULE LOADING
  // ═══════════════════════════════════════════════════

  loadModule(moduleName, expressApp) {
    const startTime = Date.now();
    const manifest = this.loadManifest(moduleName);

    if (!manifest) {
      this.modules.set(moduleName, { manifest: null, status: STATUS.DISCOVERED, path: moduleName });
      return false;
    }

    // Validate manifest
    const validation = manifestValidator.validate(manifest, { checkFiles: true, modulePath: path.join(config.paths.modules, moduleName) });
    if (!validation.valid) {
      const errMsg = 'Manifest errors: ' + validation.errors.join('; ');
      this.logModule(manifest.name, 'error', errMsg);
      this.modules.set(manifest.name, { manifest, status: STATUS.FAILED, error: errMsg, path: moduleName });
      this.updateModuleHealth(manifest.name, { status: STATUS.FAILED, last_error: errMsg });
      return false;
    }
    for (const w of validation.warnings) { this.logModule(manifest.name, 'warn', w); }

    // Check enabled/disabled
    const dbStatus = this.getModuleStatus(manifest.name);
    if (dbStatus === STATUS.DISABLED) {
      this.modules.set(manifest.name, { manifest, status: STATUS.DISABLED, path: moduleName });
      this.updateModuleHealth(manifest.name, { status: STATUS.DISABLED });
      return false;
    }

    // Validate dependencies — all must be active
    const deps = this.validateDependencies(manifest);
    if (!deps.valid) {
      const parts = [];
      if (deps.missing.length) parts.push('Missing: ' + deps.missing.join(', '));
      if (deps.disabled.length) parts.push('Disabled: ' + deps.disabled.join(', '));
      if (deps.failed.length) parts.push('Failed: ' + deps.failed.join(', '));
      const errMsg = 'Dependency check failed — ' + parts.join('; ');
      this.logModule(manifest.name, 'error', errMsg);
      this.modules.set(manifest.name, { manifest, status: STATUS.FAILED, error: errMsg, path: moduleName });
      this.updateModuleHealth(manifest.name, { status: STATUS.FAILED, last_error: errMsg });
      this.bootErrors.push({ module: manifest.name, error: errMsg });
      return false;
    }

    try {
      // Register in DB
      this.registerInDb(manifest);

      // Run migrations
      const migResult = this.runMigrations(moduleName);
      if (migResult.failed > 0) {
        const errMsg = `${migResult.failed} migration(s) failed`;
        this.modules.set(manifest.name, { manifest, status: STATUS.FAILED, error: errMsg, path: moduleName });
        this.updateModuleHealth(manifest.name, { status: STATUS.FAILED, last_error: errMsg });
        return false;
      }

      // Load routes
      const routesPath = path.join(config.paths.modules, moduleName, 'routes.js');
      if (fs.existsSync(routesPath)) {
        const setup = require(routesPath);
        if (typeof setup === 'function') setup(expressApp, { database, eventBus, container, config });
      }

      // Load services
      const svcDir = path.join(config.paths.modules, moduleName, 'services');
      if (fs.existsSync(svcDir)) {
        for (const sf of fs.readdirSync(svcDir).filter(f => f.endsWith('.js'))) {
          const svc = require(path.join(svcDir, sf));
          const svcName = manifest.name + '.' + path.basename(sf, '.js');
          container.register(svcName, typeof svc === 'function' ? svc({ database, eventBus, container, config }) : svc);
        }
      }

      // Load events/hooks
      const evPath = path.join(config.paths.modules, moduleName, 'events.js');
      if (fs.existsSync(evPath)) {
        const setup = require(evPath);
        if (typeof setup === 'function') setup(eventBus, { database, container, config });
      }

      // Register manifest extensions
      const mn = manifest.name;
      if (manifest.menu) manifest.menu.forEach(i => this.menuItems.push({ ...i, module: mn }));
      if (manifest.widgets) manifest.widgets.forEach(w => this.dashboardWidgets.push({ ...w, module: mn }));
      if (manifest.cards) manifest.cards.forEach(c => this.dashboardCards.push({ ...c, module: mn }));
      if (manifest.permissions) manifest.permissions.forEach(p => this.permissions.push({ permission: p, module: mn }));
      if (manifest.profileTabs) manifest.profileTabs.forEach(t => this.memberProfileTabs.push({ ...t, module: mn }));
      if (manifest.quickActions) manifest.quickActions.forEach(a => this.quickActions.push({ ...a, module: mn }));
      if (manifest.automationRules) manifest.automationRules.forEach(r => this.automationRules.push({ ...r, module: mn }));
      if (manifest.notificationTemplates) manifest.notificationTemplates.forEach(t => this.notificationTemplates.push({ ...t, module: mn }));
      if (manifest.scheduledJobs) manifest.scheduledJobs.forEach(j => this.scheduledJobs.push({ ...j, module: mn }));

      const loadTimeMs = Date.now() - startTime;
      this.modules.set(mn, { manifest, status: STATUS.ACTIVE, path: moduleName, loadTimeMs, frontend: this.scanFrontendAssets(moduleName, mn) });
      this.updateModuleHealth(mn, { status: STATUS.ACTIVE, load_time_ms: loadTimeMs, last_error: '' });
      this.logModule(mn, 'info', `Loaded successfully in ${loadTimeMs}ms`);
      console.log(`    ✅ Module loaded: ${mn} v${manifest.version} (${loadTimeMs}ms)`);
      return true;
    } catch (err) {
      const errMsg = err.message || String(err);
      this.logModule(manifest.name, 'error', 'Load failed: ' + errMsg);
      this.modules.set(manifest.name, { manifest, status: STATUS.FAILED, error: errMsg, path: moduleName });
      this.updateModuleHealth(manifest.name, { status: STATUS.FAILED, last_error: errMsg });
      this.bootErrors.push({ module: manifest.name, error: errMsg });
      console.error('    ❌ Failed to load ' + moduleName + ':', errMsg);
      return false;
    }
  }

  /**
   * Load all modules in dependency-resolved order.
   * Blocked modules (missing deps, circular deps) are registered as FAILED
   * and never attempted for loading.
   */
  loadAll(expressApp) {
    console.log('  📂 Discovering modules...');
    const discovered = this.discover();
    console.log(`    Found ${discovered.length} module(s): ${discovered.join(', ')}`);

    let sorted, blocked;
    try {
      const result = this.resolveDependencyOrder(discovered);
      sorted = result.sorted;
      blocked = result.blocked;
    } catch (err) {
      // Circular dependency — fatal for the cycle. Log and register all as failed.
      console.error('  ❌ Dependency error:', err.message);
      this.bootErrors.push({ module: '_system', error: err.message });
      // Cannot determine safe order — skip all modules
      sorted = [];
      blocked = discovered.map(name => ({ name, dirName: name, reason: err.message }));
    }

    // Register blocked modules as FAILED with clear reasons
    for (const b of blocked) {
      console.error(`    🚫 Blocked: ${b.name} — ${b.reason}`);
      this.modules.set(b.name, {
        manifest: this.loadManifest(b.dirName),
        status: STATUS.FAILED,
        error: b.reason,
        path: b.dirName,
      });
      this.updateModuleHealth(b.name, { status: STATUS.FAILED, last_error: b.reason });
      this.bootErrors.push({ module: b.name, error: b.reason });
    }

    if (sorted.length > 0) {
      console.log(`    Load order: ${sorted.join(' → ')}`);
    }

    for (const name of sorted) {
      this.loadModule(name, expressApp);
    }

    eventBus.emit('modules.loaded', { modules: this.getLoadedModules() });
  }

  // ═══════════════════════════════════════════════════
  // MODULE MANAGEMENT
  // ═══════════════════════════════════════════════════

  toggleModule(name, enabled) {
    database.run('UPDATE modules_registry SET enabled = ?, updated_at = datetime("now") WHERE name = ?', [enabled ? 1 : 0, name]);
    this.logModule(name, 'info', enabled ? 'Module enabled' : 'Module disabled');
    this.logModuleVersion(name, null, null, enabled ? 'enabled' : 'disabled');
  }

  // ═══════════════════════════════════════════════════
  // LOGGING & HEALTH
  // ═══════════════════════════════════════════════════

  logModule(moduleName, level, message) {
    try {
      database.run('INSERT INTO module_logs (module_name, level, message) VALUES (?, ?, ?)', [moduleName, level, message]);
    } catch (_) {} // Fail silently if table doesn't exist yet
  }

  logModuleVersion(moduleName, version, previousVersion, action) {
    try {
      database.run('INSERT INTO module_versions (module_name, version, previous_version, action) VALUES (?, ?, ?, ?)',
        [moduleName, version || '', previousVersion || '', action]);
    } catch (_) {}
  }

  updateModuleHealth(moduleName, updates) {
    try {
      const existing = database.getOne('SELECT id FROM module_health WHERE module_name = ?', [moduleName]);
      if (existing) {
        const sets = Object.entries(updates).map(([k, v]) => `${k} = ?`).join(', ');
        database.run(`UPDATE module_health SET ${sets}, updated_at = datetime('now') WHERE module_name = ?`,
          [...Object.values(updates), moduleName]);
      } else {
        const cols = ['module_name', ...Object.keys(updates)].join(', ');
        const vals = ['?', ...Object.keys(updates).map(() => '?')].join(', ');
        database.run(`INSERT INTO module_health (${cols}) VALUES (${vals})`, [moduleName, ...Object.values(updates)]);
      }
    } catch (_) {}
  }

  getModuleLogs(moduleName, limit = 50) {
    try {
      return database.getAll('SELECT * FROM module_logs WHERE module_name = ? ORDER BY created_at DESC LIMIT ?', [moduleName, limit]);
    } catch (_) { return []; }
  }

  getAllLogs(limit = 100) {
    try {
      return database.getAll('SELECT * FROM module_logs ORDER BY created_at DESC LIMIT ?', [limit]);
    } catch (_) { return []; }
  }

  // ═══════════════════════════════════════════════════
  // QUERY HELPERS
  // ═══════════════════════════════════════════════════

  _active(items) {
    return items.filter(i => {
      const m = this.modules.get(i.module);
      return m && m.status === STATUS.ACTIVE;
    });
  }

  getLoadedModules() {
    return Array.from(this.modules.entries()).map(([name, info]) => {
      const migStatus = this.getMigrationStatus(info.path || name);
      const health = this.getModuleHealthData(name);
      return {
        name,
        version: info.manifest?.version,
        description: info.manifest?.description,
        author: info.manifest?.author,
        status: info.status,
        error: info.error,
        core: !!info.manifest?.core,
        loadTimeMs: info.loadTimeMs,
        dependencies: info.manifest?.dependencies || [],
        migrations: migStatus,
        health: health,
        frontend: info.frontend || this.scanFrontendAssets(info.path || name, name),
      };
    });
  }

  getModuleHealthData(name) {
    try {
      return database.getOne('SELECT * FROM module_health WHERE module_name = ?', [name]);
    } catch (_) { return null; }
  }

  getSystemDiagnostics() {
    const modules = this.getLoadedModules();
    return {
      totalModules: modules.length,
      active: modules.filter(m => m.status === STATUS.ACTIVE).length,
      disabled: modules.filter(m => m.status === STATUS.DISABLED).length,
      failed: modules.filter(m => m.status === STATUS.FAILED).length,
      bootErrors: this.bootErrors,
      modules,
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      nodeVersion: process.version,
    };
  }


  getModuleInfo(name) {
    return this.modules.get(name) || null;
  }

  getFrontendRegistry() {
    const modules = [];
    for (const [name, info] of this.modules.entries()) {
      if (info.status !== STATUS.ACTIVE) continue;
      const frontend = info.frontend || this.scanFrontendAssets(info.path || name, name);
      modules.push({
        name,
        path: info.path || name,
        label: info.manifest?.label || info.manifest?.name || name,
        labelAr: info.manifest?.labelAr || '',
        frontend,
        menu: info.manifest?.menu || [],
        widgets: info.manifest?.widgets || [],
        profileTabs: info.manifest?.profileTabs || [],
        quickActions: info.manifest?.quickActions || [],
      });
    }
    return { modules };
  }

  getLoadedCount() { return Array.from(this.modules.values()).filter(m => m.status === STATUS.ACTIVE).length; }
  getMenuItems() { return this._active(this.menuItems); }
  getDashboardWidgets() { return this._active(this.dashboardWidgets); }
  getDashboardCards() { return this._active(this.dashboardCards); }
  getMemberProfileTabs() { return this._active(this.memberProfileTabs); }
  getQuickActions() { return this._active(this.quickActions); }
  getAllPermissions() { return this.permissions; }


  /**
   * Load and merge translations for a locale.
   * Fallback chain is resolved as: selected locale -> English.
   * Sources merged: core translations, legacy module translations, frontend module i18n files.
   */
  getTranslations(locale = 'en') {
    const mergeJson = (target, filePath) => {
      if (!fs.existsSync(filePath)) return target;
      try {
        const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        for (const [key, val] of Object.entries(parsed)) {
          if (target[key] && typeof target[key] === 'object' && typeof val === 'object' && !Array.isArray(val)) {
            Object.assign(target[key], val);
          } else {
            target[key] = val;
          }
        }
      } catch (_) {}
      return target;
    };

    const result = {};
    const mergeLocale = (loc) => {
      mergeJson(result, path.join(__dirname, 'translations', loc + '.json'));
      for (const [name, info] of this.modules) {
        if (info.status !== STATUS.ACTIVE) continue;
        const modulePath = config.paths.modules;
        const dirName = info.path || name;
        mergeJson(result, path.join(modulePath, dirName, 'translations', loc + '.json'));
        mergeJson(result, path.join(modulePath, dirName, 'frontend', 'i18n', loc + '.json'));
      }
    };

    if (locale !== 'en') mergeLocale('en');
    mergeLocale(locale || 'en');
    return result;
  }
}

module.exports = ModuleLoader;
