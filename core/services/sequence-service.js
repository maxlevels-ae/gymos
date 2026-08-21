/**
 * Centralized sequence generator — thread-safe sequential numbers.
 * Uses a dedicated sequences table with atomic increment to prevent duplicates.
 */
const database = require('../database');

const sequenceService = {
  ensureTable() {
    try {
      database.get().exec(`
        CREATE TABLE IF NOT EXISTS _sequences (
          name TEXT PRIMARY KEY,
          current_value INTEGER NOT NULL DEFAULT 0,
          prefix TEXT NOT NULL DEFAULT '',
          pad_length INTEGER NOT NULL DEFAULT 4,
          updated_at TEXT DEFAULT (datetime('now'))
        );
      `);
      database.save();
    } catch (_) {}
  },

  /**
   * Get the next number in a sequence.
   * @param {string} name - Sequence name (e.g., 'member_no', 'invoice_no')
   * @param {string} prefix - Prefix (e.g., 'M-', 'INV-')
   * @param {number} padLength - Zero-pad length (default 4)
   * @returns {string} Next value like 'M-0042'
   */
  next(name, prefix = '', padLength = 4) {
    this.ensureTable();

    const existing = database.getOne('SELECT current_value FROM _sequences WHERE name = ?', [name]);
    let nextVal;

    if (existing) {
      database.run(
        "UPDATE _sequences SET current_value = current_value + 1, updated_at = datetime('now') WHERE name = ?",
        [name]
      );
      nextVal = (existing.current_value || 0) + 1;
    } else {
      // Initialize from existing data if available
      nextVal = 1;
      database.run(
        'INSERT INTO _sequences (name, current_value, prefix, pad_length) VALUES (?, ?, ?, ?)',
        [name, nextVal, prefix, padLength]
      );
    }

    return prefix + String(nextVal).padStart(padLength, '0');
  },

  /**
   * Initialize a sequence from existing table data.
   * Call once during boot/migration to sync with existing records.
   */
  initFromTable(sequenceName, table, column, prefix) {
    this.ensureTable();
    try {
      const row = database.getOne(
        `SELECT ${column} as val FROM ${table} ORDER BY id DESC LIMIT 1`
      );
      if (row?.val) {
        const numStr = String(row.val).replace(prefix, '');
        const num = parseInt(numStr) || 0;
        const existing = database.getOne('SELECT current_value FROM _sequences WHERE name = ?', [sequenceName]);
        if (!existing) {
          database.run(
            'INSERT INTO _sequences (name, current_value, prefix, pad_length) VALUES (?, ?, ?, ?)',
            [sequenceName, num, prefix, 4]
          );
        } else if (num > existing.current_value) {
          database.run('UPDATE _sequences SET current_value = ? WHERE name = ?', [num, sequenceName]);
        }
      }
    } catch (_) {}
  },

  /** Get current value without incrementing */
  current(name) {
    this.ensureTable();
    const row = database.getOne('SELECT current_value FROM _sequences WHERE name = ?', [name]);
    return row?.current_value || 0;
  },
};

module.exports = sequenceService;
