const express = require('express');
const { authMiddleware, requirePermission } = require('../../core/middleware/auth');

module.exports = function (app, { database, eventBus, container }) {
  const router = express.Router();

  // GET /api/sdk-example
  router.get('/', authMiddleware, requirePermission('sdk_example.view'), (req, res) => {
    const items = database.getAll('SELECT * FROM sdk_example ORDER BY created_at DESC');
    res.json({ success: true, data: items });
  });

  // GET /api/sdk-example/:id
  router.get('/:id', authMiddleware, requirePermission('sdk_example.view'), (req, res) => {
    const item = database.getOne('SELECT * FROM sdk_example WHERE id = ?', [req.params.id]);
    if (!item) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, data: item });
  });

  // POST /api/sdk-example
  router.post('/', authMiddleware, requirePermission('sdk_example.create'), (req, res) => {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ success: false, error: 'Name is required' });
    const result = database.run(
      'INSERT INTO sdk_example (name, description, created_by) VALUES (?, ?, ?)',
      [name, description || '', req.user.id]
    );
    eventBus.emit('sdk-example.created', { id: result.lastInsertRowid });
    res.json({ success: true, data: { id: result.lastInsertRowid } });
  });

  // PUT /api/sdk-example/:id
  router.put('/:id', authMiddleware, requirePermission('sdk_example.edit'), (req, res) => {
    const { name, description, is_active } = req.body;
    database.run(
      'UPDATE sdk_example SET name=?, description=?, is_active=?, updated_at=datetime("now") WHERE id=?',
      [name, description, is_active ? 1 : 0, req.params.id]
    );
    res.json({ success: true });
  });

  // DELETE /api/sdk-example/:id
  router.delete('/:id', authMiddleware, requirePermission('sdk_example.delete'), (req, res) => {
    database.run('DELETE FROM sdk_example WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  });

  // Dashboard stats filter (optional)
  eventBus.addFilter('dashboard.stats', (stats) => {
    stats.sdk_exampleCount = database.getOne('SELECT COUNT(*) as c FROM sdk_example')?.c || 0;
    return stats;
  });

  app.use('/api/sdk-example', router);
};
