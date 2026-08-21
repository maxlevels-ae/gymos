module.exports = {
  up(db) {
    db.exec(`
      -- Extended modules_registry (add columns if table exists)
      -- We re-create with full schema; existing data preserved via INSERT OR IGNORE
      CREATE TABLE IF NOT EXISTS module_versions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        module_name TEXT NOT NULL,
        version TEXT NOT NULL,
        previous_version TEXT,
        action TEXT NOT NULL DEFAULT 'installed',
        performed_by INTEGER,
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS module_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        module_name TEXT NOT NULL,
        level TEXT DEFAULT 'info',
        message TEXT NOT NULL,
        details TEXT DEFAULT '',
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS module_health (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        module_name TEXT UNIQUE NOT NULL,
        status TEXT DEFAULT 'unknown',
        last_check TEXT,
        load_time_ms INTEGER DEFAULT 0,
        error_count INTEGER DEFAULT 0,
        last_error TEXT DEFAULT '',
        migrations_run INTEGER DEFAULT 0,
        migrations_pending INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_module_logs_name ON module_logs(module_name);
      CREATE INDEX IF NOT EXISTS idx_module_versions_name ON module_versions(module_name);

      INSERT OR IGNORE INTO permissions (key, display_name, module) VALUES
        ('modules.install', 'Install Modules', 'core'),
        ('modules.upload', 'Upload Modules', 'core'),
        ('system.health', 'View System Health', 'core');

      INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
        SELECT r.id, p.id FROM roles r, permissions p
        WHERE r.name = 'admin' AND p.key IN ('modules.install','modules.upload','system.health');
    `);
  }
};
