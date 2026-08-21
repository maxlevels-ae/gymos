// Shared email provider — SMTP via nodemailer. Usable by any module
// (automation, marketing, members, …). Config comes from settings.
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
const appConfig = require('../config');
const settingsService = require('./settings-service');

const g = (k, d) => { const v = settingsService.get(k, d); return v === undefined || v === null || v === '' ? d : v; };
const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Resolve the brand logo (from general Settings) to a disk file so it can be embedded
// inline in emails as a CID attachment — that renders in every mail client, unlike a
// localhost URL which external inboxes cannot reach. Falls back admin → login logo.
const LOGO_CID = 'brandlogo';
function logoFile() {
  const url = String(g('app.admin_logo_url', '') || g('app.login_logo_url', '') || '').trim();
  if (!url || !url.startsWith('/uploads/')) return null;
  try {
    const rel = url.replace(/^\/uploads\//, '').replace(/\.\.+/g, '');
    const abs = path.resolve(appConfig.paths.uploads, rel);
    if (!abs.startsWith(path.resolve(appConfig.paths.uploads))) return null;
    return fs.existsSync(abs) ? abs : null;
  } catch (_) { return null; }
}
function hasLogo() { return !!logoFile(); }

function config() {
  return {
    enabled: String(g('email.enabled', 'false')) === 'true',
    host: String(g('email.smtp_host', '') || '').trim(),
    port: Number(g('email.smtp_port', 587)) || 587,
    secure: String(g('email.smtp_secure', 'false')) === 'true',
    user: String(g('email.smtp_user', '') || '').trim(),
    pass: String(g('email.smtp_pass', '') || '').trim(),
    fromEmail: String(g('email.from_email', '') || '').trim(),
    fromName: String(g('email.from_name', '') || g('app.company_name', '') || g('app.name', 'GymOS')).trim(),
  };
}
function isConfigured() { const c = config(); return !!(c.host && c.fromEmail); }
function accent() { return String(g('app.brand_color', '') || '#714B67'); }
function company() { return g('app.company_name', '') || g('app.name', '') || g('member_pwa.app_name', 'GymOS'); }

let _transport = null, _sig = '';
function transport() {
  const c = config();
  const sig = [c.host, c.port, c.secure, c.user, c.pass].join('|');
  if (!_transport || sig !== _sig) {
    _transport = nodemailer.createTransport({ host: c.host, port: c.port, secure: c.secure, auth: c.user ? { user: c.user, pass: c.pass } : undefined, tls: { rejectUnauthorized: false } });
    _sig = sig;
  }
  return _transport;
}

// Map a raw SMTP/network error into a clear, actionable hint (EN + AR).
function diagnose(e) {
  const code = e && (e.responseCode || e.code || '');
  const msg = String((e && e.message) || '').toLowerCase();
  const resp = String((e && e.response) || '').toLowerCase();
  const has = (s) => msg.includes(s) || resp.includes(s);
  if (code === 525 || has('unauthorized ip') || has('5.7.1')) return {
    hint: 'Your email provider is blocking this server\'s IP address. Authorize the sending IP (or disable IP restriction) in your provider\'s security settings — for Brevo: Security → Authorized IPs.',
    hintAr: 'مزوّد البريد يحظر عنوان IP لهذا الخادم. أضِف عنوان IP إلى القائمة المسموح بها (أو عطّل قيود IP) من إعدادات الأمان لدى المزوّد — في Brevo: Security ← Authorized IPs.' };
  if (code === 'EAUTH' || code === 535 || has('invalid login') || has('authentication failed') || has('5.7.8')) return {
    hint: 'Login rejected. Check the SMTP username and the password/key are correct (for Brevo the login is the smtp-brevo.com user, not your account email).',
    hintAr: 'تم رفض تسجيل الدخول. تأكد من صحة اسم مستخدم SMTP وكلمة المرور/المفتاح (في Brevo اسم الدخول هو مستخدم smtp-brevo.com وليس بريد حسابك).' };
  if (code === 'ENOTFOUND' || code === 'EDNS' || has('getaddrinfo')) return {
    hint: 'SMTP host not found. Double-check the SMTP server address for typos.',
    hintAr: 'تعذّر العثور على خادم SMTP. تحقق من عنوان الخادم من الأخطاء الإملائية.' };
  if (code === 'ETIMEDOUT' || code === 'ECONNECTION' || code === 'ESOCKET' || has('timeout') || has('econnrefused')) return {
    hint: 'Could not reach the SMTP server. Verify the port (587 for STARTTLS, 465 for SSL) and that a firewall isn\'t blocking outbound SMTP.',
    hintAr: 'تعذّر الوصول إلى خادم SMTP. تحقق من المنفذ (587 لـ STARTTLS أو 465 لـ SSL) ومن أن الجدار الناري لا يحجب المنافذ الصادرة.' };
  if (has('certificate') || has('self signed') || has('self-signed')) return {
    hint: 'TLS certificate error. Try toggling the "secure" (SSL) option, or use port 587 with secure off.',
    hintAr: 'خطأ في شهادة TLS. جرّب تبديل خيار الاتصال الآمن (SSL) أو استخدم المنفذ 587 مع إيقاف الوضع الآمن.' };
  if (has('not activated') || has('account') && has('review') || has('sender') && (has('not') || has('verify'))) return {
    hint: 'Provider hasn\'t activated sending or the sender address isn\'t verified. Complete account activation and verify the "from" email in your provider dashboard.',
    hintAr: 'لم يُفعّل المزوّد الإرسال أو أن عنوان المرسل غير موثّق. أكمِل تفعيل الحساب ووثّق بريد المرسل من لوحة تحكم المزوّد.' };
  return { hint: '', hintAr: '' };
}

async function sendEmail({ to, subject, html, text }) {
  const c = config();
  if (!c.host || !c.fromEmail) return { ok: false, error: 'Email provider not configured', hint: 'Set the SMTP host and a "from" email in settings.', hintAr: 'أدخل خادم SMTP وبريد المرسل في الإعدادات.' };
  if (!to) return { ok: false, error: 'No recipient email' };
  try {
    const mail = { from: `"${c.fromName}" <${c.fromEmail}>`, to, subject: subject || '', html: html || undefined, text: text || (html ? undefined : ' ') };
    // Embed the brand logo inline when the template references it.
    const lf = logoFile();
    if (lf && html && html.includes('cid:' + LOGO_CID)) {
      mail.attachments = [{ filename: 'logo' + (path.extname(lf) || '.png'), path: lf, cid: LOGO_CID }];
    }
    await transport().sendMail(mail);
    return { ok: true };
  } catch (e) { const d = diagnose(e); return { ok: false, error: e.message, code: e.responseCode || e.code || '', hint: d.hint, hintAr: d.hintAr }; }
}

// ── Branded HTML templates ──
function shell(inner) {
  return `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f2fa;font-family:'Segoe UI',Tahoma,Arial,sans-serif;color:#1e1b3a;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f2fa;padding:28px 12px;"><tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 6px 24px rgba(30,27,58,.08);">
${inner}
</table>
<div style="color:#b0aece;font-size:11px;margin-top:14px;">${esc(company())}</div>
</td></tr></table></body></html>`;
}
function header(title, subtitle) {
  const a = accent();
  const logo = hasLogo();
  const align = logo ? 'center' : 'right';
  const badge = logo
    ? `<span style="display:inline-block;background:#ffffff;border-radius:14px;padding:10px 16px;margin-bottom:14px;box-shadow:0 4px 14px rgba(0,0,0,.12);"><img src="cid:${LOGO_CID}" alt="${esc(company())}" style="max-height:46px;max-width:180px;display:block;"></span><br>`
    : '';
  return `<tr><td style="background:linear-gradient(135deg,${a},#8c6280);padding:28px;text-align:${align};">
  ${badge}
  <div style="color:#ffffff;font-size:13px;opacity:.9;letter-spacing:.3px;">${esc(company())}</div>
  <div style="color:#ffffff;font-size:22px;font-weight:800;margin-top:6px;">${esc(title)}</div>
  ${subtitle ? `<div style="color:#ffffff;opacity:.85;font-size:13px;margin-top:6px;">${esc(subtitle)}</div>` : ''}
</td></tr>`;
}
function footer(note) {
  return `<tr><td style="padding:18px 24px;background:#faf9ff;border-top:1px solid #eef0f5;color:#9896b4;font-size:12px;text-align:center;">${esc(note || ('تقرير آلي · ' + company()))}</td></tr>`;
}

// A clean KPI-style report: sections = [{ label, value }]
function reportEmail({ title, subtitle, sections = [], note }) {
  const rows = sections.map((s, i) => `
    <tr>
      <td style="padding:15px 22px;border-top:${i ? '1px solid #eef0f5' : 'none'};color:#5b5772;font-size:14px;">${esc(s.label)}</td>
      <td style="padding:15px 22px;border-top:${i ? '1px solid #eef0f5' : 'none'};text-align:left;font-weight:700;color:#1e1b3a;font-size:16px;white-space:nowrap;">${esc(s.value)}</td>
    </tr>`).join('');
  const body = `<tr><td style="padding:6px 6px 14px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>
  </td></tr>`;
  return shell(header(title, subtitle) + body + footer(note));
}

// A simple branded message (welcome, reminder, etc.). body = plain text.
function messageEmail({ title, body, ctaText, ctaUrl }) {
  const a = accent();
  const html = String(body || '').split('\n').map(l => l.trim() ? `<p style="margin:0 0 10px;color:#3a3752;font-size:14px;line-height:1.8;">${esc(l)}</p>` : '<div style="height:8px"></div>').join('');
  const cta = (ctaText && ctaUrl) ? `<tr><td style="padding:4px 28px 24px;"><a href="${esc(ctaUrl)}" style="display:inline-block;background:${a};color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:12px 24px;border-radius:10px;">${esc(ctaText)}</a></td></tr>` : '';
  const bodyCell = `<tr><td style="padding:24px 28px 8px;">${html}</td></tr>`;
  return shell(header(title || company()) + bodyCell + cta + footer());
}

module.exports = { sendEmail, isConfigured, reportEmail, messageEmail, config, company };
