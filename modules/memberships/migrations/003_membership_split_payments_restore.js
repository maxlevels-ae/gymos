module.exports.up = function (db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS membership_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      membership_id INTEGER NOT NULL,
      member_id INTEGER NOT NULL,
      payment_date TEXT NOT NULL,
      amount REAL NOT NULL DEFAULT 0,
      method TEXT NOT NULL DEFAULT 'cash',
      reference TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      accounting_payment_id INTEGER,
      created_by INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY(membership_id) REFERENCES memberships(id) ON DELETE CASCADE,
      FOREIGN KEY(member_id) REFERENCES members(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_membership_payments_membership ON membership_payments(membership_id);
    CREATE INDEX IF NOT EXISTS idx_membership_payments_member ON membership_payments(member_id);
  `);
};
