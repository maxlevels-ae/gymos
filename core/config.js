const path = require('path');
const crypto = require('crypto');

const isProduction = (process.env.NODE_ENV || 'development') === 'production';

// ── JWT Secret Validation ──────────────────────────────────────────
const UNSAFE_SECRETS = ['change-me', 'gym-platform-secret-change-in-production', 'secret', 'password', ''];
let jwtSecret = process.env.JWT_SECRET || '';

if (!jwtSecret || UNSAFE_SECRETS.includes(jwtSecret)) {
  if (isProduction) {
    console.error('❌ FATAL: JWT_SECRET is not set or uses an unsafe default. Set a strong JWT_SECRET in your environment.');
    process.exit(1);
  }
  jwtSecret = crypto.randomBytes(64).toString('hex');
  console.warn('⚠️  JWT_SECRET not set — generated ephemeral secret (tokens invalidate on restart).');
}

// ── CORS Origins ───────────────────────────────────────────────────
const corsOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map(s => s.trim()).filter(Boolean)
  : null;

const config = {
  app: {
    name: process.env.APP_NAME || 'GymOS',
    port: parseInt(process.env.PORT || '3000'),
    locale: process.env.APP_LOCALE || 'en',
    dir: process.env.APP_DIR || 'ltr',
    env: process.env.NODE_ENV || 'development',
    isProduction,
  },
  db: {
    path: path.resolve(process.env.DB_PATH || './data/gym.db'),
    backupDir: path.resolve(process.env.DB_BACKUP_DIR || './data/backups'),
    saveIntervalMs: parseInt(process.env.DB_SAVE_INTERVAL || '2000'),
    walMode: process.env.DB_WAL_MODE !== 'false',
  },
  jwt: {
    secret: jwtSecret,
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
    pwaExpiresIn: process.env.PWA_JWT_EXPIRES_IN || '12h',
    pwaRefreshExpiresIn: process.env.PWA_JWT_REFRESH_EXPIRES_IN || '90d',
    cookieOptions: {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'strict' : 'lax',
      maxAge: 24 * 60 * 60 * 1000,
    },
  },
  cors: { origins: corsOrigins },
  security: {
    maxLoginAttempts: parseInt(process.env.MAX_LOGIN_ATTEMPTS || '5'),
    loginWindowMs: parseInt(process.env.LOGIN_WINDOW_MS || String(15 * 60 * 1000)),
    otpMaxAttempts: parseInt(process.env.OTP_MAX_ATTEMPTS || '3'),
    otpSendLimitPerHour: parseInt(process.env.OTP_SEND_LIMIT || '5'),
    forceAdminPasswordChange: process.env.FORCE_ADMIN_PW_CHANGE !== 'false',
  },
  paths: {
    modules: path.resolve(process.env.MODULES_PATH || './modules'),
    uploads: path.resolve(process.env.UPLOADS_PATH || './data/uploads'),
    public: path.resolve('./public'),
  },
  performance: {
    compressionEnabled: process.env.COMPRESSION !== 'false',
    jsonLimit: process.env.JSON_LIMIT || '10mb',
    queryMaxLimit: parseInt(process.env.QUERY_MAX_LIMIT || '100'),
  },
  logging: { level: process.env.LOG_LEVEL || 'info' },
  hosting: {
    trustProxy: process.env.TRUST_PROXY === 'true' || process.env.CPANEL_ENV === 'true',
  },
};

module.exports = config;
