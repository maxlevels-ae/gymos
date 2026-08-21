/**
 * NotificationTemplates — Registers and renders notification templates.
 * Modules register templates; the system renders them with context data.
 *
 * Usage:
 *   templates.register('membership.expiring', {
 *     title: 'Membership Expiring',
 *     body: 'Hi {{member_name}}, your {{plan_name}} expires on {{end_date}}.',
 *     type: 'warning',
 *     channels: ['in_app', 'email']
 *   });
 *
 *   const msg = templates.render('membership.expiring', {
 *     member_name: 'Ahmad', plan_name: 'Monthly', end_date: '2025-06-01'
 *   });
 */

class NotificationTemplates {
  constructor() {
    this.templates = new Map();
  }

  register(key, template) {
    this.templates.set(key, {
      key,
      title: template.title || key,
      body: template.body || '',
      type: template.type || 'info',
      channels: template.channels || ['in_app'],
      module: template.module || 'core',
    });
  }

  render(key, data = {}) {
    const tpl = this.templates.get(key);
    if (!tpl) return null;

    const interpolate = (str) => str.replace(/\{\{(\w+)\}\}/g, (_, k) => data[k] !== undefined ? data[k] : `{{${k}}}`);

    return {
      title: interpolate(tpl.title),
      body: interpolate(tpl.body),
      type: tpl.type,
      channels: tpl.channels,
      templateKey: key,
    };
  }

  list() {
    return Array.from(this.templates.values());
  }

  has(key) {
    return this.templates.has(key);
  }
}

module.exports = new NotificationTemplates();
