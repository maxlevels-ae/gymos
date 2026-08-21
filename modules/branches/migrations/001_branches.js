module.exports = {
  up(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS branches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        name_ar TEXT DEFAULT '',
        code TEXT UNIQUE,
        address TEXT DEFAULT '',
        city TEXT DEFAULT '',
        phone TEXT DEFAULT '',
        email TEXT DEFAULT '',
        manager_id INTEGER,
        is_active INTEGER DEFAULT 1,
        timezone TEXT DEFAULT 'UTC',
        opening_time TEXT DEFAULT '06:00',
        closing_time TEXT DEFAULT '23:00',
        notes TEXT DEFAULT '',
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );

      INSERT OR IGNORE INTO permissions (key, display_name, module) VALUES
        ('branches.view', 'View Branches', 'branches'),
        ('branches.create', 'Create Branches', 'branches'),
        ('branches.edit', 'Edit Branches', 'branches'),
        ('branches.delete', 'Delete Branches', 'branches');

      INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
        SELECT r.id, p.id FROM roles r, permissions p
        WHERE r.name = 'admin' AND p.module = 'branches';
    `);
  }
};
