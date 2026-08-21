const helmet = require('helmet');
const config = require('../config');

/** Helmet security headers */
const securityHeaders = helmet({
  contentSecurityPolicy: config.app.isProduction
    ? {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: [
            "'self'",
            "'unsafe-inline'",
            "'unsafe-eval'",
            'https://cdnjs.cloudflare.com',
            'https://unpkg.com',
            'https://cdn.jsdelivr.net',
          ],
          styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
          imgSrc: [
            "'self'",
            'data:',
            'blob:',
            'https:',
            'https://i.ytimg.com',
            'https://img.youtube.com',
          ],
          connectSrc: ["'self'", 'https:'],
          frameSrc: [
            "'self'",
            'https://www.youtube.com',
            'https://youtube.com',
            'https://www.youtube-nocookie.com',
          ],
          childSrc: [
            "'self'",
            'https://www.youtube.com',
            'https://youtube.com',
            'https://www.youtube-nocookie.com',
          ],
          mediaSrc: ["'self'", 'blob:', 'https:'],
        },
      }
    : false, // disable CSP in dev for easier debugging
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'same-site' },
});

/** Strip token from query string — force header/cookie only */
function stripQueryToken(req, _res, next) {
  if (req.query?.token) {
    delete req.query.token;
  }
  next();
}

/** Enforce pagination limits */
function enforcePaginationLimits(req, _res, next) {
  const maxLimit = config.performance.queryMaxLimit;
  if (req.query.limit) {
    const parsed = parseInt(req.query.limit, 10);
    req.query.limit = String(Math.min(Math.max(1, parsed || 20), maxLimit));
  }
  next();
}

module.exports = { securityHeaders, stripQueryToken, enforcePaginationLimits };
