module.exports = {
  up(db) {
    const safe = (sql) => { try { db.exec(sql); } catch (_) {} };

    safe(`ALTER TABLE accounting_invoices ADD COLUMN document_kind TEXT DEFAULT 'invoice'`);
    safe(`ALTER TABLE accounting_invoices ADD COLUMN business_line TEXT DEFAULT 'other'`);
    safe(`ALTER TABLE accounting_invoices ADD COLUMN source_reference TEXT DEFAULT ''`);

    safe(`ALTER TABLE accounting_payments ADD COLUMN payment_category TEXT DEFAULT 'customer'`);
    safe(`ALTER TABLE accounting_payments ADD COLUMN destination_journal_id INTEGER`);
    safe(`ALTER TABLE accounting_payments ADD COLUMN source_journal_id INTEGER`);

    safe(`
      CREATE TABLE IF NOT EXISTS accounting_payment_methods (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        name_ar TEXT DEFAULT '',
        payment_type TEXT NOT NULL DEFAULT 'mixed',
        is_split_allowed INTEGER DEFAULT 0,
        is_active INTEGER DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `);

    safe(`CREATE INDEX IF NOT EXISTS idx_accounting_invoice_kind ON accounting_invoices(invoice_type, document_kind, state)`);
    safe(`CREATE INDEX IF NOT EXISTS idx_accounting_invoice_business_line ON accounting_invoices(business_line)`);
    safe(`CREATE INDEX IF NOT EXISTS idx_accounting_payments_category ON accounting_payments(payment_category)`);

    db.exec(`
      INSERT OR IGNORE INTO accounting_payment_methods (code, name, name_ar, payment_type, is_split_allowed, is_active) VALUES
      ('cash', 'Cash', 'نقدي', 'cash', 1, 1),
      ('bank', 'Bank', 'بنكي', 'bank', 0, 1),
      ('card', 'Card', 'بطاقة', 'card', 1, 1),
      ('visa', 'Visa', 'فيزا', 'card', 1, 1),
      ('click', 'CliQ', 'كليك', 'bank', 1, 1),
      ('mixed', 'Split Payment', 'دفع مقسم', 'mixed', 1, 1)
    `);

    db.exec(`
      UPDATE accounting_invoices
      SET document_kind = CASE
        WHEN invoice_type='vendor' THEN 'bill'
        ELSE 'invoice'
      END
      WHERE document_kind IS NULL OR document_kind = ''
    `);

    db.exec(`
      UPDATE accounting_payments
      SET payment_category = CASE
        WHEN payment_direction='outbound' THEN 'vendor'
        ELSE 'customer'
      END
      WHERE payment_category IS NULL OR payment_category = ''
    `);
  }
};
