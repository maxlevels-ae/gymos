module.exports = {
  up({ db }) {
    try { db.run(`DROP INDEX IF EXISTS idx_memberships_member_unique`); } catch (_) {}
    try {
      db.run(`CREATE TABLE IF NOT EXISTS membership_refunds (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        membership_id INTEGER NOT NULL,
        member_id INTEGER NOT NULL,
        refund_date TEXT NOT NULL,
        amount REAL NOT NULL DEFAULT 0,
        method TEXT NOT NULL DEFAULT 'cash',
        reason TEXT DEFAULT '',
        accounting_invoice_id INTEGER,
        accounting_payment_id INTEGER,
        created_by INTEGER,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY(membership_id) REFERENCES memberships(id) ON DELETE CASCADE,
        FOREIGN KEY(member_id) REFERENCES members(id) ON DELETE CASCADE
      )`);
    } catch (_) {}
    try { db.run(`CREATE INDEX IF NOT EXISTS idx_membership_refunds_membership ON membership_refunds(membership_id)`); } catch (_) {}
    try { db.run(`CREATE INDEX IF NOT EXISTS idx_membership_refunds_member ON membership_refunds(member_id)`); } catch (_) {}
  },
  down({ db }) {
    try { db.run(`DROP TABLE IF EXISTS membership_refunds`); } catch (_) {}
  }
};
