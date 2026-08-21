const express = require('express');
const { authMiddleware, requirePermission } = require('../../core/middleware/auth');

module.exports = function (app, { database }) {
  const router = express.Router();
  const db = database;

  router.get('/', authMiddleware, (req, res) => {
    const branches = db.getAll('SELECT * FROM branches ORDER BY name');
    res.json({ success: true, data: branches });
  });

  router.get('/stats', authMiddleware, (req, res) => {
    const total = db.getOne('SELECT COUNT(*) as count FROM branches')?.count || 0;
    const active = db.getOne('SELECT COUNT(*) as count FROM branches WHERE is_active = 1')?.count || 0;
    res.json({ success: true, data: { total, active } });
  });

  router.get('/:id', authMiddleware, (req, res) => {
    const branch = db.getOne('SELECT * FROM branches WHERE id = ?', [req.params.id]);
    if (!branch) return res.status(404).json({ success: false, error: 'Branch not found' });
    res.json({ success: true, data: branch });
  });

  router.post('/', authMiddleware, requirePermission('branches.create'), (req, res) => {
    const { name, name_ar, code, address, city, phone, email, manager_id, timezone, opening_time, closing_time, notes } = req.body;
    if (!name) return res.status(400).json({ success: false, error: 'Branch name is required' });
    try {
      const result = db.run(
        `INSERT INTO branches (name, name_ar, code, address, city, phone, email, manager_id, timezone, opening_time, closing_time, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [name, name_ar || '', code || null, address || '', city || '', phone || '', email || '', manager_id || null, timezone || 'UTC', opening_time || '06:00', closing_time || '23:00', notes || '']
      );
      res.json({ success: true, data: { id: result.lastInsertRowid } });
    } catch (err) {
      if (err.message.includes('UNIQUE')) return res.status(409).json({ success: false, error: 'Branch code already exists' });
      throw err;
    }
  });

  router.put('/:id', authMiddleware, requirePermission('branches.edit'), (req, res) => {
    const { name, name_ar, code, address, city, phone, email, manager_id, is_active, timezone, opening_time, closing_time, notes } = req.body;
    db.run(
      `UPDATE branches SET name=?, name_ar=?, code=?, address=?, city=?, phone=?, email=?, manager_id=?,
       is_active=?, timezone=?, opening_time=?, closing_time=?, notes=?, updated_at=datetime('now') WHERE id=?`,
      [name, name_ar, code, address, city, phone, email, manager_id, is_active ? 1 : 0, timezone, opening_time, closing_time, notes, req.params.id]
    );
    res.json({ success: true });
  });

  router.delete('/:id', authMiddleware, requirePermission('branches.delete'), (req, res) => {
    db.run('DELETE FROM branches WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  });

  app.use('/api/branches', router);
};
