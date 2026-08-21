/**
 * Core migration: Creates all foundational tables
 */
module.exports = {
  up(db) {
    db.exec(`
      -- Migration tracking
      CREATE TABLE IF NOT EXISTS _migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key TEXT UNIQUE NOT NULL,
        module TEXT NOT NULL DEFAULT 'core',
        ran_at TEXT NOT NULL
      );

      -- Users (admin/staff accounts)
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        full_name TEXT NOT NULL DEFAULT '',
        role_id INTEGER,
        branch_id INTEGER,
        avatar TEXT,
        locale TEXT DEFAULT 'en',
        is_active INTEGER DEFAULT 1,
        last_login TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );

      -- Roles
      CREATE TABLE IF NOT EXISTS roles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        display_name TEXT NOT NULL DEFAULT '',
        description TEXT DEFAULT '',
        is_system INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now'))
      );

      -- Permissions
      CREATE TABLE IF NOT EXISTS permissions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key TEXT UNIQUE NOT NULL,
        display_name TEXT NOT NULL DEFAULT '',
        module TEXT DEFAULT 'core',
        created_at TEXT DEFAULT (datetime('now'))
      );

      -- Role-Permission pivot
      CREATE TABLE IF NOT EXISTS role_permissions (
        role_id INTEGER NOT NULL,
        permission_id INTEGER NOT NULL,
        PRIMARY KEY (role_id, permission_id)
      );

      -- Module Registry
      CREATE TABLE IF NOT EXISTS modules_registry (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        version TEXT NOT NULL DEFAULT '1.0.0',
        description TEXT DEFAULT '',
        author TEXT DEFAULT '',
        enabled INTEGER DEFAULT 1,
        meta TEXT DEFAULT '{}',
        installed_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );

      -- Settings (key-value store)
      CREATE TABLE IF NOT EXISTS settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key TEXT UNIQUE NOT NULL,
        value TEXT DEFAULT '',
        type TEXT DEFAULT 'string',
        module TEXT DEFAULT 'core',
        label TEXT DEFAULT '',
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );

      -- Activity Logs
      CREATE TABLE IF NOT EXISTS activity_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        action TEXT NOT NULL,
        entity_type TEXT,
        entity_id INTEGER,
        details TEXT DEFAULT '{}',
        ip_address TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );

      -- Notifications
      CREATE TABLE IF NOT EXISTS notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        title TEXT NOT NULL,
        body TEXT DEFAULT '',
        type TEXT DEFAULT 'info',
        is_read INTEGER DEFAULT 0,
        link TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );

      -- Attachments (shared file references)
      CREATE TABLE IF NOT EXISTS attachments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entity_type TEXT NOT NULL,
        entity_id INTEGER NOT NULL,
        filename TEXT NOT NULL,
        original_name TEXT NOT NULL,
        mime_type TEXT,
        size INTEGER DEFAULT 0,
        path TEXT NOT NULL,
        uploaded_by INTEGER,
        created_at TEXT DEFAULT (datetime('now'))
      );

      -- Scheduled Jobs
      CREATE TABLE IF NOT EXISTS scheduled_jobs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        module TEXT DEFAULT 'core',
        cron_expression TEXT,
        handler TEXT NOT NULL,
        is_active INTEGER DEFAULT 1,
        last_run TEXT,
        next_run TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );

      -- Insert default roles
      INSERT OR IGNORE INTO roles (name, display_name, description, is_system) VALUES
        ('admin', 'Administrator', 'Full system access', 1),
        ('manager', 'Manager', 'Branch manager', 1),
        ('staff', 'Staff', 'Regular staff', 1),
        ('trainer', 'Trainer', 'Gym trainer', 1);

      -- Insert core permissions
      INSERT OR IGNORE INTO permissions (key, display_name, module) VALUES
        ('system.manage', 'Manage System', 'core'),
        ('users.view', 'View Users', 'core'),
        ('users.create', 'Create Users', 'core'),
        ('users.edit', 'Edit Users', 'core'),
        ('users.delete', 'Delete Users', 'core'),
        ('roles.manage', 'Manage Roles', 'core'),
        ('settings.manage', 'Manage Settings', 'core'),
        ('modules.manage', 'Manage Modules', 'core'),
        ('activity.view', 'View Activity Logs', 'core');

      -- Give admin all permissions
      INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
        SELECT r.id, p.id FROM roles r, permissions p WHERE r.name = 'admin';

      -- Insert default settings
      INSERT OR IGNORE INTO settings (key, value, type, module, label) VALUES
        ('app.name', 'GymOS', 'string', 'core', 'Application Name'),
        ('app.locale', 'en', 'string', 'core', 'Default Language'),
        ('app.dir', 'auto', 'string', 'core', 'Text Direction'),
        ('app.timezone', 'Asia/Amman', 'string', 'core', 'Timezone'),
        ('app.currency', 'JOD', 'string', 'core', 'Currency'),
        ('app.date_format', 'YYYY-MM-DD', 'string', 'core', 'Date Format'),
        ('system.module_uploads_enabled', 'true', 'boolean', 'core', 'Allow module uploads'),
        ('system.auto_complete_freezes', 'true', 'boolean', 'core', 'Auto-complete membership freezes'),
        ('notifications.in_app.enabled', 'true', 'boolean', 'core', 'In-app notifications enabled'),
        ('notifications.email.enabled', 'false', 'boolean', 'core', 'Email notifications enabled');
    `);
  }
};
