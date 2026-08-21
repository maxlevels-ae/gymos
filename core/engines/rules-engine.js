/**
 * RulesEngine — Evaluates conditions and triggers actions.
 *
 * Usage:
 *   rulesEngine.register({
 *     name: 'expire-memberships',
 *     condition: (ctx) => ctx.daysLeft <= 0,
 *     action: (ctx) => { /* expire logic *\/ }
 *   });
 *
 *   rulesEngine.evaluate('expire-memberships', { daysLeft: -1 });
 */

class RulesEngine {
  constructor() {
    this.rules = new Map();
  }

  register(rule) {
    if (!rule.name) throw new Error('Rule must have a name');
    if (!rule.condition || typeof rule.condition !== 'function') throw new Error('Rule must have a condition function');
    if (!rule.action || typeof rule.action !== 'function') throw new Error('Rule must have an action function');

    this.rules.set(rule.name, {
      name: rule.name,
      description: rule.description || '',
      module: rule.module || 'core',
      condition: rule.condition,
      action: rule.action,
      priority: rule.priority || 10,
      enabled: rule.enabled !== false,
    });
  }

  evaluate(name, context = {}) {
    const rule = this.rules.get(name);
    if (!rule || !rule.enabled) return { matched: false, error: rule ? null : 'Rule not found' };

    try {
      const matches = rule.condition(context);
      if (matches) {
        const result = rule.action(context);
        return { matched: true, result };
      }
      return { matched: false };
    } catch (err) {
      return { matched: false, error: err.message };
    }
  }

  evaluateAll(context = {}) {
    const results = [];
    const sorted = Array.from(this.rules.values()).filter(r => r.enabled).sort((a, b) => a.priority - b.priority);

    for (const rule of sorted) {
      try {
        if (rule.condition(context)) {
          const result = rule.action(context);
          results.push({ rule: rule.name, matched: true, result });
        }
      } catch (err) {
        results.push({ rule: rule.name, matched: false, error: err.message });
      }
    }
    return results;
  }

  list() {
    return Array.from(this.rules.values()).map(r => ({
      name: r.name, description: r.description, module: r.module, priority: r.priority, enabled: r.enabled
    }));
  }

  enable(name) { const r = this.rules.get(name); if (r) r.enabled = true; }
  disable(name) { const r = this.rules.get(name); if (r) r.enabled = false; }
}

module.exports = new RulesEngine();
