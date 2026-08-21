module.exports = {
  up(db) {
    const safe = (sql) => { try { db.exec(sql); } catch (_) {} };
    safe(`ALTER TABLE marketing_messages ADD COLUMN provider_status TEXT DEFAULT ''`);
    safe(`ALTER TABLE marketing_messages ADD COLUMN attempts INTEGER DEFAULT 0`);
    safe(`ALTER TABLE marketing_messages ADD COLUMN recipient_name TEXT DEFAULT ''`);
    safe(`ALTER TABLE marketing_messages ADD COLUMN variables_json TEXT DEFAULT '{}'`);
    safe(`ALTER TABLE marketing_messages ADD COLUMN scheduled_for TEXT`);
    safe(`ALTER TABLE marketing_messages ADD COLUMN next_attempt_at TEXT`);
    safe(`ALTER TABLE marketing_messages ADD COLUMN last_error_at TEXT`);
    safe(`ALTER TABLE marketing_messages ADD COLUMN last_provider_payload_json TEXT DEFAULT '{}'`);
    safe(`ALTER TABLE marketing_campaigns ADD COLUMN batch_size INTEGER DEFAULT 50`);
    safe(`ALTER TABLE marketing_campaigns ADD COLUMN batch_delay_ms INTEGER DEFAULT 750`);
    safe(`ALTER TABLE marketing_campaigns ADD COLUMN last_queued_at TEXT`);
    safe(`ALTER TABLE marketing_campaigns ADD COLUMN sent_count INTEGER DEFAULT 0`);
    safe(`ALTER TABLE marketing_campaigns ADD COLUMN failed_count INTEGER DEFAULT 0`);
    safe(`CREATE TABLE IF NOT EXISTS marketing_webhook_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_type TEXT DEFAULT '',
      provider TEXT DEFAULT 'wesender',
      provider_message_id TEXT DEFAULT '',
      related_phone TEXT DEFAULT '',
      payload_json TEXT DEFAULT '{}',
      processed INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    )`);
    safe(`CREATE TABLE IF NOT EXISTS marketing_automation_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      automation_code TEXT NOT NULL,
      event_key TEXT NOT NULL,
      contact_id INTEGER,
      related_model TEXT DEFAULT '',
      related_id TEXT DEFAULT '',
      run_date TEXT DEFAULT (date('now')),
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(automation_code, event_key)
    )`);
    safe(`CREATE TABLE IF NOT EXISTS marketing_dispatch_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_type TEXT NOT NULL,
      processed_count INTEGER DEFAULT 0,
      sent_count INTEGER DEFAULT 0,
      failed_count INTEGER DEFAULT 0,
      note TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    )`);
    safe(`CREATE INDEX IF NOT EXISTS idx_marketing_messages_sched ON marketing_messages(status, scheduled_for, next_attempt_at, created_at)`);
    safe(`CREATE INDEX IF NOT EXISTS idx_marketing_webhook_event ON marketing_webhook_events(event_type, provider_message_id, created_at)`);
    safe(`CREATE INDEX IF NOT EXISTS idx_marketing_auto_run ON marketing_automation_runs(automation_code, run_date)`);
  }
};
