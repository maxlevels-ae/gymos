/**
 * DB Adapter — Repository-pattern abstraction over the database.
 * SECURITY: All identifiers (table names, column names, orderBy) are validated
 * against a strict pattern to prevent SQL injection.
 */
const database = require('./database');
const config = require('./config');

// ── Identifier sanitization ──────────────────────────────────────────
const SAFE_IDENTIFIER = /^[a-zA-Z_][a-zA-Z0-9_.]*$/;
const SAFE_ORDER_TOKEN = /^[a-zA-Z_][a-zA-Z0-9_.]*\s*(ASC|DESC)?$/i;

function assertSafeIdentifier(name, context = 'identifier') {
  if (!SAFE_IDENTIFIER.test(name)) {
    throw new Error(`Unsafe ${context}: "${name}"`);
  }
  return name;
}

function sanitizeOrderBy(orderBy) {
  if (!orderBy) return '';
  // Split on commas, validate each token
  const parts = String(orderBy).split(',').map(s => s.trim()).filter(Boolean);
  for (const part of parts) {
    if (!SAFE_ORDER_TOKEN.test(part)) {
      throw new Error(`Unsafe ORDER BY clause: "${part}"`);
    }
  }
  return parts.join(', ');
}

class Repository {
  constructor(table) {
    assertSafeIdentifier(table, 'table name');
    this.table = table;
  }

  findById(id) {
    return database.getOne(`SELECT * FROM ${this.table} WHERE id = ?`, [id]);
  }

  findOne(where = {}) {
    const { clause, params } = this._buildWhere(where);
    return database.getOne(`SELECT * FROM ${this.table} ${clause} LIMIT 1`, params);
  }

  findAll(where = {}, options = {}) {
    const { clause, params } = this._buildWhere(where);
    let sql = `SELECT * FROM ${this.table} ${clause}`;
    if (options.orderBy) sql += ` ORDER BY ${sanitizeOrderBy(options.orderBy)}`;
    const limit = Math.min(Number(options.limit) || 50, config.performance.queryMaxLimit);
    sql += ' LIMIT ?';
    params.push(limit);
    if (options.offset) { sql += ' OFFSET ?'; params.push(Number(options.offset) || 0); }
    return database.getAll(sql, params);
  }

  count(where = {}) {
    const { clause, params } = this._buildWhere(where);
    const row = database.getOne(`SELECT COUNT(*) as c FROM ${this.table} ${clause}`, params);
    return row?.c || 0;
  }

  create(data) {
    const keys = Object.keys(data).map(k => assertSafeIdentifier(k, 'column'));
    const vals = Object.values(data);
    const placeholders = keys.map(() => '?').join(', ');
    const result = database.run(
      `INSERT INTO ${this.table} (${keys.join(', ')}) VALUES (${placeholders})`, vals
    );
    return result.lastInsertRowid;
  }

  update(id, data) {
    const keys = Object.keys(data).map(k => assertSafeIdentifier(k, 'column'));
    const sets = keys.map(k => `${k} = ?`).join(', ');
    const vals = [...Object.values(data), id];
    return database.run(`UPDATE ${this.table} SET ${sets}, updated_at = datetime('now') WHERE id = ?`, vals);
  }

  delete(id) {
    return database.run(`DELETE FROM ${this.table} WHERE id = ?`, [id]);
  }

  raw(sql, params = []) { return database.getAll(sql, params); }
  rawOne(sql, params = []) { return database.getOne(sql, params); }
  exists(where = {}) { return !!this.findOne(where); }

  _buildWhere(where) {
    const keys = Object.keys(where);
    if (!keys.length) return { clause: '', params: [] };
    const conditions = keys.map(k => `${assertSafeIdentifier(k, 'column')} = ?`);
    return { clause: 'WHERE ' + conditions.join(' AND '), params: Object.values(where) };
  }
}

const dbAdapter = {
  repository(table) { return new Repository(table); },
  get db() { return database; },
  batch(operations) {
    const results = [];
    for (const op of operations) results.push(op());
    database.save();
    return results;
  },
  assertSafeIdentifier,
  sanitizeOrderBy,
};

module.exports = dbAdapter;
