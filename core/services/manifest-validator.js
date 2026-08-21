/**
 * ManifestValidator — Validates module manifest.json against required schema.
 * Returns { valid, errors, warnings }
 */
const REQUIRED_FIELDS = ['name', 'version'];
const VALID_NAME = /^[a-z][a-z0-9-]*$/;
const VALID_VERSION = /^\d+\.\d+\.\d+$/;
const VALID_MENU_FIELDS = ['label', 'path', 'icon'];
const VALID_PERMISSION = /^[a-z][a-z0-9_.]*$/;

const manifestValidator = {
  validate(manifest, { checkFiles = false, modulePath = '' } = {}) {
    const errors = [];
    const warnings = [];

    if (!manifest || typeof manifest !== 'object') {
      return { valid: false, errors: ['Manifest is not a valid JSON object'], warnings };
    }

    // Required fields
    for (const field of REQUIRED_FIELDS) {
      if (!manifest[field]) errors.push(`Missing required field: "${field}"`);
    }

    // Name format
    if (manifest.name && !VALID_NAME.test(manifest.name)) {
      errors.push(`Invalid name "${manifest.name}": must be lowercase alphanumeric with hyphens, starting with letter`);
    }

    // Version format
    if (manifest.version && !VALID_VERSION.test(manifest.version)) {
      errors.push(`Invalid version "${manifest.version}": must be semver (e.g. 1.0.0)`);
    }

    // Dependencies
    if (manifest.dependencies) {
      if (!Array.isArray(manifest.dependencies)) {
        errors.push('"dependencies" must be an array');
      } else {
        for (const dep of manifest.dependencies) {
          if (typeof dep !== 'string') errors.push(`Invalid dependency: ${JSON.stringify(dep)} — must be a string`);
        }
        // Check self-dependency
        if (manifest.name && manifest.dependencies.includes(manifest.name)) {
          errors.push('Module cannot depend on itself');
        }
      }
    }

    // Menu items
    if (manifest.menu) {
      if (!Array.isArray(manifest.menu)) {
        errors.push('"menu" must be an array');
      } else {
        manifest.menu.forEach((item, i) => {
          if (!item.label) errors.push(`Menu item ${i}: missing "label"`);
          if (!item.path) errors.push(`Menu item ${i}: missing "path"`);
        });
      }
    }

    // Permissions
    if (manifest.permissions) {
      if (!Array.isArray(manifest.permissions)) {
        errors.push('"permissions" must be an array');
      } else {
        manifest.permissions.forEach((p, i) => {
          if (typeof p !== 'string') errors.push(`Permission ${i}: must be a string`);
          else if (!VALID_PERMISSION.test(p)) warnings.push(`Permission "${p}": unusual format`);
        });
      }
    }

    // Widgets
    if (manifest.widgets && !Array.isArray(manifest.widgets)) {
      errors.push('"widgets" must be an array');
    }

    // Optional fields type checks
    if (manifest.author && typeof manifest.author !== 'string') warnings.push('"author" should be a string');
    if (manifest.description && typeof manifest.description !== 'string') warnings.push('"description" should be a string');
    if (manifest.core !== undefined && typeof manifest.core !== 'boolean') warnings.push('"core" should be boolean');

    // File checks
    if (checkFiles && modulePath) {
      const fs = require('fs');
      const path = require('path');
      if (!fs.existsSync(path.join(modulePath, 'routes.js'))) {
        warnings.push('No routes.js found — module will have no API endpoints');
      }
    }

    return { valid: errors.length === 0, errors, warnings };
  },

  /**
   * Compare two semver strings: returns -1, 0, or 1
   */
  compareVersions(a, b) {
    const pa = a.split('.').map(Number);
    const pb = b.split('.').map(Number);
    for (let i = 0; i < 3; i++) {
      if ((pa[i] || 0) > (pb[i] || 0)) return 1;
      if ((pa[i] || 0) < (pb[i] || 0)) return -1;
    }
    return 0;
  },

  /**
   * Check if version A satisfies minimum version B
   */
  satisfiesMinVersion(version, minVersion) {
    return this.compareVersions(version, minVersion) >= 0;
  }
};

module.exports = manifestValidator;
