const express = require('express');
const { authMiddleware, requirePermission } = require('../../core/middleware/auth');
const settingsService = require('../../core/services/settings-service');
const auditService = require('../../core/services/audit-service');

module.exports = function setup(app, { database, eventBus }) {
  const db = database;
  const q = (sql, p = []) => db.getAll(sql, p);
  const one = (sql, p = []) => db.getOne(sql, p);
  const run = (sql, p = []) => db.run(sql, p);

  const router = express.Router();
  const publicRouter = express.Router();
  router.use(authMiddleware);

  function safeExec(sql) { try { db.get().exec(sql); db.save(); } catch (_) {} }
  function safeAlter(sql) { try { db.get().exec(sql); db.save(); } catch (_) {} }
  function num(v, fallback = 0) { const n = Number(v); return Number.isFinite(n) ? n : fallback; }
  function isoNow() { return new Date().toISOString(); }
  function toSqliteDateTime(v) { return String(v || '').replace('T', ' ').replace('Z', '').slice(0, 19); }
  function appCurrency() { return settingsService.get('app.currency', 'JOD') || 'JOD'; }

  function ensureDefaults() {
    const defaults = [
      ['marketing.provider', 'wesender', 'string'],
      ['marketing.wesender_base_url', '', 'string'],
      ['marketing.wesender_token', '', 'string'],
      ['marketing.wesender_session', '', 'string'],
      ['marketing.wesender_send_path', '/api/send-message', 'string'],
      ['marketing.wesender_sessions_base_path', '/api/whatsapp-sessions', 'string'],
      ['marketing.default_country_code', '962', 'string'],
      ['marketing.expiry_reminder_days', '7', 'string'],
      ['marketing.payment_due_days', '3', 'string'],
      ['marketing.daily_send_limit', '500', 'string'],
      ['marketing.queue_batch_size', '25', 'string'],
      ['marketing.retry_attempts', '3', 'string'],
      ['marketing.queue_tick_seconds', '45', 'string'],
      ['marketing.automation_tick_minutes', '15', 'string'],
      ['marketing.quiet_hours_start', '23:00', 'string'],
      ['marketing.quiet_hours_end', '08:00', 'string'],
      ['marketing.auto_sync_contacts', true, 'boolean'],
      ['marketing.enable_scheduler', false, 'boolean'],
      ['marketing.enable_birthday_automation', true, 'boolean'],
      ['marketing.enable_expiry_automation', true, 'boolean'],
      ['marketing.enable_payment_automation', true, 'boolean'],
      ['marketing.welcome_message_enabled', true, 'boolean'],
      ['marketing.welcome_message_template', 'مرحباً {name} 👋\nأهلاً بك في {company}! 💪\nنحن سعداء بانضمامك إلينا.\nرقم العضوية: {member_no}\nنتمنى لك رحلة رياضية ممتعة ومثمرة.', 'string'],
      ['marketing.pwa_invite_enabled', true, 'boolean'],
      ['marketing.pwa_invite_template', 'مرحباً {name} 👋\n\nتم تفعيل اشتراكك في {company} ✅\nرقم العضوية: {member_no}\n\n📲 حمّل التطبيق من هنا:\n{pwa_link}\n\n📱 مستخدمو iPhone:\nشاهد طريقة التثبيت:\n{ios_video_link}\n\n🤖 مستخدمو Android:\nشاهد طريقة التثبيت:\n{android_video_link}\n\nأهلاً بك ونتمنى لك تجربة مميزة 💪', 'string'],
      ['marketing.freeze_notify_enabled', true, 'boolean'],
      ['marketing.freeze_notify_template', 'مرحباً {name} 👋\n\nتم تجميد اشتراكك في {company} ❄️\nمدة التجميد: {freeze_days} يوم\nمن: {freeze_start}\nإلى: {freeze_end}\n\nسيعود اشتراكك تلقائياً بعد انتهاء فترة التجميد.\nتاريخ انتهاء الاشتراك الجديد: {new_end_date}\n\nنتمنى لك راحة ممتعة ونراك قريباً 💪', 'string'],
      ['marketing.unfreeze_notify_enabled', true, 'boolean'],
      ['marketing.unfreeze_notify_template', 'مرحباً {name} 👋\n\nتم فك تجميد اشتراكك في {company} ✅🎉\nاشتراكك الآن نشط ويمكنك العودة للتدريب!\n\nالباقة: {plan_name}\nتاريخ الانتهاء: {end_date}\n\nأهلاً بعودتك ونتمنى لك تدريباً ممتعاً 💪🏋️', 'string'],
      ['marketing.webhook_secret', '', 'string']
    ];
    defaults.forEach(([key, val, type]) => {
      if (settingsService.get(key) === null) {
        settingsService.set(key, val, { type, module: 'marketing', label: key });
      }
    });
  }

  function ensureSchema() {
    safeExec(`
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
        updated_at TEXT DEFAULT (datetime('now'))
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
        updated_at TEXT DEFAULT (datetime('now'))
      );
      CREATE TABLE IF NOT EXISTS marketing_message_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        message_id INTEGER,
        log_type TEXT DEFAULT 'info',
        payload_json TEXT DEFAULT '{}',
        note TEXT DEFAULT '',
        created_at TEXT DEFAULT (datetime('now'))
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
        updated_at TEXT DEFAULT (datetime('now'))
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
    `);
    [
      `ALTER TABLE marketing_messages ADD COLUMN provider_status TEXT DEFAULT ''`,
      `ALTER TABLE marketing_messages ADD COLUMN attempts INTEGER DEFAULT 0`,
      `ALTER TABLE marketing_messages ADD COLUMN recipient_name TEXT DEFAULT ''`,
      `ALTER TABLE marketing_messages ADD COLUMN variables_json TEXT DEFAULT '{}'`,
      `ALTER TABLE marketing_messages ADD COLUMN scheduled_for TEXT`,
      `ALTER TABLE marketing_messages ADD COLUMN next_attempt_at TEXT`,
      `ALTER TABLE marketing_messages ADD COLUMN sent_at TEXT`,
      `ALTER TABLE marketing_messages ADD COLUMN error_message TEXT DEFAULT ''`,
      `ALTER TABLE marketing_messages ADD COLUMN last_error_at TEXT`,
      `ALTER TABLE marketing_messages ADD COLUMN last_provider_payload_json TEXT DEFAULT '{}'`,
      `ALTER TABLE marketing_campaigns ADD COLUMN batch_size INTEGER DEFAULT 50`,
      `ALTER TABLE marketing_campaigns ADD COLUMN batch_delay_ms INTEGER DEFAULT 750`,
      `ALTER TABLE marketing_campaigns ADD COLUMN last_queued_at TEXT`,
      `ALTER TABLE marketing_campaigns ADD COLUMN sent_count INTEGER DEFAULT 0`,
      `ALTER TABLE marketing_campaigns ADD COLUMN failed_count INTEGER DEFAULT 0`
    ].forEach(safeAlter);
  }

  function ensurePermissionsAndSeeds() {
    safeExec(`
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
      SELECT r.id, p.id FROM roles r, permissions p WHERE r.name='admin' AND p.module='marketing';
    `);

    const templates = [
      ['Expiry Reminder AR', 'تذكير انتهاء الاشتراك', 'expiry', 'ar', 'مرحباً {{name}}، اشتراكك ينتهي بتاريخ {{expiry_date}}. لتجديده تواصل معنا.'],
      ['Payment Due AR', 'تذكير الدفعة المستحقة', 'payment', 'ar', 'مرحباً {{name}}، لديك مبلغ مستحق {{amount}} {{currency}} وتاريخ الاستحقاق {{due_date}}.'],
      ['Birthday AR', 'تهنئة عيد ميلاد', 'birthday', 'ar', 'كل عام وأنت بخير {{name}}! 🎉'],
      ['General Offer AR', 'عرض عام', 'offer', 'ar', 'مرحباً {{name}}، لدينا عرض جديد لك: {{offer_text}}']
    ];
    templates.forEach(([name, nameAr, category, language, content]) => {
      if (!one(`SELECT id FROM marketing_templates WHERE name=?`, [name])) {
        run(`INSERT INTO marketing_templates (name, name_ar, category, language, content, variables_json, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, '[]', 1, datetime('now'), datetime('now'))`, [name, nameAr, category, language, content]);
      }
    });

    const tpl = (name) => one(`SELECT id FROM marketing_templates WHERE name=?`, [name])?.id || null;
    const autos = [
      ['expiry_reminder', 'Expiry Reminder', 'تذكير انتهاء الاشتراك', 'schedule', tpl('Expiry Reminder AR')],
      ['payment_due_reminder', 'Payment Due Reminder', 'تذكير الدفع المستحق', 'schedule', tpl('Payment Due AR')],
      ['birthday_today', 'Birthday Today', 'عيد ميلاد اليوم', 'schedule', tpl('Birthday AR')]
    ];
    autos.forEach(([code, name, nameAr, triggerType, templateId]) => {
      if (!one(`SELECT id FROM marketing_automations WHERE code=?`, [code])) {
        run(`INSERT INTO marketing_automations (code, name, name_ar, trigger_type, template_id, enabled, config_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 1, '{}', datetime('now'), datetime('now'))`, [code, name, nameAr, triggerType, templateId]);
      }
    });
  }

  ensureDefaults();
  ensureSchema();
  ensurePermissionsAndSeeds();

  function normalizePhone(raw) {
    let v = String(raw || '').trim();
    if (!v) return '';
    v = v.replace(/[\s\-()]/g, '');
    if (v.startsWith('+')) v = v.slice(1);
    if (v.startsWith('00')) v = v.slice(2);
    if (!/^\d+$/.test(v)) return '';
    if (v.startsWith('0')) {
      const cc = String(settingsService.get('marketing.default_country_code', '962') || '962');
      v = cc + v.replace(/^0+/, '');
    }
    return v;
  }

  function formatTemplate(content, vars = {}) {
    return String(content || '').replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_m, key) => {
      const value = vars[key];
      return value === undefined || value === null ? '' : String(value);
    });
  }

  function getMembersSafe() {
    if (!db.tableExists('members')) return [];
    try { return q(`SELECT * FROM members WHERE COALESCE(status,'') != 'archived' ORDER BY id DESC`); }
    catch (_) { return []; }
  }

  function syncContacts() {
    const members = getMembersSafe();
    let synced = 0;
    members.forEach((m) => {
      const fullName = `${m.first_name || ''} ${m.last_name || ''}`.trim() || m.full_name || m.name || '';
      const phone = normalizePhone(m.phone || m.phone2 || m.mobile || '');
      if (!fullName || !phone) return;
      const existing = one(`SELECT id FROM marketing_contacts WHERE member_id=? OR phone=?`, [m.id, phone]);
      if (existing) {
        run(`UPDATE marketing_contacts SET member_id=?, full_name=?, phone=?, email=?, branch_id=?, source='member', last_sync_at=datetime('now'), updated_at=datetime('now') WHERE id=?`, [m.id, fullName, phone, m.email || '', m.branch_id || null, existing.id]);
      } else {
        run(`INSERT INTO marketing_contacts (member_id, full_name, phone, email, branch_id, language, consent_status, whatsapp_status, source, tags_json, last_sync_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'ar', 'opt_in', 'unknown', 'member', '[]', datetime('now'), datetime('now'), datetime('now'))`, [m.id, fullName, phone, m.email || '', m.branch_id || null]);
      }
      synced += 1;
    });
    return { synced, totalMembers: members.length };
  }

  function listSegments() {
    const expiryDays = num(settingsService.get('marketing.expiry_reminder_days', '7'), 7);
    const paymentDays = num(settingsService.get('marketing.payment_due_days', '3'), 3);
    const segments = [];
    segments.push({ code: 'all_contacts', name: 'All Contacts', nameAr: 'كل جهات الاتصال', count: one(`SELECT COUNT(*) as c FROM marketing_contacts`)?.c || 0 });
    segments.push({ code: 'active_memberships', name: 'Active Memberships', nameAr: 'اشتراكات فعالة', count: db.tableExists('memberships') ? (one(`SELECT COUNT(*) as c FROM memberships WHERE status='active'`)?.c || 0) : 0 });
    segments.push({ code: 'expiring_soon', name: 'Expiring Soon / Just Expired', nameAr: 'اشتراكات تنتهي قريباً / منتهية حديثاً', count: db.tableExists('memberships') ? (one(`SELECT COUNT(*) as c FROM memberships WHERE status IN ('active','scheduled','expired') AND end_date IS NOT NULL AND date(end_date) BETWEEN date('now','-1 day') AND date('now', '+' || ? || ' day')`, [expiryDays])?.c || 0) : 0 });
    segments.push({ code: 'birthday_today', name: 'Birthday Today', nameAr: 'عيد ميلاد اليوم', count: db.tableExists('members') ? (one(`SELECT COUNT(*) as c FROM members WHERE date_of_birth IS NOT NULL AND strftime('%m-%d', date_of_birth)=strftime('%m-%d','now')`)?.c || 0) : 0 });
    segments.push({ code: 'payment_due', name: 'Payment Due', nameAr: 'دفعات مستحقة', count: db.tableExists('accounting_invoices') ? (one(`SELECT COUNT(*) as c FROM accounting_invoices WHERE state IN ('posted','open') AND residual_amount > 0 AND due_date IS NOT NULL AND date(due_date) BETWEEN date('now') AND date('now', '+' || ? || ' day')`, [paymentDays])?.c || 0) : 0 });
    return segments;
  }

  function segmentContacts(code) {
    if (code === 'all_contacts') return q(`SELECT * FROM marketing_contacts ORDER BY full_name ASC LIMIT 500`);
    if (code === 'active_memberships' && db.tableExists('memberships')) {
      return q(`SELECT mc.* FROM marketing_contacts mc JOIN memberships ms ON ms.member_id = mc.member_id WHERE ms.status='active' GROUP BY mc.id ORDER BY mc.full_name`);
    }
    if (code === 'expiring_soon' && db.tableExists('memberships')) {
      const days = num(settingsService.get('marketing.expiry_reminder_days', '7'), 7);
      return q(`SELECT mc.*, ms.end_date, ms.plan_name, ms.id as membership_id,
        CASE WHEN date(ms.end_date) < date('now') THEN 1 ELSE 0 END as is_expired
        FROM marketing_contacts mc
        JOIN memberships ms ON ms.member_id = mc.member_id
        WHERE ms.status IN ('active','scheduled','expired')
          AND ms.end_date IS NOT NULL
          AND date(ms.end_date) BETWEEN date('now','-1 day') AND date('now', '+' || ? || ' day')
        GROUP BY mc.id, ms.id
        ORDER BY ms.end_date ASC`, [days]);
    }
    if (code === 'birthday_today' && db.tableExists('members')) {
      return q(`SELECT mc.*, m.date_of_birth FROM marketing_contacts mc JOIN members m ON m.id = mc.member_id WHERE m.date_of_birth IS NOT NULL AND strftime('%m-%d', m.date_of_birth)=strftime('%m-%d','now') ORDER BY mc.full_name`);
    }
    if (code === 'payment_due' && db.tableExists('accounting_invoices')) {
      const days = num(settingsService.get('marketing.payment_due_days', '3'), 3);
      return q(`SELECT mc.*, ai.due_date, ai.residual_amount, ai.id as invoice_id FROM marketing_contacts mc JOIN accounting_invoices ai ON lower(ai.partner_name)=lower(mc.full_name) WHERE ai.state IN ('posted','open') AND ai.residual_amount > 0 AND ai.due_date IS NOT NULL AND date(ai.due_date) BETWEEN date('now') AND date('now', '+' || ? || ' day') GROUP BY mc.id ORDER BY ai.due_date ASC`, [days]);
    }
    return [];
  }

  function marketingStats() {
    return {
      pendingMessages: one(`SELECT COUNT(*) as c FROM marketing_messages WHERE status IN ('queued','retrying')`)?.c || 0,
      sentToday: one(`SELECT COUNT(*) as c FROM marketing_messages WHERE status='sent' AND date(sent_at)=date('now')`)?.c || 0,
      campaignCount: one(`SELECT COUNT(*) as c FROM marketing_campaigns`)?.c || 0,
      contactsCount: one(`SELECT COUNT(*) as c FROM marketing_contacts`)?.c || 0,
      expiringSoon: listSegments().find(s => s.code === 'expiring_soon')?.count || 0,
      birthdayToday: listSegments().find(s => s.code === 'birthday_today')?.count || 0,
      paymentDue: listSegments().find(s => s.code === 'payment_due')?.count || 0
    };
  }

  function queueSummary() {
    return {
      queued: one(`SELECT COUNT(*) as c FROM marketing_messages WHERE status='queued'`)?.c || 0,
      retrying: one(`SELECT COUNT(*) as c FROM marketing_messages WHERE status='retrying'`)?.c || 0,
      failed: one(`SELECT COUNT(*) as c FROM marketing_messages WHERE status='failed'`)?.c || 0,
      sent: one(`SELECT COUNT(*) as c FROM marketing_messages WHERE status='sent'`)?.c || 0
    };
  }

  function queueAllowedToday() {
    const limit = num(settingsService.get('marketing.daily_send_limit', '500'), 500);
    const sentToday = one(`SELECT COUNT(*) as c FROM marketing_messages WHERE status='sent' AND date(sent_at)=date('now')`)?.c || 0;
    return Math.max(0, limit - sentToday);
  }

  function logMessage(messageId, logType, payload, note) {
    run(`INSERT INTO marketing_message_logs (message_id, log_type, payload_json, note, created_at) VALUES (?, ?, ?, ?, datetime('now'))`, [messageId || null, logType || 'info', JSON.stringify(payload || {}), note || '']);
  }

  function queueMessage({ campaignId = null, automationCode = '', contactId = null, phone, recipientName = '', messageText, scheduledFor = null, vars = {} }) {
    const normalized = normalizePhone(phone);
    if (!normalized || !messageText) return null;
    const r = run(`INSERT INTO marketing_messages (campaign_id, automation_code, contact_id, phone, recipient_name, message_text, variables_json, status, provider_name, scheduled_for, attempts, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'queued', ?, ?, 0, datetime('now'), datetime('now'))`, [campaignId, automationCode, contactId, normalized, recipientName, messageText, JSON.stringify(vars || {}), settingsService.get('marketing.provider', 'wesender'), scheduledFor]);
    logMessage(r.lastInsertRowid, 'queued', { campaignId, automationCode, phone: normalized }, 'Message queued');
    return r.lastInsertRowid;
  }

  function resolveTemplateByCode(code) {
    const automation = one(`SELECT * FROM marketing_automations WHERE code=?`, [code]);
    if (automation?.template_id) return one(`SELECT * FROM marketing_templates WHERE id=?`, [automation.template_id]);
    const fallbackName = code === 'expiry_reminder' ? 'Expiry Reminder AR' : code === 'payment_due_reminder' ? 'Payment Due AR' : code === 'birthday_today' ? 'Birthday AR' : null;
    return fallbackName ? one(`SELECT * FROM marketing_templates WHERE name=?`, [fallbackName]) : null;
  }

  function alreadyAutomated(code, eventKey) {
    return !!one(`SELECT id FROM marketing_automation_runs WHERE automation_code=? AND event_key=?`, [code, eventKey]);
  }
  function markAutomated(code, eventKey, contactId, relatedModel, relatedId) {
    run(`INSERT OR IGNORE INTO marketing_automation_runs (automation_code, event_key, contact_id, related_model, related_id, run_date, created_at) VALUES (?, ?, ?, ?, ?, date('now'), datetime('now'))`, [code, eventKey, contactId || null, relatedModel || '', relatedId || '']);
  }

  function queueAutomationMessages(code) {
    const tpl = resolveTemplateByCode(code);
    if (!tpl) return { queued: 0, skipped: 0, error: 'Template not found' };
    const sourceSegment = code === 'expiry_reminder' ? 'expiring_soon' : code === 'payment_due_reminder' ? 'payment_due' : 'birthday_today';
    const contacts = segmentContacts(sourceSegment);
    let queued = 0;
    let skipped = 0;
    contacts.forEach((contact) => {
      const eventKey = code === 'expiry_reminder'
        ? `${code}:${contact.membership_id || contact.member_id || contact.id}:${contact.is_expired ? 'expired' : 'soon'}`
        : `${code}:${contact.membership_id || contact.invoice_id || contact.member_id || contact.id}`;
      if (alreadyAutomated(code, eventKey)) { skipped += 1; return; }
      const vars = {
        name: contact.full_name,
        expiry_date: contact.end_date || '',
        amount: contact.residual_amount || '',
        currency: appCurrency(),
        due_date: contact.due_date || '',
        offer_text: ''
      };
      const text = formatTemplate(tpl.content, vars);
      const id = queueMessage({ automationCode: code, contactId: contact.id, phone: contact.phone, recipientName: contact.full_name, messageText: text, vars });
      if (id) {
        markAutomated(code, eventKey, contact.id, code === 'payment_due_reminder' ? 'accounting_invoice' : 'membership', String(contact.invoice_id || contact.membership_id || contact.member_id || ''));
        queued += 1;
      }
    });
    return { queued, skipped };
  }

  function queueCampaignMessages(campaignId) {
    const campaign = one(`SELECT * FROM marketing_campaigns WHERE id=?`, [campaignId]);
    if (!campaign) throw new Error('Campaign not found');
    const template = campaign.template_id ? one(`SELECT * FROM marketing_templates WHERE id=?`, [campaign.template_id]) : null;
    const contacts = segmentContacts(campaign.target_segment || 'all_contacts');
    const scheduledFor = campaign.scheduled_at ? toSqliteDateTime(campaign.scheduled_at) : null;
    let queued = 0;
    contacts.forEach((contact) => {
      const vars = { name: contact.full_name, expiry_date: contact.end_date || '', amount: contact.residual_amount || '', currency: appCurrency(), due_date: contact.due_date || '', offer_text: campaign.message_text || '' };
      const messageText = template ? formatTemplate(template.content, vars) : formatTemplate(campaign.message_text || '', vars);
      if (queueMessage({ campaignId: campaign.id, contactId: contact.id, phone: contact.phone, recipientName: contact.full_name, messageText, scheduledFor, vars })) queued += 1;
    });
    run(`UPDATE marketing_campaigns SET status='scheduled', last_queued_at=datetime('now'), updated_at=datetime('now') WHERE id=?`, [campaign.id]);
    return { queued };
  }

  function updateCampaignCounters(campaignId) {
    if (!campaignId) return;
    const agg = one(`SELECT SUM(CASE WHEN status='sent' THEN 1 ELSE 0 END) as sent_count, SUM(CASE WHEN status='failed' THEN 1 ELSE 0 END) as failed_count, SUM(CASE WHEN status IN ('queued','retrying') THEN 1 ELSE 0 END) as pending_count FROM marketing_messages WHERE campaign_id=?`, [campaignId]) || {};
    let status = 'completed';
    if (num(agg.pending_count) > 0) status = 'running';
    if (num(agg.sent_count) === 0 && num(agg.failed_count) === 0 && num(agg.pending_count) > 0) status = 'scheduled';
    run(`UPDATE marketing_campaigns SET sent_count=?, failed_count=?, status=?, updated_at=datetime('now') WHERE id=?`, [num(agg.sent_count), num(agg.failed_count), status, campaignId]);
  }

  function isQuietHours() {
    const start = String(settingsService.get('marketing.quiet_hours_start', '23:00') || '23:00');
    const end = String(settingsService.get('marketing.quiet_hours_end', '08:00') || '08:00');
    const now = new Date();
    const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    if (start === end) return false;
    if (start < end) return hhmm >= start && hhmm < end;
    return hhmm >= start || hhmm < end;
  }

  async function callWesender(path, options = {}) {
    const baseUrl = String(settingsService.get('marketing.wesender_base_url', '') || '').replace(/\/$/, '');
    const token = settingsService.get('marketing.wesender_token', '');
    if (!baseUrl || !token) throw new Error('Wesender is not configured');
    if (typeof fetch !== 'function') throw new Error('Global fetch is not available');
    const resp = await fetch(baseUrl + path, {
      method: options.method || 'GET',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(options.headers || {}) },
      body: options.body ? JSON.stringify(options.body) : undefined
    });
    const text = await resp.text();
    let body;
    try { body = JSON.parse(text); } catch { body = { raw: text }; }
    if (!resp.ok) {
      const err = new Error(`Wesender HTTP ${resp.status}`);
      err.responseBody = body;
      throw err;
    }
    return body;
  }

  // Absolute, publicly-reachable brand logo URL (from general Settings). WaSender
  // fetches the image from the internet, so it needs app.public_url set; on localhost
  // it resolves to '' and the message is sent text-only.
  function brandLogoUrl() {
    const logo = String(settingsService.get('app.admin_logo_url', '') || settingsService.get('app.login_logo_url', '') || '').trim();
    if (!logo) return '';
    if (/^https?:\/\//i.test(logo)) return logo;
    const b = String(settingsService.get('app.public_url', '') || '').trim().replace(/\/$/, '');
    return b ? b + (logo.startsWith('/') ? logo : '/' + logo) : '';
  }

  async function sendViaWesender({ phone, message }) {
    const sendPath = settingsService.get('marketing.wesender_send_path', '/api/send-message');
    const session = settingsService.get('marketing.wesender_session', '');
    const payload = { to: normalizePhone(phone), text: message };
    const img = brandLogoUrl();
    if (img) payload.imageUrl = img; // logo as a header image, message as caption
    if (session) payload.session = session;
    return callWesender(sendPath, { method: 'POST', body: payload });
  }

  async function fetchSessionRemote() {
    const session = settingsService.get('marketing.wesender_session', '');
    const base = String(settingsService.get('marketing.wesender_sessions_base_path', '/api/whatsapp-sessions') || '/api/whatsapp-sessions').replace(/\/$/, '');
    if (!session) return { session: '', remote: null, logs: [] };
    const remote = await callWesender(`${base}/${encodeURIComponent(session)}/status`).catch(() => null);
    const logsRes = await callWesender(`${base}/${encodeURIComponent(session)}/session-logs`).catch(() => null);
    const logs = Array.isArray(logsRes?.data) ? logsRes.data : Array.isArray(logsRes?.logs) ? logsRes.logs : [];
    return { session, remote: remote?.data || remote || null, logs };
  }

  async function processQueueBatch() {
    if (isQuietHours()) return { processed: 0, sent: 0, failed: 0, skippedQuietHours: true };
    const take = Math.min(Math.max(1, num(settingsService.get('marketing.queue_batch_size', '25'), 25)), queueAllowedToday());
    if (take <= 0) return { processed: 0, sent: 0, failed: 0, skippedLimit: true };
    const maxAttempts = Math.max(1, num(settingsService.get('marketing.retry_attempts', '3'), 3));
    const rows = q(`SELECT * FROM marketing_messages WHERE status IN ('queued','retrying') AND (scheduled_for IS NULL OR datetime(scheduled_for) <= datetime('now')) AND (next_attempt_at IS NULL OR datetime(next_attempt_at) <= datetime('now')) ORDER BY created_at ASC LIMIT ?`, [take]);
    let processed = 0, sent = 0, failed = 0;
    for (const row of rows) {
      processed += 1;
      try {
        const providerResponse = await sendViaWesender({ phone: row.phone, message: row.message_text });
        const providerMessageId = String(providerResponse?.data?.msgId || providerResponse?.id || providerResponse?.messageId || providerResponse?.data?.id || '');
        run(`UPDATE marketing_messages SET status='sent', provider_message_id=?, provider_status=?, sent_at=datetime('now'), error_message='', last_provider_payload_json=?, updated_at=datetime('now') WHERE id=?`, [providerMessageId, providerResponse?.data?.status || providerResponse?.status || 'sent', JSON.stringify(providerResponse || {}), row.id]);
        logMessage(row.id, 'sent', providerResponse, 'Message sent');
        updateCampaignCounters(row.campaign_id);
        sent += 1;
      } catch (err) {
        const attempts = num(row.attempts, 0) + 1;
        const body = err.responseBody || { error: err.message || 'Send failed' };
        if (attempts >= maxAttempts) {
          run(`UPDATE marketing_messages SET status='failed', attempts=?, error_message=?, last_error_at=datetime('now'), last_provider_payload_json=?, updated_at=datetime('now') WHERE id=?`, [attempts, err.message || 'Send failed', JSON.stringify(body), row.id]);
          logMessage(row.id, 'failed', body, err.message || 'Send failed');
          failed += 1;
        } else {
          const nextAttemptAt = toSqliteDateTime(new Date(Date.now() + Math.min(60, Math.max(2, attempts * 5)) * 60 * 1000).toISOString());
          run(`UPDATE marketing_messages SET status='retrying', attempts=?, error_message=?, next_attempt_at=?, last_error_at=datetime('now'), last_provider_payload_json=?, updated_at=datetime('now') WHERE id=?`, [attempts, err.message || 'Send failed', nextAttemptAt, JSON.stringify(body), row.id]);
          logMessage(row.id, 'retrying', body, 'Scheduled for retry');
        }
        updateCampaignCounters(row.campaign_id);
      }
    }
    run(`INSERT INTO marketing_dispatch_runs (run_type, processed_count, sent_count, failed_count, note, created_at) VALUES ('queue', ?, ?, ?, ?, datetime('now'))`, [processed, sent, failed, JSON.stringify({ take })]);
    return { processed, sent, failed };
  }

  async function dispatchDueCampaigns() {
    const due = q(`SELECT * FROM marketing_campaigns WHERE status IN ('scheduled','running') AND scheduled_at IS NOT NULL AND datetime(replace(scheduled_at, 'T', ' ')) <= datetime('now') ORDER BY scheduled_at ASC LIMIT 10`);
    let queued = 0;
    due.forEach((c) => {
      const existing = one(`SELECT COUNT(*) as c FROM marketing_messages WHERE campaign_id=?`, [c.id])?.c || 0;
      if (!existing) queued += queueCampaignMessages(c.id).queued;
      run(`UPDATE marketing_campaigns SET status='running', updated_at=datetime('now') WHERE id=?`, [c.id]);
    });
    return { queued, campaigns: due.length };
  }

  async function runDueAutomations() {
    if (settingsService.get('marketing.auto_sync_contacts', true)) { try { syncContacts(); } catch (_) {} }
    const results = [];
    if (settingsService.get('marketing.enable_expiry_automation', true)) results.push({ code: 'expiry_reminder', ...queueAutomationMessages('expiry_reminder') });
    if (settingsService.get('marketing.enable_payment_automation', true)) results.push({ code: 'payment_due_reminder', ...queueAutomationMessages('payment_due_reminder') });
    if (settingsService.get('marketing.enable_birthday_automation', true)) results.push({ code: 'birthday_today', ...queueAutomationMessages('birthday_today') });
    run(`INSERT INTO marketing_dispatch_runs (run_type, processed_count, sent_count, failed_count, note, created_at) VALUES ('automation', ?, 0, 0, ?, datetime('now'))`, [results.reduce((a, b) => a + num(b.queued), 0), JSON.stringify(results)]);
    return results;
  }

  function startScheduler() {
    if (global.__gymosMarketingScheduler?.started) return;
    const state = { started: true, startedAt: isoNow() };
    state.queueTimer = setInterval(() => {
      if (!settingsService.get('marketing.enable_scheduler', false)) return;
      processQueueBatch().catch(() => {});
    }, Math.max(15, num(settingsService.get('marketing.queue_tick_seconds', '45'), 45)) * 1000);
    state.automationTimer = setInterval(() => {
      if (!settingsService.get('marketing.enable_scheduler', false)) return;
      dispatchDueCampaigns().then(() => runDueAutomations()).catch(() => {});
    }, Math.max(5, num(settingsService.get('marketing.automation_tick_minutes', '15'), 15)) * 60 * 1000);
    if (typeof state.queueTimer.unref === 'function') state.queueTimer.unref();
    if (typeof state.automationTimer.unref === 'function') state.automationTimer.unref();
    global.__gymosMarketingScheduler = state;
  }
  try { startScheduler(); } catch (_) {}

  // ─── Pre-unfreeze reminder: 24h before freeze end ────────
  // Runs every hour, independent of the marketing scheduler toggle.
  // Sends a "welcome back" message to members whose freeze ends within 24 hours.
  try {
    const preUnfreezeTimer = setInterval(async () => {
      try {
        if (!settingsService.get('marketing.unfreeze_notify_enabled', true)) return;
        const token = settingsService.get('marketing.wesender_token', '');
        const session = settingsService.get('marketing.wesender_session', '');
        if (!token || !session) return;
        // Find active freezes ending within the next 24 hours
        const upcoming = q(`
          SELECT fr.id, fr.membership_id, fr.member_id, fr.end_date, fr.total_days,
                 ms.plan_name, ms.end_date as ms_end_date,
                 m.first_name, m.middle_name, m.last_name, m.phone, m.phone2, m.member_no
          FROM freeze_requests fr
          JOIN members m ON m.id = fr.member_id
          JOIN memberships ms ON ms.id = fr.membership_id
          WHERE fr.status = 'active'
            AND date(fr.end_date) = date('now', '+1 day')
        `);
        const companyName = settingsService.get('app.company_name', '') || settingsService.get('app.name', '') || 'GymOS';
        for (const row of upcoming) {
          try {
            const phone = normalizePhone(row.phone || row.phone2 || '');
            if (!phone) continue;
            const eventKey = `unfreeze_reminder:${row.id}`;
            if (alreadyAutomated('unfreeze_reminder', eventKey)) continue;
            const fullName = [row.first_name, row.middle_name, row.last_name].filter(Boolean).join(' ').trim() || 'عميلنا الكريم';
            const messageText = `مرحباً ${fullName} 👋\n\nغداً ينتهي تجميد اشتراكك في ${companyName} ✅\nسيعود اشتراكك نشطاً تلقائياً.\n\nالباقة: ${row.plan_name || ''}\nتاريخ انتهاء الاشتراك: ${row.ms_end_date || ''}\n\nأهلاً بعودتك ونراك في النادي 💪🏋️`;
            const msgId = await queueAndSend({
              automationCode: 'unfreeze_reminder',
              phone, recipientName: fullName, messageText,
              vars: { name: fullName, plan_name: row.plan_name || '', end_date: row.ms_end_date || '' }
            });
            if (msgId) markAutomated('unfreeze_reminder', eventKey, null, 'freeze', row.id);
          } catch (_) {}
        }
      } catch (_) {}
    }, 60 * 60 * 1000); // Every 1 hour
    if (typeof preUnfreezeTimer.unref === 'function') preUnfreezeTimer.unref();
  } catch (_) {}

  function schedulerState() {
    const state = global.__gymosMarketingScheduler;
    if (!state) return { started: false };
    return {
      started: !!state.started,
      startedAt: state.startedAt || null,
      queueTimerActive: !!state.queueTimer,
      automationTimerActive: !!state.automationTimer,
      queueTickSeconds: Math.max(15, num(settingsService.get('marketing.queue_tick_seconds', '45'), 45)),
      automationTickMinutes: Math.max(5, num(settingsService.get('marketing.automation_tick_minutes', '15'), 15)),
      schedulerEnabled: !!settingsService.get('marketing.enable_scheduler', false)
    };
  }

  function recordWebhook(eventType, payload, providerMessageId = '', relatedPhone = '', processed = 0) {
    run(`INSERT INTO marketing_webhook_events (event_type, provider, provider_message_id, related_phone, payload_json, processed, created_at) VALUES (?, 'wesender', ?, ?, ?, ?, datetime('now'))`, [eventType || '', providerMessageId || '', relatedPhone || '', JSON.stringify(payload || {}), processed ? 1 : 0]);
  }

  function extractWebhookData(payload = {}) {
    const data = payload.data || {};
    const msg = Array.isArray(data.messages) ? data.messages[0] : data.messages || data.message || data;
    const key = msg?.key || data.key || {};
    const providerMessageId = key.id || data.messageId || data.msgId || '';
    const phone = key.remoteJid || key.senderPn || key.cleanedSenderPn || data.to || data.phone || '';
    return { providerMessageId: String(providerMessageId || ''), phone: String(phone || '').replace(/@.+$/, '') };
  }

  function applyWebhookEvent(payload = {}) {
    const eventType = payload.event || payload.type || 'unknown';
    const { providerMessageId, phone } = extractWebhookData(payload);
    recordWebhook(eventType, payload, providerMessageId, phone, 1);
    const row = providerMessageId ? one(`SELECT * FROM marketing_messages WHERE provider_message_id=? ORDER BY id DESC LIMIT 1`, [providerMessageId]) : one(`SELECT * FROM marketing_messages WHERE phone=? ORDER BY id DESC LIMIT 1`, [normalizePhone(phone)]);
    if (!row) return;
    if (eventType === 'message.sent') {
      run(`UPDATE marketing_messages SET status='sent', provider_status='sent', updated_at=datetime('now') WHERE id=?`, [row.id]);
      logMessage(row.id, 'webhook', payload, 'Webhook marked sent');
    } else if (eventType === 'message.status.update' || eventType === 'message.receipt.update') {
      const status = payload?.data?.status || payload?.data?.messageStatus || payload?.status || 'delivered';
      run(`UPDATE marketing_messages SET provider_status=?, updated_at=datetime('now') WHERE id=?`, [status, row.id]);
      logMessage(row.id, 'webhook', payload, 'Webhook status updated');
    } else if (eventType === 'messages.received' || eventType === 'messages.upsert') {
      logMessage(row.id, 'inbound', payload, 'Inbound message received');
    }
    updateCampaignCounters(row.campaign_id);
  }

  publicRouter.post('/webhook', express.json({ limit: '5mb' }), (req, res) => {
    const configuredSecret = String(settingsService.get('marketing.webhook_secret', '') || '');
    if (!configuredSecret) {
      return res.status(403).json({ success: false, error: 'Webhook secret not configured. Set marketing.webhook_secret in settings.' });
    }
    const incomingSecret = String(req.headers['x-webhook-secret'] || req.headers['x-marketing-secret'] || '');
    if (incomingSecret !== configuredSecret) {
      recordWebhook('rejected', { reason: 'invalid_secret' }, '', '', 0);
      return res.status(401).json({ success: false, error: 'Invalid webhook secret' });
    }
    try {
      applyWebhookEvent(req.body || {});
      return res.json({ success: true });
    } catch (err) {
      recordWebhook('error', { error: err.message, body: req.body || {} }, '', '', 0);
      return res.status(500).json({ success: false, error: err.message || 'Webhook failed' });
    }
  });

  router.get('/health', (_req, res) => {
    res.json({ success: true, data: { module: 'marketing', tablesReady: db.tableExists('marketing_contacts') && db.tableExists('marketing_templates') && db.tableExists('marketing_campaigns') && db.tableExists('marketing_messages'), scheduler: schedulerState(), currency: appCurrency() } });
  });

  const buildBootstrapPayload = () => ({ currency: appCurrency(), stats: marketingStats(), segments: listSegments(), templates: q(`SELECT id, name FROM marketing_templates WHERE is_active=1 ORDER BY name`), queue: queueSummary(), scheduler: schedulerState() });

  router.get('/', requirePermission('marketing.view'), (_req, res) => {
    res.json({ success: true, data: buildBootstrapPayload() });
  });

  router.get('/bootstrap', requirePermission('marketing.view'), (_req, res) => {
    res.json({ success: true, data: buildBootstrapPayload() });
  });

  router.get('/dashboard', requirePermission('marketing.view'), (_req, res) => {
    res.json({ success: true, data: { stats: marketingStats(), queue: queueSummary(), recentCampaigns: q(`SELECT * FROM marketing_campaigns ORDER BY created_at DESC LIMIT 8`), recentMessages: q(`SELECT * FROM marketing_messages ORDER BY created_at DESC LIMIT 8`) } });
  });

  router.get('/contacts', requirePermission('marketing.view'), (req, res) => {
    const search = String(req.query.search || '').trim().toLowerCase();
    let rows = q(`SELECT * FROM marketing_contacts ORDER BY full_name ASC LIMIT 300`);
    if (search) rows = rows.filter(r => String(r.full_name || '').toLowerCase().includes(search) || String(r.phone || '').includes(search));
    res.json({ success: true, data: rows });
  });

  const syncContactsHandler = (req, res) => {
    const result = syncContacts();
    auditService.log({ userId: req.user.id, action: 'marketing.contacts.sync', details: result, ip: req.ip });
    res.json({ success: true, data: result });
  };

  router.post('/contacts/sync', requirePermission('marketing.contacts.manage'), syncContactsHandler);
  router.post('/contacts/sync-members', requirePermission('marketing.contacts.manage'), syncContactsHandler);

  router.get('/segments', requirePermission('marketing.view'), (_req, res) => res.json({ success: true, data: listSegments() }));
  router.get('/segments/:code/preview', requirePermission('marketing.view'), (req, res) => res.json({ success: true, data: segmentContacts(req.params.code) }));

  router.get('/templates', requirePermission('marketing.view'), (_req, res) => res.json({ success: true, data: q(`SELECT * FROM marketing_templates ORDER BY created_at DESC`) }));
  router.post('/templates', requirePermission('marketing.templates.manage'), (req, res) => {
    const { name, name_ar, category, language, content, variables_json } = req.body || {};
    if (!name || !content) return res.status(400).json({ success: false, error: 'name and content are required' });
    const r = run(`INSERT INTO marketing_templates (name, name_ar, category, language, content, variables_json, is_active, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 1, ?, datetime('now'), datetime('now'))`, [name, name_ar || '', category || 'general', language || 'ar', content, JSON.stringify(variables_json || []), req.user.id]);
    return res.json({ success: true, data: one(`SELECT * FROM marketing_templates WHERE id=?`, [r.lastInsertRowid]) });
  });
  router.put('/templates/:id', requirePermission('marketing.templates.manage'), (req, res) => {
    const cur = one(`SELECT * FROM marketing_templates WHERE id=?`, [req.params.id]);
    if (!cur) return res.status(404).json({ success: false, error: 'Template not found' });
    const body = req.body || {};
    run(`UPDATE marketing_templates SET name=?, name_ar=?, category=?, language=?, content=?, variables_json=?, is_active=?, updated_at=datetime('now') WHERE id=?`, [body.name || cur.name, body.name_ar || cur.name_ar || '', body.category || cur.category || 'general', body.language || cur.language || 'ar', body.content || cur.content, JSON.stringify(body.variables_json || (() => { try { return JSON.parse(cur.variables_json || '[]'); } catch { return []; } })()), body.is_active === false ? 0 : 1, req.params.id]);
    return res.json({ success: true, data: one(`SELECT * FROM marketing_templates WHERE id=?`, [req.params.id]) });
  });

  router.get('/campaigns', requirePermission('marketing.view'), (_req, res) => res.json({ success: true, data: q(`SELECT c.*, t.name as template_name, t.name_ar as template_name_ar FROM marketing_campaigns c LEFT JOIN marketing_templates t ON t.id=c.template_id ORDER BY c.created_at DESC`) }));
  router.post('/campaigns', requirePermission('marketing.campaigns.manage'), (req, res) => {
    const body = req.body || {};
    if (!body.name) return res.status(400).json({ success: false, error: 'name is required' });
    const r = run(`INSERT INTO marketing_campaigns (name, campaign_type, target_segment, branch_id, template_id, scheduled_at, status, message_text, meta_json, batch_size, batch_delay_ms, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`, [body.name, body.campaign_type || 'broadcast', body.target_segment || 'all_contacts', body.branch_id || null, body.template_id || null, body.scheduled_at || null, body.status || 'draft', body.message_text || '', JSON.stringify(body.meta_json || {}), num(body.batch_size, 50), num(body.batch_delay_ms, 750), req.user.id]);
    return res.json({ success: true, data: one(`SELECT * FROM marketing_campaigns WHERE id=?`, [r.lastInsertRowid]) });
  });
  router.put('/campaigns/:id', requirePermission('marketing.campaigns.manage'), (req, res) => {
    const cur = one(`SELECT * FROM marketing_campaigns WHERE id=?`, [req.params.id]);
    if (!cur) return res.status(404).json({ success: false, error: 'Campaign not found' });
    const body = req.body || {};
    run(`UPDATE marketing_campaigns SET name=?, campaign_type=?, target_segment=?, branch_id=?, template_id=?, scheduled_at=?, status=?, message_text=?, meta_json=?, batch_size=?, batch_delay_ms=?, updated_at=datetime('now') WHERE id=?`, [body.name || cur.name, body.campaign_type || cur.campaign_type, body.target_segment || cur.target_segment, body.branch_id || cur.branch_id || null, body.template_id || cur.template_id || null, body.scheduled_at || cur.scheduled_at || null, body.status || cur.status, body.message_text ?? cur.message_text, JSON.stringify(body.meta_json || (() => { try { return JSON.parse(cur.meta_json || '{}'); } catch { return {}; } })()), num(body.batch_size, cur.batch_size || 50), num(body.batch_delay_ms, cur.batch_delay_ms || 750), req.params.id]);
    return res.json({ success: true, data: one(`SELECT * FROM marketing_campaigns WHERE id=?`, [req.params.id]) });
  });
  router.post('/campaigns/:id/queue', requirePermission('marketing.send'), (req, res) => {
    try {
      const result = queueCampaignMessages(req.params.id);
      auditService.log({ userId: req.user.id, action: 'marketing.campaign.queue', details: { campaignId: req.params.id, ...result }, ip: req.ip });
      return res.json({ success: true, data: result });
    } catch (err) {
      return res.status(400).json({ success: false, error: err.message });
    }
  });
  router.post('/campaigns/:id/run', requirePermission('marketing.send'), async (req, res) => {
    try {
      const campaign = one(`SELECT * FROM marketing_campaigns WHERE id=?`, [req.params.id]);
      if (!campaign) return res.status(404).json({ success: false, error: 'Campaign not found' });
      const existing = one(`SELECT COUNT(*) as c FROM marketing_messages WHERE campaign_id=?`, [campaign.id])?.c || 0;
      if (!existing) queueCampaignMessages(campaign.id);
      run(`UPDATE marketing_campaigns SET status='running', updated_at=datetime('now') WHERE id=?`, [campaign.id]);
      const result = await processQueueBatch();
      updateCampaignCounters(campaign.id);
      return res.json({ success: true, data: result });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message || 'Campaign run failed' });
    }
  });

  router.get('/automations', requirePermission('marketing.view'), (_req, res) => {
    const rows = q(`SELECT a.*, t.name as template_name, t.name_ar as template_name_ar FROM marketing_automations a LEFT JOIN marketing_templates t ON t.id=a.template_id ORDER BY a.id`);
    res.json({ success: true, data: rows.map(r => ({ ...r, config: (() => { try { return JSON.parse(r.config_json || '{}'); } catch { return {}; } })() })) });
  });
  router.put('/automations/:code/toggle', requirePermission('marketing.automations.manage'), (req, res) => {
    run(`UPDATE marketing_automations SET enabled=?, updated_at=datetime('now') WHERE code=?`, [req.body.enabled ? 1 : 0, req.params.code]);
    return res.json({ success: true, data: one(`SELECT * FROM marketing_automations WHERE code=?`, [req.params.code]) });
  });
  router.post('/automations/:code/run', requirePermission('marketing.send'), (req, res) => {
    const result = queueAutomationMessages(req.params.code);
    auditService.log({ userId: req.user.id, action: 'marketing.automation.run', details: { code: req.params.code, ...result }, ip: req.ip });
    res.json({ success: true, data: result });
  });
  router.post('/automations/run-due', requirePermission('marketing.send'), async (_req, res) => {
    try {
      const campaigns = await dispatchDueCampaigns();
      const results = await runDueAutomations();
      return res.json({ success: true, data: { campaigns, results } });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message || 'Automation dispatch failed' });
    }
  });

  router.get('/queue/status', requirePermission('marketing.logs.view'), (_req, res) => res.json({ success: true, data: { summary: queueSummary(), rows: q(`SELECT * FROM marketing_messages ORDER BY created_at DESC LIMIT 200`) } }));
  router.post('/queue/process', requirePermission('marketing.send'), async (_req, res) => {
    try { return res.json({ success: true, data: await processQueueBatch() }); }
    catch (err) { return res.status(500).json({ success: false, error: err.message || 'Queue processing failed' }); }
  });

  router.get('/logs', requirePermission('marketing.logs.view'), (_req, res) => {
    const rows = q(`SELECT mm.*, mc.full_name, lg.log_type, lg.note, lg.payload_json, lg.created_at as log_created_at FROM marketing_messages mm LEFT JOIN marketing_contacts mc ON mc.id = mm.contact_id LEFT JOIN marketing_message_logs lg ON lg.message_id = mm.id ORDER BY mm.created_at DESC, lg.created_at DESC LIMIT 300`);
    res.json({ success: true, data: rows });
  });
  router.get('/webhooks', requirePermission('marketing.logs.view'), (_req, res) => res.json({ success: true, data: q(`SELECT * FROM marketing_webhook_events ORDER BY created_at DESC LIMIT 200`) }));

  router.get('/sessions/status', requirePermission('marketing.view'), async (_req, res) => {
    try {
      const remote = await fetchSessionRemote().catch(() => ({ remote: null, logs: [] }));
      return res.json({ success: true, data: { provider: settingsService.get('marketing.provider', 'wesender'), configured: !!settingsService.get('marketing.wesender_token', ''), session: settingsService.get('marketing.wesender_session', ''), baseUrl: settingsService.get('marketing.wesender_base_url', ''), sendPath: settingsService.get('marketing.wesender_send_path', '/api/send-message'), remote: remote.remote || null, logs: remote.logs || [] } });
    } catch (err) {
      return res.json({ success: true, data: { provider: settingsService.get('marketing.provider', 'wesender'), configured: false, session: settingsService.get('marketing.wesender_session', ''), baseUrl: settingsService.get('marketing.wesender_base_url', ''), sendPath: settingsService.get('marketing.wesender_send_path', '/api/send-message'), remote: null, logs: [], error: err.message } });
    }
  });

  router.post('/test-send', requirePermission('marketing.send'), async (req, res) => {
    try {
      const phone = normalizePhone(req.body.phone);
      const message = String(req.body.message || '').trim();
      if (!phone || !message) return res.status(400).json({ success: false, error: 'phone and message are required' });
      const messageId = queueMessage({ phone, recipientName: phone, messageText: message });
      const providerResponse = await sendViaWesender({ phone, message });
      run(`UPDATE marketing_messages SET status='sent', provider_message_id=?, provider_status=?, sent_at=datetime('now'), updated_at=datetime('now'), last_provider_payload_json=? WHERE id=?`, [String(providerResponse?.data?.msgId || providerResponse?.id || providerResponse?.messageId || ''), providerResponse?.data?.status || providerResponse?.status || 'sent', JSON.stringify(providerResponse || {}), messageId]);
      logMessage(messageId, 'sent', providerResponse, 'Test message sent');
      auditService.log({ userId: req.user.id, action: 'marketing.test_send', details: { phone }, ip: req.ip });
      return res.json({ success: true, data: { messageId, providerResponse } });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message || 'Send failed', details: err.responseBody || null });
    }
  });

  // ─── Welcome WhatsApp on member.created ────────────────
  // Listens for new member registrations and queues a welcome WhatsApp message.
  // Safety guards:
  //   1) Feature toggle (marketing.welcome_message_enabled) — default ON but inactive without provider config
  //   2) Provider must be configured (wesender_token + wesender_session) — otherwise silently skipped
  //   3) Valid phone required — otherwise skipped
  //   4) Deduplication via marketing_automation_runs (event_key = 'member_welcome:<id>')
  //   5) All errors caught so member creation never fails because of WhatsApp issues
  // Helper: queue a message AND attempt immediate send (like test-send does).
  // This makes event-driven messages work even when the background scheduler is disabled.
  // Failures are logged but never thrown — the queued row stays for retry.
  async function queueAndSend({ automationCode, phone, recipientName, messageText, vars }) {
    const msgId = queueMessage({ automationCode, phone, recipientName, messageText, vars });
    if (!msgId) return null;
    try {
      const providerResponse = await sendViaWesender({ phone, message: messageText });
      run(
        `UPDATE marketing_messages SET status='sent', provider_message_id=?, provider_status=?, sent_at=datetime('now'), updated_at=datetime('now'), last_provider_payload_json=? WHERE id=?`,
        [
          String(providerResponse?.data?.msgId || providerResponse?.id || providerResponse?.messageId || ''),
          providerResponse?.data?.status || providerResponse?.status || 'sent',
          JSON.stringify(providerResponse || {}),
          msgId
        ]
      );
      logMessage(msgId, 'sent', providerResponse, `Auto-sent (${automationCode})`);
    } catch (err) {
      // Keep as queued for retry; log the error so admin can inspect
      logMessage(msgId, 'send_failed', { error: err.message, body: err.responseBody || null }, `Direct send failed for ${automationCode}`);
    }
    return msgId;
  }

  if (eventBus && typeof eventBus.on === 'function') {
    eventBus.on('member.created', async (payload) => {
      try {
        if (!settingsService.get('marketing.welcome_message_enabled', true)) return;
        const token = settingsService.get('marketing.wesender_token', '');
        const session = settingsService.get('marketing.wesender_session', '');
        if (!token || !session) return; // Provider not configured — safe skip
        const memberId = payload?.memberId;
        if (!memberId) return;
        const member = one('SELECT * FROM members WHERE id = ?', [memberId]);
        if (!member) return;
        const phone = normalizePhone(member.phone || member.phone2 || '');
        if (!phone) return;
        const eventKey = `member_pwa_invite:${memberId}`; // shared with membership.created so the invite is sent once per member
        if (alreadyAutomated('member_pwa_invite', eventKey)) return;
        const fullName = [member.first_name, member.middle_name, member.last_name].filter(Boolean).join(' ').trim() || member.first_name || 'عميلنا الكريم';
        const companyName = settingsService.get('app.company_name', '') || settingsService.get('app.name', '') || settingsService.get('member_pwa.app_name', 'GymOS');
        // Resolve the PWA download link to an absolute URL so it is clickable on the member's phone.
        let pwaLink = settingsService.get('qr_registration.pwa_link', '/member/') || '/member/';
        if (!/^https?:\/\//i.test(pwaLink)) {
          const publicBase = String(settingsService.get('app.public_url', '') || settingsService.get('app.base_url', '') || '').trim().replace(/\/$/, '');
          if (publicBase) pwaLink = publicBase + (pwaLink.startsWith('/') ? pwaLink : '/' + pwaLink);
        }
        const iosVideoLink = settingsService.get('qr_registration.ios_video_link', '') || '';
        const androidVideoLink = settingsService.get('qr_registration.android_video_link', '') || '';
        // Send the "download the app" invite on member creation (default template includes the link + install videos).
        const defaultWelcome = 'مرحباً {name}\n\nأهلاً بك في {company}\nرقم العضوية: {member_no}\n\nحمّل تطبيق العضو من هنا:\n{pwa_link}\n\nطريقة التثبيت على iPhone:\n{ios_video_link}\n\nطريقة التثبيت على Android:\n{android_video_link}';
        const template = settingsService.get('marketing.welcome_message_template', '') || settingsService.get('marketing.pwa_invite_template', '') || defaultWelcome;
        const messageText = String(template)
          .replace(/\{name\}/g, fullName)
          .replace(/\{first_name\}/g, member.first_name || '')
          .replace(/\{member_no\}/g, member.member_no || '')
          .replace(/\{company\}/g, companyName)
          .replace(/\{gym_name\}/g, companyName)
          .replace(/\{pwa_link\}/g, pwaLink)
          .replace(/\{ios_video_link\}/g, iosVideoLink)
          .replace(/\{android_video_link\}/g, androidVideoLink);
        const msgId = await queueAndSend({
          automationCode: 'member_welcome',
          phone,
          recipientName: fullName,
          messageText,
          vars: { name: fullName, member_no: member.member_no || '', company: companyName }
        });
        // Also deliver the welcome / download-app message by email if configured and the member has one.
        try {
          const emailService = require('../../core/services/email-service');
          if (member.email && emailService.isConfigured()) {
            await emailService.sendEmail({ to: member.email, subject: companyName, html: emailService.messageEmail({ title: companyName, body: messageText, ctaText: 'حمّل التطبيق', ctaUrl: /^https?:\/\//i.test(pwaLink) ? pwaLink : '' }) });
          }
        } catch (_) {}
        if (msgId) markAutomated('member_pwa_invite', eventKey, null, 'member', memberId);
      } catch (err) {
        console.error('[marketing] welcome message handler failed:', err.message);
      }
    });

    // ─── PWA Install Invite on membership.created ────────────
    eventBus.on('membership.created', async (payload) => {
      try {
        if (!settingsService.get('marketing.pwa_invite_enabled', true)) return;
        const token = settingsService.get('marketing.wesender_token', '');
        const session = settingsService.get('marketing.wesender_session', '');
        if (!token || !session) return;
        const memberId = payload?.member_id;
        const membershipId = payload?.membershipId;
        if (!memberId) return;
        const member = one('SELECT * FROM members WHERE id = ?', [memberId]);
        if (!member) return;
        const phone = normalizePhone(member.phone || member.phone2 || '');
        if (!phone) return;
        const eventKey = `member_pwa_invite:${memberId}`; // shared with member.created so the invite is sent once per member
        if (alreadyAutomated('member_pwa_invite', eventKey)) return;
        const fullName = [member.first_name, member.middle_name, member.last_name].filter(Boolean).join(' ').trim() || member.first_name || 'عميلنا الكريم';
        const companyName = settingsService.get('app.company_name', '') || settingsService.get('app.name', '') || settingsService.get('member_pwa.app_name', 'GymOS');
        const pwaLink = settingsService.get('qr_registration.pwa_link', '/member/') || '/member/';
        const iosVideoLink = settingsService.get('qr_registration.ios_video_link', '') || '';
        const androidVideoLink = settingsService.get('qr_registration.android_video_link', '') || '';
        const defaultTemplate = 'مرحباً {name} 👋\n\nتم تفعيل اشتراكك في {company} ✅\nرقم العضوية: {member_no}\n\n📲 حمّل التطبيق من هنا:\n{pwa_link}\n\n📱 مستخدمو iPhone:\nشاهد طريقة التثبيت:\n{ios_video_link}\n\n🤖 مستخدمو Android:\nشاهد طريقة التثبيت:\n{android_video_link}\n\nأهلاً بك ونتمنى لك تجربة مميزة 💪';
        const template = settingsService.get('marketing.pwa_invite_template', '') || defaultTemplate;
        const messageText = String(template)
          .replace(/\{name\}/g, fullName)
          .replace(/\{first_name\}/g, member.first_name || '')
          .replace(/\{member_no\}/g, member.member_no || '')
          .replace(/\{company\}/g, companyName)
          .replace(/\{gym_name\}/g, companyName)
          .replace(/\{pwa_link\}/g, pwaLink)
          .replace(/\{ios_video_link\}/g, iosVideoLink)
          .replace(/\{android_video_link\}/g, androidVideoLink);
        const msgId = await queueAndSend({
          automationCode: 'membership_pwa_invite',
          phone,
          recipientName: fullName,
          messageText,
          vars: { name: fullName, member_no: member.member_no || '', company: companyName, pwa_link: pwaLink, ios_video_link: iosVideoLink, android_video_link: androidVideoLink }
        });
        if (msgId) markAutomated('member_pwa_invite', eventKey, null, 'member', memberId);
      } catch (err) {
        console.error('[marketing] membership PWA invite handler failed:', err.message);
      }
    });

    // ─── Freeze notification on freeze.activated ────────────
    eventBus.on('freeze.activated', async (payload) => {
      try {
        if (!settingsService.get('marketing.freeze_notify_enabled', true)) return;
        const token = settingsService.get('marketing.wesender_token', '');
        const session = settingsService.get('marketing.wesender_session', '');
        if (!token || !session) return;
        const memberId = payload?.memberId;
        const freezeId = payload?.freezeId;
        if (!memberId) return;
        const member = one('SELECT * FROM members WHERE id = ?', [memberId]);
        if (!member) return;
        const phone = normalizePhone(member.phone || member.phone2 || '');
        if (!phone) return;
        const eventKey = `freeze_notify:${freezeId}`;
        if (alreadyAutomated('freeze_notify', eventKey)) return;
        const fullName = [member.first_name, member.middle_name, member.last_name].filter(Boolean).join(' ').trim() || 'عميلنا الكريم';
        const companyName = settingsService.get('app.company_name', '') || settingsService.get('app.name', '') || 'GymOS';
        const freeze = one('SELECT * FROM freeze_requests WHERE id = ?', [freezeId]);
        const membership = freeze ? one('SELECT * FROM memberships WHERE id = ?', [freeze.membership_id]) : null;
        const template = settingsService.get('marketing.freeze_notify_template', '') || 'تم تجميد اشتراكك ❄️';
        const messageText = String(template)
          .replace(/\{name\}/g, fullName)
          .replace(/\{first_name\}/g, member.first_name || '')
          .replace(/\{member_no\}/g, member.member_no || '')
          .replace(/\{company\}/g, companyName)
          .replace(/\{freeze_days\}/g, String(freeze?.total_days || payload?.days || 0))
          .replace(/\{freeze_start\}/g, freeze?.start_date || '')
          .replace(/\{freeze_end\}/g, freeze?.end_date || '')
          .replace(/\{new_end_date\}/g, membership?.end_date || freeze?.membership_end_after || '')
          .replace(/\{plan_name\}/g, membership?.plan_name || '');
        const msgId = await queueAndSend({
          automationCode: 'freeze_notify',
          phone, recipientName: fullName, messageText,
          vars: { name: fullName, freeze_days: String(freeze?.total_days || 0), freeze_start: freeze?.start_date || '', freeze_end: freeze?.end_date || '' }
        });
        if (msgId) markAutomated('freeze_notify', eventKey, null, 'freeze', freezeId);
      } catch (err) {
        console.error('[marketing] freeze notify handler failed:', err.message);
      }
    });

    // ─── Unfreeze welcome on freeze.completed ────────────
    eventBus.on('freeze.completed', async (payload) => {
      try {
        if (!settingsService.get('marketing.unfreeze_notify_enabled', true)) return;
        const token = settingsService.get('marketing.wesender_token', '');
        const session = settingsService.get('marketing.wesender_session', '');
        if (!token || !session) return;
        const memberId = payload?.memberId;
        const freezeId = payload?.freezeId;
        if (!memberId) return;
        const member = one('SELECT * FROM members WHERE id = ?', [memberId]);
        if (!member) return;
        const phone = normalizePhone(member.phone || member.phone2 || '');
        if (!phone) return;
        const eventKey = `unfreeze_notify:${freezeId}`;
        if (alreadyAutomated('unfreeze_notify', eventKey)) return;
        const fullName = [member.first_name, member.middle_name, member.last_name].filter(Boolean).join(' ').trim() || 'عميلنا الكريم';
        const companyName = settingsService.get('app.company_name', '') || settingsService.get('app.name', '') || 'GymOS';
        const membership = one('SELECT ms.*, mp.name as plan_name FROM memberships ms LEFT JOIN membership_plans mp ON mp.id = ms.plan_id WHERE ms.id = ?', [payload?.membershipId]);
        const template = settingsService.get('marketing.unfreeze_notify_template', '') || 'تم فك تجميد اشتراكك ✅';
        const messageText = String(template)
          .replace(/\{name\}/g, fullName)
          .replace(/\{first_name\}/g, member.first_name || '')
          .replace(/\{member_no\}/g, member.member_no || '')
          .replace(/\{company\}/g, companyName)
          .replace(/\{plan_name\}/g, membership?.plan_name || membership?.plan_display || '')
          .replace(/\{end_date\}/g, membership?.end_date || '');
        const msgId = await queueAndSend({
          automationCode: 'unfreeze_notify',
          phone, recipientName: fullName, messageText,
          vars: { name: fullName, plan_name: membership?.plan_name || '', end_date: membership?.end_date || '' }
        });
        if (msgId) markAutomated('unfreeze_notify', eventKey, null, 'freeze', freezeId);
      } catch (err) {
        console.error('[marketing] unfreeze notify handler failed:', err.message);
      }
    });
  }

  app.use('/api/marketing', publicRouter);
  app.use('/api/marketing', router);
};
