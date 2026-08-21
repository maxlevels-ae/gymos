module.exports = {
  up(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS announcements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL, title_ar TEXT DEFAULT '', body TEXT DEFAULT '', body_ar TEXT DEFAULT '',
        type TEXT DEFAULT 'info', priority TEXT DEFAULT 'normal',
        target_audience TEXT DEFAULT 'all', branch_id INTEGER,
        is_published INTEGER DEFAULT 0, published_at TEXT, expires_at TEXT,
        created_by INTEGER, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))
      );
      CREATE TABLE IF NOT EXISTS engagement_rules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL, description TEXT DEFAULT '',
        trigger_type TEXT NOT NULL, trigger_config TEXT DEFAULT '{}',
        action_type TEXT NOT NULL, action_config TEXT DEFAULT '{}',
        is_active INTEGER DEFAULT 1, last_run TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );
      INSERT OR IGNORE INTO permissions (key, display_name, module) VALUES
        ('engagement.view', 'View Engagement', 'engagement'),
        ('engagement.manage', 'Manage Engagement', 'engagement'),
        ('announcements.manage', 'Manage Announcements', 'engagement');
      INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
        SELECT r.id, p.id FROM roles r, permissions p WHERE r.name = 'admin' AND p.module = 'engagement';
    `);
  }
};
