const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');
const config = require('./config');

let db = null;
let SQL = null;
let dbPath = null;
let dirty = false;

function save() {
  if (!db || !dbPath || !dirty) return;
  try {
    const data = db.export();
    const buffer = Buffer.from(data);
    // Ensure the target directory still exists — on some hosts (e.g. shared cPanel) it can
    // disappear between saves, which caused a persistent ENOENT rename failure.
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    // Atomic write: write to temp then rename. If the rename fails (cross-device or transient
    // ENOENT), fall back to a direct write so data is still persisted rather than lost.
    const tmp = dbPath + '.tmp';
    fs.writeFileSync(tmp, buffer);
    try {
      fs.renameSync(tmp, dbPath);
    } catch (renameErr) {
      console.error('⚠️  Database atomic rename failed, writing directly:', renameErr.message);
      fs.writeFileSync(dbPath, buffer);
      try { fs.unlinkSync(tmp); } catch (_) {}
    }
    dirty = false;
  } catch (err) {
    // Keep `dirty = true` so the next interval retries instead of silently dropping data.
    console.error('❌ Database save failed (will retry next tick):', err.message);
  }
}

let saveInterval = null;

const database = {
  async init() {
    if (!SQL) SQL = await initSqlJs();
  },

  async connect() {
    if (!SQL) await this.init();
    if (db) return db;
    dbPath = config.db.path;
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    if (fs.existsSync(dbPath)) {
      const fileBuffer = fs.readFileSync(dbPath);
      db = new SQL.Database(fileBuffer);
    } else {
      db = new SQL.Database();
    }

    db.run('PRAGMA foreign_keys = ON');
    db.run('PRAGMA journal_mode = WAL');
    db.run('PRAGMA synchronous = NORMAL');
    db.run('PRAGMA cache_size = -8000');       // 8MB cache
    db.run('PRAGMA temp_store = MEMORY');
    db.run('PRAGMA mmap_size = 268435456');     // 256MB mmap

    if (saveInterval) clearInterval(saveInterval);
    saveInterval = setInterval(save, config.db.saveIntervalMs || 2000);

    // Create backup directory
    const backupDir = config.db.backupDir;
    if (backupDir && !fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

    console.log('  ✅ Database connected:', dbPath);
    return db;
  },

  get() {
    if (!db) throw new Error('Database not connected. Call connect() first.');
    return db;
  },

  run(sql, params = []) {
    const p = Array.isArray(params) ? params : [params];
    this.get().run(sql, p);
    const lastId = this.get().exec("SELECT last_insert_rowid() as id");
    const id = lastId[0]?.values[0]?.[0] || 0;
    const changes = this.get().getRowsModified();
    dirty = true;
    save();
    return { lastInsertRowid: id, changes };
  },

  getOne(sql, params = []) {
    const p = Array.isArray(params) ? params : [params];
    try {
      const stmt = this.get().prepare(sql);
      stmt.bind(p);
      let result = null;
      if (stmt.step()) {
        result = stmt.getAsObject();
      }
      stmt.free();
      return result;
    } catch (err) {
      if (err.message.includes('no such table')) return null;
      throw err;
    }
  },

  getAll(sql, params = []) {
    const p = Array.isArray(params) ? params : [params];
    try {
      const stmt = this.get().prepare(sql);
      stmt.bind(p);
      const results = [];
      while (stmt.step()) {
        results.push(stmt.getAsObject());
      }
      stmt.free();
      return results;
    } catch (err) {
      if (err.message.includes('no such table')) return [];
      throw err;
    }
  },

  tableExists(name) {
    const row = this.getOne("SELECT name FROM sqlite_master WHERE type='table' AND name=?", [name]);
    return !!row;
  },

  migrate(sql, label = '') {
    try {
      this.get().exec(sql);
      dirty = true;
      save();
      if (label) console.log('    ✅ Migration:', label);
    } catch (err) {
      console.error('    ❌ Migration failed [' + label + ']:', err.message);
      throw err;
    }
  },

  /** Create a timestamped backup of the database */
  backup() {
    if (!db || !dbPath) return null;
    const backupDir = config.db.backupDir;
    if (!backupDir) return null;
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
    save(); // flush first
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const dest = path.join(backupDir, `gym-${ts}.db`);
    fs.copyFileSync(dbPath, dest);
    // Prune old backups (keep last 10)
    const backups = fs.readdirSync(backupDir).filter(f => f.startsWith('gym-') && f.endsWith('.db')).sort();
    while (backups.length > 10) {
      fs.unlinkSync(path.join(backupDir, backups.shift()));
    }
    return dest;
  },

  save() { dirty = true; save(); },

  close() {
    if (saveInterval) clearInterval(saveInterval);
    dirty = true;
    save();
    if (db) { db.close(); db = null; }
    console.log('  ✅ Database closed gracefully');
  }
};

module.exports = database;
