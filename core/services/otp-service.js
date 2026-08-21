const crypto = require('crypto');
const database = require('../database');
const config = require('../config');

function hashOtp(otp) {
  return crypto.createHash('sha256').update(String(otp)).digest('hex');
}

function generateOtp(length = 6) {
  const digits = '0123456789';
  let otp = '';
  const bytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    otp += digits[bytes[i] % 10];
  }
  return otp;
}

const otpService = {
  /** Ensure OTP table exists */
  ensureTable() {
    try {
      database.get().exec(`
        CREATE TABLE IF NOT EXISTS otp_codes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          otp_key TEXT NOT NULL,
          otp_hash TEXT NOT NULL,
          type TEXT NOT NULL DEFAULT 'member',
          person_id INTEGER,
          phone TEXT,
          attempts INTEGER DEFAULT 0,
          max_attempts INTEGER DEFAULT 3,
          expires_at TEXT NOT NULL,
          used INTEGER DEFAULT 0,
          created_at TEXT DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS idx_otp_key ON otp_codes(otp_key);
        CREATE INDEX IF NOT EXISTS idx_otp_expires ON otp_codes(expires_at);
      `);
      database.save();
    } catch (_) {}
  },

  /** Store a new OTP (returns plaintext OTP for delivery) */
  create({ type, phone, personId, lengthOverride, expiryMinutes = 5 }) {
    this.ensureTable();
    const key = `${type}:${phone}`;
    const length = lengthOverride || 6;
    const otp = generateOtp(length);

    // Invalidate any existing OTPs for this key
    database.run("UPDATE otp_codes SET used = 1 WHERE otp_key = ? AND used = 0", [key]);

    const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000).toISOString();
    database.run(
      `INSERT INTO otp_codes (otp_key, otp_hash, type, person_id, phone, max_attempts, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [key, hashOtp(otp), type, personId || null, phone, config.security.otpMaxAttempts, expiresAt]
    );

    return otp;
  },

  /** Verify an OTP. Returns { valid, personId, error } */
  verify({ type, phone, otp }) {
    this.ensureTable();
    const key = `${type}:${phone}`;

    const stored = database.getOne(
      `SELECT * FROM otp_codes WHERE otp_key = ? AND used = 0 AND datetime(expires_at) > datetime('now')
       ORDER BY id DESC LIMIT 1`,
      [key]
    );

    if (!stored) {
      return { valid: false, error: 'Invalid or expired OTP' };
    }

    // Check max attempts
    if (stored.attempts >= stored.max_attempts) {
      database.run("UPDATE otp_codes SET used = 1 WHERE id = ?", [stored.id]);
      return { valid: false, error: 'Too many attempts. Please request a new code.' };
    }

    // Increment attempts
    database.run("UPDATE otp_codes SET attempts = attempts + 1 WHERE id = ?", [stored.id]);

    // Verify hash
    if (hashOtp(otp) !== stored.otp_hash) {
      const remaining = stored.max_attempts - stored.attempts - 1;
      return { valid: false, error: `Invalid OTP. ${remaining} attempt(s) remaining.` };
    }

    // Mark used
    database.run("UPDATE otp_codes SET used = 1 WHERE id = ?", [stored.id]);

    return { valid: true, personId: stored.person_id, type: stored.type };
  },

  /** Clean up expired OTPs (call periodically) */
  cleanup() {
    try {
      database.run("DELETE FROM otp_codes WHERE datetime(expires_at) < datetime('now', '-1 hour')");
    } catch (_) {}
  },

  /** Check send rate limit for a phone */
  canSend(type, phone, maxPerHour) {
    this.ensureTable();
    const key = `${type}:${phone}`;
    const row = database.getOne(
      `SELECT COUNT(*) as c FROM otp_codes WHERE otp_key = ? AND datetime(created_at) > datetime('now', '-1 hour')`,
      [key]
    );
    return (row?.c || 0) < (maxPerHour || config.security.otpSendLimitPerHour);
  },
};

module.exports = otpService;
