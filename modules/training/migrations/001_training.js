function ensureSetting(db, key, value, type='string', module='training', label='') {
  try {
    const existing = db.exec(`SELECT id FROM settings WHERE key='${key.replace("'", "''")}'`);
    if (!existing.length || !existing[0].values.length) {
      db.run('INSERT INTO settings (key, value, type, module, label, created_at, updated_at) VALUES (?, ?, ?, ?, ?, datetime("now"), datetime("now"))', [key, String(value), type, module, label]);
    }
  } catch (_) {}
}

module.exports.up = function (db) {

  // ── Training categories (Chest, Back, Legs, Shoulders, Arms, Core, Cardio, etc.)
  db.run(`CREATE TABLE IF NOT EXISTS training_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    name_ar TEXT DEFAULT '',
    code TEXT UNIQUE,
    icon TEXT DEFAULT '',
    color TEXT DEFAULT '',
    sort_order INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )`);

  // ── Exercises library (video + image + instructions per category)
  db.run(`CREATE TABLE IF NOT EXISTS training_exercises (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    name_ar TEXT DEFAULT '',
    description TEXT DEFAULT '',
    description_ar TEXT DEFAULT '',
    experience_level TEXT DEFAULT 'all',
    video_url TEXT DEFAULT '',
    image_url TEXT DEFAULT '',
    thumbnail_url TEXT DEFAULT '',
    sets_default INTEGER DEFAULT 3,
    reps_default TEXT DEFAULT '10-12',
    rest_seconds INTEGER DEFAULT 60,
    equipment TEXT DEFAULT '',
    muscle_group TEXT DEFAULT '',
    difficulty INTEGER DEFAULT 1,
    instructions TEXT DEFAULT '',
    instructions_ar TEXT DEFAULT '',
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (category_id) REFERENCES training_categories(id) ON DELETE CASCADE
  )`);

  // ── Training programs (collections of exercises grouped for a level)
  db.run(`CREATE TABLE IF NOT EXISTS training_programs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    name_ar TEXT DEFAULT '',
    description TEXT DEFAULT '',
    description_ar TEXT DEFAULT '',
    experience_level TEXT DEFAULT 'beginner',
    duration_weeks INTEGER DEFAULT 4,
    days_per_week INTEGER DEFAULT 3,
    goal TEXT DEFAULT 'general',
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )`);

  // ── Program exercises (which exercises belong to which program, on which day)
  db.run(`CREATE TABLE IF NOT EXISTS training_program_exercises (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    program_id INTEGER NOT NULL,
    exercise_id INTEGER NOT NULL,
    day_number INTEGER DEFAULT 1,
    sort_order INTEGER DEFAULT 0,
    sets INTEGER DEFAULT 3,
    reps TEXT DEFAULT '10-12',
    rest_seconds INTEGER DEFAULT 60,
    notes TEXT DEFAULT '',
    notes_ar TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (program_id) REFERENCES training_programs(id) ON DELETE CASCADE,
    FOREIGN KEY (exercise_id) REFERENCES training_exercises(id) ON DELETE CASCADE
  )`);

  // ── Member training profile (birthday, experience, assigned program)
  db.run(`CREATE TABLE IF NOT EXISTS training_member_profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    member_id INTEGER NOT NULL UNIQUE,
    date_of_birth TEXT,
    age INTEGER DEFAULT 0,
    experience_level TEXT DEFAULT 'beginner',
    fitness_goal TEXT DEFAULT 'general',
    health_notes TEXT DEFAULT '',
    assigned_program_id INTEGER,
    onboarding_completed INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE,
    FOREIGN KEY (assigned_program_id) REFERENCES training_programs(id) ON DELETE SET NULL
  )`);

  // ── Member exercise progress / log
  db.run(`CREATE TABLE IF NOT EXISTS training_progress (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    member_id INTEGER NOT NULL,
    exercise_id INTEGER NOT NULL,
    program_id INTEGER,
    sets_completed INTEGER DEFAULT 0,
    reps_completed TEXT DEFAULT '',
    weight_used REAL DEFAULT 0,
    duration_minutes INTEGER DEFAULT 0,
    notes TEXT DEFAULT '',
    completed_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE,
    FOREIGN KEY (exercise_id) REFERENCES training_exercises(id) ON DELETE CASCADE,
    FOREIGN KEY (program_id) REFERENCES training_programs(id) ON DELETE SET NULL
  )`);

  // ── Indexes
  db.run(`CREATE INDEX IF NOT EXISTS idx_training_exercises_cat ON training_exercises(category_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_training_exercises_level ON training_exercises(experience_level)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_training_prog_ex_prog ON training_program_exercises(program_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_training_profiles_member ON training_member_profiles(member_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_training_progress_member ON training_progress(member_id)`);

  // ── Default categories
  const cats = [
    ['Chest',     'صدر',      'CHEST',     '💪', '#ef4444', 1],
    ['Back',      'ظهر',      'BACK',      '🔙', '#3b82f6', 2],
    ['Legs',      'أرجل',     'LEGS',      '🦵', '#22c55e', 3],
    ['Shoulders', 'أكتاف',    'SHOULDERS', '🤸', '#f59e0b', 4],
    ['Arms',      'ذراعين',   'ARMS',      '💪', '#8b5cf6', 5],
    ['Core',      'بطن',      'CORE',      '🎯', '#06b6d4', 6],
    ['Cardio',    'كارديو',   'CARDIO',    '❤️', '#ec4899', 7],
    ['Stretching','إطالة',    'STRETCH',   '🧘', '#14b8a6', 8],
  ];
  cats.forEach(([name, ar, code, icon, color, order]) => {
    try { db.run('INSERT OR IGNORE INTO training_categories (name, name_ar, code, icon, color, sort_order) VALUES (?,?,?,?,?,?)', [name, ar, code, icon, color, order]); } catch(_){}
  });

  // ── Default exercises (seeded with video/image placeholders for each category & level)
  const exercises = [
    // Chest
    ['Flat Bench Press',           'بنش مستوي',           1, 'beginner',  'https://www.youtube.com/watch?v=rT7DgCr-3pg', '/training/images/bench-press.jpg',       4, '8-12',  90, 'Barbell', 'Chest, Triceps', 'Lie flat, grip barbell shoulder-width, lower to chest, press up.', 'استلقِ مستوياً، امسك البار بعرض الأكتاف، أنزل إلى الصدر، ارفع.'],
    ['Incline Dumbbell Press',     'بنش مائل دمبل',       1, 'mid',       'https://www.youtube.com/watch?v=8iPEnn-ltC8', '/training/images/incline-db-press.jpg',  4, '10-12', 90, 'Dumbbells, Incline Bench', 'Chest Upper, Shoulders', 'Set bench 30-45°, press dumbbells from chest level.', 'اضبط البنش 30-45 درجة، ارفع الدمبلز من مستوى الصدر.'],
    ['Cable Crossover',            'كروس أوفر',           1, 'expert',    'https://www.youtube.com/watch?v=taI4XduLpTk', '/training/images/cable-crossover.jpg',   3, '12-15', 60, 'Cable Machine', 'Chest Inner', 'Stand centered, pull cables in arc motion to chest level.', 'قف بالمنتصف، اسحب الكابلات بحركة قوسية إلى مستوى الصدر.'],
    ['Push-ups',                   'ضغط أرضي',            1, 'beginner',  'https://www.youtube.com/watch?v=IODxDxX7oi4', '/training/images/pushups.jpg',           3, '15-20', 45, 'None', 'Chest, Triceps, Core', 'Hands shoulder-width, body straight, lower chest to floor.', 'اليدين بعرض الأكتاف، الجسم مستقيم، أنزل الصدر للأرض.'],
    // Back
    ['Lat Pulldown',               'سحب علوي',            2, 'beginner',  'https://www.youtube.com/watch?v=CAwf7n6Luuc', '/training/images/lat-pulldown.jpg',      4, '10-12', 90, 'Cable Machine', 'Lats, Biceps', 'Grip wide, pull bar to upper chest, squeeze lats.', 'مسكة واسعة، اسحب البار لأعلى الصدر، اضغط على الظهر.'],
    ['Barbell Row',                'تجديف بار',           2, 'mid',       'https://www.youtube.com/watch?v=FWJR5Ve8bnQ', '/training/images/barbell-row.jpg',       4, '8-10',  90, 'Barbell', 'Back, Biceps', 'Bend 45°, pull barbell to lower chest, squeeze.', 'انحنِ 45 درجة، اسحب البار لأسفل الصدر.'],
    ['Deadlift',                   'ديدلفت',              2, 'expert',    'https://www.youtube.com/watch?v=op9kVnSso6Q', '/training/images/deadlift.jpg',          5, '5-8',   120,'Barbell', 'Back, Legs, Glutes', 'Feet hip-width, grip bar, drive through heels, stand tall.', 'القدمين بعرض الوركين، امسك البار، ادفع بالكعبين.'],
    // Legs
    ['Squat',                      'سكوات',               3, 'beginner',  'https://www.youtube.com/watch?v=ultWZbUMPL8', '/training/images/squat.jpg',             4, '10-12', 90, 'Barbell/Bodyweight', 'Quads, Glutes, Hamstrings', 'Feet shoulder-width, sit back, knees over toes, drive up.', 'القدمين بعرض الأكتاف، اجلس للخلف، ادفع للأعلى.'],
    ['Leg Press',                  'ليج بريس',            3, 'mid',       'https://www.youtube.com/watch?v=IZxyjW7MPJQ', '/training/images/leg-press.jpg',         4, '10-12', 90, 'Leg Press Machine', 'Quads, Glutes', 'Feet shoulder-width on platform, lower and press.', 'القدمين بعرض الأكتاف على المنصة، أنزل وارفع.'],
    ['Bulgarian Split Squat',      'سبليت سكوات',         3, 'expert',    'https://www.youtube.com/watch?v=2C-uNgKwPLE', '/training/images/split-squat.jpg',       3, '10-12', 60, 'Dumbbells, Bench', 'Quads, Glutes, Balance', 'Rear foot on bench, lunge down, drive up.', 'القدم الخلفية على البنش، انزل وارفع.'],
    // Shoulders
    ['Overhead Press',             'ضغط علوي',            4, 'beginner',  'https://www.youtube.com/watch?v=2yjwXTZQDDI', '/training/images/overhead-press.jpg',    4, '8-10',  90, 'Barbell/Dumbbells', 'Deltoids, Triceps', 'Press weight overhead from shoulder level.', 'ارفع الوزن فوق الرأس من مستوى الأكتاف.'],
    ['Lateral Raise',              'رفع جانبي',           4, 'mid',       'https://www.youtube.com/watch?v=3VcKaXpzqRo', '/training/images/lateral-raise.jpg',     3, '12-15', 60, 'Dumbbells', 'Side Deltoids', 'Arms slightly bent, raise to shoulder height.', 'الذراعين مثنية قليلاً، ارفع لمستوى الأكتاف.'],
    // Arms
    ['Barbell Curl',               'كيرل بار',            5, 'beginner',  'https://www.youtube.com/watch?v=kwG2ipFRgFo', '/training/images/barbell-curl.jpg',      3, '10-12', 60, 'EZ Bar/Barbell', 'Biceps', 'Elbows fixed, curl bar to shoulders.', 'المرفقين ثابتين، ارفع البار للأكتاف.'],
    ['Tricep Dips',                'ديبس تراي',           5, 'mid',       'https://www.youtube.com/watch?v=0326dy_-CzM', '/training/images/tricep-dips.jpg',       3, '10-15', 60, 'Dip Bars/Bench', 'Triceps', 'Lower body by bending elbows, press back up.', 'أنزل الجسم بثني المرفقين، ارفع.'],
    // Core
    ['Plank',                      'بلانك',               6, 'beginner',  'https://www.youtube.com/watch?v=ASdvN_XEl_c', '/training/images/plank.jpg',             3, '30-60s',45, 'None', 'Core', 'Hold body straight on forearms, engage core.', 'حافظ على الجسم مستقيماً على الساعدين.'],
    ['Hanging Leg Raise',          'رفع أرجل معلق',       6, 'expert',    'https://www.youtube.com/watch?v=hdng3Nm1x_E', '/training/images/leg-raise.jpg',         3, '10-15', 60, 'Pull-up Bar', 'Lower Abs', 'Hang from bar, raise legs to 90°.', 'تعلق من البار، ارفع الأرجل 90 درجة.'],
    // Cardio
    ['Treadmill Walk/Run',         'مشي/جري',             7, 'beginner',  '', '/training/images/treadmill.jpg',      1, '20-30 min', 0, 'Treadmill', 'Cardiovascular', 'Start slow, increase speed gradually.', 'ابدأ ببطء، زد السرعة تدريجياً.'],
    ['Jump Rope',                  'نط حبل',              7, 'mid',       'https://www.youtube.com/watch?v=FJmRQ5iTXKE', '/training/images/jump-rope.jpg',         3, '3 min', 60, 'Jump Rope', 'Cardiovascular, Calves', 'Jump with both feet, keep wrists relaxed.', 'اقفز بالقدمين، حافظ على المعصمين مرتخيين.'],
    // Stretching
    ['Full Body Stretch',          'إطالة كاملة',         8, 'beginner',  'https://www.youtube.com/watch?v=sTxC3J3gQEU', '/training/images/stretch.jpg',           1, '10-15 min', 0, 'None', 'Flexibility', 'Hold each stretch 20-30 seconds, breathe deeply.', 'امسك كل تمرين 20-30 ثانية، تنفس بعمق.'],
  ];
  exercises.forEach(([name, ar, catId, level, video, image, sets, reps, rest, equip, muscle, instr, instrAr]) => {
    try { db.run('INSERT INTO training_exercises (name, name_ar, category_id, experience_level, video_url, image_url, sets_default, reps_default, rest_seconds, equipment, muscle_group, instructions, instructions_ar) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',
      [name, ar, catId, level, video, image, sets, reps, rest, equip, muscle, instr, instrAr]); } catch(_){}
  });

  // ── Default programs
  const programs = [
    ['Beginner Full Body',   'برنامج مبتدئ شامل',    'beginner', 4, 3, 'general',   'Full body workout for beginners, 3 days/week for 4 weeks.', 'تمرين شامل للمبتدئين، 3 أيام/أسبوع لمدة 4 أسابيع.'],
    ['Intermediate Split',   'برنامج متوسط سبليت',   'mid',      6, 4, 'muscle',    'Push/Pull/Legs split for intermediate, 4 days/week.', 'تقسيم دفع/سحب/أرجل للمتوسطين، 4 أيام/أسبوع.'],
    ['Advanced Bodybuilding','برنامج متقدم بناء أجسام','expert',   8, 5, 'bodybuilding','Advanced 5-day split for experienced lifters.', 'تقسيم 5 أيام متقدم للمتمرسين.'],
  ];
  programs.forEach(([name, ar, level, weeks, days, goal, desc, descAr]) => {
    try { db.run('INSERT INTO training_programs (name, name_ar, experience_level, duration_weeks, days_per_week, goal, description, description_ar) VALUES (?,?,?,?,?,?,?,?)',
      [name, ar, level, weeks, days, goal, desc, descAr]); } catch(_){}
  });

  // ── Assign exercises to programs
  // Beginner (program 1): Push-ups, Squat, Lat Pulldown, Overhead Press, Plank, Treadmill, Stretch
  [[1,4,1],[1,8,1],[1,5,2],[1,11,2],[1,16,3],[1,18,3],[1,20,3]].forEach(([pid,eid,day],i) => {
    try { db.run('INSERT INTO training_program_exercises (program_id,exercise_id,day_number,sort_order) VALUES (?,?,?,?)',[pid,eid,day,i+1]); } catch(_){}
  });
  // Intermediate (program 2): Bench, Incline DB, Barbell Row, Leg Press, Lateral Raise, Dips, Jump Rope
  [[2,1,1],[2,2,1],[2,6,2],[2,9,3],[2,12,2],[2,15,4],[2,19,4]].forEach(([pid,eid,day],i) => {
    try { db.run('INSERT INTO training_program_exercises (program_id,exercise_id,day_number,sort_order) VALUES (?,?,?,?)',[pid,eid,day,i+1]); } catch(_){}
  });
  // Expert (program 3): Bench, Cable Cross, Deadlift, Split Squat, Overhead Press, Barbell Curl, Leg Raise
  [[3,1,1],[3,3,1],[3,7,2],[3,10,3],[3,11,4],[3,14,5],[3,17,5]].forEach(([pid,eid,day],i) => {
    try { db.run('INSERT INTO training_program_exercises (program_id,exercise_id,day_number,sort_order) VALUES (?,?,?,?)',[pid,eid,day,i+1]); } catch(_){}
  });

  // ── Settings
  ensureSetting(db, 'training.auto_assign_program', 'true', 'boolean', 'training', 'Auto-assign program on onboarding');
  ensureSetting(db, 'training.default_goal', 'general', 'string', 'training', 'Default fitness goal');
};

module.exports.down = function (db) {
  db.run('DROP TABLE IF EXISTS training_progress');
  db.run('DROP TABLE IF EXISTS training_member_profiles');
  db.run('DROP TABLE IF EXISTS training_program_exercises');
  db.run('DROP TABLE IF EXISTS training_programs');
  db.run('DROP TABLE IF EXISTS training_exercises');
  db.run('DROP TABLE IF EXISTS training_categories');
};
