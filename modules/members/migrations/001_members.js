module.exports = {
  up(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS members (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        member_no TEXT UNIQUE,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        first_name_ar TEXT DEFAULT '',
        last_name_ar TEXT DEFAULT '',
        email TEXT DEFAULT '',
        phone TEXT DEFAULT '',
        phone2 TEXT DEFAULT '',
        gender TEXT DEFAULT 'male',
        date_of_birth TEXT,
        national_id TEXT DEFAULT '',
        photo TEXT DEFAULT '',
        address TEXT DEFAULT '',
        city TEXT DEFAULT '',
        country TEXT DEFAULT '',
        branch_id INTEGER,
        status TEXT DEFAULT 'active',
        lifecycle_stage TEXT DEFAULT 'new',
        source TEXT DEFAULT '',
        qr_code TEXT UNIQUE,
        last_visit_at TEXT,
        total_visits INTEGER DEFAULT 0,
        waiver_signed INTEGER DEFAULT 0,
        waiver_date TEXT,
        profile_completeness INTEGER DEFAULT 0,
        risk_level TEXT DEFAULT 'none',
        notes TEXT DEFAULT '',
        tags TEXT DEFAULT '[]',
        joined_date TEXT DEFAULT (date('now')),
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );
      CREATE TABLE IF NOT EXISTS member_contacts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        member_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        relationship TEXT DEFAULT '',
        phone TEXT NOT NULL,
        is_emergency INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS member_notes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        member_id INTEGER NOT NULL,
        user_id INTEGER,
        content TEXT NOT NULL,
        type TEXT DEFAULT 'note',
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS member_timeline (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        member_id INTEGER NOT NULL,
        event_type TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT DEFAULT '',
        meta TEXT DEFAULT '{}',
        created_by INTEGER,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_members_status ON members(status);
      CREATE INDEX IF NOT EXISTS idx_members_lifecycle ON members(lifecycle_stage);
      CREATE INDEX IF NOT EXISTS idx_members_branch ON members(branch_id);
      CREATE INDEX IF NOT EXISTS idx_members_phone ON members(phone);
      CREATE INDEX IF NOT EXISTS idx_members_qr ON members(qr_code);
      CREATE INDEX IF NOT EXISTS idx_timeline_member ON member_timeline(member_id);

      INSERT OR IGNORE INTO permissions (key, display_name, module) VALUES
        ('members.view', 'View Members', 'members'),
        ('members.create', 'Create Members', 'members'),
        ('members.edit', 'Edit Members', 'members'),
        ('members.delete', 'Delete Members', 'members'),
        ('members.export', 'Export Members', 'members');
      INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
        SELECT r.id, p.id FROM roles r, permissions p WHERE r.name = 'admin' AND p.module = 'members';
    `);
  }
};
