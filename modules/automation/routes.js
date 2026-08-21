const express = require('express');
const settingsService = require('../../core/services/settings-service');
const emailService = require('../../core/services/email-service');
const { authMiddleware, requirePermission } = require('../../core/middleware/auth');

let _sweep = null;

module.exports = function (app, { database, eventBus } = {}) {
  const db = database;
  const router = express.Router();
  const num = (v, d = 0) => { const n = Number(v); return Number.isFinite(n) ? n : d; };
  const setget = (k, d) => { const v = settingsService.get(k, d); return v === undefined || v === null || v === '' ? d : v; };
  const fullName = m => [m.first_name, m.middle_name, m.last_name].filter(Boolean).join(' ').trim() || m.first_name || (m.member_no || '');
  const company = () => setget('app.company_name', '') || setget('app.name', '') || setget('member_pwa.app_name', 'GymOS');
  function pwaLinkAbs() { let l = setget('qr_registration.pwa_link', '/member/') || '/member/'; if (!/^https?:\/\//i.test(l)) { const b = String(setget('app.public_url', '') || '').trim().replace(/\/$/, ''); if (b) l = b + (l.startsWith('/') ? l : '/' + l); } return l; }
  const render = (tpl, ctx) => String(tpl || '').replace(/\{(\w+)\}/g, (_, k) => (ctx[k] !== undefined ? String(ctx[k]) : ''));
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  // ── Channel senders ──
  function normalizePhone(p) { let s = String(p || '').replace(/[^\d+]/g, ''); if (s.startsWith('+')) s = s.slice(1); if (s.startsWith('00')) s = s.slice(2); if (s.startsWith('0')) s = '962' + s.slice(1); else if (!s.startsWith('962') && s.length <= 10) s = '962' + s; return s; }
  // Absolute, publicly-reachable brand logo URL (from general Settings). Needs
  // app.public_url set — WaSender fetches the image from the internet, so a
  // localhost path won't work; in that case we send text only.
  function logoPublicUrl() {
    const logo = String(setget('app.admin_logo_url', '') || setget('app.login_logo_url', '') || '').trim();
    if (!logo) return '';
    if (/^https?:\/\//i.test(logo)) return logo;
    const b = String(setget('app.public_url', '') || '').trim().replace(/\/$/, '');
    return b ? b + (logo.startsWith('/') ? logo : '/' + logo) : '';
  }
  async function sendWhatsApp(phone, text) {
    const base = String(setget('marketing.wesender_base_url', '') || '').trim().replace(/\/$/, '');
    const token = String(setget('marketing.wesender_token', '') || '').trim();
    const sendPath = String(setget('marketing.wesender_send_path', '/api/send-message') || '/api/send-message').trim();
    const session = String(setget('marketing.wesender_session', '') || '').trim();
    if (!base || !token) return { ok: false, error: 'WhatsApp gateway not configured' };
    if (!phone) return { ok: false, error: 'no phone' };
    try {
      const payload = { to: '+' + normalizePhone(phone), text };
      const img = logoPublicUrl();
      if (img) payload.imageUrl = img; // send the logo as a header image with the message as caption
      if (session) payload.session = session;
      const r = await fetch(base + sendPath, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify(payload) });
      const body = await r.text();
      if (!r.ok) return { ok: false, error: 'gateway ' + r.status + ': ' + String(body).slice(0, 140) };
      return { ok: true };
    } catch (e) { return { ok: false, error: e.message }; }
  }
  const pushService = require('../../core/services/push-service');
  function sendNotif(memberId, text) { try { db.run("INSERT INTO member_notifications (member_id,category,title,title_ar,body,body_ar,is_read,created_at) VALUES (?,?,?,?,?,?,0,datetime('now'))", [memberId, 'general', 'تنبيه', 'تنبيه', text, text]); try { pushService.pushToMember(memberId, { title: company(), body: text, category: 'general', url: '/member/' }).catch(() => {}); } catch (_) {} return { ok: true }; } catch (e) { return { ok: false, error: e.message }; } }

  // ── Log / dedup ──
  function alreadyRan(runKey) { try { return !!db.getOne('SELECT id FROM automation_log WHERE run_key = ?', [runKey]); } catch (_) { return false; } }
  function logRun(rule, member, channel, status, detail, runKey, retryable) {
    try {
      db.run(`INSERT OR IGNORE INTO automation_log (rule_id, rule_name, member_id, member_name, channel, status, detail, run_key, attempts, retryable, created_at) VALUES (?,?,?,?,?,?,?,?,1,?,datetime('now'))`,
        [rule.id, rule.name_ar || rule.name || '', member ? member.id : null, member ? fullName(member) : '', channel, status, detail || '', runKey || '', retryable ? 1 : 0]);
    } catch (_) {}
  }
  const MAX_ATTEMPTS = 4;
  function isRetryable(err) {
    const e = String(err || '').toLowerCase();
    if (/429|too many|rate|retry_after|protection/.test(e)) return true;               // rate limited — transient
    if (/timeout|timed out|econnreset|etimedout|enotfound|econnrefused|fetch failed|network|socket|502|503|504|gateway 5\d\d/.test(e)) return true; // network / 5xx — transient
    return false;                                                                        // 4xx, not-configured, no-phone, invalid number → permanent (don't retry)
  }
  async function sendChannel(ch, member, text) {
    if (ch === 'whatsapp') { const r = await sendWhatsApp(member.phone || member.phone2, text); await sleep(5200); /* WaSender: 1 msg / 5s */ return r; }
    if (ch === 'notif') return sendNotif(member.id, text);
    if (ch === 'email') return member.email ? await emailService.sendEmail({ to: member.email, subject: company(), html: emailService.messageEmail({ title: company(), body: text }) }) : { ok: false, error: 'Member has no email' };
    if (ch === 'sms') return { ok: false, error: 'No SMS gateway configured' };
    return { ok: false, error: 'unknown channel' };
  }

  async function deliver(rule, member, text, dayKey) {
    let channels = []; try { channels = JSON.parse(rule.channels || '[]'); } catch (_) { channels = ['whatsapp']; }
    for (const ch of channels) {
      const runKey = `r${rule.id}:m${member.id}:${ch}:${dayKey}`;
      let existing = null; try { existing = db.getOne('SELECT id, status, attempts, retryable FROM automation_log WHERE run_key = ?', [runKey]); } catch (_) {}
      if (existing) {
        if (existing.status === 'sent') continue;                       // already delivered
        if (!existing.retryable) continue;                              // permanent API failure — do not retry
        if (num(existing.attempts, 1) >= MAX_ATTEMPTS) continue;        // gave up after MAX attempts
        const res = await sendChannel(ch, member, text);               // retry a transient failure
        const retry = res.ok ? 0 : (isRetryable(res.error) ? 1 : 0);
        try { db.run("UPDATE automation_log SET status=?, detail=?, attempts=attempts+1, retryable=?, created_at=datetime('now') WHERE id=?", [res.ok ? 'sent' : 'failed', res.error || '', retry, existing.id]); } catch (_) {}
      } else {
        const res = await sendChannel(ch, member, text);
        logRun(rule, member, ch, res.ok ? 'sent' : 'failed', res.error || '', runKey, res.ok ? 0 : (isRetryable(res.error) ? 1 : 0));
      }
    }
  }

  // ── Rule evaluation ──
  async function runRule(rule) {
    if (rule.trigger === 'weekly_report') return runWeeklyReport(rule);
    const today = db.getOne("SELECT date('now','localtime') d")?.d;
    const co = company(), pwa = pwaLinkAbs();
    const money = v => (v != null ? Number(v).toFixed(2) + ' د.أ' : '');
    const ctx = m => ({ name: fullName(m), first_name: m.first_name || '', member_no: m.member_no || '', company: co, pwa_link: pwa, end_date: m.end_date || '', plan: m.plan_name || '', days: num(rule.offset_days), amount: money(m.debt_amount), debt: money(m.debt_amount) });
    const tpl = rule.template_ar || rule.template || '';
    const N = num(rule.offset_days);
    let members = [];
    if (rule.trigger === 'expiry_before')
      members = db.getAll(`SELECT m.*, ms.end_date, ms.plan_name FROM memberships ms JOIN members m ON m.id = ms.member_id WHERE ms.status='active' AND date(ms.end_date) = date('now','localtime','+${N} day')`);
    else if (rule.trigger === 'expiry_on')
      members = db.getAll(`SELECT m.*, ms.end_date, ms.plan_name FROM memberships ms JOIN members m ON m.id = ms.member_id WHERE ms.status IN ('active','expired') AND date(ms.end_date) = date('now','localtime')`);
    else if (rule.trigger === 'expiry_after')
      members = db.getAll(`SELECT m.*, ms.end_date, ms.plan_name FROM memberships ms JOIN members m ON m.id = ms.member_id WHERE ms.status IN ('active','expired') AND date(ms.end_date) = date('now','localtime','-${N} day')`);
    else if (rule.trigger === 'inactive')
      members = db.getAll(`SELECT m.* FROM members m WHERE m.status='active' AND (m.last_visit_at IS NULL OR date(m.last_visit_at) <= date('now','localtime','-${N} day')) AND date(m.created_at) <= date('now','localtime','-${N} day')`);
    else if (rule.trigger === 'birthday')
      members = db.getAll(`SELECT m.* FROM members m WHERE m.status='active' AND m.date_of_birth IS NOT NULL AND m.date_of_birth != '' AND strftime('%m-%d', m.date_of_birth) = strftime('%m-%d','now','localtime')`);
    else if (rule.trigger === 'debt') {
      try {
        members = db.getAll(`SELECT m.*, d.amount AS debt_amount FROM members m JOIN (
            SELECT member_id, SUM(bal) AS amount FROM (
              SELECT member_id, (total - COALESCE(paid_total,0)) AS bal FROM cafeteria_orders WHERE member_id IS NOT NULL AND status NOT IN ('void','draft','cancelled','refunded') AND (total - COALESCE(paid_total,0)) > 0.009
              UNION ALL
              SELECT member_id, COALESCE(balance_due,0) AS bal FROM memberships WHERE member_id IS NOT NULL AND COALESCE(balance_due,0) > 0.009
            ) GROUP BY member_id HAVING amount > 0.009
          ) d ON d.member_id = m.id WHERE m.status='active'`);
      } catch (_) { members = []; }
    }
    let processed = 0;
    for (const m of members) { if (!m || !m.id) continue; await deliver(rule, m, render(tpl, ctx(m)), today); processed++; }
    try { db.run("UPDATE automation_rules SET last_run_at = datetime('now') WHERE id = ?", [rule.id]); } catch (_) {}
    return processed;
  }

  // Report section registry: key -> { label, compute }
  const safeVal = (sql, col) => { try { const r = db.getOne(sql); return r ? num(r[col]) : 0; } catch (_) { return 0; } };
  const money = v => Number(v || 0).toFixed(2) + ' د.أ';
  function reportSectionValues() {
    return {
      active_members: { label: 'الأعضاء النشطون', value: safeVal("SELECT COUNT(*) c FROM members WHERE status='active'", 'c') },
      new_members: { label: 'أعضاء جدد (٧ أيام)', value: safeVal("SELECT COUNT(*) c FROM members WHERE date(created_at) >= date('now','localtime','-7 day')", 'c') },
      expiring: { label: 'اشتراكات تنتهي هذا الأسبوع', value: safeVal("SELECT COUNT(*) c FROM memberships WHERE status='active' AND date(end_date) BETWEEN date('now','localtime') AND date('now','localtime','+7 day')", 'c') },
      expired: { label: 'اشتراكات منتهية (٧ أيام)', value: safeVal("SELECT COUNT(*) c FROM memberships WHERE date(end_date) BETWEEN date('now','localtime','-7 day') AND date('now','localtime')", 'c') },
      revenue: { label: 'إيراد الأسبوع', value: money(safeVal("SELECT COALESCE(SUM(amount),0) s FROM membership_payments WHERE date(payment_date) >= date('now','localtime','-7 day')", 's')) },
      attendance: { label: 'عدد الزيارات (٧ أيام)', value: safeVal("SELECT COUNT(*) c FROM attendance_logs WHERE date(check_in) >= date('now','localtime','-7 day')", 'c') },
      debts: { label: 'إجمالي الديون المستحقة', value: money(safeVal("SELECT COALESCE(SUM(bal),0) s FROM (SELECT (total-COALESCE(paid_total,0)) bal FROM cafeteria_orders WHERE status NOT IN ('void','draft','cancelled','refunded') UNION ALL SELECT COALESCE(balance_due,0) FROM memberships)", 's')) },
      cancellations: { label: 'اشتراكات ملغاة (٧ أيام)', value: safeVal("SELECT COUNT(*) c FROM memberships WHERE status='cancelled' AND date(COALESCE(cancelled_at,updated_at)) >= date('now','localtime','-7 day')", 'c') },
      // ── Sales / Cafeteria ──
      cafeteria: { label: 'مبيعات الكافتيريا (٧ أيام)', value: money(safeVal("SELECT COALESCE(SUM(total),0) s FROM cafeteria_orders WHERE status NOT IN ('void','draft','cancelled') AND date(created_at) >= date('now','localtime','-7 day')", 's')) },
      cafeteria_orders: { label: 'عدد الطلبات (٧ أيام)', value: safeVal("SELECT COUNT(*) c FROM cafeteria_orders WHERE status NOT IN ('void','draft','cancelled') AND date(created_at) >= date('now','localtime','-7 day')", 'c') },
      cafeteria_profit: { label: 'ربح الكافتيريا (٧ أيام)', value: money(safeVal("SELECT COALESCE(SUM(gross_profit),0) s FROM cafeteria_orders WHERE status NOT IN ('void','draft','cancelled') AND date(created_at) >= date('now','localtime','-7 day')", 's')) },
      // ── Inventory ──
      low_stock: { label: 'أصناف قاربت على النفاد', value: safeVal("SELECT COUNT(*) c FROM cafeteria_products WHERE product_type='stockable' AND qty_on_hand <= low_stock_threshold AND qty_on_hand > 0", 'c') },
      out_of_stock: { label: 'أصناف نفدت من المخزون', value: safeVal("SELECT COUNT(*) c FROM cafeteria_products WHERE product_type='stockable' AND qty_on_hand <= 0", 'c') },
      stock_value: { label: 'قيمة المخزون الحالية', value: money(safeVal("SELECT COALESCE(SUM(qty_on_hand*COALESCE(cost_price,0)),0) s FROM cafeteria_products WHERE product_type='stockable'", 's')) },
      // ── Accounting / Finance ──
      unpaid_invoices: { label: 'فواتير عملاء غير مسددة (عدد)', value: safeVal("SELECT COUNT(*) c FROM accounting_invoices WHERE invoice_type='customer' AND residual_amount > 0.009", 'c') },
      receivables: { label: 'ذمم مدينة مستحقة', value: money(safeVal("SELECT COALESCE(SUM(residual_amount),0) s FROM accounting_invoices WHERE invoice_type='customer' AND residual_amount > 0.009", 's')) },
      payables: { label: 'ذمم دائنة للموردين', value: money(safeVal("SELECT COALESCE(SUM(residual_amount),0) s FROM accounting_invoices WHERE invoice_type='supplier' AND residual_amount > 0.009", 's')) },
      // ── HR ──
      pending_leaves: { label: 'طلبات إجازة معلّقة', value: safeVal("SELECT COUNT(*) c FROM hr_leave_requests WHERE status='pending'", 'c') },
    };
  }

  async function runWeeklyReport(rule) {
    const wk = db.getOne("SELECT strftime('%Y-%W','now','localtime') w")?.w;
    const runKey = `r${rule.id}:week:${wk}`;
    if (alreadyRan(runKey)) return 0;
    let secs = []; try { secs = JSON.parse(rule.report_sections || '[]'); } catch (_) {}
    if (!secs.length) secs = ['active_members', 'expiring', 'revenue'];
    const all = reportSectionValues();
    const header = render(rule.template_ar || rule.template || 'تقرير {company} الأسبوعي:', { company: company() });
    const keys = secs.filter(k => all[k]);
    const lines = keys.map(k => `• ${all[k].label}: ${all[k].value}`);
    const text = header + '\n' + lines.join('\n');
    const sectionList = keys.map(k => ({ label: all[k].label, value: String(all[k].value) }));
    const adminPhone = setget('automation.admin_phone', '') || setget('app.owner_phone', '');
    const adminEmail = setget('automation.admin_email', '') || setget('email.admin_email', '');
    let channels = []; try { channels = JSON.parse(rule.channels || '[]'); } catch (_) { channels = ['whatsapp']; }
    let any = false;
    for (const ch of channels) {
      let res = { ok: false, error: 'channel not applicable to admin report' };
      if (ch === 'whatsapp') res = adminPhone ? await sendWhatsApp(adminPhone, text) : { ok: false, error: 'No admin phone (set it in Automation settings)' };
      else if (ch === 'email') res = adminEmail ? await emailService.sendEmail({ to: adminEmail, subject: company() + ' — ' + header.split('\n')[0], html: emailService.reportEmail({ title: header.split('\n')[0] || 'التقرير الأسبوعي', subtitle: 'ملخص الأسبوع الماضي', sections: sectionList }) }) : { ok: false, error: 'No admin email (set it in Automation settings)' };
      if (res.ok) any = true;
      logRun(rule, null, ch, res.ok ? 'sent' : 'failed', res.error || '', runKey + ':' + ch, res.ok ? 0 : (isRetryable(res.error) ? 1 : 0));
    }
    logRun(rule, null, 'report', any ? 'sent' : 'failed', lines.join(' · '), runKey);
    try { db.run("UPDATE automation_rules SET last_run_at = datetime('now') WHERE id = ?", [rule.id]); } catch (_) {}
    return 1;
  }

  async function runAll(force) {
    let rules = []; try { rules = db.getAll('SELECT * FROM automation_rules WHERE is_active = 1'); } catch (_) { return; }
    const wd = num(db.getOne("SELECT strftime('%w','now','localtime') w")?.w);
    for (const rule of rules) {
      try {
        if (rule.trigger === 'weekly_report' && !force && wd !== num(rule.run_weekday)) continue;
        await runRule(rule);
      } catch (e) { console.error('[automation] rule', rule.id, 'failed:', e.message); }
    }
  }

  // ── Routes ──
  router.use(authMiddleware);
  router.get('/overview', requirePermission('automation.view'), (_req, res) => {
    res.json({ success: true, data: {
      rules: num(db.getOne('SELECT COUNT(*) c FROM automation_rules')?.c),
      activeRules: num(db.getOne('SELECT COUNT(*) c FROM automation_rules WHERE is_active=1')?.c),
      sent7: num(db.getOne("SELECT COUNT(*) c FROM automation_log WHERE status='sent' AND created_at>=datetime('now','-7 days')")?.c),
      failed7: num(db.getOne("SELECT COUNT(*) c FROM automation_log WHERE status='failed' AND created_at>=datetime('now','-7 days')")?.c),
    } });
  });
  router.get('/rules', requirePermission('automation.view'), (_req, res) => res.json({ success: true, data: db.getAll('SELECT * FROM automation_rules ORDER BY id') }));
  const chJson = c => JSON.stringify(Array.isArray(c) ? c : ['whatsapp']);
  const secJson = s => JSON.stringify(Array.isArray(s) ? s : ['active_members', 'expiring', 'revenue']);
  router.post('/rules', requirePermission('automation.manage'), (req, res) => { const b = req.body || {}; const r = db.run(`INSERT INTO automation_rules (name,name_ar,trigger,offset_days,run_weekday,recipient,channels,template,template_ar,report_sections,is_active) VALUES (?,?,?,?,?,?,?,?,?,?,?)`, [b.name || '', b.name_ar || '', b.trigger || 'expiry_before', num(b.offset_days), num(b.run_weekday), b.recipient || 'member', chJson(b.channels), b.template || '', b.template_ar || '', secJson(b.report_sections), b.is_active === false ? 0 : 1]); res.json({ success: true, data: { id: r.lastInsertRowid } }); });
  router.put('/rules/:id', requirePermission('automation.manage'), (req, res) => { const b = req.body || {}; db.run(`UPDATE automation_rules SET name=?,name_ar=?,trigger=?,offset_days=?,run_weekday=?,recipient=?,channels=?,template=?,template_ar=?,report_sections=?,is_active=?,updated_at=datetime('now') WHERE id=?`, [b.name || '', b.name_ar || '', b.trigger || 'expiry_before', num(b.offset_days), num(b.run_weekday), b.recipient || 'member', chJson(b.channels), b.template || '', b.template_ar || '', secJson(b.report_sections), b.is_active === false ? 0 : 1, req.params.id]); res.json({ success: true }); });
  router.delete('/rules/:id', requirePermission('automation.manage'), (req, res) => { db.run('DELETE FROM automation_rules WHERE id=?', [req.params.id]); res.json({ success: true }); });
  router.post('/rules/:id/run', requirePermission('automation.manage'), async (req, res) => { const rule = db.getOne('SELECT * FROM automation_rules WHERE id=?', [req.params.id]); if (!rule) return res.status(404).json({ success: false, error: 'not found' }); try { const n = await runRule(rule); res.json({ success: true, data: { processed: n } }); } catch (e) { res.status(400).json({ success: false, error: e.message }); } });
  router.post('/run-now', requirePermission('automation.manage'), async (_req, res) => { try { await runAll(true); res.json({ success: true }); } catch (e) { res.status(400).json({ success: false, error: e.message }); } });
  router.get('/log', requirePermission('automation.view'), (req, res) => res.json({ success: true, data: db.getAll('SELECT * FROM automation_log ORDER BY id DESC LIMIT ?', [num(req.query.limit, 100)]) }));
  // Clear the log — also resets the per-member/day dedup keys, so rules re-send on the
  // next run (use after fixing member data such as a missing email/phone).
  router.delete('/log', requirePermission('automation.manage'), (req, res) => {
    try {
      if (req.query.failed === '1') db.run("DELETE FROM automation_log WHERE status='failed'");
      else db.run('DELETE FROM automation_log');
      res.json({ success: true });
    } catch (e) { res.status(400).json({ success: false, error: e.message }); }
  });
  router.get('/settings', requirePermission('automation.view'), (_req, res) => res.json({ success: true, data: {
    admin_phone: setget('automation.admin_phone', ''),
    admin_email: setget('automation.admin_email', ''),
    gateway_configured: !!(String(setget('marketing.wesender_base_url', '') || '').trim() && String(setget('marketing.wesender_token', '') || '').trim()),
    email_configured: emailService.isConfigured(),
    email_enabled: String(setget('email.enabled', 'false')) === 'true',
    email_smtp_host: setget('email.smtp_host', ''),
    email_smtp_port: setget('email.smtp_port', 587),
    email_smtp_secure: String(setget('email.smtp_secure', 'false')) === 'true',
    email_smtp_user: setget('email.smtp_user', ''),
    email_smtp_pass_set: !!String(setget('email.smtp_pass', '') || '').trim(),
    email_from_email: setget('email.from_email', ''),
    email_from_name: setget('email.from_name', ''),
  } }));
  router.put('/settings', requirePermission('automation.manage'), (req, res) => {
    const b = req.body || {};
    const S = (k, v, type = 'string') => settingsService.set(k, String(v), { type, module: 'automation' });
    if (b.admin_phone !== undefined) S('automation.admin_phone', b.admin_phone);
    if (b.admin_email !== undefined) S('automation.admin_email', b.admin_email);
    if (b.email_enabled !== undefined) S('email.enabled', b.email_enabled ? 'true' : 'false', 'boolean');
    if (b.email_smtp_host !== undefined) S('email.smtp_host', b.email_smtp_host);
    if (b.email_smtp_port !== undefined) S('email.smtp_port', b.email_smtp_port, 'number');
    if (b.email_smtp_secure !== undefined) S('email.smtp_secure', b.email_smtp_secure ? 'true' : 'false', 'boolean');
    if (b.email_smtp_user !== undefined) S('email.smtp_user', b.email_smtp_user);
    if (b.email_smtp_pass) S('email.smtp_pass', b.email_smtp_pass); // only overwrite when provided
    if (b.email_from_email !== undefined) S('email.from_email', b.email_from_email);
    if (b.email_from_name !== undefined) S('email.from_name', b.email_from_name);
    res.json({ success: true });
  });
  // Send a test email to verify the provider
  router.post('/test-email', requirePermission('automation.manage'), async (req, res) => {
    const to = (req.body || {}).to;
    if (!to) return res.status(400).json({ success: false, error: 'Recipient email required' });
    const html = emailService.reportEmail({ title: 'رسالة تجريبية', subtitle: 'اختبار مزوّد البريد', sections: [{ label: 'الحالة', value: 'يعمل ✓' }, { label: 'المصدر', value: emailService.company() }] });
    const r = await emailService.sendEmail({ to, subject: emailService.company() + ' — رسالة تجريبية', html });
    res.json({ success: true, data: r });
  });

  app.use('/api/automation', router);

  // Scheduler: shortly after boot, then hourly.
  setTimeout(() => { runAll(false).catch(() => {}); }, 30000);
  if (!_sweep) { _sweep = setInterval(() => { runAll(false).catch(() => {}); }, 60 * 60 * 1000); if (_sweep.unref) _sweep.unref(); }
};
