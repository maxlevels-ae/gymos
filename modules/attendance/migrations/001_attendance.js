module.exports = {
  up(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS attendance_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        member_id INTEGER NOT NULL,
        membership_id INTEGER,
        branch_id INTEGER,
        check_in TEXT NOT NULL DEFAULT (datetime('now')),
        check_out TEXT,
        duration_minutes INTEGER DEFAULT 0,
        method TEXT DEFAULT 'manual',
        was_denied INTEGER DEFAULT 0,
        denied_reason TEXT DEFAULT '',
        checked_by INTEGER,
        notes TEXT DEFAULT '',
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_att_member ON attendance_logs(member_id);
      CREATE INDEX IF NOT EXISTS idx_att_date ON attendance_logs(check_in);
      CREATE INDEX IF NOT EXISTS idx_att_branch ON attendance_logs(branch_id);

      INSERT OR IGNORE INTO permissions (key, display_name, module) VALUES
        ('attendance.view', 'View Attendance', 'attendance'),
        ('attendance.checkin', 'Check In Members', 'attendance'),
        ('attendance.manage', 'Manage Attendance', 'attendance');
      INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
        SELECT r.id, p.id FROM roles r, permissions p WHERE r.name = 'admin' AND p.module = 'attendance';
    `);
  }
};
