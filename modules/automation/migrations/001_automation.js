// Automation module — rules + execution log
module.exports = { up(db) {
  const run = (sql, p = []) => { try { db.run(sql, p); } catch (e) { /* idempotent */ } };

  run(`
    CREATE TABLE IF NOT EXISTS automation_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT DEFAULT '',
      name_ar TEXT DEFAULT '',
      trigger TEXT NOT NULL DEFAULT 'expiry_before',   -- expiry_before | expiry_on | expiry_after | inactive | birthday | weekly_report
      offset_days INTEGER DEFAULT 0,                    -- N days (before/after/inactive)
      run_weekday INTEGER DEFAULT 0,                    -- 0=Sun..6=Sat, for weekly_report
      recipient TEXT DEFAULT 'member',                  -- member | admin
      channels TEXT DEFAULT '["whatsapp"]',             -- JSON array: whatsapp,sms,notif
      template TEXT DEFAULT '',
      template_ar TEXT DEFAULT '',
      is_active INTEGER DEFAULT 1,
      last_run_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `);

  run(`
    CREATE TABLE IF NOT EXISTS automation_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      rule_id INTEGER,
      rule_name TEXT DEFAULT '',
      member_id INTEGER,
      member_name TEXT DEFAULT '',
      channel TEXT DEFAULT '',
      status TEXT DEFAULT 'sent',                        -- sent | failed | skipped
      detail TEXT DEFAULT '',
      run_key TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);
  run(`CREATE INDEX IF NOT EXISTS idx_automation_log_rule ON automation_log(rule_id)`);
  run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_automation_log_runkey ON automation_log(run_key)`);

  // Seed a few smart default rules (inactive so nothing fires until the admin reviews/enables).
  let count = 0;
  try { const rc = db.exec('SELECT COUNT(*) AS c FROM automation_rules'); count = rc && rc[0] ? Number(rc[0].values[0][0]) : 0; } catch (_) { count = 0; }
  if (!count) {
    const seed = (r) => run(
      `INSERT INTO automation_rules (name, name_ar, trigger, offset_days, run_weekday, recipient, channels, template, template_ar, is_active)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [r.name, r.name_ar, r.trigger, r.offset_days || 0, r.run_weekday || 0, r.recipient || 'member', JSON.stringify(r.channels || ['whatsapp']), r.template || '', r.template_ar || '', 0]
    );
    seed({ name: 'Expiry reminder — 7 days', name_ar: 'تذكير قبل الانتهاء بـ 7 أيام', trigger: 'expiry_before', offset_days: 7, channels: ['whatsapp', 'notif'],
      template_ar: 'مرحباً {name}\nيتبقى {days} أيام على انتهاء اشتراكك في {company}.\nجدّد الآن لتستمر بلا انقطاع.' });
    seed({ name: 'Expiry reminder — 3 days', name_ar: 'تذكير قبل الانتهاء بـ 3 أيام', trigger: 'expiry_before', offset_days: 3, channels: ['whatsapp', 'sms', 'notif'],
      template_ar: 'مرحباً {name}\nيتبقى {days} أيام فقط على انتهاء اشتراكك في {company}.\nبادر بالتجديد.' });
    seed({ name: 'Subscription expired', name_ar: 'انتهى الاشتراك', trigger: 'expiry_on', offset_days: 0, channels: ['whatsapp', 'notif'],
      template_ar: 'مرحباً {name}\nانتهى اشتراكك في {company} اليوم.\nجدّد الآن للعودة للتمرين.' });
    seed({ name: 'Win-back — 3 days after expiry', name_ar: 'استعادة — بعد الانتهاء بـ 3 أيام', trigger: 'expiry_after', offset_days: 3, channels: ['whatsapp'],
      template_ar: 'اشتقنا لك {name}!\nمضى 3 أيام على انتهاء اشتراكك في {company}. عرض تجديد بانتظارك.' });
    seed({ name: 'Inactive members — 14 days', name_ar: 'أعضاء غير نشطين — 14 يوم', trigger: 'inactive', offset_days: 14, channels: ['whatsapp', 'notif'],
      template_ar: 'مرحباً {name}\nلم نرك منذ فترة في {company}. عودتك تسعدنا!' });
    seed({ name: 'Outstanding debt reminder', name_ar: 'تذكير برصيد مستحق (دين)', trigger: 'debt', offset_days: 0, channels: ['whatsapp', 'notif'],
      template_ar: 'مرحباً {name}\nلديك رصيد مستحق بقيمة {amount} في {company}.\nنرجو تسويته في أقرب وقت. شكراً لك.' });
    seed({ name: 'Birthday greeting', name_ar: 'تهنئة عيد ميلاد', trigger: 'birthday', offset_days: 0, channels: ['whatsapp', 'notif'],
      template_ar: 'كل عام وأنت بخير {name}! 🎉\nعائلة {company} تتمنى لك يوماً سعيداً.' });
    seed({ name: 'Weekly admin report', name_ar: 'تقرير أسبوعي للإدارة', trigger: 'weekly_report', run_weekday: 6, recipient: 'admin', channels: ['whatsapp'],
      template_ar: 'تقرير {company} الأسبوعي:\nأعضاء نشطون: {active_members}\nاشتراكات تنتهي هذا الأسبوع: {expiring}\nإيراد الأسبوع: {revenue}' });
  }
} };
