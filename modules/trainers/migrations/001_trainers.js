module.exports = {
  up(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS trainers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        phone TEXT DEFAULT '',
        email TEXT DEFAULT '',
        specialization TEXT DEFAULT '',
        bio TEXT DEFAULT '',
        photo TEXT DEFAULT '',
        branch_id INTEGER,
        is_active INTEGER DEFAULT 1,
        hire_date TEXT,
        notes TEXT DEFAULT '',
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS trainer_assignments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        trainer_id INTEGER NOT NULL,
        member_id INTEGER NOT NULL,
        membership_id INTEGER,
        start_date TEXT DEFAULT (date('now')),
        end_date TEXT,
        status TEXT DEFAULT 'active',
        notes TEXT DEFAULT '',
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (trainer_id) REFERENCES trainers(id),
        FOREIGN KEY (member_id) REFERENCES members(id)
      );

      INSERT OR IGNORE INTO permissions (key, display_name, module) VALUES
        ('trainers.view', 'View Trainers', 'trainers'),
        ('trainers.create', 'Create Trainers', 'trainers'),
        ('trainers.edit', 'Edit Trainers', 'trainers'),
        ('trainers.delete', 'Delete Trainers', 'trainers');

      INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
        SELECT r.id, p.id FROM roles r, permissions p
        WHERE r.name = 'admin' AND p.module = 'trainers';
    `);
  }
};
