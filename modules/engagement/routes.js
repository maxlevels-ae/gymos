const express = require('express');
const { authMiddleware, requirePermission } = require('../../core/middleware/auth');

module.exports = function (app, { database, eventBus }) {
  const router = express.Router();
  const db = database;

  // ═══ ANNOUNCEMENTS ═══
  router.get('/announcements', authMiddleware, (req, res) => {
    const all = db.getAll('SELECT a.*, u.full_name as author FROM announcements a LEFT JOIN users u ON u.id = a.created_by ORDER BY a.created_at DESC');
    res.json({ success: true, data: all });
  });
  router.post('/announcements', authMiddleware, requirePermission('announcements.manage'), (req, res) => {
    const { title, title_ar, body, body_ar, type, priority, target_audience, branch_id, is_published, expires_at } = req.body;
    if (!title) return res.status(400).json({ success: false, error: 'Title required' });
    const r = db.run('INSERT INTO announcements (title,title_ar,body,body_ar,type,priority,target_audience,branch_id,is_published,published_at,expires_at,created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
      [title, title_ar||'', body||'', body_ar||'', type||'info', priority||'normal', target_audience||'all', branch_id||null,
       is_published?1:0, is_published?new Date().toISOString():null, expires_at||null, req.user.id]);
    res.json({ success: true, data: { id: r.lastInsertRowid } });
  });
  router.put('/announcements/:id', authMiddleware, requirePermission('announcements.manage'), (req, res) => {
    const b = req.body;
    db.run('UPDATE announcements SET title=?,title_ar=?,body=?,body_ar=?,type=?,priority=?,target_audience=?,branch_id=?,is_published=?,expires_at=?,updated_at=datetime("now") WHERE id=?',
      [b.title, b.title_ar, b.body, b.body_ar, b.type, b.priority, b.target_audience, b.branch_id, b.is_published?1:0, b.expires_at, req.params.id]);
    res.json({ success: true });
  });
  router.delete('/announcements/:id', authMiddleware, requirePermission('announcements.manage'), (req, res) => {
    db.run('DELETE FROM announcements WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  });

  // ═══ RETENTION DASHBOARD ═══
  router.get('/retention', authMiddleware, (req, res) => {
    const atRisk = db.getAll(
      `SELECT m.id, m.member_no, m.first_name, m.last_name, m.phone, m.last_visit_at, m.total_visits, m.status, m.risk_level,
              ms.plan_name, ms.end_date, ms.payment_status, ms.remaining_sessions
       FROM members m
       LEFT JOIN memberships ms ON ms.member_id = m.id AND ms.status = 'active'
       WHERE m.status = 'active' AND (
         m.last_visit_at IS NULL OR m.last_visit_at < datetime('now', '-14 days')
         OR m.risk_level IN ('medium','high')
         OR (ms.end_date IS NOT NULL AND ms.end_date BETWEEN date('now') AND date('now','+7 days'))
         OR ms.payment_status IN ('unpaid','partial')
       )
       ORDER BY m.last_visit_at ASC LIMIT 50`
    );
    // Compute risk scores
    for (const m of atRisk) {
      let score = 0;
      if (!m.last_visit_at || daysSince(m.last_visit_at) > 30) score += 3;
      else if (daysSince(m.last_visit_at) > 14) score += 2;
      else if (daysSince(m.last_visit_at) > 7) score += 1;
      if (m.payment_status === 'unpaid') score += 2;
      if (m.payment_status === 'partial') score += 1;
      if (m.end_date && daysUntil(m.end_date) <= 3) score += 2;
      else if (m.end_date && daysUntil(m.end_date) <= 7) score += 1;
      m.risk_score = score;
      m.risk_level = score >= 4 ? 'high' : score >= 2 ? 'medium' : 'low';
      // Update in DB
      db.run('UPDATE members SET risk_level = ? WHERE id = ?', [m.risk_level, m.id]);
    }
    atRisk.sort((a, b) => b.risk_score - a.risk_score);

    const summary = {
      highRisk: atRisk.filter(m => m.risk_level === 'high').length,
      mediumRisk: atRisk.filter(m => m.risk_level === 'medium').length,
      lowRisk: atRisk.filter(m => m.risk_level === 'low').length,
      totalAtRisk: atRisk.length,
    };
    res.json({ success: true, data: { members: atRisk, summary } });
  });

  function daysSince(d) { return Math.floor((Date.now() - new Date(d).getTime()) / 86400000); }
  function daysUntil(d) { return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000); }

  // ═══ AUTOMATION RULES ═══
  router.get('/rules', authMiddleware, (req, res) => {
    res.json({ success: true, data: db.getAll('SELECT * FROM engagement_rules ORDER BY created_at DESC') });
  });
  router.post('/rules', authMiddleware, requirePermission('engagement.manage'), (req, res) => {
    const { name, description, trigger_type, trigger_config, action_type, action_config } = req.body;
    const r = db.run('INSERT INTO engagement_rules (name,description,trigger_type,trigger_config,action_type,action_config) VALUES (?,?,?,?,?,?)',
      [name, description||'', trigger_type, JSON.stringify(trigger_config||{}), action_type, JSON.stringify(action_config||{})]);
    res.json({ success: true, data: { id: r.lastInsertRowid } });
  });

  app.use('/api/engagement', router);
};
