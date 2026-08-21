module.exports = {
  up(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS sdk_example (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT DEFAULT '',
        is_active INTEGER DEFAULT 1,
        created_by INTEGER,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );

      INSERT OR IGNORE INTO permissions (key, display_name, module) VALUES
        ('sdk_example.view', 'View sdk-example', 'sdk-example'),
        ('sdk_example.create', 'Create sdk-example', 'sdk-example'),
        ('sdk_example.edit', 'Edit sdk-example', 'sdk-example'),
        ('sdk_example.delete', 'Delete sdk-example', 'sdk-example');

      INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
        SELECT r.id, p.id FROM roles r, permissions p
        WHERE r.name = 'admin' AND p.module = 'sdk-example';
    `);
  },

  // Optional: rollback migration
  down(db) {
    db.exec('DROP TABLE IF EXISTS sdk_example');
  }
};
