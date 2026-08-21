/**
 * Container - Simple dependency injection / service registry
 * Modules can register and resolve services through this container.
 */
class Container {
  constructor() {
    this.services = new Map();
    this.factories = new Map();
  }

  // Register a singleton instance
  register(name, instance) {
    this.services.set(name, instance);
  }

  // Register a factory (lazy instantiation)
  factory(name, factoryFn) {
    this.factories.set(name, factoryFn);
  }

  // Resolve a service
  resolve(name) {
    if (this.services.has(name)) return this.services.get(name);
    if (this.factories.has(name)) {
      const instance = this.factories.get(name)(this);
      this.services.set(name, instance);
      return instance;
    }
    throw new Error(`Service not found: ${name}`);
  }

  // Check if service exists
  has(name) {
    return this.services.has(name) || this.factories.has(name);
  }

  // List all registered service names
  list() {
    return [
      ...new Set([...this.services.keys(), ...this.factories.keys()])
    ];
  }
}

module.exports = new Container();
