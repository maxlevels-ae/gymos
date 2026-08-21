require('dotenv').config();
const app = require('./core/bootstrap');
const PORT = Number(process.env.PORT || process.env.APP_PORT || 3000);

(async () => {
  try {
    await app.boot();

    const server = app.express.listen(PORT, () => {
      console.log(`\n${'═'.repeat(50)}`);
      console.log(`  🏋️  GymOS Platform v1.0.0`);
      console.log(`  🌐  Listening on port ${PORT}`);
      console.log(`  📦  Modules: ${app.moduleLoader.getLoadedCount()} loaded`);
      console.log(`  🔒  Security: helmet, rate-limit, CORS restricted`);
      console.log(`  ⚡  Performance: compression, WAL, caching`);
      console.log(`${'═'.repeat(50)}\n`);
    });

    // ── Graceful Shutdown ──────────────────────────────────────────
    const shutdown = async (signal) => {
      console.log(`\n🛑 ${signal} received — shutting down gracefully...`);

      // Stop accepting new connections
      server.close(() => {
        console.log('  ✅ HTTP server closed');
      });

      // Flush and close database
      await app.shutdown(signal);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    // ── Process Error Handlers ────────────────────────────────────
    process.on('uncaughtException', (err) => {
      console.error('❌ Uncaught Exception:', err.message);
      console.error(err.stack);
      // Flush DB before exit
      try { require('./core/database').close(); } catch (_) {}
      process.exit(1);
    });

    process.on('unhandledRejection', (reason, promise) => {
      console.error('❌ Unhandled Rejection at:', promise);
      console.error('  Reason:', reason);
    });

  } catch (err) {
    console.error('❌ Boot failed:', err);
    process.exit(1);
  }
})();
