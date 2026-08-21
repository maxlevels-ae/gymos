
module.exports = {
  up(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS accounting_accounts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        name_ar TEXT DEFAULT '',
        account_type TEXT NOT NULL,
        parent_id INTEGER,
        allow_reconcile INTEGER DEFAULT 0,
        is_active INTEGER DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY(parent_id) REFERENCES accounting_accounts(id)
      );

      CREATE TABLE IF NOT EXISTS accounting_journals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        name_ar TEXT DEFAULT '',
        journal_type TEXT NOT NULL,
        default_debit_account_id INTEGER,
        default_credit_account_id INTEGER,
        is_active INTEGER DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY(default_debit_account_id) REFERENCES accounting_accounts(id),
        FOREIGN KEY(default_credit_account_id) REFERENCES accounting_accounts(id)
      );

      CREATE TABLE IF NOT EXISTS accounting_taxes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        name_ar TEXT DEFAULT '',
        rate REAL NOT NULL DEFAULT 0,
        tax_scope TEXT NOT NULL DEFAULT 'sale',
        price_include INTEGER DEFAULT 0,
        is_active INTEGER DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS accounting_entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entry_no TEXT NOT NULL UNIQUE,
        journal_id INTEGER NOT NULL,
        entry_date TEXT NOT NULL,
        reference TEXT DEFAULT '',
        memo TEXT DEFAULT '',
        state TEXT NOT NULL DEFAULT 'draft',
        source_module TEXT DEFAULT '',
        source_model TEXT DEFAULT '',
        source_id TEXT DEFAULT '',
        created_by INTEGER,
        created_at TEXT DEFAULT (datetime('now')),
        posted_at TEXT,
        FOREIGN KEY(journal_id) REFERENCES accounting_journals(id),
        FOREIGN KEY(created_by) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS accounting_entry_lines (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entry_id INTEGER NOT NULL,
        account_id INTEGER NOT NULL,
        label TEXT DEFAULT '',
        partner_name TEXT DEFAULT '',
        debit REAL NOT NULL DEFAULT 0,
        credit REAL NOT NULL DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY(entry_id) REFERENCES accounting_entries(id) ON DELETE CASCADE,
        FOREIGN KEY(account_id) REFERENCES accounting_accounts(id)
      );

      CREATE TABLE IF NOT EXISTS accounting_invoices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        invoice_no TEXT NOT NULL UNIQUE,
        invoice_type TEXT NOT NULL DEFAULT 'customer',
        partner_name TEXT NOT NULL,
        invoice_date TEXT NOT NULL,
        due_date TEXT,
        state TEXT NOT NULL DEFAULT 'draft',
        subtotal REAL NOT NULL DEFAULT 0,
        tax_amount REAL NOT NULL DEFAULT 0,
        total_amount REAL NOT NULL DEFAULT 0,
        residual_amount REAL NOT NULL DEFAULT 0,
        journal_id INTEGER,
        notes TEXT DEFAULT '',
        created_by INTEGER,
        created_at TEXT DEFAULT (datetime('now')),
        posted_at TEXT,
        FOREIGN KEY(journal_id) REFERENCES accounting_journals(id),
        FOREIGN KEY(created_by) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS accounting_invoice_lines (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        invoice_id INTEGER NOT NULL,
        description TEXT NOT NULL,
        quantity REAL NOT NULL DEFAULT 1,
        unit_price REAL NOT NULL DEFAULT 0,
        tax_rate REAL NOT NULL DEFAULT 0,
        line_subtotal REAL NOT NULL DEFAULT 0,
        line_total REAL NOT NULL DEFAULT 0,
        revenue_account_id INTEGER,
        expense_account_id INTEGER,
        FOREIGN KEY(invoice_id) REFERENCES accounting_invoices(id) ON DELETE CASCADE,
        FOREIGN KEY(revenue_account_id) REFERENCES accounting_accounts(id),
        FOREIGN KEY(expense_account_id) REFERENCES accounting_accounts(id)
      );

      CREATE TABLE IF NOT EXISTS accounting_payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        payment_no TEXT NOT NULL UNIQUE,
        payment_direction TEXT NOT NULL,
        partner_name TEXT DEFAULT '',
        journal_id INTEGER NOT NULL,
        payment_date TEXT NOT NULL,
        amount REAL NOT NULL DEFAULT 0,
        method TEXT NOT NULL DEFAULT 'cash',
        state TEXT NOT NULL DEFAULT 'posted',
        memo TEXT DEFAULT '',
        invoice_id INTEGER,
        created_by INTEGER,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY(journal_id) REFERENCES accounting_journals(id),
        FOREIGN KEY(invoice_id) REFERENCES accounting_invoices(id),
        FOREIGN KEY(created_by) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS accounting_localization_templates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        region TEXT NOT NULL,
        country_code TEXT NOT NULL,
        template_key TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        UNIQUE(country_code, template_key)
      );

      CREATE INDEX IF NOT EXISTS idx_accounting_entries_journal_date ON accounting_entries(journal_id, entry_date);
      CREATE INDEX IF NOT EXISTS idx_accounting_invoice_state ON accounting_invoices(invoice_type, state);
      CREATE INDEX IF NOT EXISTS idx_accounting_payment_invoice ON accounting_payments(invoice_id);

      INSERT OR IGNORE INTO permissions (key, display_name, module) VALUES
        ('accounting.view', 'View Accounting', 'accounting'),
        ('accounting.manage_settings', 'Manage Accounting Settings', 'accounting'),
        ('accounting.manage_accounts', 'Manage Accounts', 'accounting'),
        ('accounting.manage_journals', 'Manage Journals', 'accounting'),
        ('accounting.manage_entries', 'Manage Journal Entries', 'accounting'),
        ('accounting.manage_invoices', 'Manage Invoices & Bills', 'accounting'),
        ('accounting.manage_bills', 'Manage Vendor Bills', 'accounting'),
        ('accounting.manage_payments', 'Manage Payments', 'accounting'),
        ('accounting.view_reports', 'View Accounting Reports', 'accounting');

      INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
        SELECT r.id, p.id FROM roles r, permissions p
        WHERE r.name = 'admin' AND p.module = 'accounting';
    `);
  }
};
