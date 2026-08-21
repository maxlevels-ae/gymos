module.exports = {
  up(db) {
    const safe = (sql) => { try { db.exec(sql); } catch (_) {} };

    safe(`ALTER TABLE membership_plans ADD COLUMN freeze_pricing_mode TEXT DEFAULT 'inherit'`);
    safe(`ALTER TABLE membership_plans ADD COLUMN freeze_price_per_day REAL DEFAULT 0`);
    safe(`ALTER TABLE membership_plans ADD COLUMN freeze_fixed_price REAL DEFAULT 0`);
    safe(`ALTER TABLE membership_plans ADD COLUMN freeze_requires_approval INTEGER DEFAULT 0`);
    safe(`ALTER TABLE membership_plans ADD COLUMN freeze_allow_pwa_request INTEGER DEFAULT 1`);
    safe(`ALTER TABLE membership_plans ADD COLUMN freeze_allow_pwa_unfreeze INTEGER DEFAULT 1`);

    safe(`ALTER TABLE freeze_requests ADD COLUMN request_source TEXT DEFAULT 'admin'`);
    safe(`ALTER TABLE freeze_requests ADD COLUMN approval_status TEXT DEFAULT 'approved'`);
    safe(`ALTER TABLE freeze_requests ADD COLUMN approved_by INTEGER`);
    safe(`ALTER TABLE freeze_requests ADD COLUMN approved_at TEXT`);
    safe(`ALTER TABLE freeze_requests ADD COLUMN receipt_no TEXT`);
    safe(`ALTER TABLE freeze_requests ADD COLUMN unfreeze_requested_at TEXT`);
    safe(`ALTER TABLE freeze_requests ADD COLUMN unfreeze_requested_by INTEGER`);
    safe(`ALTER TABLE freeze_requests ADD COLUMN unfreeze_reason TEXT DEFAULT ''`);
    safe(`ALTER TABLE freeze_requests ADD COLUMN refunded_amount REAL DEFAULT 0`);
    safe(`ALTER TABLE freeze_requests ADD COLUMN refund_status TEXT DEFAULT 'none'`);

    safe(`ALTER TABLE freeze_payments ADD COLUMN accounting_payment_id INTEGER`);
    safe(`ALTER TABLE freeze_payments ADD COLUMN payment_no TEXT`);
    safe(`ALTER TABLE freeze_payments ADD COLUMN change_amount REAL DEFAULT 0`);
    safe(`ALTER TABLE freeze_payments ADD COLUMN direction TEXT DEFAULT 'in'`);

    safe(`INSERT OR IGNORE INTO settings (key, value, type, module, label) VALUES
      ('freeze.pwa_requests_enabled', 'true', 'boolean', 'membership-freeze', 'Enable freeze requests from member app'),
      ('freeze.pwa_unfreeze_enabled', 'true', 'boolean', 'membership-freeze', 'Enable unfreeze requests from member app'),
      ('freeze.auto_approve_admin_created', 'true', 'boolean', 'membership-freeze', 'Auto approve admin created freeze'),
      ('freeze.receipt_prefix', 'FRZ-', 'string', 'membership-freeze', 'Freeze receipt prefix')
    `);
  }
};