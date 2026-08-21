(function () {
  function deepMerge(target, source) {
    if (!source || typeof source !== 'object') return target;
    for (const [key, value] of Object.entries(source)) {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        if (!target[key] || typeof target[key] !== 'object' || Array.isArray(target[key])) target[key] = {};
        deepMerge(target[key], value);
      } else {
        target[key] = value;
      }
    }
    return target;
  }

  const state = {
    frontendRegistry: null,
    backendTranslations: {},
    moduleTranslations: {},
    loadedScripts: new Set(),
    loadedLocales: new Set(),
  };

  const registries = {
    pages: new Map(),
    menus: [],
    widgets: [],
    settingsSections: [],
    profileTabs: [],
    quickActions: [],
    translations: {},
  };

  function upsertBy(list, item, key) {
    const idx = list.findIndex((entry) => entry[key] === item[key]);
    if (idx >= 0) list[idx] = { ...list[idx], ...item };
    else list.push(item);
  }

  const GymOS = {
    state,
    registries,
    shared: {},
    deepMerge,

    registerPage(def) {
      if (!def || !def.path || typeof def.component !== 'function') return;
      registries.pages.set(def.path, { order: 99, ...def });
    },
    registerMenu(def) {
      if (!def || !def.path) return;
      upsertBy(registries.menus, { order: 99, ...def }, 'path');
    },
    registerWidget(def) {
      if (!def || !def.id) return;
      upsertBy(registries.widgets, { order: 99, ...def }, 'id');
    },
    registerSettingsSection(def) {
      if (!def || !def.id) return;
      upsertBy(registries.settingsSections, { order: 99, fields: [], ...def }, 'id');
    },
    registerProfileTab(def) {
      if (!def || !def.id) return;
      upsertBy(registries.profileTabs, { order: 99, ...def }, 'id');
    },
    registerQuickAction(def) {
      if (!def || !def.id) return;
      upsertBy(registries.quickActions, { order: 99, ...def }, 'id');
    },
    registerTranslations(locale, data) {
      if (!locale || !data) return;
      if (!registries.translations[locale]) registries.translations[locale] = {};
      deepMerge(registries.translations[locale], data);
    },

    getPage(path) {
      return registries.pages.get(path) || null;
    },
    getMenus() {
      return [...registries.menus].sort((a, b) => (a.order || 99) - (b.order || 99));
    },
    getWidgets() {
      return [...registries.widgets].sort((a, b) => (a.order || 99) - (b.order || 99));
    },
    getSettingsSections() {
      return [...registries.settingsSections].sort((a, b) => (a.order || 99) - (b.order || 99));
    },
    getProfileTabs() {
      return [...registries.profileTabs].sort((a, b) => (a.order || 99) - (b.order || 99));
    },
    getQuickActions() {
      return [...registries.quickActions].sort((a, b) => (a.order || 99) - (b.order || 99));
    },

    async fetchJson(url, options) {
      const response = await fetch(url, options);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Request failed');
      return data.data !== undefined ? data.data : data;
    },

    async loadFrontendRegistry() {
      if (state.frontendRegistry) return state.frontendRegistry;
      state.frontendRegistry = await this.fetchJson('/api/frontend/registry');
      return state.frontendRegistry;
    },

    async loadBabelScript(url) {
      if (!url || state.loadedScripts.has(url)) return;
      const response = await fetch(url, { credentials: 'same-origin' });
      if (!response.ok) throw new Error('Failed to load module asset: ' + url);
      const source = await response.text();
      const transformed = window.Babel.transform(source, { presets: ['react'] }).code;
      const fn = new Function('window', 'React', 'ReactDOM', 'GymOS', 'shared', `${transformed}\n//# sourceURL=${url}`);
      fn(window, window.React, window.ReactDOM, GymOS, GymOS.shared);
      state.loadedScripts.add(url);
    },

    async ensureLocale(locale) {
      const requested = locale || 'en';
      if (requested !== 'en' && !state.loadedLocales.has('en')) await this.ensureLocale('en');

      if (!state.backendTranslations[requested]) {
        state.backendTranslations[requested] = await this.fetchJson('/api/translations/' + requested);
      }

      const registry = await this.loadFrontendRegistry();
      if (!state.moduleTranslations[requested]) state.moduleTranslations[requested] = {};
      const modules = registry?.modules || [];
      for (const mod of modules) {
        const url = mod?.frontend?.i18n?.[requested]?.url;
        if (!url || state.moduleTranslations[requested][mod.name]) continue;
        try {
          const response = await fetch(url, { credentials: 'same-origin' });
          if (!response.ok) continue;
          state.moduleTranslations[requested][mod.name] = await response.json();
        } catch (_) {}
      }

      state.loadedLocales.add(requested);
      return this.getMergedTranslations(requested);
    },

    getMergedTranslations(locale) {
      const requested = locale || 'en';
      const result = {};
      deepMerge(result, state.backendTranslations.en || {});
      const enModules = state.moduleTranslations.en || {};
      Object.values(enModules).forEach((data) => deepMerge(result, data || {}));
      deepMerge(result, registries.translations.en || {});
      if (requested !== 'en') {
        deepMerge(result, state.backendTranslations[requested] || {});
        const requestedModules = state.moduleTranslations[requested] || {};
        Object.values(requestedModules).forEach((data) => deepMerge(result, data || {}));
        deepMerge(result, registries.translations[requested] || {});
      }
      return result;
    },

    async initModuleFrontends() {
      const registry = await this.loadFrontendRegistry();
      state.moduleRegistry = registry;
      state.moduleScriptMap = new Map();
      const modules = registry?.modules || [];
      // 1) Load lightweight registration files immediately (menu.js, widgets.js, index.js, etc.)
      //    These are small files that register menu items, dashboard widgets, settings sections.
      //    Skip the large pages/*.js files — those are deferred to route navigation.
      for (const mod of modules) {
        const optionalFiles = mod?.frontend?.optional || {};
        const lightUrls = Object.values(optionalFiles).map(v => v && v.url).filter(Boolean);
        for (const url of lightUrls) {
          try { await this.loadBabelScript(url); } catch (_) {}
        }
      }
      // 2) Register heavy page scripts for deferred loading
      for (const mod of modules) {
        const pages = mod?.frontend?.pages || [];
        const pageUrls = pages.map(p => p && p.url).filter(Boolean);
        if (pageUrls.length === 0) continue;
        const paths = (mod?.menu || []).map(m => m.path).filter(Boolean);
        state.moduleScriptMap.set(mod.name, { scripts: pageUrls, loaded: false });
        for (const p of paths) {
          state.moduleScriptMap.set(p, { scripts: pageUrls, loaded: false, ref: mod.name });
        }
      }
      return registry;
    },

    async ensureModuleLoaded(routePath) {
      if (!state.moduleScriptMap) return;
      let entry = state.moduleScriptMap.get(routePath);
      if (!entry) {
        const clean = (routePath || '').split('?')[0];
        // Match a module by its base menu path. Sub-pages are named either
        // `/base/sub` or (by convention here) `/base-sub` (e.g. /cafeteria-debts),
        // so accept both separators. Pick the LONGEST matching key = most specific.
        let bestLen = -1;
        for (const [key, val] of state.moduleScriptMap.entries()) {
          if (!key.startsWith('/')) continue;
          if (clean === key || clean.startsWith(key + '/') || clean.startsWith(key + '-')) {
            if (key.length > bestLen) { entry = val; bestLen = key.length; }
          }
        }
      }
      if (!entry || entry.loaded) return;
      const actual = entry.ref ? state.moduleScriptMap.get(entry.ref) : entry;
      if (!actual || actual.loaded) { entry.loaded = true; return; }
      for (const url of actual.scripts) {
        try { await this.loadBabelScript(url); } catch (_) {}
      }
      actual.loaded = true;
      entry.loaded = true;
    },
  };

  window.GymOS = GymOS;
})();
