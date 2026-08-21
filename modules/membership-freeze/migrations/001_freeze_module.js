module.exports = {
  up(db) {
    db.exec(`
      -- Core freeze requests table (owned by this module)
      CREATE TABLE IF NOT EXISTS freeze_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        membership_id INTEGER NOT NULL,
        member_id INTEGER NOT NULL,
        start_date TEXT NOT NULL,
        end_date TEXT NOT NULL,
        total_days INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        reason TEXT DEFAULT '',
        price REAL DEFAULT 0,
        payment_status TEXT DEFAULT 'unpaid',
        payment_method TEXT DEFAULT '',
        paid_at TEXT,
        membership_end_before TEXT,
        membership_end_after TEXT,
        cancelled_at TEXT,
        cancel_reason TEXT DEFAULT '',
        completed_at TEXT,
        created_by INTEGER,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (membership_id) REFERENCES memberships(id),
        FOREIGN KEY (member_id) REFERENCES members(id)
      );

      -- Payment log for freeze transactions
      CREATE TABLE IF NOT EXISTS freeze_payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        freeze_id INTEGER NOT NULL,
        amount REAL NOT NULL,
        method TEXT NOT NULL DEFAULT 'cash',
        reference TEXT DEFAULT '',
        status TEXT DEFAULT 'completed',
        notes TEXT DEFAULT '',
        received_by INTEGER,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (freeze_id) REFERENCES freeze_requests(id)
      );

      CREATE INDEX IF NOT EXISTS idx_freeze_req_membership ON freeze_requests(membership_id);
      CREATE INDEX IF NOT EXISTS idx_freeze_req_member ON freeze_requests(member_id);
      CREATE INDEX IF NOT EXISTS idx_freeze_req_status ON freeze_requests(status);
      CREATE INDEX IF NOT EXISTS idx_freeze_req_dates ON freeze_requests(start_date, end_date);

      -- Permissions
      INSERT OR IGNORE INTO permissions (key, display_name, module) VALUES
        ('freeze.view', 'View Freezes', 'membership-freeze'),
        ('freeze.create', 'Create Freezes', 'membership-freeze'),
        ('freeze.manage', 'Manage Freezes', 'membership-freeze'),
        ('freeze.settings', 'Freeze Settings', 'membership-freeze');

      INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
        SELECT r.id, p.id FROM roles r, permissions p
        WHERE r.name = 'admin' AND p.module = 'membership-freeze';

      -- Default freeze rule settings
      INSERT OR IGNORE INTO settings (key, value, type, module, label) VALUES
        ('freeze.max_days_per_membership', '30', 'number', 'membership-freeze', 'Max freeze days per membership'),
        ('freeze.max_times', '3', 'number', 'membership-freeze', 'Max freeze count per membership'),
        ('freeze.min_days', '3', 'number', 'membership-freeze', 'Minimum freeze duration (days)'),
        ('freeze.max_days_single', '15', 'number', 'membership-freeze', 'Max days per single freeze'),
        ('freeze.require_payment', 'false', 'boolean', 'membership-freeze', 'Require payment for freeze'),
        ('freeze.pricing_mode', 'per_day', 'string', 'membership-freeze', 'Pricing mode (per_day or fixed)'),
        ('freeze.price_per_day', '1', 'number', 'membership-freeze', 'Price per freeze day'),
        ('freeze.fixed_price', '10', 'number', 'membership-freeze', 'Fixed freeze price'),
        ('freeze.currency', 'JOD', 'string', 'membership-freeze', 'Freeze payment currency');
    `);
  },

  down(db) {
    db.exec(`
      DROP TABLE IF EXISTS freeze_payments;
      DROP TABLE IF EXISTS freeze_requests;
      DELETE FROM settings WHERE module = 'membership-freeze';
      DELETE FROM permissions WHERE module = 'membership-freeze';
    `);
  }
};
