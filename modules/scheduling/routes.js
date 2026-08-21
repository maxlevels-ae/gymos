const express = require('express');
const { authMiddleware, requirePermission } = require('../../core/middleware/auth');

module.exports = function (app, { database, eventBus }) {
  const router = express.Router();
  const db = database;
  const dow = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

  // ═══ CLASS TYPES ═══
  router.get('/class-types', authMiddleware, (req, res) => {
    res.json({ success: true, data: db.getAll('SELECT * FROM class_types ORDER BY name') });
  });
  router.post('/class-types', authMiddleware, requirePermission('schedule.manage'), (req, res) => {
    const { name, name_ar, description, color, duration_minutes, max_capacity, branch_id } = req.body;
    if (!name) return res.status(400).json({ success: false, error: 'Name required' });
    const r = db.run('INSERT INTO class_types (name,name_ar,description,color,duration_minutes,max_capacity,branch_id) VALUES (?,?,?,?,?,?,?)',
      [name, name_ar||'', description||'', color||'#3b82f6', duration_minutes||60, max_capacity||20, branch_id||null]);
    res.json({ success: true, data: { id: r.lastInsertRowid } });
  });
  router.put('/class-types/:id', authMiddleware, requirePermission('schedule.manage'), (req, res) => {
    const b = req.body;
    db.run('UPDATE class_types SET name=?,name_ar=?,description=?,color=?,duration_minutes=?,max_capacity=?,is_active=? WHERE id=?',
      [b.name, b.name_ar, b.description, b.color, b.duration_minutes, b.max_capacity, b.is_active?1:0, req.params.id]);
    res.json({ success: true });
  });

  // ═══ SCHEDULE ═══
  router.get('/classes', authMiddleware, (req, res) => {
    const { date, day, branch_id } = req.query;
    let where = ["cs.status = 'active'"], params = [];
    if (date) { where.push("(cs.date = ? OR (cs.is_recurring = 1 AND cs.day_of_week = CAST(strftime('%w', ?) AS INTEGER)))"); params.push(date, date); }
    else if (day !== undefined) { where.push("(cs.is_recurring = 1 AND cs.day_of_week = ?)"); params.push(Number(day)); }
    if (branch_id) { where.push("cs.branch_id = ?"); params.push(Number(branch_id)); }
    const wc = where.length ? 'WHERE ' + where.join(' AND ') : '';
    const classes = db.getAll(
      `SELECT cs.*, ct.name as class_name, ct.name_ar as class_name_ar, ct.color, ct.duration_minutes as type_duration,
              t.first_name as trainer_first, t.last_name as trainer_last
       FROM class_schedule cs
       LEFT JOIN class_types ct ON ct.id = cs.class_type_id
       LEFT JOIN trainers t ON t.id = cs.trainer_id ${wc} ORDER BY cs.start_time`, params);

    // Add booking counts
    const targetDate = date || new Date().toISOString().split('T')[0];
    for (const c of classes) {
      const booked = db.getOne("SELECT COUNT(*) as c FROM class_bookings WHERE schedule_id = ? AND booking_date = ? AND status = 'confirmed'", [c.id, targetDate]);
      c.booked_count = booked?.c || 0;
      c.spots_left = (c.max_capacity || 20) - c.booked_count;
    }
    res.json({ success: true, data: classes });
  });

  router.post('/classes', authMiddleware, requirePermission('schedule.manage'), (req, res) => {
    const { class_type_id, trainer_id, branch_id, title, day_of_week, start_time, end_time, date, max_capacity, is_recurring, notes } = req.body;
    if (!class_type_id || !start_time || !end_time) return res.status(400).json({ success: false, error: 'Class type, start and end time required' });
    const r = db.run(
      'INSERT INTO class_schedule (class_type_id,trainer_id,branch_id,title,day_of_week,start_time,end_time,date,max_capacity,is_recurring,notes) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
      [class_type_id, trainer_id||null, branch_id||null, title||'', day_of_week??null, start_time, end_time, date||null, max_capacity||20, is_recurring!==false?1:0, notes||'']);
    res.json({ success: true, data: { id: r.lastInsertRowid } });
  });

  router.put('/classes/:id', authMiddleware, requirePermission('schedule.manage'), (req, res) => {
    const b = req.body;
    db.run('UPDATE class_schedule SET class_type_id=?,trainer_id=?,branch_id=?,title=?,day_of_week=?,start_time=?,end_time=?,date=?,max_capacity=?,is_recurring=?,status=?,notes=? WHERE id=?',
      [b.class_type_id, b.trainer_id, b.branch_id, b.title, b.day_of_week, b.start_time, b.end_time, b.date, b.max_capacity, b.is_recurring?1:0, b.status||'active', b.notes, req.params.id]);
    res.json({ success: true });
  });

  router.delete('/classes/:id', authMiddleware, requirePermission('schedule.manage'), (req, res) => {
    db.run("UPDATE class_schedule SET status = 'cancelled' WHERE id = ?", [req.params.id]);
    res.json({ success: true });
  });

  // ═══ BOOKINGS ═══
  router.post('/book', authMiddleware, (req, res) => {
    const { schedule_id, member_id, booking_date } = req.body;
    if (!schedule_id || !member_id || !booking_date) return res.status(400).json({ success: false, error: 'Schedule, member, and date required' });

    const cls = db.getOne('SELECT * FROM class_schedule WHERE id = ?', [schedule_id]);
    if (!cls) return res.status(404).json({ success: false, error: 'Class not found' });

    // Check capacity
    const booked = db.getOne("SELECT COUNT(*) as c FROM class_bookings WHERE schedule_id = ? AND booking_date = ? AND status = 'confirmed'", [schedule_id, booking_date])?.c || 0;
    const isWaitlist = booked >= (cls.max_capacity || 20);

    // Check duplicate
    const existing = db.getOne("SELECT id FROM class_bookings WHERE schedule_id = ? AND member_id = ? AND booking_date = ? AND status != 'cancelled'", [schedule_id, member_id, booking_date]);
    if (existing) return res.status(409).json({ success: false, error: 'Already booked' });

    const r = db.run('INSERT INTO class_bookings (schedule_id, member_id, booking_date, status, is_waitlist) VALUES (?,?,?,?,?)',
      [schedule_id, member_id, booking_date, isWaitlist ? 'waitlist' : 'confirmed', isWaitlist ? 1 : 0]);

    try { db.run('INSERT INTO member_timeline (member_id, event_type, title, description, created_by) VALUES (?,?,?,?,?)',
      [member_id, 'booking', isWaitlist ? 'Added to Waitlist' : 'Class Booked', `Booked for ${booking_date}`, req.user.id]); } catch(_){}

    eventBus.emit('booking.created', { bookingId: r.lastInsertRowid, member_id, schedule_id });
    res.json({ success: true, data: { id: r.lastInsertRowid, status: isWaitlist ? 'waitlist' : 'confirmed', spots_left: Math.max(0, (cls.max_capacity || 20) - booked - (isWaitlist ? 0 : 1)) } });
  });

  router.post('/bookings/:id/cancel', authMiddleware, (req, res) => {
    db.run("UPDATE class_bookings SET status = 'cancelled', cancelled_at = datetime('now'), cancel_reason = ? WHERE id = ?",
      [req.body.reason || '', req.params.id]);
    // Promote from waitlist
    const booking = db.getOne('SELECT schedule_id, booking_date FROM class_bookings WHERE id = ?', [req.params.id]);
    if (booking) {
      const waitlisted = db.getOne("SELECT id FROM class_bookings WHERE schedule_id = ? AND booking_date = ? AND status = 'waitlist' ORDER BY created_at LIMIT 1", [booking.schedule_id, booking.booking_date]);
      if (waitlisted) db.run("UPDATE class_bookings SET status = 'confirmed', is_waitlist = 0 WHERE id = ?", [waitlisted.id]);
    }
    res.json({ success: true });
  });

  router.get('/bookings', authMiddleware, (req, res) => {
    const { date, member_id, schedule_id } = req.query;
    let where = [], params = [];
    if (date) { where.push('cb.booking_date = ?'); params.push(date); }
    if (member_id) { where.push('cb.member_id = ?'); params.push(Number(member_id)); }
    if (schedule_id) { where.push('cb.schedule_id = ?'); params.push(Number(schedule_id)); }
    const wc = where.length ? 'WHERE ' + where.join(' AND ') : '';
    const bookings = db.getAll(
      `SELECT cb.*, m.first_name, m.last_name, m.member_no, cs.start_time, cs.end_time, ct.name as class_name
       FROM class_bookings cb
       LEFT JOIN members m ON m.id = cb.member_id
       LEFT JOIN class_schedule cs ON cs.id = cb.schedule_id
       LEFT JOIN class_types ct ON ct.id = cs.class_type_id
       ${wc} ORDER BY cb.created_at DESC`, params);
    res.json({ success: true, data: bookings });
  });

  // ─── Week Schedule View ────────────────────────
  router.get('/week', authMiddleware, (req, res) => {
    const classes = db.getAll(
      `SELECT cs.*, ct.name as class_name, ct.color, t.first_name as trainer_first, t.last_name as trainer_last
       FROM class_schedule cs
       LEFT JOIN class_types ct ON ct.id = cs.class_type_id
       LEFT JOIN trainers t ON t.id = cs.trainer_id
       WHERE cs.status = 'active' AND cs.is_recurring = 1
       ORDER BY cs.day_of_week, cs.start_time`);
    // Group by day
    const week = {};
    for (let i = 0; i < 7; i++) week[i] = { day: dow[i], classes: [] };
    for (const c of classes) { if (week[c.day_of_week]) week[c.day_of_week].classes.push(c); }
    res.json({ success: true, data: Object.values(week) });
  });

  // Dashboard
  eventBus.addFilter('dashboard.stats', (stats) => {
    const todayDow = new Date().getDay();
    stats.todayClasses = db.getOne("SELECT COUNT(*) as c FROM class_schedule WHERE (is_recurring = 1 AND day_of_week = ? AND status = 'active') OR (date = date('now') AND status = 'active')", [todayDow])?.c || 0;
    stats.todayBookings = db.getOne("SELECT COUNT(*) as c FROM class_bookings WHERE booking_date = date('now') AND status = 'confirmed'")?.c || 0;
    return stats;
  });

  app.use('/api/schedule', router);
};
