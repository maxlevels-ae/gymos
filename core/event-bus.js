/**
 * EventBus - Central event/hooks system
 * Modules can subscribe to events and emit them.
 * Core emits lifecycle events that modules can hook into.
 */
class EventBus {
  constructor() {
    this.listeners = new Map();
    this.filters = new Map();
  }

  // Subscribe to an event
  on(event, handler, priority = 10) {
    if (!this.listeners.has(event)) this.listeners.set(event, []);
    this.listeners.get(event).push({ handler, priority });
    this.listeners.get(event).sort((a, b) => a.priority - b.priority);
    return () => this.off(event, handler);
  }

  // Unsubscribe
  off(event, handler) {
    if (!this.listeners.has(event)) return;
    const list = this.listeners.get(event).filter(l => l.handler !== handler);
    this.listeners.set(event, list);
  }

  // Emit an event (fire and forget)
  async emit(event, data = {}) {
    const handlers = this.listeners.get(event) || [];
    for (const { handler } of handlers) {
      try {
        await handler(data);
      } catch (err) {
        console.error(`EventBus error [${event}]:`, err.message);
      }
    }
  }

  // Synchronous emit
  emitSync(event, data = {}) {
    const handlers = this.listeners.get(event) || [];
    for (const { handler } of handlers) {
      try {
        handler(data);
      } catch (err) {
        console.error(`EventBus sync error [${event}]:`, err.message);
      }
    }
  }

  // Register a filter (value pipeline)
  addFilter(name, handler, priority = 10) {
    if (!this.filters.has(name)) this.filters.set(name, []);
    this.filters.get(name).push({ handler, priority });
    this.filters.get(name).sort((a, b) => a.priority - b.priority);
  }

  // Apply filters to a value
  applyFilters(name, value, context = {}) {
    const handlers = this.filters.get(name) || [];
    let result = value;
    for (const { handler } of handlers) {
      try {
        result = handler(result, context);
      } catch (err) {
        console.error(`Filter error [${name}]:`, err.message);
      }
    }
    return result;
  }

  // List all registered events
  listEvents() {
    return Array.from(this.listeners.keys());
  }
}

module.exports = new EventBus();
