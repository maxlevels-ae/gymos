const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');
const config = require('../config');
const database = require('../database');
const manifestValidator = require('./manifest-validator');

const EXECUTABLE_PATH_PATTERNS = [
  /^routes\.js$/i,
  /^events\.js$/i,
  /^hooks\//i,
  /^controllers\//i,
  /^services\//i,
  /^models\//i,
  /^migrations\//i,
  /^frontend\/.*\.jsx?$/i,
];

function normalizeEntry(name) {
  return String(name || '').replace(/^\.\//, '').replace(/\\/g, '/');
}

function isExecutableEntry(name) {
  const entry = normalizeEntry(name);
  return EXECUTABLE_PATH_PATTERNS.some((pattern) => pattern.test(entry));
}

class ModuleInstaller {
  constructor(moduleLoader) {
    this.moduleLoader = moduleLoader;
    this.uploadDir = path.join(config.paths.uploads, 'modules');
    if (!fs.existsSync(this.uploadDir)) fs.mkdirSync(this.uploadDir, { recursive: true });
  }

  /**
   * Install module from uploaded zip file.
   * On any failure after files are placed, performs full rollback:
   *   - removes installed files
   *   - restores backup if one was made
   *   - removes DB registration if it was new
   *   - cleans temp files and uploaded zip
   *
   * @param {string} zipPath - Path to uploaded .zip file
   * @param {object} opts - { expressApp }
   * @returns {{ success: boolean, module?: object, errors: string[], warnings: string[] }}
   */
  async installFromZip(zipPath, { expressApp } = {}) {
    const warnings = [];
    let tempDir = null;
    let moduleName = null;
    let backupDir = null;
    let targetDir = null;
    let wasNewRegistration = false;
    let previousDbState = null;   // snapshot for upgrade rollback

    const rollback = (reason) => {
      // ── Filesystem rollback ──
      if (targetDir && fs.existsSync(targetDir)) {
        this.rmDir(targetDir);
      }
      if (backupDir && fs.existsSync(backupDir)) {
        fs.renameSync(backupDir, targetDir);
      }

      // ── Database metadata rollback ──
      if (moduleName) {
        if (wasNewRegistration) {
          // Fresh install that failed — remove everything created
          try { database.run('DELETE FROM modules_registry WHERE name = ?', [moduleName]); } catch (_) {}
          try { database.run('DELETE FROM module_health WHERE module_name = ?', [moduleName]); } catch (_) {}
          try { database.run('DELETE FROM module_versions WHERE module_name = ?', [moduleName]); } catch (_) {}
          try { database.run('DELETE FROM module_logs WHERE module_name = ?', [moduleName]); } catch (_) {}
        } else if (previousDbState) {
          // Upgrade that failed — restore previous DB state exactly
          const prev = previousDbState;

          // Restore modules_registry to pre-upgrade values
          if (prev.registry) {
            try {
              database.run(
                `UPDATE modules_registry SET version=?, description=?, author=?, enabled=?, meta=?, updated_at=? WHERE name=?`,
                [prev.registry.version, prev.registry.description, prev.registry.author,
                 prev.registry.enabled, prev.registry.meta, prev.registry.updated_at, moduleName]
              );
            } catch (_) {}
          }

          // Restore module_health to pre-upgrade values, or delete if none existed
          if (prev.health) {
            try {
              database.run(
                `UPDATE module_health SET status=?, load_time_ms=?, error_count=?, last_error=?, migrations_run=?, migrations_pending=?, updated_at=? WHERE module_name=?`,
                [prev.health.status, prev.health.load_time_ms, prev.health.error_count,
                 prev.health.last_error, prev.health.migrations_run, prev.health.migrations_pending,
                 prev.health.updated_at, moduleName]
              );
            } catch (_) {}
          } else {
            // No health row existed before — delete any row created during the attempt
            try { database.run('DELETE FROM module_health WHERE module_name = ?', [moduleName]); } catch (_) {}
          }

          // Delete module_versions rows created during this attempt
          if (prev.maxVersionId !== null) {
            try { database.run('DELETE FROM module_versions WHERE module_name = ? AND id > ?', [moduleName, prev.maxVersionId]); } catch (_) {}
          } else {
            // No version rows existed before — delete all for this module
            try { database.run('DELETE FROM module_versions WHERE module_name = ?', [moduleName]); } catch (_) {}
          }

          // Delete module_logs rows created during this attempt
          if (prev.maxLogId !== null) {
            try { database.run('DELETE FROM module_logs WHERE module_name = ? AND id > ?', [moduleName, prev.maxLogId]); } catch (_) {}
          } else {
            // No log rows existed before — delete all for this module
            try { database.run('DELETE FROM module_logs WHERE module_name = ?', [moduleName]); } catch (_) {}
          }
        }

        // Log the rollback (only for upgrades — module still exists in registry)
        if (previousDbState) {
          const prevVersion = previousDbState.registry?.version;
          this.moduleLoader.logModule(moduleName, 'error',
            `Upgrade failed — system restored to previous version ${prevVersion}`);
        }
        // For new installs: no log written — all traces deleted, error is in API response
      }
    };

    const cleanup = () => {
      if (tempDir && fs.existsSync(tempDir)) this.rmDir(tempDir);
      if (zipPath && fs.existsSync(zipPath)) { try { fs.unlinkSync(zipPath); } catch (_) {} }
      // Remove backup on success (only called when not rolling back)
    };

    try {
      // ── 1. Extract zip using adm-zip (Node-native, cross-platform) ──
      tempDir = path.join(this.uploadDir, '_temp_' + Date.now());
      fs.mkdirSync(tempDir, { recursive: true });

      let zip;
      try {
        zip = new AdmZip(zipPath);

        // Validate every entry path before extracting anything
        const entries = zip.getEntries();
        for (const entry of entries) {
          const entryName = entry.entryName;
          if (entryName.includes('..') || entryName.includes('\\..') || path.isAbsolute(entryName)) {
            cleanup();
            return { success: false, errors: [`Unsafe zip entry rejected: "${entryName}" — path traversal or absolute path not allowed`], warnings };
          }
          const resolved = path.resolve(tempDir, entryName);
          if (!resolved.startsWith(tempDir + path.sep) && resolved !== tempDir) {
            cleanup();
            return { success: false, errors: [`Unsafe zip entry rejected: "${entryName}" — resolves outside target directory`], warnings };
          }
        }

        zip.extractAllTo(tempDir, true);
      } catch (err) {
        cleanup();
        return { success: false, errors: ['Failed to extract zip: ' + err.message], warnings };
      }

      // ── 2. Locate manifest.json (root or one level deep) ──
      let moduleDir = tempDir;
      let manifestPath = path.join(moduleDir, 'manifest.json');

      if (!fs.existsSync(manifestPath)) {
        const subdirs = fs.readdirSync(tempDir, { withFileTypes: true }).filter(d => d.isDirectory());
        if (subdirs.length === 1) {
          moduleDir = path.join(tempDir, subdirs[0].name);
          manifestPath = path.join(moduleDir, 'manifest.json');
        }
      }

      if (!fs.existsSync(manifestPath)) {
        cleanup();
        return { success: false, errors: ['No manifest.json found in the uploaded archive'], warnings };
      }

      // ── 3. Parse and validate manifest ──
      let manifest;
      try {
        manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
      } catch (err) {
        cleanup();
        return { success: false, errors: ['Invalid manifest.json: ' + err.message], warnings };
      }

      const validation = manifestValidator.validate(manifest, { checkFiles: true, modulePath: moduleDir });
      if (!validation.valid) {
        cleanup();
        return { success: false, errors: validation.errors, warnings: validation.warnings };
      }
      warnings.push(...validation.warnings);
      moduleName = manifest.name;

      // ── 3b. Block executable uploads in production; allow only explicitly trusted code uploads in non-production ──
      const trustedUploadRequested = manifest.trusted_upload === true;
      const isProduction = String(process.env.NODE_ENV || 'development').toLowerCase() === 'production';
      const allowTrustedCodeUpload = !isProduction && config.security.allowTrustedModuleUploads === true && trustedUploadRequested;
      const zipEntries = zip.getEntries().map((entry) => normalizeEntry(entry.entryName));
      const executableEntries = zipEntries.filter(isExecutableEntry);
      if (executableEntries.length && !allowTrustedCodeUpload) {
        cleanup();
        return {
          success: false,
          errors: [
            isProduction
              ? 'This upload contains executable code and is blocked in production. Only declarative/assets-only module uploads are permitted.'
              : 'This upload contains executable server/frontend code and is blocked by default. Only declarative/assets-only module uploads are allowed unless ALLOW_TRUSTED_MODULE_UPLOADS=true and manifest.trusted_upload=true in non-production.'
          ],
          warnings: executableEntries.slice(0, 10).map((entry) => 'Blocked executable entry: ' + entry),
        };
      }

      // ── 4. Strict dependency check — block if any are missing ──
      if (manifest.dependencies?.length) {
        const depCheck = this.moduleLoader.validateDependencies(manifest);
        if (!depCheck.valid) {
          const parts = [];
          if (depCheck.missing.length) parts.push('Missing: ' + depCheck.missing.join(', '));
          if (depCheck.disabled.length) parts.push('Disabled: ' + depCheck.disabled.join(', '));
          if (depCheck.failed.length) parts.push('Failed: ' + depCheck.failed.join(', '));
          cleanup();
          return { success: false, errors: ['Dependency check failed — ' + parts.join('; ')], warnings };
        }
      }

      // ── 5. Handle existing module (backup before overwrite) ──
      targetDir = path.join(config.paths.modules, moduleName);
      if (fs.existsSync(targetDir)) {
        const existingManifest = this.moduleLoader.loadManifest(moduleName);
        if (existingManifest) {
          const cmp = manifestValidator.compareVersions(manifest.version, existingManifest.version);
          if (cmp <= 0) {
            warnings.push(`Existing v${existingManifest.version} is same or newer than uploaded v${manifest.version}`);
          }
        }
        backupDir = targetDir + '.backup.' + Date.now();
        fs.renameSync(targetDir, backupDir);
      }

      // ── 6. Copy module files to target ──
      this.copyDir(moduleDir, targetDir);

      // ── 7. Snapshot existing DB state, then register ──
      const existingReg = database.getOne('SELECT * FROM modules_registry WHERE name = ?', [moduleName]);
      wasNewRegistration = !existingReg;

      if (!wasNewRegistration) {
        // Upgrading — capture full snapshot for rollback
        const health = database.getOne('SELECT * FROM module_health WHERE module_name = ?', [moduleName]);
        const maxVersionRow = database.getOne('SELECT MAX(id) as mid FROM module_versions WHERE module_name = ?', [moduleName]);
        const maxLogRow = database.getOne('SELECT MAX(id) as mid FROM module_logs WHERE module_name = ?', [moduleName]);
        previousDbState = {
          registry: existingReg,
          health: health,
          maxVersionId: maxVersionRow?.mid ?? null,
          maxLogId: maxLogRow?.mid ?? null,
        };
      }

      this.moduleLoader.registerInDb(manifest);

      // ── 8. Run migrations — rollback everything on failure ──
      const migResult = this.moduleLoader.runMigrations(moduleName);
      if (migResult.failed > 0) {
        rollback(`${migResult.failed} migration(s) failed`);
        cleanup();
        return { success: false, errors: [`${migResult.failed} migration(s) failed — installation rolled back`], warnings };
      }

      // ── 9. Attempt to load — rollback on failure ──
      if (expressApp) {
        const loaded = this.moduleLoader.loadModule(moduleName, expressApp);
        if (!loaded) {
          const modInfo = this.moduleLoader.modules.get(moduleName);
          const loadErr = modInfo?.error || 'Unknown load error';
          rollback('Module failed to load: ' + loadErr);
          cleanup();
          return { success: false, errors: ['Module failed to load: ' + loadErr + ' — installation rolled back'], warnings };
        }
      }

      // ── 10. Success — clean up temp and backup ──
      this.moduleLoader.logModule(moduleName, 'info', `Installed v${manifest.version} via upload`);

      cleanup();
      // Remove backup only on full success
      if (backupDir && fs.existsSync(backupDir)) {
        this.rmDir(backupDir);
      }

      return {
        success: true,
        module: { name: moduleName, version: manifest.version, description: manifest.description },
        errors: [],
        warnings,
      };

    } catch (err) {
      rollback(err.message);
      cleanup();
      return { success: false, errors: ['Installation failed: ' + err.message], warnings };
    }
  }

  /**
   * Validate a module on disk without installing
   */
  validateModule(moduleName) {
    const modulePath = path.join(config.paths.modules, moduleName);
    if (!fs.existsSync(modulePath)) return { valid: false, errors: ['Module directory not found'] };

    const manifestPath = path.join(modulePath, 'manifest.json');
    if (!fs.existsSync(manifestPath)) return { valid: false, errors: ['No manifest.json'] };

    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
      return manifestValidator.validate(manifest, { checkFiles: true, modulePath });
    } catch (err) {
      return { valid: false, errors: ['Cannot parse manifest: ' + err.message] };
    }
  }

  // ── File helpers ───────────────────────────────────

  copyDir(src, dest) {
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);
      if (entry.isDirectory()) {
        this.copyDir(srcPath, destPath);
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }

  rmDir(dir) {
    try {
      if (!fs.existsSync(dir)) return;
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, entry.name);
        if (entry.isDirectory()) this.rmDir(p);
        else fs.unlinkSync(p);
      }
      fs.rmdirSync(dir);
    } catch (_) {}
  }
}

module.exports = ModuleInstaller;
