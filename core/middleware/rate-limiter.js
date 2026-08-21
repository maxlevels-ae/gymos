const rateLimit = require('express-rate-limit');
const config = require('../config');

/** Global API rate limit */
const globalLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,  // 1 minute
  max: 200,                   // 200 req/min per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests, please try again later.' },
  keyGenerator: (req) => req.ip,
});

/** Strict limiter for authentication endpoints */
const authLimiter = rateLimit({
  windowMs: config.security.loginWindowMs,
  max: config.security.maxLoginAttempts,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many login attempts. Please wait before trying again.' },
  keyGenerator: (req) => `auth:${req.ip}`,
  skipSuccessfulRequests: true,
});

/** OTP send limiter */
const otpSendLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,  // 1 hour
  max: config.security.otpSendLimitPerHour,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many OTP requests. Please try again later.' },
  keyGenerator: (req) => `otp-send:${req.body?.phone || req.ip}`,
});

/** OTP verify limiter — very tight */
const otpVerifyLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,  // 5 minutes
  max: config.security.otpMaxAttempts,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many verification attempts. Please request a new code.' },
  keyGenerator: (req) => `otp-verify:${req.body?.phone || req.ip}`,
});

/** Signup / public form limiter */
const publicFormLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: { success: false, error: 'Too many submissions. Please try again later.' },
  keyGenerator: (req) => `form:${req.ip}`,
});

module.exports = { globalLimiter, authLimiter, otpSendLimiter, otpVerifyLimiter, publicFormLimiter };
