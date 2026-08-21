/**
 * Example module settings hook
 *
 * Usage from a module's routes.js or events.js:
 *
 * module.exports = function (_app, { container }) {
 *   const settingsRegistry = container.resolve('settingsRegistry');
 *
 *   settingsRegistry.registerSection({
 *     key: 'membership_freeze_settings',
 *     tab: 'modules',
 *     label: 'Freeze Settings',
 *     labelAr: 'إعدادات التجميد',
 *     description: 'Membership freeze behavior and pricing.',
 *     descriptionAr: 'سلوك وأسعار تجميد العضويات.',
 *     icon: 'snowflake',
 *     module: 'membership-freeze',
 *     order: 30,
 *     fields: [
 *       {
 *         key: 'freeze_mode',
 *         path: 'modules.membershipFreeze.mode',
 *         storageKey: 'membership_freeze.mode',
 *         label: 'Freeze Mode',
 *         labelAr: 'وضع التجميد',
 *         description: 'Choose how freeze rules are applied.',
 *         descriptionAr: 'اختر كيف يتم تطبيق قواعد التجميد.',
 *         type: 'select',
 *         default: 'manual',
 *         options: [
 *           { value: 'manual', label: 'Manual', labelAr: 'يدوي' },
 *           { value: 'automatic', label: 'Automatic', labelAr: 'تلقائي' }
 *         ]
 *       }
 *     ]
 *   });
 * };
 */
