// Accounting V2: Single entry point — all navigation is inside the accounting workspace via top header.
// No left-sidebar sub-items for accounting pages.
GymOS.registerMenu({
  path: '/accounting',
  label: 'Accounting',
  labelAr: 'المحاسبة',
  icon: 'calculator',
  order: 70,
  module: 'accounting'
});
