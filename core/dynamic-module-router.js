const express = require('express');

class DynamicModuleRouter {
  constructor() {
    this.routes = new Map(); // moduleName -> { router, prefixes: [] }
    this.dispatcher = this.dispatcher.bind(this);
  }

  middleware() {
    return this.dispatcher;
  }

  ensureModuleEntry(moduleName) {
    if (!this.routes.has(moduleName)) {
      this.routes.set(moduleName, {
        router: express.Router(),
        prefixes: [],
      });
    }
    return this.routes.get(moduleName);
  }

  dispatcher(req, res, next) {
    const entries = Array.from(this.routes.values());
    let index = 0;

    const run = (err) => {
      if (err) return next(err);
      const entry = entries[index++];
      if (!entry) return next();
      return entry.router(req, res, run);
    };

    run();
  }

  createModuleApp(moduleName) {
    const entry = this.ensureModuleEntry(moduleName);
    const router = entry.router;

    const recordPrefixes = (args) => {
      if (typeof args[0] === 'string' && !entry.prefixes.includes(args[0])) {
        entry.prefixes.push(args[0]);
      }
    };

    return {
      use: (...args) => {
        recordPrefixes(args);
        return router.use(...args);
      },
      get: (...args) => router.get(...args),
      post: (...args) => router.post(...args),
      put: (...args) => router.put(...args),
      patch: (...args) => router.patch(...args),
      delete: (...args) => router.delete(...args),
      options: (...args) => router.options(...args),
      head: (...args) => router.head(...args),
      all: (...args) => router.all(...args),
      route: (...args) => router.route(...args),
    };
  }

  unregisterModule(moduleName) {
    this.routes.delete(moduleName);
  }

  getModulePrefixes(moduleName) {
    return this.routes.get(moduleName)?.prefixes || [];
  }
}

module.exports = DynamicModuleRouter;
