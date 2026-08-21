module.exports = {
  up(db) {
    // ── Member profile extras (height, initial weight, goal) ──
    for (const stmt of [
      "ALTER TABLE members ADD COLUMN height_cm REAL DEFAULT 0",
      "ALTER TABLE members ADD COLUMN initial_weight_kg REAL DEFAULT 0",
      "ALTER TABLE members ADD COLUMN fitness_goal TEXT DEFAULT ''"
    ]) { try { db.exec(stmt); } catch (_) { /* column exists */ } }

    db.exec(`
      -- Body weight log (one entry per weigh-in)
      CREATE TABLE IF NOT EXISTS member_weight_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        member_id INTEGER NOT NULL,
        weight_kg REAL NOT NULL,
        logged_on TEXT NOT NULL DEFAULT (date('now')),
        created_at TEXT DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_mwl_member ON member_weight_log(member_id, logged_on);

      -- Daily water intake (glasses), one row per member per day
      CREATE TABLE IF NOT EXISTS member_water_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        member_id INTEGER NOT NULL,
        log_date TEXT NOT NULL,
        glasses INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT DEFAULT (datetime('now')),
        UNIQUE(member_id, log_date)
      );

      -- Meal plan templates (admin-managed, reused across members)
      CREATE TABLE IF NOT EXISTS member_meal_plans (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT DEFAULT '',
        name_ar TEXT DEFAULT '',
        goal TEXT DEFAULT 'any',
        daily_calories INTEGER DEFAULT 0,
        protein_g INTEGER DEFAULT 0,
        carbs_g INTEGER DEFAULT 0,
        fat_g INTEGER DEFAULT 0,
        water_glasses INTEGER DEFAULT 8,
        is_active INTEGER DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now'))
      );

      -- Meals inside a plan
      CREATE TABLE IF NOT EXISTS member_meal_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        plan_id INTEGER NOT NULL,
        title TEXT DEFAULT '',
        title_ar TEXT DEFAULT '',
        time_label TEXT DEFAULT '',
        time_sort TEXT DEFAULT '00:00',
        calories INTEGER DEFAULT 0,
        sort_order INTEGER DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS idx_mmi_plan ON member_meal_items(plan_id, sort_order);

      -- Which plan a member is assigned (one active plan per member)
      CREATE TABLE IF NOT EXISTS member_meal_assignments (
        member_id INTEGER PRIMARY KEY,
        plan_id INTEGER NOT NULL,
        assigned_at TEXT DEFAULT (datetime('now'))
      );

      -- Member-facing notifications
      CREATE TABLE IF NOT EXISTS member_notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        member_id INTEGER NOT NULL,
        category TEXT DEFAULT 'general',
        title TEXT DEFAULT '',
        title_ar TEXT DEFAULT '',
        body TEXT DEFAULT '',
        body_ar TEXT DEFAULT '',
        action_type TEXT DEFAULT '',
        action_label TEXT DEFAULT '',
        action_label_ar TEXT DEFAULT '',
        is_read INTEGER DEFAULT 0,
        dedupe_key TEXT DEFAULT '',
        created_at TEXT DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_mn_member ON member_notifications(member_id, created_at);
      CREATE INDEX IF NOT EXISTS idx_mn_dedupe ON member_notifications(member_id, dedupe_key);

      -- Per-member notification preferences (key -> enabled)
      CREATE TABLE IF NOT EXISTS member_notification_prefs (
        member_id INTEGER NOT NULL,
        pref_key TEXT NOT NULL,
        enabled INTEGER DEFAULT 1,
        UNIQUE(member_id, pref_key)
      );
    `);

    // ── Seed real, editable meal-plan templates (one per goal) if none exist ──
    const count = db.exec("SELECT COUNT(*) c FROM member_meal_plans");
    const existing = count.length ? count[0].values[0][0] : 0;
    if (!existing) {
      const plans = [
        { name: 'Bulk Plan', name_ar: 'خطة التضخيم', goal: 'bulk', cal: 2850, p: 200, c: 300, f: 80, water: 8,
          meals: [
            ['Breakfast', 'الإفطار', '7:00 ص', '07:00', 620],
            ['Mid-morning Snack', 'وجبة خفيفة 10ص', '10:00 ص', '10:00', 300],
            ['Lunch', 'الغداء', '1:00 م', '13:00', 800],
            ['Dinner', 'العشاء', '7:00 م', '19:00', 730],
            ['Evening Snack', 'وجبة مسائية', '9:30 م', '21:30', 400]
          ] },
        { name: 'Maintain Plan', name_ar: 'خطة المحافظة', goal: 'maintain', cal: 2300, p: 160, c: 240, f: 70, water: 8,
          meals: [
            ['Breakfast', 'الإفطار', '7:30 ص', '07:30', 520],
            ['Lunch', 'الغداء', '1:00 م', '13:00', 720],
            ['Snack', 'وجبة خفيفة', '4:00 م', '16:00', 260],
            ['Dinner', 'العشاء', '7:30 م', '19:30', 620]
          ] },
        { name: 'Cut Plan', name_ar: 'خطة التنشيف', goal: 'cut', cal: 1900, p: 180, c: 150, f: 55, water: 10,
          meals: [
            ['Breakfast', 'الإفطار', '7:30 ص', '07:30', 420],
            ['Lunch', 'الغداء', '1:00 م', '13:00', 620],
            ['Snack', 'وجبة خفيفة', '4:30 م', '16:30', 220],
            ['Dinner', 'العشاء', '8:00 م', '20:00', 540]
          ] }
      ];
      for (const pl of plans) {
        db.run(
          "INSERT INTO member_meal_plans (name, name_ar, goal, daily_calories, protein_g, carbs_g, fat_g, water_glasses, is_active) VALUES (?,?,?,?,?,?,?,?,1)",
          [pl.name, pl.name_ar, pl.goal, pl.cal, pl.p, pl.c, pl.f, pl.water]
        );
        const pid = db.exec("SELECT last_insert_rowid() id")[0].values[0][0];
        pl.meals.forEach((m, i) => {
          db.run(
            "INSERT INTO member_meal_items (plan_id, title, title_ar, time_label, time_sort, calories, sort_order) VALUES (?,?,?,?,?,?,?)",
            [pid, m[0], m[1], m[2], m[3], m[4], i]
          );
        });
      }
    }
  }
};
