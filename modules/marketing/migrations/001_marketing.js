module.exports = {
  up(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS marketing_contacts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        member_id INTEGER,
        full_name TEXT NOT NULL,
        phone TEXT NOT NULL,
        email TEXT DEFAULT '',
        branch_id INTEGER,
        language TEXT DEFAULT 'ar',
        consent_status TEXT DEFAULT 'opt_in',
        whatsapp_status TEXT DEFAULT 'unknown',
        source TEXT DEFAULT 'member',
        tags_json TEXT DEFAULT '[]',
        last_sync_at TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        UNIQUE(member_id),
        UNIQUE(phone)
      );

      CREATE TABLE IF NOT EXISTS marketing_templates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        name_ar TEXT DEFAULT '',
        category TEXT DEFAULT 'general',
        language TEXT DEFAULT 'ar',
        content TEXT NOT NULL,
        variables_json TEXT DEFAULT '[]',
        is_active INTEGER DEFAULT 1,
        created_by INTEGER,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS marketing_campaigns (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        campaign_type TEXT DEFAULT 'broadcast',
        target_segment TEXT DEFAULT 'all_contacts',
        branch_id INTEGER,
        template_id INTEGER,
        scheduled_at TEXT,
        status TEXT DEFAULT 'draft',
        message_text TEXT DEFAULT '',
        meta_json TEXT DEFAULT '{}',
        batch_size INTEGER DEFAULT 50,
        batch_delay_ms INTEGER DEFAULT 750,
        last_queued_at TEXT,
        sent_count INTEGER DEFAULT 0,
        failed_count INTEGER DEFAULT 0,
        created_by INTEGER,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY(template_id) REFERENCES marketing_templates(id)
      );

      CREATE TABLE IF NOT EXISTS marketing_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        campaign_id INTEGER,
        automation_code TEXT DEFAULT '',
        contact_id INTEGER,
        phone TEXT NOT NULL,
        recipient_name TEXT DEFAULT '',
        message_text TEXT NOT NULL,
        variables_json TEXT DEFAULT '{}',
        status TEXT DEFAULT 'queued',
        provider_name TEXT DEFAULT 'wesender',
        provider_message_id TEXT DEFAULT '',
        provider_status TEXT DEFAULT '',
        attempts INTEGER DEFAULT 0,
        scheduled_for TEXT,
        next_attempt_at TEXT,
        sent_at TEXT,
        error_message TEXT DEFAULT '',
        last_error_at TEXT,
        last_provider_payload_json TEXT DEFAULT '{}',
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY(campaign_id) REFERENCES marketing_campaigns(id),
        FOREIGN KEY(contact_id) REFERENCES marketing_contacts(id)
      );

      CREATE TABLE IF NOT EXISTS marketing_message_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        message_id INTEGER,
        log_type TEXT DEFAULT 'info',
        payload_json TEXT DEFAULT '{}',
        note TEXT DEFAULT '',
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY(message_id) REFERENCES marketing_messages(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS marketing_automations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        name_ar TEXT DEFAULT '',
        trigger_type TEXT DEFAULT 'manual',
        template_id INTEGER,
        enabled INTEGER DEFAULT 1,
        config_json TEXT DEFAULT '{}',
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY(template_id) REFERENCES marketing_templates(id)
      );

      CREATE TABLE IF NOT EXISTS marketing_webhook_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_type TEXT DEFAULT '',
        provider TEXT DEFAULT 'wesender',
        provider_message_id TEXT DEFAULT '',
        related_phone TEXT DEFAULT '',
        payload_json TEXT DEFAULT '{}',
        processed INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS marketing_automation_runs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        automation_code TEXT NOT NULL,
        event_key TEXT NOT NULL,
        contact_id INTEGER,
        related_model TEXT DEFAULT '',
        related_id TEXT DEFAULT '',
        run_date TEXT DEFAULT (date('now')),
        created_at TEXT DEFAULT (datetime('now')),
        UNIQUE(automation_code, event_key)
      );

      CREATE TABLE IF NOT EXISTS marketing_dispatch_runs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        run_type TEXT NOT NULL,
        processed_count INTEGER DEFAULT 0,
        sent_count INTEGER DEFAULT 0,
        failed_count INTEGER DEFAULT 0,
        note TEXT DEFAULT '',
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_marketing_messages_status ON marketing_messages(status, created_at);
      CREATE INDEX IF NOT EXISTS idx_marketing_messages_sched ON marketing_messages(status, scheduled_for, next_attempt_at, created_at);
      CREATE INDEX IF NOT EXISTS idx_marketing_campaigns_status ON marketing_campaigns(status, scheduled_at);
      CREATE INDEX IF NOT EXISTS idx_marketing_contacts_branch ON marketing_contacts(branch_id);
      CREATE INDEX IF NOT EXISTS idx_marketing_webhook_event ON marketing_webhook_events(event_type, provider_message_id, created_at);
      CREATE INDEX IF NOT EXISTS idx_marketing_auto_run ON marketing_automation_runs(automation_code, run_date);

      INSERT OR IGNORE INTO permissions (key, display_name, module) VALUES
        ('marketing.view', 'View Marketing', 'marketing'),
        ('marketing.contacts.manage', 'Manage Marketing Contacts', 'marketing'),
        ('marketing.templates.manage', 'Manage Marketing Templates', 'marketing'),
        ('marketing.campaigns.manage', 'Manage Marketing Campaigns', 'marketing'),
        ('marketing.automations.manage', 'Manage Marketing Automations', 'marketing'),
        ('marketing.logs.view', 'View Marketing Logs', 'marketing'),
        ('marketing.settings.manage', 'Manage Marketing Settings', 'marketing'),
        ('marketing.send', 'Send Marketing Messages', 'marketing');

      INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
        SELECT r.id, p.id FROM roles r, permissions p
        WHERE r.name = 'admin' AND p.module = 'marketing';
    `);
  }
};
