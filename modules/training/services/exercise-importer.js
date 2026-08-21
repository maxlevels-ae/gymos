/**
 * Exercise Importer — Downloads 800+ exercises from free-exercise-db (Unlicense)
 * and imports them into the existing training_exercises + training_categories tables.
 * Run once from Admin panel. All data stored locally, no external dependency after import.
 */

const IMAGE_BASE = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/';
const DATA_URL = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json';

// Muscle group → category mapping
const MUSCLE_CATEGORY_MAP = {
  'chest': { name: 'Chest', ar: 'صدر', code: 'CHEST', icon: '🏋️', color: '#ef4444' },
  'shoulders': { name: 'Shoulders', ar: 'أكتاف', code: 'SHOULDERS', icon: '🤸', color: '#f59e0b' },
  'biceps': { name: 'Arms', ar: 'ذراعين', code: 'ARMS', icon: '💪', color: '#8b5cf6' },
  'triceps': { name: 'Arms', ar: 'ذراعين', code: 'ARMS', icon: '💪', color: '#8b5cf6' },
  'forearms': { name: 'Arms', ar: 'ذراعين', code: 'ARMS', icon: '💪', color: '#8b5cf6' },
  'lats': { name: 'Back', ar: 'ظهر', code: 'BACK', icon: '🔙', color: '#3b82f6' },
  'middle back': { name: 'Back', ar: 'ظهر', code: 'BACK', icon: '🔙', color: '#3b82f6' },
  'lower back': { name: 'Back', ar: 'ظهر', code: 'BACK', icon: '🔙', color: '#3b82f6' },
  'traps': { name: 'Back', ar: 'ظهر', code: 'BACK', icon: '🔙', color: '#3b82f6' },
  'abdominals': { name: 'Core', ar: 'بطن', code: 'CORE', icon: '🎯', color: '#06b6d4' },
  'quadriceps': { name: 'Legs', ar: 'أرجل', code: 'LEGS', icon: '🦵', color: '#22c55e' },
  'hamstrings': { name: 'Legs', ar: 'أرجل', code: 'LEGS', icon: '🦵', color: '#22c55e' },
  'glutes': { name: 'Legs', ar: 'أرجل', code: 'LEGS', icon: '🦵', color: '#22c55e' },
  'calves': { name: 'Legs', ar: 'أرجل', code: 'LEGS', icon: '🦵', color: '#22c55e' },
  'adductors': { name: 'Legs', ar: 'أرجل', code: 'LEGS', icon: '🦵', color: '#22c55e' },
  'abductors': { name: 'Legs', ar: 'أرجل', code: 'LEGS', icon: '🦵', color: '#22c55e' },
  'neck': { name: 'Shoulders', ar: 'أكتاف', code: 'SHOULDERS', icon: '🤸', color: '#f59e0b' },
};

// Arabic muscle names
const MUSCLE_AR = {
  'chest':'الصدر','shoulders':'الأكتاف','biceps':'البايسبس','triceps':'الترايسبس',
  'forearms':'الساعد','lats':'الظهر العريض','middle back':'وسط الظهر','lower back':'أسفل الظهر',
  'traps':'شبه المنحرفة','abdominals':'البطن','quadriceps':'الفخذ الأمامي','hamstrings':'العضلات الخلفية',
  'glutes':'المؤخرة','calves':'السمانة','adductors':'المقربة','abductors':'المبعدة','neck':'الرقبة',
};

const EQUIP_AR = {
  'barbell':'بار حديد','dumbbell':'دمبل','kettlebells':'كيتل بيل','cable':'كيبل',
  'machine':'جهاز','body only':'وزن الجسم','bands':'أحزمة مقاومة','medicine ball':'كرة طبية',
  'exercise ball':'كرة تمارين','foam roll':'فوم رولر','e-z curl bar':'بار زجزاج','other':'أخرى',
};

const LEVEL_MAP = { 'beginner': 1, 'intermediate': 2, 'expert': 3 };

function ensureColumns(db) {
  // Add missing columns to training_exercises if they don't exist
  const cols = ['force TEXT DEFAULT ""', 'mechanic TEXT DEFAULT ""', 'secondary_muscles TEXT DEFAULT ""', 'images_json TEXT DEFAULT "[]"', 'external_id TEXT DEFAULT ""'];
  cols.forEach(col => {
    try { db.get().exec(`ALTER TABLE training_exercises ADD COLUMN ${col}`); } catch (_) {}
  });
  try { db.get().exec(`CREATE INDEX IF NOT EXISTS idx_trex_extid ON training_exercises(external_id)`); } catch (_) {}
  try { db.save(); } catch (_) {}
}

function ensureCategories(db) {
  const seen = {};
  Object.values(MUSCLE_CATEGORY_MAP).forEach(cat => {
    if (seen[cat.code]) return;
    seen[cat.code] = true;
    try {
      db.run(`INSERT OR IGNORE INTO training_categories (name, name_ar, code, icon, color, sort_order) VALUES (?,?,?,?,?,?)`,
        [cat.name, cat.ar, cat.code, cat.icon, cat.color, Object.keys(seen).length]);
    } catch (_) {}
  });
  // Also add stretching/cardio/plyometrics
  const extra = [
    ['Stretching', 'إطالة', 'STRETCH', '🧘', '#14b8a6', 8],
    ['Cardio', 'كارديو', 'CARDIO', '❤️', '#ec4899', 9],
    ['Plyometrics', 'بليومتركس', 'PLYO', '⚡', '#eab308', 10],
    ['Strongman', 'رجل قوي', 'STRONGMAN', '🏆', '#78716c', 11],
    ['Powerlifting', 'رفع أثقال', 'POWERLIFTING', '🏅', '#a855f7', 12],
  ];
  extra.forEach(([name, ar, code, icon, color, order]) => {
    try { db.run(`INSERT OR IGNORE INTO training_categories (name, name_ar, code, icon, color, sort_order) VALUES (?,?,?,?,?,?)`, [name, ar, code, icon, color, order]); } catch (_) {}
  });
  db.save();
}

function getCategoryId(db, muscleOrCategory) {
  // Try muscle → category code
  const mapping = MUSCLE_CATEGORY_MAP[muscleOrCategory];
  if (mapping) {
    const cat = db.getOne('SELECT id FROM training_categories WHERE code = ?', [mapping.code]);
    if (cat) return cat.id;
  }
  // Try category name directly (stretching, cardio, etc)
  const CATEGORY_CODE_MAP = {
    'strength': 'CHEST', 'stretching': 'STRETCH', 'cardio': 'CARDIO',
    'plyometrics': 'PLYO', 'strongman': 'STRONGMAN', 'powerlifting': 'POWERLIFTING',
    'olympic weightlifting': 'POWERLIFTING',
  };
  const code = CATEGORY_CODE_MAP[muscleOrCategory];
  if (code) {
    const cat = db.getOne('SELECT id FROM training_categories WHERE code = ?', [code]);
    if (cat) return cat.id;
  }
  // Fallback: first category
  return db.getOne('SELECT id FROM training_categories ORDER BY id LIMIT 1')?.id || 1;
}

async function importExercises(db, { source = 'github' } = {}) {
  ensureColumns(db);
  ensureCategories(db);

  // Check if already imported
  const existing = db.getOne("SELECT COUNT(*) as c FROM training_exercises WHERE external_id != '' AND external_id IS NOT NULL");
  if (existing?.c > 100) {
    return { success: true, imported: 0, total: existing.c, message: 'Already imported. Use force=true to re-import.' };
  }

  console.log('[exercise-import] Downloading exercises from GitHub...');
  const response = await fetch(DATA_URL);
  if (!response.ok) throw new Error('Download failed: HTTP ' + response.status);
  const exercises = await response.json();
  if (!Array.isArray(exercises) || exercises.length < 10) throw new Error('Invalid data');

  let imported = 0, skipped = 0;
  const stmt = db.get().prepare(`
    INSERT OR IGNORE INTO training_exercises
      (name, name_ar, category_id, experience_level, video_url, image_url, thumbnail_url,
       sets_default, reps_default, rest_seconds, equipment, muscle_group, difficulty,
       instructions, instructions_ar, force, mechanic, secondary_muscles, images_json, external_id, is_active)
    VALUES (?,?,?,?,?,?,?, ?,?,?,?,?,?, ?,?,?,?,?,?,?,1)
  `);

  // sql.js has no better-sqlite3-style db.transaction(); use a manual BEGIN/COMMIT and save once.
  const raw = db.get();
  raw.run('BEGIN');
  try {
    for (const ex of exercises) {
      const extId = ex.id || ex.name?.replace(/\s+/g, '_');
      // Skip if already exists
      const exists = db.getOne('SELECT id FROM training_exercises WHERE external_id = ?', [extId]);
      if (exists) { skipped++; continue; }

      const primaryMuscle = (ex.primaryMuscles || [])[0] || '';
      const catId = getCategoryId(db, primaryMuscle || ex.category);
      const muscleGroupAr = (ex.primaryMuscles || []).map(m => MUSCLE_AR[m] || m).join(', ');
      const muscleGroupEn = (ex.primaryMuscles || []).join(', ');
      const secondaryAr = (ex.secondaryMuscles || []).map(m => MUSCLE_AR[m] || m).join(', ');
      const equipAr = EQUIP_AR[ex.equipment] || ex.equipment || '';
      const imgUrl = ex.images?.[0] ? IMAGE_BASE + ex.images[0] : '';
      const thumbUrl = ex.images?.[1] ? IMAGE_BASE + ex.images[1] : imgUrl;
      const ytUrl = 'https://www.youtube.com/results?search_query=' + encodeURIComponent(ex.name + ' exercise');
      const level = ex.level || 'beginner';
      const diff = LEVEL_MAP[level] || 1;

      stmt.run([
        ex.name,                         // name
        '',                               // name_ar (empty — admin can fill)
        catId,                            // category_id
        level,                            // experience_level
        ytUrl,                            // video_url (YouTube search)
        imgUrl,                           // image_url
        thumbUrl,                         // thumbnail_url
        3,                                // sets_default
        level === 'beginner' ? '10-12' : level === 'intermediate' ? '8-10' : '6-8',
        level === 'expert' ? 120 : 90,    // rest_seconds
        ex.equipment || '',               // equipment (English)
        muscleGroupEn,                    // muscle_group
        diff,                             // difficulty
        JSON.stringify(ex.instructions || []),  // instructions (JSON array)
        '',                               // instructions_ar (empty — admin or AI fills)
        ex.force || '',                   // force
        ex.mechanic || '',                // mechanic
        secondaryAr,                      // secondary_muscles
        JSON.stringify(ex.images || []),   // images_json
        extId                             // external_id
      ]);
      imported++;
    }
    raw.run('COMMIT');
  } catch (txErr) {
    try { raw.run('ROLLBACK'); } catch (_) {}
    throw txErr;
  } finally {
    stmt.free();
  }
  db.save();

  console.log(`[exercise-import] ✅ Imported ${imported}, skipped ${skipped} (total in DB: ${imported + skipped + (existing?.c || 0)})`);
  return { success: true, imported, skipped, total: imported + skipped };
}

module.exports = { importExercises, ensureColumns, ensureCategories, IMAGE_BASE, MUSCLE_AR, EQUIP_AR };
