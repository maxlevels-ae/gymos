/**
 * Event hooks for membership-freeze module.
 * - Registers notification templates
 * - Periodic job: auto-completes expired freezes every 60 seconds
 */
module.exports = function (eventBus, { database, container }) {
  let intervalHandle = null;

  // ─── Register notification templates ───────────
  try {
    const templates = container.resolve('notificationTemplates');

    templates.register('freeze.started', {
      title: 'Membership Frozen',
      body: 'Hi {{member_name}}, your membership has been frozen for {{total_days}} days until {{end_date}}.',
      type: 'info', channels: ['in_app'], module: 'membership-freeze',
    });
    templates.register('freeze.ending_soon', {
      title: 'Freeze Ending Soon',
      body: 'Hi {{member_name}}, your membership freeze ends on {{end_date}}.',
      type: 'warning', channels: ['in_app'], module: 'membership-freeze',
    });
    templates.register('freeze.completed', {
      title: 'Freeze Completed',
      body: 'Hi {{member_name}}, your freeze has ended. Membership active until {{new_end_date}}.',
      type: 'info', channels: ['in_app'], module: 'membership-freeze',
    });
    templates.register('freeze.payment_due', {
      title: 'Freeze Payment Required',
      body: 'Freeze request for {{member_name}} requires payment of {{price}} {{currency}}.',
      type: 'warning', channels: ['in_app'], module: 'membership-freeze',
    });
  } catch (_) {}

  // ─── Periodic auto-complete job ────────────────
  function autoCompleteExpired() {
    try {
      const settings = container.resolve('settings');
      const enabled = settings?.get('system.auto_complete_freezes', true);
      if (!enabled) return;

      const expired = database.getAll(
        "SELECT id FROM freeze_requests WHERE status = 'active' AND end_date <= date('now')"
      );
      if (expired.length > 0) {
        const freezeService = container.resolve('membership-freeze.freeze-service');
        for (const row of expired) freezeService.complete(row.id, null);
        console.log('    ❄️  Auto-completed ' + expired.length + ' expired freeze(s)');
      }
    } catch (_) {}
  }

  // Run once on boot, then every 60 seconds
  eventBus.on('modules.loaded', () => {
    autoCompleteExpired();
    if (!intervalHandle) intervalHandle = setInterval(autoCompleteExpired, 60000);
  });
};
