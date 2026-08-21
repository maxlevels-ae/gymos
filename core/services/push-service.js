// Web Push (VAPID) for the member PWA — lets members receive real notifications
// on their device (lock screen, app closed) with sound + vibration.
const database = require('../database');
const settingsService = require('./settings-service');

let webpush = null;
try { webpush = require('web-push'); } catch (_) { webpush = null; }

// Ensure a VAPID keypair exists (generated once, persisted in settings).
function ensureVapid() {
  let pub = String(settingsService.get('push.vapid_public', '') || '').trim();
  let priv = String(settingsService.get('push.vapid_private', '') || '').trim();
  if ((!pub || !priv) && webpush) {
    try {
      const keys = webpush.generateVAPIDKeys();
      pub = keys.publicKey; priv = keys.privateKey;
      settingsService.set('push.vapid_public', pub, { type: 'string', module: 'core' });
      settingsService.set('push.vapid_private', priv, { type: 'string', module: 'core' });
    } catch (_) {}
  }
  return { pub, priv };
}

function subject() {
  const s = String(settingsService.get('push.subject', '') || '').trim();
  if (/^mailto:|^https?:\/\//i.test(s)) return s;
  const email = String(settingsService.get('email.from_email', '') || settingsService.get('automation.admin_email', '') || '').trim();
  return email ? 'mailto:' + email : 'mailto:admin@gymos.app';
}

function isConfigured() { const v = ensureVapid(); return !!(webpush && v.pub && v.priv); }
function publicKey() { return ensureVapid().pub; }

// Store (or refresh) a browser subscription for a member.
function saveSubscription(memberId, sub, userAgent) {
  if (!sub || !sub.endpoint) return { ok: false, error: 'Invalid subscription' };
  const keys = sub.keys || {};
  try {
    database.run(
      `INSERT INTO push_subscriptions (member_id, endpoint, p256dh, auth, user_agent) VALUES (?,?,?,?,?)
       ON CONFLICT(endpoint) DO UPDATE SET member_id=excluded.member_id, p256dh=excluded.p256dh, auth=excluded.auth, user_agent=excluded.user_agent`,
      [memberId, sub.endpoint, keys.p256dh || '', keys.auth || '', String(userAgent || '').slice(0, 300)]
    );
    return { ok: true };
  } catch (e) {
    // Fallback for SQLite builds without UPSERT support.
    try {
      database.run('DELETE FROM push_subscriptions WHERE endpoint=?', [sub.endpoint]);
      database.run('INSERT INTO push_subscriptions (member_id, endpoint, p256dh, auth, user_agent) VALUES (?,?,?,?,?)',
        [memberId, sub.endpoint, keys.p256dh || '', keys.auth || '', String(userAgent || '').slice(0, 300)]);
      return { ok: true };
    } catch (e2) { return { ok: false, error: e2.message }; }
  }
}

function removeSubscription(endpoint) {
  try { database.run('DELETE FROM push_subscriptions WHERE endpoint=?', [endpoint]); } catch (_) {}
}

// Send a push to every device a member has registered. Dead subscriptions are pruned.
async function pushToMember(memberId, payload) {
  if (!isConfigured()) return { ok: false, error: 'Web push not configured' };
  const { pub, priv } = ensureVapid();
  try { webpush.setVapidDetails(subject(), pub, priv); } catch (e) { return { ok: false, error: e.message }; }
  let subs = [];
  try { subs = database.getAll('SELECT * FROM push_subscriptions WHERE member_id=?', [memberId]) || []; } catch (_) {}
  if (!subs.length) return { ok: true, sent: 0 };
  const body = JSON.stringify(payload || {});
  let sent = 0;
  for (const s of subs) {
    const subscription = { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } };
    try { await webpush.sendNotification(subscription, body, { TTL: 3600 }); sent++; }
    catch (e) { if (e && (e.statusCode === 404 || e.statusCode === 410)) removeSubscription(s.endpoint); }
  }
  return { ok: true, sent };
}

module.exports = { ensureVapid, isConfigured, publicKey, subject, saveSubscription, removeSubscription, pushToMember };
