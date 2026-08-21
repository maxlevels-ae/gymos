module.exports = {
  up(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS class_types (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL, name_ar TEXT DEFAULT '', description TEXT DEFAULT '',
        color TEXT DEFAULT '#3b82f6', duration_minutes INTEGER DEFAULT 60,
        max_capacity INTEGER DEFAULT 20, requires_booking INTEGER DEFAULT 1,
        branch_id INTEGER, is_active INTEGER DEFAULT 1, created_at TEXT DEFAULT (datetime('now'))
      );
      CREATE TABLE IF NOT EXISTS class_schedule (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        class_type_id INTEGER NOT NULL, trainer_id INTEGER, branch_id INTEGER,
        title TEXT DEFAULT '', day_of_week INTEGER, start_time TEXT NOT NULL, end_time TEXT NOT NULL,
        date TEXT, max_capacity INTEGER DEFAULT 20, is_recurring INTEGER DEFAULT 1,
        status TEXT DEFAULT 'active', notes TEXT DEFAULT '', created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (class_type_id) REFERENCES class_types(id)
      );
      CREATE TABLE IF NOT EXISTS class_bookings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        schedule_id INTEGER NOT NULL, member_id INTEGER NOT NULL,
        booking_date TEXT NOT NULL, status TEXT DEFAULT 'confirmed',
        is_waitlist INTEGER DEFAULT 0, checked_in INTEGER DEFAULT 0,
        cancelled_at TEXT, cancel_reason TEXT DEFAULT '', created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (schedule_id) REFERENCES class_schedule(id),
        FOREIGN KEY (member_id) REFERENCES members(id)
      );
      CREATE INDEX IF NOT EXISTS idx_bookings_date ON class_bookings(booking_date);
      CREATE INDEX IF NOT EXISTS idx_bookings_member ON class_bookings(member_id);
      INSERT OR IGNORE INTO permissions (key, display_name, module) VALUES
        ('schedule.view', 'View Schedule', 'scheduling'),
        ('schedule.manage', 'Manage Schedule', 'scheduling'),
        ('bookings.view', 'View Bookings', 'scheduling'),
        ('bookings.manage', 'Manage Bookings', 'scheduling');
      INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
        SELECT r.id, p.id FROM roles r, permissions p WHERE r.name = 'admin' AND p.module = 'scheduling';
    `);
  }
};
