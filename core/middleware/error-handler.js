const config = require('../config');

function errorHandler(err, req, res, _next) {
  const status = err.status || err.statusCode || 500;

  // Only log full stack in non-production
  if (!config.app.isProduction) {
    console.error('❌ Error:', err.message);
    console.error(err.stack);
  } else if (status >= 500) {
    console.error('❌ Server Error:', err.message);
  }

  res.status(status).json({
    success: false,
    error: status >= 500 && config.app.isProduction ? 'Internal server error' : (err.message || 'Internal server error'),
    // Never expose stack in production
    ...((!config.app.isProduction && status >= 500) ? { stack: err.stack } : {}),
  });
}

function notFound(req, res) {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ success: false, error: 'Endpoint not found' });
  }
  res.sendFile('index.html', { root: config.paths.public });
}

module.exports = { errorHandler, notFound };
