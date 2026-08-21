module.exports.up = function (db) {
  const columns = (table) => {
    try {
      const rows = db.exec(`PRAGMA table_info(${table})`);
      return (rows?.[0]?.values || []).map(r => r[1]);
    } catch (_) { return []; }
  };

  const identityCols = columns('access_identities');
  if (!identityCols.includes('employee_id')) {
    db.run(`ALTER TABLE access_identities ADD COLUMN employee_id INTEGER`);
  }

  const eventCols = columns('access_events');
  if (!eventCols.includes('employee_id')) {
    db.run(`ALTER TABLE access_events ADD COLUMN employee_id INTEGER`);
  }

  db.run(`CREATE INDEX IF NOT EXISTS idx_access_identities_employee ON access_identities(employee_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_access_events_employee ON access_events(employee_id)`);

  try {
    const existing = db.exec("SELECT id FROM settings WHERE key='access_control.allow_employee_attendance'");
    if (!existing.length || !existing[0].values.length) {
      db.run(`INSERT INTO settings (key, value, type, module, label, created_at, updated_at) VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))`, ['access_control.allow_employee_attendance', 'true', 'boolean', 'access-control', 'Create Employee Attendance on Success']);
    }
  } catch (_) {}

  try {
    db.run(`UPDATE hr_employees
      SET badge_id = (
        SELECT ai.code FROM access_identities ai
        WHERE ai.employee_id = hr_employees.id
        ORDER BY ai.id DESC LIMIT 1
      )
      WHERE EXISTS (
        SELECT 1 FROM access_identities ai
        WHERE ai.employee_id = hr_employees.id
      )
      AND (badge_id IS NULL OR badge_id = '')`);
  } catch (_) {}
};

module.exports.down = function () {
  // SQLite rollback for added columns is intentionally skipped.
};
