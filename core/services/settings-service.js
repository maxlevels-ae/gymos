const database = require('../database');

const settingsService = {
  get(key, defaultValue = null) {
    const row = database.getOne('SELECT value, type FROM settings WHERE key = ?', [key]);
    if (!row) return defaultValue;
    return this.cast(row.value, row.type);
  },

  set(key, value, { type = 'string', module = 'core', label = '' } = {}) {
    const existing = database.getOne('SELECT id FROM settings WHERE key = ?', [key]);
    if (existing) {
      database.run('UPDATE settings SET value = ?, updated_at = datetime("now") WHERE key = ?', [String(value), key]);
    } else {
      database.run(
        'INSERT INTO settings (key, value, type, module, label) VALUES (?, ?, ?, ?, ?)',
        [key, String(value), type, module, label]
      );
    }
  },

  getAll(module = null) {
    const sql = module
      ? 'SELECT * FROM settings WHERE module = ? ORDER BY key'
      : 'SELECT * FROM settings ORDER BY key';
    return database.getAll(sql, module ? [module] : []);
  },

  getByModule(module) {
    return this.getAll(module);
  },

  cast(value, type) {
    switch (type) {
      case 'number': return Number(value);
      case 'boolean': return value === 'true' || value === '1';
      case 'json': try { return JSON.parse(value); } catch { return value; }
      default: return value;
    }
  },

  bulkSet(settings) {
    for (const [key, value] of Object.entries(settings)) {
      const existing = database.getOne('SELECT type, module, label FROM settings WHERE key = ?', [key]) || {};
      let type = existing.type;
      if (!type || type === 'string') {
        if (typeof value === 'boolean') type = 'boolean';
        else if (typeof value === 'number') type = 'number';
        else if (value && typeof value === 'object') type = 'json';
        else type = 'string';
      }
      this.set(key, value, { type, module: existing.module || 'core', label: existing.label || key });
    }
  },
};

module.exports = settingsService;
