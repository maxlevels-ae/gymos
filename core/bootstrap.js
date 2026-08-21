const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const compression = require('compression');
const config = require('./config');
const database = require('./database');
const eventBus = require('./event-bus');
const container = require('./container');
const ModuleLoader = require('./module-loader');
const registerCoreRoutes = require('./routes');
const { errorHandler, notFound } = require('./middleware/error-handler');
const { securityHeaders, stripQueryToken, enforcePaginationLimits } = require('./middleware/security');
const { globalLimiter } = require('./middleware/rate-limiter');

class Application {
  constructor() {
    this.express = express();
    this.moduleLoader = new ModuleLoader();
    this.bootDiagnostics = { started: new Date(), steps: [], errors: [] };
  }

  async boot() {
    console.log('🚀 Booting GymOS Platform...\n');

    try {
      this.step('middleware', () => this.setupMiddleware());
      await this.stepAsync('database', () => database.connect());
      this.step('core_services', () => this.registerCoreServices());
      this.step('core_migrations', () => this.runCoreMigrations());
      await this.stepAsync('seed_defaults', () => this.seedDefaults());
      this.step('timezone', () => this.applyTimezone());
      this.step('core_routes', () => registerCoreRoutes(this.express, this.moduleLoader));
      this.step('modules', () => this.moduleLoader.loadAll(this.express));
      this.step('frontend', () => this.serveFrontend());
      this.step('scheduled_jobs', () => this.startScheduledJobs());

      // Error handling (must be last)
      this.express.use(notFound);
      this.express.use(errorHandler);

      this.bootDiagnostics.completed = new Date();
      this.bootDiagnostics.bootTimeMs = this.bootDiagnostics.completed - this.bootDiagnostics.started;
      container.register('diagnostics', this.bootDiagnostics);

      eventBus.emit('app.booted', { modules: this.moduleLoader.getLoadedCount() });
      console.log('\n  ✅ Boot complete (' + this.bootDiagnostics.bootTimeMs + 'ms)');

      if (this.moduleLoader.bootErrors.length > 0) {
        console.log('  ⚠️  Module issues:');
        for (const e of this.moduleLoader.bootErrors) {
          console.log('    • ' + e.module + ': ' + e.error);
        }
      }
    } catch (err) {
      this.bootDiagnostics.errors.push({ step: 'boot', error: err.message });
      console.error('❌ Boot failed:', err.message);
      throw err;
    }
  }

  step(name, fn) {
    const start = Date.now();
    try {
      fn();
      this.bootDiagnostics.steps.push({ name, status: 'ok', timeMs: Date.now() - start });
    } catch (err) {
      this.bootDiagnostics.steps.push({ name, status: 'failed', error: err.message, timeMs: Date.now() - start });
      this.bootDiagnostics.errors.push({ step: name, error: err.message });
      throw err;
    }
  }

  async stepAsync(name, fn) {
    const start = Date.now();
    try {
      await fn();
      this.bootDiagnostics.steps.push({ name, status: 'ok', timeMs: Date.now() - start });
    } catch (err) {
      this.bootDiagnostics.steps.push({ name, status: 'failed', error: err.message, timeMs: Date.now() - start });
      this.bootDiagnostics.errors.push({ step: name, error: err.message });
      throw err;
    }
  }

  // Apply the configured app timezone to the Node process so that ALL server-side
  // date math — JS `new Date()` and SQLite `date('now','localtime')` used by the
  // scheduler, automation, reports and every module — resolves in the club's zone
  // instead of the host OS zone. Verified: SQLite localtime honours process.env.TZ.
  applyTimezone() {
    try {
      const settingsService = require('./services/settings-service');
      const tz = String(settingsService.get('app.timezone', 'Asia/Amman') || 'Asia/Amman').trim();
      if (tz) { process.env.TZ = tz; console.log('  🕐 Timezone: ' + tz + ' (applied to all server-side date math)'); }
    } catch (e) { console.log('  ⚠️  Timezone not applied: ' + e.message); }
  }

  setupMiddleware() {
    if (config.hosting?.trustProxy) {
      this.express.set('trust proxy', 1);
      console.log('  ✅ trust proxy enabled');
    }

    // ── Security headers (Helmet) ──
    this.express.use(securityHeaders);

    // ── Compression ──
    if (config.performance.compressionEnabled) {
      this.express.use(compression());
    }

    // ── CORS — restrictive in production ──
    const corsOptions = {
      origin: config.cors.origins
        ? (origin, cb) => {
            if (!origin || config.cors.origins.includes(origin)) cb(null, true);
            else {
              // Return a proper 403 (Forbidden) rather than a generic 500 "Internal server error".
              const e = new Error('Origin not allowed by CORS policy');
              e.status = 403;
              cb(e);
            }
          }
        : true,
      credentials: true,
    };
    this.express.use(cors(corsOptions));

    // ── Body parsing ──
    this.express.use(express.json({ limit: config.performance.jsonLimit }));
    this.express.use(express.urlencoded({ extended: true }));
    this.express.use(cookieParser());

    // ── Security: strip query tokens, enforce pagination ──
    this.express.use(stripQueryToken);
    this.express.use(enforcePaginationLimits);

    // ── Rate limiting ──
    this.express.use('/api/', globalLimiter);

    // ── Static uploads ──
    this.express.use('/uploads', express.static(config.paths.uploads, {
      maxAge: '1d',
      etag: true,
    }));

    // ── Request ID for tracing ──
    this.express.use((req, _res, next) => {
      req.requestId = require('crypto').randomUUID();
      next();
    });

    console.log('  ✅ Middleware configured (helmet, compression, rate-limit, CORS)');
  }

  runCoreMigrations() {
    console.log('  📦 Running core migrations...');
    database.get().exec(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key TEXT UNIQUE NOT NULL,
        module TEXT NOT NULL DEFAULT 'core',
        ran_at TEXT NOT NULL
      );
    `);
    database.save();

    // Add must_change_password column if missing
    try { database.get().exec('ALTER TABLE users ADD COLUMN must_change_password INTEGER DEFAULT 0'); } catch (_) {}

    const fs = require('fs');
    const migrationsDir = path.join(__dirname, 'migrations');
    const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.js')).sort();

    for (const file of files) {
      const key = 'core:' + file;
      if (database.getOne('SELECT id FROM _migrations WHERE key = ?', [key])) continue;
      const migration = require(path.join(migrationsDir, file));
      if (typeof migration.up === 'function') {
        migration.up(database.get());
        database.save();
        database.run('INSERT INTO _migrations (key, module, ran_at) VALUES (?, ?, datetime("now"))', [key, 'core']);
        console.log('    ✅ Core migration:', file);
      }
    }
  }

  async seedDefaults() {
    const existing = database.getOne('SELECT id FROM users WHERE username = ?', ['admin']);
    if (!existing) {
      const authService = require('./services/auth-service');
      const adminRole = database.getOne("SELECT id FROM roles WHERE name = 'admin'");
      await authService.createUser({
        username: 'admin', email: 'admin@gym.local', password: 'admin123',
        full_name: 'System Admin', role_id: adminRole?.id || 1,
        mustChangePassword: true,  // ← Force password change on first login
      });
      console.log('  👤 Default admin created (admin / admin123) — password change required on first login');
    }

    const settings = container.resolve('settings');
    const defaults = [
      ['app.name', 'GymOS', { type: 'string', module: 'core', label: 'Application Name' }],
      ['app.admin_logo_url', '', { type: 'string', module: 'core', label: 'Admin Logo URL' }],
      ['app.login_logo_url', '', { type: 'string', module: 'core', label: 'Login Logo URL' }],
      ['app.locale', 'en', { type: 'string', module: 'core', label: 'Default Language' }],
      ['app.dir', 'auto', { type: 'string', module: 'core', label: 'Text Direction' }],
      ['app.timezone', 'Asia/Amman', { type: 'string', module: 'core', label: 'Timezone' }],
      ['app.currency', 'JOD', { type: 'string', module: 'core', label: 'Currency' }],
      ['app.date_format', 'YYYY-MM-DD', { type: 'string', module: 'core', label: 'Date Format' }],
      ['system.module_uploads_enabled', true, { type: 'boolean', module: 'core', label: 'Allow module uploads' }],
      ['system.auto_complete_freezes', true, { type: 'boolean', module: 'core', label: 'Auto-complete membership freezes' }],
      ['notifications.in_app.enabled', true, { type: 'boolean', module: 'core', label: 'In-app notifications enabled' }],
      ['notifications.email.enabled', false, { type: 'boolean', module: 'core', label: 'Email notifications enabled' }],
    ];

    for (const [key, value, meta] of defaults) {
      if (settings.get(key) === null) settings.set(key, value, meta);
    }

    // Initialize sequence service
    const sequenceService = container.resolve('sequences');
    sequenceService.ensureTable();
  }

  registerCoreServices() {
    container.register('database', database);
    container.register('eventBus', eventBus);
    container.register('config', config);
    container.register('auth', require('./services/auth-service'));
    container.register('settings', require('./services/settings-service'));
    container.register('audit', require('./services/audit-service'));
    container.register('notifications', require('./services/notification-service'));
    container.register('otp', require('./services/otp-service'));
    container.register('membershipState', require('./services/membership-state-service'));
    container.register('sequences', require('./services/sequence-service'));

    // Shared engines
    container.register('dbAdapter', require('./db-adapter'));
    container.register('workflowEngine', require('./engines/workflow-engine'));
    container.register('rulesEngine', require('./engines/rules-engine'));
    container.register('notificationTemplates', require('./engines/notification-templates'));

    console.log('  ✅ Core services + engines registered (incl. OTP, sequences, membership-state)');
  }

  startScheduledJobs() {
    // OTP cleanup every 10 minutes
    const otpService = container.resolve('otp');
    setInterval(() => otpService.cleanup(), 10 * 60 * 1000);

    // DB backup every 6 hours
    setInterval(() => {
      try {
        const dest = database.backup();
        if (dest) console.log('  💾 Auto-backup:', dest);
      } catch (_) {}
    }, 6 * 60 * 60 * 1000);

    console.log('  ✅ Scheduled jobs started (OTP cleanup, DB backup)');
  }

  serveFrontend() {
    this.express.use(express.static(config.paths.public, {
      maxAge: config.app.isProduction ? '7d' : 0,
      etag: true,
      immutable: config.app.isProduction,
    }));
    const empPwaPath = path.join(__dirname, '..', 'employee-pwa');
    const memPwaPath = path.join(__dirname, '..', 'member-pwa');
    const fs = require('fs');
    if (fs.existsSync(empPwaPath)) this.express.use('/employee', express.static(empPwaPath, { maxAge: '1d' }));
    if (fs.existsSync(memPwaPath)) this.express.use('/member', express.static(memPwaPath, { maxAge: '1d' }));
  }

  /** Graceful shutdown */
  async shutdown(signal) {
    console.log(`\n🛑 ${signal} received — shutting down gracefully...`);
    try {
      database.close();
    } catch (err) {
      console.error('Error during shutdown:', err.message);
    }
    process.exit(0);
  }
}

module.exports = new Application();
