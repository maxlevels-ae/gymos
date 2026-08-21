/**
 * WorkflowEngine — Reusable state machine for entity lifecycle transitions.
 *
 * Usage:
 *   const wf = workflowEngine.create('membership', {
 *     states: ['active','frozen','expired','cancelled'],
 *     transitions: [
 *       { from: 'active', to: 'frozen', action: 'freeze', guard: (ctx) => ctx.freezeAllowed },
 *       { from: 'frozen', to: 'active', action: 'unfreeze' },
 *       { from: 'active', to: 'expired', action: 'expire' },
 *       { from: ['active','frozen','expired'], to: 'cancelled', action: 'cancel' },
 *     ]
 *   });
 *
 *   const result = wf.transition('active', 'freeze', context);
 *   // → { success: true, from: 'active', to: 'frozen' }
 */

class Workflow {
  constructor(name, definition) {
    this.name = name;
    this.states = definition.states || [];
    this.transitions = definition.transitions || [];
    this.hooks = { before: {}, after: {} };
  }

  canTransition(currentState, action) {
    return this.transitions.some(t => {
      const fromMatch = Array.isArray(t.from) ? t.from.includes(currentState) : t.from === currentState || t.from === '*';
      return fromMatch && t.action === action;
    });
  }

  transition(currentState, action, context = {}) {
    const t = this.transitions.find(tr => {
      const fromMatch = Array.isArray(tr.from) ? tr.from.includes(currentState) : tr.from === currentState || tr.from === '*';
      return fromMatch && tr.action === action;
    });

    if (!t) return { success: false, error: `No transition "${action}" from state "${currentState}"` };

    // Run guard
    if (t.guard && !t.guard(context)) {
      return { success: false, error: `Guard blocked transition "${action}"` };
    }

    // Before hooks
    if (this.hooks.before[action]) {
      for (const hook of this.hooks.before[action]) { hook(currentState, t.to, context); }
    }

    const result = { success: true, from: currentState, to: t.to, action };

    // After hooks
    if (this.hooks.after[action]) {
      for (const hook of this.hooks.after[action]) { hook(currentState, t.to, context); }
    }

    return result;
  }

  getAvailableActions(currentState) {
    return this.transitions
      .filter(t => {
        const fromMatch = Array.isArray(t.from) ? t.from.includes(currentState) : t.from === currentState || t.from === '*';
        return fromMatch;
      })
      .map(t => ({ action: t.action, to: t.to }));
  }

  before(action, fn) {
    if (!this.hooks.before[action]) this.hooks.before[action] = [];
    this.hooks.before[action].push(fn);
  }

  after(action, fn) {
    if (!this.hooks.after[action]) this.hooks.after[action] = [];
    this.hooks.after[action].push(fn);
  }
}

const workflowEngine = {
  workflows: new Map(),

  create(name, definition) {
    const wf = new Workflow(name, definition);
    this.workflows.set(name, wf);
    return wf;
  },

  get(name) {
    return this.workflows.get(name);
  },

  list() {
    return Array.from(this.workflows.keys());
  }
};

module.exports = workflowEngine;
