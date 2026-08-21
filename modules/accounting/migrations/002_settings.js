
module.exports = {
  up(db) {
    db.exec(`
      INSERT OR IGNORE INTO settings (key, value, type, module, label) VALUES
        ('accounting.default_currency', 'JOD', 'string', 'accounting', 'Default Currency'),
        ('accounting.fiscal_year_start', '01-01', 'string', 'accounting', 'Fiscal Year Start'),
        ('accounting.localization_region', 'Middle East', 'string', 'accounting', 'Localization Region'),
        ('accounting.localization_country', 'JO', 'string', 'accounting', 'Localization Country'),
        ('accounting.include_cafeteria', 'false', 'boolean', 'accounting', 'Include Cafeteria in Accounting');
    `);
  }
};
