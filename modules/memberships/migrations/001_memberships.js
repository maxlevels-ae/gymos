module.exports = {
  up(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS membership_plans (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        name_ar TEXT DEFAULT '',
        description TEXT DEFAULT '',
        plan_type TEXT DEFAULT 'standard',
        billing_type TEXT DEFAULT 'period',
        duration_days INTEGER DEFAULT 30,
        total_sessions INTEGER DEFAULT 0,
        price REAL DEFAULT 0,
        signup_fee REAL DEFAULT 0,
        currency TEXT DEFAULT 'JOD',
        is_recurring INTEGER DEFAULT 0,
        recurring_interval TEXT DEFAULT 'monthly',
        trial_days INTEGER DEFAULT 0,
        freeze_allowed INTEGER DEFAULT 1,
        freeze_max_days INTEGER DEFAULT 30,
        freeze_max_count INTEGER DEFAULT 2,
        auto_renew INTEGER DEFAULT 0,
        branch_id INTEGER,
        is_active INTEGER DEFAULT 1,
        features TEXT DEFAULT '[]',
        sort_order INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS memberships (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        member_id INTEGER NOT NULL,
        plan_id INTEGER,
        plan_name TEXT DEFAULT '',
        membership_type TEXT DEFAULT 'standard',
        billing_type TEXT DEFAULT 'period',
        start_date TEXT NOT NULL,
        end_date TEXT,
        total_sessions INTEGER DEFAULT 0,
        used_sessions INTEGER DEFAULT 0,
        remaining_sessions INTEGER DEFAULT 0,
        price REAL DEFAULT 0,
        signup_fee REAL DEFAULT 0,
        discount REAL DEFAULT 0,
        total_paid REAL DEFAULT 0,
        balance_due REAL DEFAULT 0,
        payment_status TEXT DEFAULT 'unpaid',
        payment_method TEXT DEFAULT '',
        status TEXT DEFAULT 'active',
        is_trial INTEGER DEFAULT 0,
        is_recurring INTEGER DEFAULT 0,
        auto_renew INTEGER DEFAULT 0,
        freeze_days_used INTEGER DEFAULT 0,
        freeze_days_allowed INTEGER DEFAULT 30,
        freeze_count INTEGER DEFAULT 0,
        freeze_max_count INTEGER DEFAULT 2,
        branch_id INTEGER,
        trainer_id INTEGER,
        notes TEXT DEFAULT '',
        invoice_ref TEXT DEFAULT '',
        contract_ref TEXT DEFAULT '',
        activated_by INTEGER,
        cancelled_at TEXT,
        cancelled_reason TEXT DEFAULT '',
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS membership_freezes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        membership_id INTEGER NOT NULL,
        member_id INTEGER NOT NULL,
        start_date TEXT NOT NULL,
        end_date TEXT,
        days INTEGER DEFAULT 0,
        reason TEXT DEFAULT '',
        status TEXT DEFAULT 'active',
        approved_by INTEGER,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (membership_id) REFERENCES memberships(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS membership_renewals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        membership_id INTEGER NOT NULL,
        member_id INTEGER NOT NULL,
        old_end_date TEXT,
        new_end_date TEXT,
        price REAL DEFAULT 0,
        renewed_by INTEGER,
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_ms_member ON memberships(member_id);
      CREATE INDEX IF NOT EXISTS idx_ms_status ON memberships(status);
      CREATE INDEX IF NOT EXISTS idx_ms_end ON memberships(end_date);
      CREATE INDEX IF NOT EXISTS idx_ms_type ON memberships(membership_type);

      INSERT OR IGNORE INTO permissions (key, display_name, module) VALUES
        ('memberships.view', 'View Memberships', 'memberships'),
        ('memberships.create', 'Create Memberships', 'memberships'),
        ('memberships.edit', 'Edit Memberships', 'memberships'),
        ('memberships.delete', 'Delete Memberships', 'memberships'),
        ('plans.manage', 'Manage Plans', 'memberships');
      INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
        SELECT r.id, p.id FROM roles r, permissions p WHERE r.name = 'admin' AND p.module = 'memberships';
    `);
  }
};
