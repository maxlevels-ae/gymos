#!/usr/bin/env node
/**
 * GymOS Module Scaffold Generator
 *
 * Usage:
 *   node scripts/create-module.js my-module "My Module Description" "Author Name"
 *   npm run create-module -- my-module "Description" "Author"
 */

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
if (args.length < 1) {
  console.log(`
  🏋️  GymOS Module Scaffold Generator

  Usage:
    node scripts/create-module.js <module-name> [description] [author]

  Example:
    node scripts/create-module.js invoicing "Invoice management module" "GymOS Dev"

  This creates a ready-to-use module in modules/<module-name>/
  `);
  process.exit(0);
}

const moduleName = args[0].toLowerCase().replace(/[^a-z0-9-]/g, '-');
const description = args[1] || `${moduleName} module for GymOS`;
const author = args[2] || 'GymOS Developer';
const moduleDir = path.join(__dirname, '..', 'modules', moduleName);

if (fs.existsSync(moduleDir)) {
  console.error(`❌ Module "${moduleName}" already exists at ${moduleDir}`);
  process.exit(1);
}

// Create directory structure
const dirs = ['migrations', 'services', 'controllers', 'hooks', 'frontend', 'frontend/pages', 'frontend/i18n'];
fs.mkdirSync(moduleDir, { recursive: true });
for (const d of dirs) fs.mkdirSync(path.join(moduleDir, d));

// Permission prefix
const perm = moduleName.replace(/-/g, '_');

// ── manifest.json ──
fs.writeFileSync(path.join(moduleDir, 'manifest.json'), JSON.stringify({
  name: moduleName,
  version: '1.0.0',
  description,
  author,
  core: false,
  dependencies: [],
  permissions: [
    `${perm}.view`,
    `${perm}.create`,
    `${perm}.edit`,
    `${perm}.delete`,
  ],
  menu: [
    {
      label: moduleName.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join(' '),
      labelAr: '',
      icon: 'package',
      path: '/' + moduleName,
      order: 50,
      permission: `${perm}.view`,
    }
  ],
  widgets: [],
  profileTabs: [],
  quickActions: [],
}, null, 2));

// ── migrations/001_initial.js ──
const tableName = moduleName.replace(/-/g, '_');
fs.writeFileSync(path.join(moduleDir, 'migrations', '001_initial.js'), `module.exports = {
  up(db) {
    db.exec(\`
      CREATE TABLE IF NOT EXISTS ${tableName} (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT DEFAULT '',
        is_active INTEGER DEFAULT 1,
        created_by INTEGER,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );

      INSERT OR IGNORE INTO permissions (key, display_name, module) VALUES
        ('${perm}.view', 'View ${moduleName}', '${moduleName}'),
        ('${perm}.create', 'Create ${moduleName}', '${moduleName}'),
        ('${perm}.edit', 'Edit ${moduleName}', '${moduleName}'),
        ('${perm}.delete', 'Delete ${moduleName}', '${moduleName}');

      INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
        SELECT r.id, p.id FROM roles r, permissions p
        WHERE r.name = 'admin' AND p.module = '${moduleName}';
    \`);
  },

  // Optional: rollback migration
  down(db) {
    db.exec('DROP TABLE IF EXISTS ${tableName}');
  }
};
`);

// ── routes.js ──
fs.writeFileSync(path.join(moduleDir, 'routes.js'), `const express = require('express');
const { authMiddleware, requirePermission } = require('../../core/middleware/auth');

module.exports = function (app, { database, eventBus, container }) {
  const router = express.Router();

  // GET /api/${moduleName}
  router.get('/', authMiddleware, requirePermission('${perm}.view'), (req, res) => {
    const items = database.getAll('SELECT * FROM ${tableName} ORDER BY created_at DESC');
    res.json({ success: true, data: items });
  });

  // GET /api/${moduleName}/:id
  router.get('/:id', authMiddleware, requirePermission('${perm}.view'), (req, res) => {
    const item = database.getOne('SELECT * FROM ${tableName} WHERE id = ?', [req.params.id]);
    if (!item) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, data: item });
  });

  // POST /api/${moduleName}
  router.post('/', authMiddleware, requirePermission('${perm}.create'), (req, res) => {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ success: false, error: 'Name is required' });
    const result = database.run(
      'INSERT INTO ${tableName} (name, description, created_by) VALUES (?, ?, ?)',
      [name, description || '', req.user.id]
    );
    eventBus.emit('${moduleName}.created', { id: result.lastInsertRowid });
    res.json({ success: true, data: { id: result.lastInsertRowid } });
  });

  // PUT /api/${moduleName}/:id
  router.put('/:id', authMiddleware, requirePermission('${perm}.edit'), (req, res) => {
    const { name, description, is_active } = req.body;
    database.run(
      'UPDATE ${tableName} SET name=?, description=?, is_active=?, updated_at=datetime("now") WHERE id=?',
      [name, description, is_active ? 1 : 0, req.params.id]
    );
    res.json({ success: true });
  });

  // DELETE /api/${moduleName}/:id
  router.delete('/:id', authMiddleware, requirePermission('${perm}.delete'), (req, res) => {
    database.run('DELETE FROM ${tableName} WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  });

  // Dashboard stats filter (optional)
  eventBus.addFilter('dashboard.stats', (stats) => {
    stats.${perm}Count = database.getOne('SELECT COUNT(*) as c FROM ${tableName}')?.c || 0;
    return stats;
  });

  app.use('/api/${moduleName}', router);
};
`);

// ── events.js (hooks) ──
fs.writeFileSync(path.join(moduleDir, 'events.js'), `/**
 * Event subscriptions for ${moduleName} module.
 * Subscribe to events from other modules here.
 */
module.exports = function (eventBus, { database, container }) {
  // Example: React to member creation
  // eventBus.on('member.created', async ({ memberId }) => {
  //   console.log('${moduleName}: New member created:', memberId);
  // });
};
`);

// ── frontend/index.js ──
fs.writeFileSync(path.join(moduleDir, 'frontend', 'index.js'), `// Optional frontend bootstrap for ${moduleName}
// Runs automatically when the module frontend is discovered.
`);

// ── frontend/menu.js ──
fs.writeFileSync(path.join(moduleDir, 'frontend', 'menu.js'), `GymOS.registerMenu({
  path: '/${moduleName}',
  label: '${moduleName.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join(' ')}',
  labelAr: '',
  icon: 'package',
  order: 50,
  module: '${moduleName}',
});
`);

// ── frontend/pages/${moduleName}-page.js ──
fs.writeFileSync(path.join(moduleDir, 'frontend', 'pages', `${moduleName}-page.js`), `const { useState, useEffect } = React;
const { api, useI18n } = shared;

function ${moduleName.split('-').map(part => part.charAt(0).toUpperCase() + part.slice(1)).join('')}Page() {
  const { t } = useI18n();
  const [items, setItems] = useState([]);

  useEffect(() => {
    api.get('/api/${moduleName}').then((r) => setItems(r.data || [])).catch(() => setItems([]));
  }, []);

  return <div>
    <div className="ph">
      <h1>{t('${moduleName}.title', '${moduleName.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join(' ')}')}</h1>
      <p>{t('${moduleName}.desc', '${description.replace(/'/g, "\'")}')}</p>
    </div>
    <div className="pb">
      <div className="card">
        <div className="ct">{t('common.showing')} {items.length}</div>
      </div>
    </div>
  </div>;
}

GymOS.registerPage({
  path: '/${moduleName}',
  component: ${moduleName.split('-').map(part => part.charAt(0).toUpperCase() + part.slice(1)).join('')}Page,
  label: '${moduleName.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join(' ')}',
  labelAr: '',
  order: 50,
  module: '${moduleName}',
});
`);

// ── frontend/settings.js ──
fs.writeFileSync(path.join(moduleDir, 'frontend', 'settings.js'), `// Optional settings section injection for ${moduleName}
// Example:
// GymOS.registerSettingsSection({
//   id: '${moduleName}-settings',
//   module: '${moduleName}',
//   tab: 'modules',
//   title: '${moduleName.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join(' ')} Settings',
//   titleAr: '',
//   fields: []
// });
`);

// ── frontend/i18n/en.json ──
fs.writeFileSync(path.join(moduleDir, 'frontend', 'i18n', 'en.json'), JSON.stringify({
  [moduleName.replace(/-/g, '_')]: {
    title: moduleName.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join(' '),
    desc: description,
  },
}, null, 2));

// ── frontend/i18n/ar.json ──
fs.writeFileSync(path.join(moduleDir, 'frontend', 'i18n', 'ar.json'), JSON.stringify({
  [moduleName.replace(/-/g, '_')]: {
    title: '',
    desc: '',
  },
}, null, 2));

// ── README.md ──
fs.writeFileSync(path.join(moduleDir, 'README.md'), `# ${moduleName}

${description}

## Installation
Drop this folder into \`modules/\` and restart GymOS.

## API Endpoints
- \`GET /api/${moduleName}\` — List all
- \`GET /api/${moduleName}/:id\` — Get one
- \`POST /api/${moduleName}\` — Create
- \`PUT /api/${moduleName}/:id\` — Update
- \`DELETE /api/${moduleName}/:id\` — Delete

## Permissions
- \`${perm}.view\`
- \`${perm}.create\`
- \`${perm}.edit\`
- \`${perm}.delete\`

## Events Emitted
- \`${moduleName}.created\`

## Author
${author}
`);

console.log(`
  ✅ Module "${moduleName}" created at modules/${moduleName}/

  Files generated:
    📄 manifest.json        — Module metadata & configuration
    📄 routes.js             — API endpoints
    📄 events.js             — Event subscriptions
    📄 README.md             — Documentation
    📁 migrations/
      📄 001_initial.js      — Database schema
    📁 services/             — Business logic (empty)
    📁 controllers/          — Route handlers (empty)
    📁 hooks/                — Event hooks (empty)
    📁 frontend/             — Optional injected frontend assets
      📄 index.js            — Frontend bootstrap (optional)
      📄 menu.js             — Menu injection (optional)
      📄 settings.js         — Settings section injection (optional)
      📁 pages/              — Auto-loaded pages (optional)
      📁 i18n/               — Auto-loaded translations (optional)

  Next steps:
    1. Edit manifest.json to customize menu, permissions, widgets
    2. Edit migrations/001_initial.js to define your schema
    3. Edit routes.js to implement your API
    4. Add frontend files only if the module needs UI injection
    5. Restart GymOS — your module auto-loads!
`);
