module.exports = {
  up(db) {
    const safe = (sql) => { try { db.exec(sql); } catch (_) {} };

    safe(`
      CREATE TABLE IF NOT EXISTS membership_payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        membership_id INTEGER NOT NULL,
        member_id INTEGER,
        payment_date TEXT DEFAULT (date('now')),
        amount REAL DEFAULT 0,
        method TEXT DEFAULT 'cash',
        reference TEXT DEFAULT '',
        notes TEXT DEFAULT '',
        accounting_payment_id INTEGER,
        accounting_entry_id INTEGER,
        created_by INTEGER,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      )
    `);

    safe(`CREATE INDEX IF NOT EXISTS idx_membership_payments_membership ON membership_payments(membership_id)`);
    safe(`CREATE INDEX IF NOT EXISTS idx_membership_payments_member ON membership_payments(member_id)`);
    safe(`CREATE INDEX IF NOT EXISTS idx_membership_payments_date ON membership_payments(payment_date)`);

    // Optional columns if your route logic expects them later.
    safe(`ALTER TABLE memberships ADD COLUMN paid_amount REAL DEFAULT 0`);
    safe(`ALTER TABLE memberships ADD COLUMN outstanding_amount REAL DEFAULT 0`);

    // Backfill one payment line for legacy memberships that already have total_paid.
    // This avoids JS-side db.getAll()/db.getOne() because migrations receive raw sql.js db.
    safe(`
      INSERT INTO membership_payments (
        membership_id,
        member_id,
        payment_date,
        amount,
        method,
        reference,
        notes,
        created_at,
        updated_at
      )
      SELECT
        m.id,
        m.member_id,
        COALESCE(substr(m.created_at, 1, 10), date('now')),
        COALESCE(m.total_paid, 0),
        CASE
          WHEN lower(COALESCE(m.payment_method, '')) IN ('cash','cliq','click','visa','card','bank') THEN lower(m.payment_method)
          ELSE 'cash'
        END,
        COALESCE(m.invoice_ref, ''),
        'Backfilled from legacy membership total_paid',
        COALESCE(m.created_at, datetime('now')),
        datetime('now')
      FROM memberships m
      WHERE COALESCE(m.total_paid, 0) > 0
        AND NOT EXISTS (
          SELECT 1 FROM membership_payments mp WHERE mp.membership_id = m.id
        )
    `);

    // Normalize summary fields from payment lines.
    safe(`
      UPDATE memberships
      SET paid_amount = COALESCE((
            SELECT SUM(mp.amount)
            FROM membership_payments mp
            WHERE mp.membership_id = memberships.id
          ), 0)
    `);

    safe(`
      UPDATE memberships
      SET total_paid = COALESCE(paid_amount, total_paid, 0)
    `);

    safe(`
      UPDATE memberships
      SET outstanding_amount = MAX(COALESCE(price, 0) + COALESCE(signup_fee, 0) - COALESCE(discount, 0) - COALESCE(total_paid, 0), 0)
    `);

    safe(`
      UPDATE memberships
      SET balance_due = COALESCE(outstanding_amount, balance_due, 0)
    `);

    safe(`
      UPDATE memberships
      SET payment_status = CASE
        WHEN COALESCE(total_paid, 0) <= 0 THEN 'unpaid'
        WHEN COALESCE(balance_due, 0) > 0 THEN 'partial'
        ELSE 'paid'
      END
    `);
  }
};
