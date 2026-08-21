// Migration 002 — Safely add any columns that may be missing from po_orders
// if the table was created by a previous version without all fields.
// Uses ALTER TABLE ADD COLUMN which is idempotent-safe (we catch errors per column).
module.exports = {
  up(db) {
    const columns = [
      "ALTER TABLE po_orders ADD COLUMN state TEXT DEFAULT 'draft'",
      "ALTER TABLE po_orders ADD COLUMN order_type TEXT DEFAULT 'rfq'",
      "ALTER TABLE po_orders ADD COLUMN vendor_name TEXT DEFAULT ''",
      "ALTER TABLE po_orders ADD COLUMN branch_id INTEGER",
      "ALTER TABLE po_orders ADD COLUMN expected_date TEXT",
      "ALTER TABLE po_orders ADD COLUMN confirmed_date TEXT",
      "ALTER TABLE po_orders ADD COLUMN received_date TEXT",
      "ALTER TABLE po_orders ADD COLUMN currency TEXT DEFAULT 'JOD'",
      "ALTER TABLE po_orders ADD COLUMN payment_terms INTEGER DEFAULT 30",
      "ALTER TABLE po_orders ADD COLUMN subtotal REAL DEFAULT 0",
      "ALTER TABLE po_orders ADD COLUMN tax_amount REAL DEFAULT 0",
      "ALTER TABLE po_orders ADD COLUMN discount_amount REAL DEFAULT 0",
      "ALTER TABLE po_orders ADD COLUMN total_amount REAL DEFAULT 0",
      "ALTER TABLE po_orders ADD COLUMN amount_billed REAL DEFAULT 0",
      "ALTER TABLE po_orders ADD COLUMN notes TEXT DEFAULT ''",
      "ALTER TABLE po_orders ADD COLUMN internal_notes TEXT DEFAULT ''",
      "ALTER TABLE po_orders ADD COLUMN source_reference TEXT DEFAULT ''",
      "ALTER TABLE po_orders ADD COLUMN billing_status TEXT DEFAULT 'nothing'",
      "ALTER TABLE po_orders ADD COLUMN receipt_status TEXT DEFAULT 'pending'",
      "ALTER TABLE po_orders ADD COLUMN approved_by INTEGER",
      "ALTER TABLE po_orders ADD COLUMN approved_at TEXT",
      "ALTER TABLE po_orders ADD COLUMN cancelled_by INTEGER",
      "ALTER TABLE po_orders ADD COLUMN cancel_reason TEXT DEFAULT ''",
      "ALTER TABLE po_orders ADD COLUMN created_by INTEGER",
      "ALTER TABLE po_orders ADD COLUMN updated_at TEXT DEFAULT (datetime('now'))",
    ];

    for (const sql of columns) {
      try { db.exec(sql); } catch (_) { /* column already exists — safe to ignore */ }
    }

    // Also patch po_order_lines missing columns
    const lineColumns = [
      "ALTER TABLE po_order_lines ADD COLUMN qty_received REAL DEFAULT 0",
      "ALTER TABLE po_order_lines ADD COLUMN qty_billed REAL DEFAULT 0",
      "ALTER TABLE po_order_lines ADD COLUMN discount_pct REAL DEFAULT 0",
      "ALTER TABLE po_order_lines ADD COLUMN line_subtotal REAL DEFAULT 0",
      "ALTER TABLE po_order_lines ADD COLUMN line_total REAL DEFAULT 0",
      "ALTER TABLE po_order_lines ADD COLUMN expected_date TEXT",
      "ALTER TABLE po_order_lines ADD COLUMN notes TEXT DEFAULT ''",
    ];
    for (const sql of lineColumns) {
      try { db.exec(sql); } catch (_) {}
    }

    // Patch po_bills missing columns
    const billColumns = [
      "ALTER TABLE po_bills ADD COLUMN residual_amount REAL DEFAULT 0",
      "ALTER TABLE po_bills ADD COLUMN accounting_invoice_id INTEGER",
    ];
    for (const sql of billColumns) {
      try { db.exec(sql); } catch (_) {}
    }
  },
  down() {}
};
