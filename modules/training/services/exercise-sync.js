/**
 * Exercise Database Sync — Downloads the open-source exercise database
 * from GitHub (free-exercise-db, Unlicense) and caches it in SQLite.
 * Runs once on server startup. Re-syncs weekly or on-demand.
 */

const EXERCISES_URL = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json';
const IMAGE_BASE = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/';

function ensureTable(db) {
  try {
    db.get().exec(`
      CREATE TABLE IF NOT EXISTS exercise_library (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        name_ar TEXT DEFAULT '',
        force TEXT DEFAULT '',
        level TEXT DEFAULT 'beginner',
        mechanic TEXT DEFAULT '',
        equipment TEXT DEFAULT '',
        primary_muscles TEXT DEFAULT '[]',
        secondary_muscles TEXT DEFAULT '[]',
        instructions TEXT DEFAULT '[]',
        category TEXT DEFAULT 'strength',
        images TEXT DEFAULT '[]',
        image_url TEXT DEFAULT '',
        video_url TEXT DEFAULT '',
        is_active INTEGER DEFAULT 1,
        synced_at TEXT DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_exlib_equip ON exercise_library(equipment);
      CREATE INDEX IF NOT EXISTS idx_exlib_level ON exercise_library(level);
      CREATE INDEX IF NOT EXISTS idx_exlib_cat ON exercise_library(category);
    `);
    db.save();
  } catch (_) {}
}

async function syncExercises(db) {
  ensureTable(db);
  // Check if we already have data and it's less than 7 days old
  const existing = db.getOne("SELECT COUNT(*) as c FROM exercise_library");
  const lastSync = db.getOne("SELECT MAX(synced_at) as t FROM exercise_library");
  if (existing?.c > 100 && lastSync?.t) {
    const age = Date.now() - new Date(lastSync.t).getTime();
    if (age < 7 * 24 * 60 * 60 * 1000) {
      console.log(`[exercise-sync] ${existing.c} exercises cached, last sync ${lastSync.t} — skipping`);
      return { synced: false, count: existing.c };
    }
  }

  console.log('[exercise-sync] Downloading exercise database from GitHub...');
  try {
    const response = await fetch(EXERCISES_URL);
    if (!response.ok) throw new Error('HTTP ' + response.status);
    const exercises = await response.json();
    if (!Array.isArray(exercises) || exercises.length < 10) throw new Error('Invalid data');

    // sql.js has no better-sqlite3-style db.transaction(); use a manual BEGIN/COMMIT with a
    // prepared statement (sql.js Statement.run takes a positional values array), saving once.
    const raw = db.get();
    const stmt = raw.prepare(`
      INSERT OR REPLACE INTO exercise_library
        (id, name, force, level, mechanic, equipment, primary_muscles, secondary_muscles, instructions, category, images, image_url, synced_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `);
    raw.run('BEGIN');
    try {
      for (const ex of exercises) {
        const imgUrl = ex.images?.[0] ? IMAGE_BASE + ex.images[0] : '';
        stmt.run([
          ex.id || ex.name?.replace(/\s+/g, '_'),
          ex.name || '',
          ex.force || '',
          ex.level || 'beginner',
          ex.mechanic || '',
          ex.equipment || '',
          JSON.stringify(ex.primaryMuscles || []),
          JSON.stringify(ex.secondaryMuscles || []),
          JSON.stringify(ex.instructions || []),
          ex.category || 'strength',
          JSON.stringify(ex.images || []),
          imgUrl
        ]);
      }
      raw.run('COMMIT');
    } catch (txErr) {
      try { raw.run('ROLLBACK'); } catch (_) {}
      throw txErr;
    } finally {
      stmt.free();
    }
    db.save();
    console.log(`[exercise-sync] ✅ Synced ${exercises.length} exercises`);
    return { synced: true, count: exercises.length };
  } catch (err) {
    console.error('[exercise-sync] ❌ Failed:', err.message);
    return { synced: false, error: err.message, count: existing?.c || 0 };
  }
}

function getExercises(db, { muscle, equipment, level, category, search, limit = 50, offset = 0 } = {}) {
  ensureTable(db);
  const where = ['is_active = 1'];
  const params = [];
  if (muscle) { where.push("primary_muscles LIKE ?"); params.push(`%"${muscle}"%`); }
  if (equipment) { where.push("equipment = ?"); params.push(equipment); }
  if (level) { where.push("level = ?"); params.push(level); }
  if (category) { where.push("category = ?"); params.push(category); }
  if (search) { where.push("name LIKE ?"); params.push(`%${search}%`); }
  const rows = db.getAll(
    `SELECT * FROM exercise_library WHERE ${where.join(' AND ')} ORDER BY name LIMIT ? OFFSET ?`,
    [...params, Number(limit), Number(offset)]
  );
  const total = db.getOne(
    `SELECT COUNT(*) as c FROM exercise_library WHERE ${where.join(' AND ')}`,
    params
  )?.c || 0;
  return {
    exercises: rows.map(r => ({
      ...r,
      primaryMuscles: JSON.parse(r.primary_muscles || '[]'),
      secondaryMuscles: JSON.parse(r.secondary_muscles || '[]'),
      instructions: JSON.parse(r.instructions || '[]'),
      images: JSON.parse(r.images || '[]'),
    })),
    total,
    imageBase: IMAGE_BASE,
  };
}

function getExerciseById(db, id) {
  ensureTable(db);
  const r = db.getOne('SELECT * FROM exercise_library WHERE id = ?', [id]);
  if (!r) return null;
  return {
    ...r,
    primaryMuscles: JSON.parse(r.primary_muscles || '[]'),
    secondaryMuscles: JSON.parse(r.secondary_muscles || '[]'),
    instructions: JSON.parse(r.instructions || '[]'),
    images: JSON.parse(r.images || '[]'),
  };
}

function getFilters(db) {
  ensureTable(db);
  const muscles = new Set();
  const equipments = new Set();
  const levels = new Set();
  const categories = new Set();
  const rows = db.getAll('SELECT DISTINCT primary_muscles, equipment, level, category FROM exercise_library WHERE is_active=1');
  for (const r of rows) {
    try { JSON.parse(r.primary_muscles || '[]').forEach(m => muscles.add(m)); } catch (_) {}
    if (r.equipment) equipments.add(r.equipment);
    if (r.level) levels.add(r.level);
    if (r.category) categories.add(r.category);
  }
  return {
    muscles: [...muscles].sort(),
    equipments: [...equipments].sort(),
    levels: [...levels].sort(),
    categories: [...categories].sort(),
  };
}

module.exports = { syncExercises, getExercises, getExerciseById, getFilters, ensureTable, IMAGE_BASE };
