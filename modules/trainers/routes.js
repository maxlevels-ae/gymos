const express = require('express');
const { authMiddleware, requirePermission } = require('../../core/middleware/auth');

module.exports = function (app, { database, eventBus }) {
  const router = express.Router();
  const db = database;

  router.get('/stats', authMiddleware, (req, res) => {
    const total = db.getOne('SELECT COUNT(*) as c FROM trainers')?.c || 0;
    const active = db.getOne('SELECT COUNT(*) as c FROM trainers WHERE is_active = 1')?.c || 0;
    res.json({ success: true, data: { total, active } });
  });

  router.get('/', authMiddleware, (req, res) => {
    const { branch_id } = req.query;
    let sql = `SELECT t.*, b.name as branch_name,
               (SELECT COUNT(*) FROM trainer_assignments ta WHERE ta.trainer_id = t.id AND ta.status = 'active') as active_clients
               FROM trainers t LEFT JOIN branches b ON b.id = t.branch_id`;
    const params = [];
    if (branch_id) { sql += ' WHERE t.branch_id = ?'; params.push(Number(branch_id)); }
    sql += ' ORDER BY t.first_name';
    res.json({ success: true, data: db.getAll(sql, params) });
  });

  router.get('/:id', authMiddleware, (req, res) => {
    const trainer = db.getOne('SELECT * FROM trainers WHERE id = ?', [req.params.id]);
    if (!trainer) return res.status(404).json({ success: false, error: 'Trainer not found' });
    trainer.assignments = db.getAll(
      `SELECT ta.*, m.first_name, m.last_name, m.member_no
       FROM trainer_assignments ta
       LEFT JOIN members m ON m.id = ta.member_id
       WHERE ta.trainer_id = ? ORDER BY ta.start_date DESC`,
      [req.params.id]
    );
    res.json({ success: true, data: trainer });
  });

  router.post('/', authMiddleware, requirePermission('trainers.create'), (req, res) => {
    const { first_name, last_name, phone, email, specialization, bio, branch_id, hire_date, user_id } = req.body;
    if (!first_name || !last_name) return res.status(400).json({ success: false, error: 'Name required' });
    const result = db.run(
      `INSERT INTO trainers (first_name, last_name, phone, email, specialization, bio, branch_id, hire_date, user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [first_name, last_name, phone || '', email || '', specialization || '', bio || '', branch_id || null, hire_date || null, user_id || null]
    );
    res.json({ success: true, data: { id: result.lastInsertRowid } });
  });

  router.put('/:id', authMiddleware, requirePermission('trainers.edit'), (req, res) => {
    const { first_name, last_name, phone, email, specialization, bio, branch_id, is_active, hire_date, notes } = req.body;
    db.run(
      `UPDATE trainers SET first_name=?, last_name=?, phone=?, email=?, specialization=?, bio=?,
       branch_id=?, is_active=?, hire_date=?, notes=?, updated_at=datetime('now') WHERE id=?`,
      [first_name, last_name, phone, email, specialization, bio, branch_id, is_active ? 1 : 0, hire_date, notes, req.params.id]
    );
    res.json({ success: true });
  });

  router.delete('/:id', authMiddleware, requirePermission('trainers.delete'), (req, res) => {
    db.run('DELETE FROM trainers WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  });

  // ─── Assignments ───────────────────────────────
  router.post('/:id/assign', authMiddleware, (req, res) => {
    const { member_id, membership_id, start_date, end_date, notes } = req.body;
    const result = db.run(
      `INSERT INTO trainer_assignments (trainer_id, member_id, membership_id, start_date, end_date, notes)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [req.params.id, member_id, membership_id || null, start_date || new Date().toISOString().split('T')[0], end_date || null, notes || '']
    );
    res.json({ success: true, data: { id: result.lastInsertRowid } });
  });

  eventBus.addFilter('dashboard.stats', (stats) => {
    stats.activeTrainers = db.getOne('SELECT COUNT(*) as c FROM trainers WHERE is_active = 1')?.c || 0;
    return stats;
  });

  app.use('/api/trainers', router);
};
