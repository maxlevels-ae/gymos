module.exports = {
  up(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS po_vendors (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT UNIQUE,
        name TEXT NOT NULL,
        name_ar TEXT DEFAULT '',
        email TEXT DEFAULT '',
        phone TEXT DEFAULT '',
        mobile TEXT DEFAULT '',
        contact_name TEXT DEFAULT '',
        address TEXT DEFAULT '',
        city TEXT DEFAULT '',
        country TEXT DEFAULT '',
        tax_number TEXT DEFAULT '',
        payment_terms INTEGER DEFAULT 30,
        currency TEXT DEFAULT 'JOD',
        bank_name TEXT DEFAULT '',
        bank_account TEXT DEFAULT '',
        bank_iban TEXT DEFAULT '',
        notes TEXT DEFAULT '',
        is_active INTEGER DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS po_products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT UNIQUE,
        name TEXT NOT NULL,
        name_ar TEXT DEFAULT '',
        description TEXT DEFAULT '',
        category TEXT DEFAULT 'general',
        uom TEXT DEFAULT 'unit',
        standard_price REAL DEFAULT 0,
        last_purchase_price REAL DEFAULT 0,
        min_qty REAL DEFAULT 0,
        reorder_qty REAL DEFAULT 0,
        on_hand_qty REAL DEFAULT 0,
        tax_rate REAL DEFAULT 0,
        notes TEXT DEFAULT '',
        is_active INTEGER DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS po_vendor_pricelists (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        vendor_id INTEGER NOT NULL REFERENCES po_vendors(id),
        product_id INTEGER NOT NULL REFERENCES po_products(id),
        vendor_product_code TEXT DEFAULT '',
        price REAL NOT NULL DEFAULT 0,
        min_qty REAL DEFAULT 1,
        lead_days INTEGER DEFAULT 7,
        valid_from TEXT,
        valid_to TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS po_orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        po_number TEXT UNIQUE NOT NULL,
        order_type TEXT DEFAULT 'rfq',
        state TEXT DEFAULT 'draft',
        vendor_id INTEGER REFERENCES po_vendors(id),
        vendor_name TEXT DEFAULT '',
        branch_id INTEGER,
        order_date TEXT NOT NULL,
        expected_date TEXT,
        confirmed_date TEXT,
        received_date TEXT,
        currency TEXT DEFAULT 'JOD',
        payment_terms INTEGER DEFAULT 30,
        subtotal REAL DEFAULT 0,
        tax_amount REAL DEFAULT 0,
        discount_amount REAL DEFAULT 0,
        total_amount REAL DEFAULT 0,
        amount_billed REAL DEFAULT 0,
        notes TEXT DEFAULT '',
        internal_notes TEXT DEFAULT '',
        source_reference TEXT DEFAULT '',
        billing_status TEXT DEFAULT 'nothing',
        receipt_status TEXT DEFAULT 'pending',
        approved_by INTEGER,
        approved_at TEXT,
        cancelled_by INTEGER,
        cancel_reason TEXT DEFAULT '',
        created_by INTEGER,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS po_order_lines (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL REFERENCES po_orders(id) ON DELETE CASCADE,
        product_id INTEGER REFERENCES po_products(id),
        description TEXT NOT NULL DEFAULT '',
        uom TEXT DEFAULT 'unit',
        qty_ordered REAL DEFAULT 0,
        qty_received REAL DEFAULT 0,
        qty_billed REAL DEFAULT 0,
        unit_price REAL DEFAULT 0,
        discount_pct REAL DEFAULT 0,
        tax_rate REAL DEFAULT 0,
        line_subtotal REAL DEFAULT 0,
        line_total REAL DEFAULT 0,
        expected_date TEXT,
        notes TEXT DEFAULT '',
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS po_receipts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        receipt_number TEXT UNIQUE NOT NULL,
        order_id INTEGER NOT NULL REFERENCES po_orders(id),
        vendor_id INTEGER REFERENCES po_vendors(id),
        vendor_name TEXT DEFAULT '',
        receipt_date TEXT NOT NULL,
        state TEXT DEFAULT 'draft',
        notes TEXT DEFAULT '',
        created_by INTEGER,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS po_receipt_lines (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        receipt_id INTEGER NOT NULL REFERENCES po_receipts(id) ON DELETE CASCADE,
        order_line_id INTEGER NOT NULL REFERENCES po_order_lines(id),
        product_id INTEGER,
        description TEXT DEFAULT '',
        qty_done REAL DEFAULT 0,
        uom TEXT DEFAULT 'unit',
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS po_bills (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        bill_number TEXT UNIQUE NOT NULL,
        order_id INTEGER REFERENCES po_orders(id),
        vendor_id INTEGER REFERENCES po_vendors(id),
        vendor_name TEXT DEFAULT '',
        invoice_date TEXT NOT NULL,
        due_date TEXT,
        state TEXT DEFAULT 'draft',
        subtotal REAL DEFAULT 0,
        tax_amount REAL DEFAULT 0,
        total_amount REAL DEFAULT 0,
        residual_amount REAL DEFAULT 0,
        notes TEXT DEFAULT '',
        accounting_invoice_id INTEGER,
        created_by INTEGER,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS po_bill_lines (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        bill_id INTEGER NOT NULL REFERENCES po_bills(id) ON DELETE CASCADE,
        order_line_id INTEGER REFERENCES po_order_lines(id),
        product_id INTEGER,
        description TEXT DEFAULT '',
        qty REAL DEFAULT 0,
        unit_price REAL DEFAULT 0,
        tax_rate REAL DEFAULT 0,
        line_subtotal REAL DEFAULT 0,
        line_total REAL DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now'))
      );
    `);
  },
  down(db) {
    db.exec(`
      DROP TABLE IF EXISTS po_bill_lines;
      DROP TABLE IF EXISTS po_bills;
      DROP TABLE IF EXISTS po_receipt_lines;
      DROP TABLE IF EXISTS po_receipts;
      DROP TABLE IF EXISTS po_order_lines;
      DROP TABLE IF EXISTS po_orders;
      DROP TABLE IF EXISTS po_vendor_pricelists;
      DROP TABLE IF EXISTS po_products;
      DROP TABLE IF EXISTS po_vendors;
    `);
  }
};
