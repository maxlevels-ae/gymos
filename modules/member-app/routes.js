const express = require('express');
const jwt = require('jsonwebtoken');
const config = require('../../core/config');
const settingsService = require('../../core/services/settings-service');
const pushService = require('../../core/services/push-service');
const { authMiddleware, requirePermission } = require('../../core/middleware/auth');

let _notifSweep = null;

module.exports = function (app, { database, eventBus } = {}) {
  const db = database;

  // ── helpers ──────────────────────────────────────────────
  function pwaMember(req) {
    const token = String(req.headers.authorization || '').replace('Bearer ', '').trim();
    if (!token) throw Object.assign(new Error('No token'), { status: 401 });
    const d = jwt.verify(token, config.jwt.secret);
    const type = d.type || d.personType;
    if (d.kind !== 'pwa' || d.tokenType === 'refresh' || type !== 'member') {
      throw Object.assign(new Error('Invalid token scope'), { status: 403 });
    }
    return d.personId || d.id;
  }
  const fail = (res, e) => res.status(e.status || 400).json({ success: false, error: e.message });
  const today = () => db.getOne("SELECT date('now','localtime') d")?.d || new Date().toISOString().slice(0, 10);
  const nowHM = () => db.getOne("SELECT strftime('%H:%M','now','localtime') t")?.t || '00:00';
  const num = (v, d = 0) => { const n = Number(v); return Number.isFinite(n) ? n : d; };
  const setget = (k, d) => { const v = settingsService.get(k, d); return v === undefined || v === null || v === '' ? d : v; };

  function memberRow(id) { return db.getOne('SELECT * FROM members WHERE id = ?', [id]); }
  function latestWeight(id) {
    const r = db.getOne('SELECT weight_kg FROM member_weight_log WHERE member_id = ? ORDER BY logged_on DESC, id DESC LIMIT 1', [id]);
    return r ? num(r.weight_kg) : 0;
  }
  function assignedPlan(id) {
    const a = db.getOne('SELECT plan_id FROM member_meal_assignments WHERE member_id = ?', [id]);
    let plan = a ? db.getOne('SELECT * FROM member_meal_plans WHERE id = ? AND is_active = 1', [a.plan_id]) : null;
    if (!plan) {
      const m = memberRow(id);
      const goal = String(m?.fitness_goal || '').toLowerCase();
      plan = db.getOne('SELECT * FROM member_meal_plans WHERE is_active = 1 AND goal = ? ORDER BY id LIMIT 1', [goal])
        || db.getOne("SELECT * FROM member_meal_plans WHERE is_active = 1 AND goal IN ('maintain','any') ORDER BY id LIMIT 1")
        || db.getOne('SELECT * FROM member_meal_plans WHERE is_active = 1 ORDER BY id LIMIT 1');
    }
    return plan;
  }
  // Compute nutrition targets from the assigned plan, or from the member's real profile if none.
  function nutritionTargets(id) {
    const plan = assignedPlan(id);
    if (plan) {
      return { calories: num(plan.daily_calories), protein: num(plan.protein_g), carbs: num(plan.carbs_g), fat: num(plan.fat_g), water_glasses: num(plan.water_glasses, 8), plan };
    }
    const m = memberRow(id);
    const w = latestWeight(id) || num(m?.initial_weight_kg) || 75;
    const goal = String(m?.fitness_goal || '').toLowerCase();
    const factor = goal === 'bulk' ? 38 : goal === 'cut' ? 28 : 33;
    const calories = Math.round(w * factor);
    return { calories, protein: Math.round(w * 2.2), carbs: Math.round((calories * 0.45) / 4), fat: Math.round((calories * 0.25) / 9), water_glasses: goal === 'cut' ? 10 : 8, plan: null };
  }

  // Notification preferences (defaults mirror the design)
  const PREF_DEFAULTS = { subscription: 1, workouts: 1, meals: 1, water: 0, offers: 1, trainer: 0 };
  function getPrefs(id) {
    const rows = db.getAll('SELECT pref_key, enabled FROM member_notification_prefs WHERE member_id = ?', [id]);
    const map = { ...PREF_DEFAULTS };
    rows.forEach(r => { map[r.pref_key] = r.enabled ? 1 : 0; });
    return map;
  }
  function prefEnabled(id, key) { return getPrefs(id)[key] !== 0; }

  // Create a member notification (deduped by key). Respects the member's category preference.
  function notify(memberId, n) {
    const prefKey = n.prefKey || n.category;
    if (prefKey && !prefEnabled(memberId, prefKey)) return null;
    if (n.dedupe_key) {
      const dup = db.getOne('SELECT id FROM member_notifications WHERE member_id = ? AND dedupe_key = ? LIMIT 1', [memberId, n.dedupe_key]);
      if (dup) return null;
    }
    const r = db.run(
      `INSERT INTO member_notifications (member_id, category, title, title_ar, body, body_ar, action_type, action_label, action_label_ar, dedupe_key)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [memberId, n.category || 'general', n.title || '', n.title_ar || '', n.body || '', n.body_ar || '', n.action_type || '', n.action_label || '', n.action_label_ar || '', n.dedupe_key || '']
    );
    // Deliver a real device push (lock screen / app closed) alongside the in-app entry.
    try {
      pushService.pushToMember(memberId, {
        title: n.title_ar || n.title || 'GRAMS GYM',
        body: n.body_ar || n.body || '',
        category: n.category || 'general',
        tag: 'gymos-notif-' + r.lastInsertRowid,
        url: '/member/',
      }).catch(() => {});
    } catch (_) {}
    return r.lastInsertRowid;
  }

  // Generate real, time-based notifications (subscription expiry + workout reminder).
  function generateNotifications() {
    try {
      // subscription expiry at 7 / 3 / 1 days
      const subs = db.getAll(
        `SELECT ms.member_id, ms.end_date, CAST(julianday(ms.end_date) - julianday('now','localtime') AS INTEGER) AS days_left
         FROM memberships ms
         WHERE ms.status = 'active' AND ms.end_date IS NOT NULL`
      );
      subs.forEach(s => {
        const d = s.days_left;
        if ([7, 3, 1].includes(d)) {
          notify(s.member_id, {
            category: 'subscription', prefKey: 'subscription',
            title: 'Your subscription is ending soon', title_ar: 'اشتراكك ينتهي قريباً',
            body: `Your subscription ends in ${d} day(s) on ${s.end_date}. Renew now to keep training.`,
            body_ar: `ينتهي اشتراكك خلال ${d} ${d === 1 ? 'يوم' : 'أيام'} بتاريخ ${s.end_date}. جدّد الآن لمواصلة التمرين.`,
            action_type: 'subscriptions', action_label: 'Renew subscription', action_label_ar: 'تجديد الاشتراك',
            dedupe_key: `sub_expiry_${d}_${s.end_date}`
          });
        }
      });
      // daily workout reminder for members with an assigned plan who haven't logged today
      const day = today();
      const withPlan = db.getAll('SELECT DISTINCT member_id FROM member_meal_assignments');
      withPlan.forEach(row => {
        const mid = row.member_id;
        const logged = db.getOne("SELECT id FROM member_workout_logs WHERE member_id = ? AND date(completed_at) = date('now','localtime') LIMIT 1", [mid]);
        if (!logged) {
          notify(mid, {
            category: 'training', prefKey: 'workouts',
            title: 'Today\'s workout is waiting', title_ar: 'تمرين اليوم في انتظارك',
            body: 'You have not logged a workout today. Open Training to get started.',
            body_ar: 'لم تسجّل تمرينك اليوم بعد. افتح قسم التدريب لتبدأ.',
            action_type: 'training', action_label: 'Start workout', action_label_ar: 'ابدأ التمرين',
            dedupe_key: `workout_reminder_${day}`
          });
        }
      });
    } catch (e) { console.error('[member-app] generateNotifications failed:', e.message); }
  }

  // Fire a welcome notification when a member is created
  if (eventBus && eventBus.on) {
    eventBus.on('member.created', ({ memberId }) => {
      if (!memberId) return;
      const gym = setget('app.name', 'Gram Gym');
      notify(memberId, {
        category: 'general', prefKey: 'offers',
        title: `Welcome to ${gym}`, title_ar: `مرحباً بك في ${gym}`,
        body: 'Your member account is ready. Explore your subscription, training and nutrition from the app.',
        body_ar: 'تم تجهيز حسابك. استكشف اشتراكك وتدريبك وتغذيتك من التطبيق.',
        dedupe_key: `welcome_${memberId}`
      });
    });
  }

  // ═══════════════════════════════════════════════════════════
  // PWA MEMBER ENDPOINTS  (mounted on /api so paths stay /api/pwa/member/*)
  // ═══════════════════════════════════════════════════════════

  // Gym capacity + hours (REAL: current in-gym count from attendance)
  app.get('/api/pwa/member/gym-status', (req, res) => {
    try {
      const mid = pwaMember(req);
      const m = memberRow(mid);
      const branch = m?.branch_id ? db.getOne('SELECT * FROM branches WHERE id = ?', [m.branch_id]) : db.getOne('SELECT * FROM branches ORDER BY id LIMIT 1');
      const currentIn = num(db.getOne("SELECT COUNT(*) c FROM attendance_logs WHERE date(check_in)=date('now','localtime') AND check_out IS NULL AND was_denied=0")?.c);
      const maxCapacity = num(setget('member_app.gym_max_capacity', 45), 45);
      const ratio = maxCapacity > 0 ? currentIn / maxCapacity : 0;
      const level = ratio >= 0.75 ? 'busy' : ratio >= 0.4 ? 'medium' : 'quiet';
      const open = String(branch?.opening_time || '06:00');
      const close = String(branch?.closing_time || '22:00');
      const now = nowHM();
      const isOpen = now >= open && now < close;
      let hoursJson = []; try { hoursJson = JSON.parse(setget('member_app.gym_hours', '[]')); } catch (_) { hoursJson = []; }
      res.json({ success: true, data: {
        currentIn, maxCapacity, level, isOpen,
        openTime: open, closeTime: close,
        nextEvent: isOpen ? { type: 'closes', time: close } : { type: 'opens', time: open },
        weekly: Array.isArray(hoursJson) && hoursJson.length ? hoursJson : defaultWeekly(open, close),
        branchName: branch?.name || ''
      } });
    } catch (e) { fail(res, e); }
  });
  function defaultWeekly(open, close) {
    return [
      { days: 'الأحد – الخميس', open, close },
      { days: 'الجمعة', open: '16:00', close },
      { days: 'السبت', open: '08:00', close: '20:00' }
    ];
  }

  // Weight log
  app.get('/api/pwa/member/weight', (req, res) => {
    try {
      const mid = pwaMember(req);
      const m = memberRow(mid);
      const logs = db.getAll('SELECT id, weight_kg, logged_on FROM member_weight_log WHERE member_id = ? ORDER BY logged_on DESC, id DESC LIMIT 60', [mid]);
      const initial = num(m?.initial_weight_kg) || (logs.length ? num(logs[logs.length - 1].weight_kg) : 0);
      const current = logs.length ? num(logs[0].weight_kg) : initial;
      res.json({ success: true, data: { current, initial, change: +(current - initial).toFixed(1), height_cm: num(m?.height_cm), logs } });
    } catch (e) { fail(res, e); }
  });
  app.post('/api/pwa/member/weight', (req, res) => {
    try {
      const mid = pwaMember(req);
      const w = num(req.body?.weight_kg);
      if (!(w > 0 && w < 500)) return res.status(400).json({ success: false, error: 'Valid weight required' });
      const on = /^\d{4}-\d{2}-\d{2}$/.test(String(req.body?.date || '')) ? req.body.date : today();
      db.run('INSERT INTO member_weight_log (member_id, weight_kg, logged_on) VALUES (?,?,?)', [mid, w, on]);
      const m = memberRow(mid);
      if (!num(m?.initial_weight_kg)) db.run('UPDATE members SET initial_weight_kg = ? WHERE id = ?', [w, mid]);
      res.json({ success: true });
    } catch (e) { fail(res, e); }
  });

  // Water tracker
  app.get('/api/pwa/member/water', (req, res) => {
    try {
      const mid = pwaMember(req);
      const day = today();
      const row = db.getOne('SELECT glasses FROM member_water_log WHERE member_id = ? AND log_date = ?', [mid, day]);
      const goal = nutritionTargets(mid).water_glasses;
      res.json({ success: true, data: { glasses: num(row?.glasses), goal, ml_per_glass: 250 } });
    } catch (e) { fail(res, e); }
  });
  app.post('/api/pwa/member/water', (req, res) => {
    try {
      const mid = pwaMember(req);
      const day = today();
      const delta = req.body?.delta != null ? num(req.body.delta) : null;
      const setTo = req.body?.glasses != null ? num(req.body.glasses) : null;
      const cur = num(db.getOne('SELECT glasses FROM member_water_log WHERE member_id = ? AND log_date = ?', [mid, day])?.glasses);
      let next = setTo != null ? setTo : cur + (delta != null ? delta : 1);
      next = Math.max(0, Math.min(30, next));
      db.run('INSERT INTO member_water_log (member_id, log_date, glasses, updated_at) VALUES (?,?,?,datetime(\'now\')) ON CONFLICT(member_id, log_date) DO UPDATE SET glasses = ?, updated_at = datetime(\'now\')', [mid, day, next, next]);
      res.json({ success: true, data: { glasses: next } });
    } catch (e) { fail(res, e); }
  });

  // Nutrition: targets + meals (completed by time) + macros + water
  app.get('/api/pwa/member/nutrition', (req, res) => {
    try {
      const mid = pwaMember(req);
      const t = nutritionTargets(mid);
      const now = nowHM();
      let meals = [];
      if (t.plan) {
        meals = db.getAll('SELECT id, title, title_ar, time_label, time_sort, calories FROM member_meal_items WHERE plan_id = ? ORDER BY sort_order, time_sort', [t.plan.id])
          .map(m => ({ ...m, completed: String(m.time_sort || '00:00') <= now }));
      }
      const consumed = meals.filter(m => m.completed).reduce((s, m) => s + num(m.calories), 0);
      const day = today();
      const water = num(db.getOne('SELECT glasses FROM member_water_log WHERE member_id = ? AND log_date = ?', [mid, day])?.glasses);
      const ratio = t.calories > 0 ? Math.min(1, consumed / t.calories) : 0; // macros consumed derived from real consumed calories
      res.json({ success: true, data: {
        planName: t.plan?.name || '', planNameAr: t.plan?.name_ar || '', goal: t.plan?.goal || '',
        calories: { consumed, target: t.calories, remaining: Math.max(0, t.calories - consumed) },
        macros: { protein: { consumed: Math.round(t.protein * ratio), target: t.protein }, carbs: { consumed: Math.round(t.carbs * ratio), target: t.carbs }, fat: { consumed: Math.round(t.fat * ratio), target: t.fat } },
        water: { glasses: water, goal: t.water_glasses, ml_per_glass: 250 },
        meals
      } });
    } catch (e) { fail(res, e); }
  });

  // Notifications
  app.get('/api/pwa/member/notifications', (req, res) => {
    try {
      const mid = pwaMember(req);
      const cat = req.query.category ? String(req.query.category) : '';
      const rows = db.getAll(
        `SELECT * FROM member_notifications WHERE member_id = ? ${cat ? 'AND category = ?' : ''} ORDER BY created_at DESC LIMIT 60`,
        cat ? [mid, cat] : [mid]
      );
      const unread = num(db.getOne('SELECT COUNT(*) c FROM member_notifications WHERE member_id = ? AND is_read = 0', [mid])?.c);
      res.json({ success: true, data: rows, unread });
    } catch (e) { fail(res, e); }
  });
  app.get('/api/pwa/member/notifications/unread-count', (req, res) => {
    try { const mid = pwaMember(req); res.json({ success: true, data: { count: num(db.getOne('SELECT COUNT(*) c FROM member_notifications WHERE member_id = ? AND is_read = 0', [mid])?.c) } }); }
    catch (e) { fail(res, e); }
  });
  app.post('/api/pwa/member/notifications/:id/read', (req, res) => {
    try { const mid = pwaMember(req); db.run('UPDATE member_notifications SET is_read = 1 WHERE id = ? AND member_id = ?', [Number(req.params.id), mid]); res.json({ success: true }); }
    catch (e) { fail(res, e); }
  });
  app.post('/api/pwa/member/notifications/read-all', (req, res) => {
    try { const mid = pwaMember(req); db.run('UPDATE member_notifications SET is_read = 1 WHERE member_id = ?', [mid]); res.json({ success: true }); }
    catch (e) { fail(res, e); }
  });
  // ── Web Push subscription ──
  app.get('/api/pwa/member/push/vapid', (_req, res) => {
    res.json({ success: true, data: { publicKey: pushService.publicKey(), enabled: pushService.isConfigured() } });
  });
  app.post('/api/pwa/member/push/subscribe', (req, res) => {
    try {
      const mid = pwaMember(req);
      const sub = req.body && (req.body.subscription || req.body.endpoint ? req.body : null);
      const r = pushService.saveSubscription(mid, sub && sub.subscription ? sub.subscription : sub, req.headers['user-agent']);
      if (!r.ok) return res.status(400).json({ success: false, error: r.error || 'Invalid subscription' });
      res.json({ success: true });
    } catch (e) { fail(res, e); }
  });
  app.post('/api/pwa/member/push/unsubscribe', (req, res) => {
    try { pwaMember(req); if (req.body && req.body.endpoint) pushService.removeSubscription(req.body.endpoint); res.json({ success: true }); }
    catch (e) { fail(res, e); }
  });
  // Send a test push to the current member's devices.
  app.post('/api/pwa/member/push/test', async (req, res) => {
    try {
      const mid = pwaMember(req);
      const r = await pushService.pushToMember(mid, { title: 'GRAMS GYM', body: 'تم تفعيل الإشعارات بنجاح 🔔', category: 'general', tag: 'gymos-test', url: '/member/' });
      res.json({ success: true, data: r });
    } catch (e) { fail(res, e); }
  });

  app.get('/api/pwa/member/notification-prefs', (req, res) => {
    try { const mid = pwaMember(req); res.json({ success: true, data: getPrefs(mid) }); }
    catch (e) { fail(res, e); }
  });
  app.put('/api/pwa/member/notification-prefs', (req, res) => {
    try {
      const mid = pwaMember(req);
      const prefs = req.body?.prefs || {};
      Object.keys(PREF_DEFAULTS).forEach(k => {
        if (prefs[k] === undefined) return;
        const en = prefs[k] ? 1 : 0;
        db.run('INSERT INTO member_notification_prefs (member_id, pref_key, enabled) VALUES (?,?,?) ON CONFLICT(member_id, pref_key) DO UPDATE SET enabled = ?', [mid, k, en, en]);
      });
      res.json({ success: true, data: getPrefs(mid) });
    } catch (e) { fail(res, e); }
  });

  // Extended profile (height / initial weight / goal) + edit
  app.get('/api/pwa/member/profile-extra', (req, res) => {
    try { const mid = pwaMember(req); const m = memberRow(mid); res.json({ success: true, data: { height_cm: num(m?.height_cm), initial_weight_kg: num(m?.initial_weight_kg), fitness_goal: m?.fitness_goal || '', current_weight: latestWeight(mid) } }); }
    catch (e) { fail(res, e); }
  });
  app.put('/api/pwa/member/profile-extra', (req, res) => {
    try {
      const mid = pwaMember(req);
      const h = num(req.body?.height_cm);
      const goal = ['bulk', 'cut', 'maintain', ''].includes(String(req.body?.fitness_goal || '')) ? req.body.fitness_goal : undefined;
      if (h > 0 && h < 300) db.run('UPDATE members SET height_cm = ? WHERE id = ?', [h, mid]);
      if (goal !== undefined) db.run('UPDATE members SET fitness_goal = ? WHERE id = ?', [goal, mid]);
      res.json({ success: true });
    } catch (e) { fail(res, e); }
  });

  // Public membership plans (for the subscriptions upgrade section)
  app.get('/api/pwa/member/plans', (req, res) => {
    try {
      pwaMember(req);
      const plans = db.getAll("SELECT id, name, name_ar, plan_type, billing_type, duration_days, total_sessions, price, features FROM membership_plans WHERE is_active = 1 AND plan_type != 'trial' ORDER BY price");
      plans.forEach(p => { try { p.features = JSON.parse(p.features || '[]'); } catch (_) { p.features = []; } if (!Array.isArray(p.features)) p.features = []; });
      res.json({ success: true, data: plans });
    } catch (e) { fail(res, e); }
  });

  // ═══════════════════════════════════════════════════════════
  // ADMIN ENDPOINTS  (/api/member-app/*)  — PWA management
  // ═══════════════════════════════════════════════════════════
  const router = express.Router();
  router.use(authMiddleware);

  router.get('/overview', requirePermission('member_app.view'), (_req, res) => {
    const plans = num(db.getOne('SELECT COUNT(*) c FROM member_meal_plans WHERE is_active = 1')?.c);
    const assigned = num(db.getOne('SELECT COUNT(*) c FROM member_meal_assignments')?.c);
    const notifs = num(db.getOne("SELECT COUNT(*) c FROM member_notifications WHERE created_at >= datetime('now','-7 days')")?.c);
    const weighins = num(db.getOne("SELECT COUNT(*) c FROM member_weight_log WHERE created_at >= datetime('now','-7 days')")?.c);
    res.json({ success: true, data: { activePlans: plans, assignedMembers: assigned, notifs7d: notifs, weighins7d: weighins } });
  });

  // Meal plans CRUD
  router.get('/meal-plans', requirePermission('member_app.view'), (_req, res) => {
    const plans = db.getAll('SELECT * FROM member_meal_plans ORDER BY id');
    plans.forEach(p => { p.meals = db.getAll('SELECT * FROM member_meal_items WHERE plan_id = ? ORDER BY sort_order, time_sort', [p.id]); p.assigned = num(db.getOne('SELECT COUNT(*) c FROM member_meal_assignments WHERE plan_id = ?', [p.id])?.c); });
    res.json({ success: true, data: plans });
  });
  router.post('/meal-plans', requirePermission('member_app.manage'), (req, res) => {
    const b = req.body || {};
    const r = db.run('INSERT INTO member_meal_plans (name, name_ar, goal, daily_calories, protein_g, carbs_g, fat_g, water_glasses, is_active) VALUES (?,?,?,?,?,?,?,?,?)',
      [b.name || '', b.name_ar || '', b.goal || 'any', num(b.daily_calories), num(b.protein_g), num(b.carbs_g), num(b.fat_g), num(b.water_glasses, 8), b.is_active === false ? 0 : 1]);
    saveMeals(r.lastInsertRowid, b.meals);
    res.json({ success: true, data: { id: r.lastInsertRowid } });
  });
  router.put('/meal-plans/:id', requirePermission('member_app.manage'), (req, res) => {
    const id = Number(req.params.id); const b = req.body || {};
    db.run('UPDATE member_meal_plans SET name=?, name_ar=?, goal=?, daily_calories=?, protein_g=?, carbs_g=?, fat_g=?, water_glasses=?, is_active=? WHERE id=?',
      [b.name || '', b.name_ar || '', b.goal || 'any', num(b.daily_calories), num(b.protein_g), num(b.carbs_g), num(b.fat_g), num(b.water_glasses, 8), b.is_active === false ? 0 : 1, id]);
    if (Array.isArray(b.meals)) { db.run('DELETE FROM member_meal_items WHERE plan_id = ?', [id]); saveMeals(id, b.meals); }
    res.json({ success: true });
  });
  router.delete('/meal-plans/:id', requirePermission('member_app.manage'), (req, res) => {
    const id = Number(req.params.id);
    db.run('DELETE FROM member_meal_items WHERE plan_id = ?', [id]);
    db.run('DELETE FROM member_meal_assignments WHERE plan_id = ?', [id]);
    db.run('DELETE FROM member_meal_plans WHERE id = ?', [id]);
    res.json({ success: true });
  });
  function saveMeals(planId, meals) {
    if (!Array.isArray(meals)) return;
    meals.forEach((m, i) => db.run('INSERT INTO member_meal_items (plan_id, title, title_ar, time_label, time_sort, calories, sort_order) VALUES (?,?,?,?,?,?,?)',
      [planId, m.title || '', m.title_ar || '', m.time_label || '', m.time_sort || '00:00', num(m.calories), i]));
  }

  // Assign a plan to members (list of member_ids) or to all members of a goal
  router.post('/meal-plans/:id/assign', requirePermission('member_app.manage'), (req, res) => {
    const planId = Number(req.params.id);
    const b = req.body || {};
    let ids = Array.isArray(b.member_ids) ? b.member_ids.map(Number) : [];
    if (b.goal) ids = ids.concat(db.getAll('SELECT id FROM members WHERE lower(fitness_goal) = ?', [String(b.goal).toLowerCase()]).map(r => r.id));
    ids = [...new Set(ids)].filter(Boolean);
    ids.forEach(mid => db.run('INSERT INTO member_meal_assignments (member_id, plan_id, assigned_at) VALUES (?,?,datetime(\'now\')) ON CONFLICT(member_id) DO UPDATE SET plan_id = ?, assigned_at = datetime(\'now\')', [mid, planId, planId]));
    res.json({ success: true, data: { assigned: ids.length } });
  });
  router.get('/assignments', requirePermission('member_app.view'), (_req, res) => {
    const rows = db.getAll(`SELECT a.member_id, a.plan_id, p.name AS plan_name, p.name_ar AS plan_name_ar,
      TRIM(COALESCE(m.first_name,'')||' '||COALESCE(m.last_name,'')) AS member_name, m.member_no
      FROM member_meal_assignments a JOIN members m ON m.id = a.member_id LEFT JOIN member_meal_plans p ON p.id = a.plan_id ORDER BY m.member_no`);
    res.json({ success: true, data: rows });
  });

  // Send / broadcast notifications to members
  router.post('/notifications/send', requirePermission('member_app.manage'), (req, res) => {
    const b = req.body || {};
    let ids = [];
    if (b.target === 'all') ids = db.getAll("SELECT id FROM members WHERE status = 'active'").map(r => r.id);
    else if (b.target === 'expiring') ids = db.getAll("SELECT DISTINCT member_id FROM memberships WHERE status='active' AND julianday(end_date)-julianday('now') <= 14").map(r => r.member_id);
    else if (Array.isArray(b.member_ids)) ids = b.member_ids.map(Number).filter(Boolean);
    let sent = 0;
    ids.forEach(mid => { const r = notify(mid, { category: b.category || 'general', prefKey: b.category === 'general' ? null : b.category, title: b.title || '', title_ar: b.title_ar || '', body: b.body || '', body_ar: b.body_ar || '', action_type: b.action_type || '', action_label: b.action_label || '', action_label_ar: b.action_label_ar || '' }); if (r) sent++; });
    res.json({ success: true, data: { sent } });
  });
  router.post('/notifications/run-generation', requirePermission('member_app.manage'), (_req, res) => { generateNotifications(); res.json({ success: true }); });

  // PWA settings (gym capacity, etc.)
  const boolStr = v => (v === true || v === 'true' || v === 1 || v === '1');
  function normalizePhone(p) { let s = String(p || '').replace(/[^\d+]/g, ''); if (s.startsWith('+')) s = s.slice(1); if (s.startsWith('00')) s = s.slice(2); if (s.startsWith('0')) s = '962' + s.slice(1); else if (!s.startsWith('962') && s.length <= 10) s = '962' + s; return s; }
  // Absolute public brand logo URL from general Settings (needs app.public_url;
  // WaSender fetches it over the internet, so localhost paths resolve to '' → text only).
  function brandLogoUrl() {
    const logo = String(setget('app.admin_logo_url', '') || setget('app.login_logo_url', '') || '').trim();
    if (!logo) return '';
    if (/^https?:\/\//i.test(logo)) return logo;
    const b = String(setget('app.public_url', '') || '').trim().replace(/\/$/, '');
    return b ? b + (logo.startsWith('/') ? logo : '/' + logo) : '';
  }
  async function sendWa(phone, text) {
    const base = String(setget('marketing.wesender_base_url', '') || '').trim().replace(/\/$/, '');
    const token = String(setget('marketing.wesender_token', '') || '').trim();
    const sendPath = String(setget('marketing.wesender_send_path', '/api/send-message') || '/api/send-message').trim();
    const session = String(setget('marketing.wesender_session', '') || '').trim();
    if (!base || !token) return { sent: false, error: 'WhatsApp gateway not configured' };
    if (!phone) return { sent: false, error: 'No phone number' };
    try {
      const payload = { to: '+' + normalizePhone(phone), text };
      const img = brandLogoUrl();
      if (img) payload.imageUrl = img; // logo as header image, message as caption
      if (session) payload.session = session;
      const r = await fetch(base + sendPath, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify(payload) });
      const body = await r.text();
      if (!r.ok) return { sent: false, error: 'gateway ' + r.status + ': ' + String(body).slice(0, 180) };
      return { sent: true };
    } catch (e) { return { sent: false, error: e.message }; }
  }
  router.get('/settings', requirePermission('member_app.view'), (_req, res) => {
    const gwOk = !!(String(setget('marketing.wesender_base_url', '') || '').trim() && String(setget('marketing.wesender_token', '') || '').trim());
    res.json({ success: true, data: {
      gym_max_capacity: num(setget('member_app.gym_max_capacity', 45), 45),
      gateway_configured: gwOk,
      welcome_message_enabled: boolStr(setget('marketing.welcome_message_enabled', 'true')),
      welcome_message_template: setget('marketing.welcome_message_template', ''),
      pwa_invite_enabled: boolStr(setget('marketing.pwa_invite_enabled', 'true')),
      pwa_invite_template: setget('marketing.pwa_invite_template', ''),
      pwa_link: setget('qr_registration.pwa_link', '/member/'),
      public_url: setget('app.public_url', ''),
      ios_video_link: setget('qr_registration.ios_video_link', ''),
      android_video_link: setget('qr_registration.android_video_link', ''),
    } });
  });
  router.put('/settings', requirePermission('member_app.manage'), (req, res) => {
    const b = req.body || {};
    const S = (k, v, type = 'string') => settingsService.set(k, String(v), { type, module: 'member-app' });
    if (b.gym_max_capacity !== undefined) S('member_app.gym_max_capacity', num(b.gym_max_capacity, 45), 'number');
    if (b.welcome_message_enabled !== undefined) S('marketing.welcome_message_enabled', b.welcome_message_enabled ? 'true' : 'false', 'boolean');
    if (b.welcome_message_template !== undefined) S('marketing.welcome_message_template', b.welcome_message_template);
    if (b.pwa_invite_enabled !== undefined) S('marketing.pwa_invite_enabled', b.pwa_invite_enabled ? 'true' : 'false', 'boolean');
    if (b.pwa_invite_template !== undefined) S('marketing.pwa_invite_template', b.pwa_invite_template);
    if (b.pwa_link !== undefined) S('qr_registration.pwa_link', b.pwa_link);
    if (b.public_url !== undefined) S('app.public_url', b.public_url);
    if (b.ios_video_link !== undefined) S('qr_registration.ios_video_link', b.ios_video_link);
    if (b.android_video_link !== undefined) S('qr_registration.android_video_link', b.android_video_link);
    res.json({ success: true });
  });
  // Send a test WhatsApp to any number (does not touch members)
  router.post('/test-message', requirePermission('member_app.manage'), async (req, res) => {
    const b = req.body || {};
    if (!b.phone) return res.status(400).json({ success: false, error: 'Phone required' });
    const r = await sendWa(b.phone, b.message || ('رسالة تجريبية من ' + setget('app.name', 'GymOS')));
    res.json({ success: true, data: r });
  });

  // Members list for targeting (id, name, member_no, goal)
  router.get('/members', requirePermission('member_app.view'), (_req, res) => {
    const rows = db.getAll(`SELECT id, member_no, TRIM(COALESCE(first_name,'')||' '||COALESCE(middle_name,'')||' '||COALESCE(last_name,'')) AS name, fitness_goal FROM members WHERE status='active' ORDER BY member_no`);
    res.json({ success: true, data: rows });
  });

  app.use('/api/member-app', router);

  // ── Scheduled notification generation: on boot + every 6h ──
  try { generateNotifications(); } catch (_) {}
  if (!_notifSweep) {
    _notifSweep = setInterval(() => { try { generateNotifications(); } catch (_) {} }, 6 * 60 * 60 * 1000);
    if (_notifSweep.unref) _notifSweep.unref();
  }
};
