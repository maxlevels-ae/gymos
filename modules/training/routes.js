const express = require('express');
const { authMiddleware, requirePermission } = require('../../core/middleware/auth');
const settingsService = require('../../core/services/settings-service');

module.exports = function (app, { database, eventBus }) {
  const router = express.Router();
  const db = database;

  function one(sql, p = []) { return db.getOne(sql, p); }
  function all(sql, p = []) { return db.getAll(sql, p); }
  function run(sql, p = []) { return db.run(sql, p); }
  function cnt(sql, p = []) { return one(sql, p)?.c || 0; }

  function addTimeline(memberId, type, title, desc, userId, meta) {
    try { run('INSERT INTO member_timeline (member_id, event_type, title, description, created_by, meta) VALUES (?,?,?,?,?,?)',
      [memberId, type, title, desc || '', userId || null, JSON.stringify(meta || {})]); } catch (_) {}
  }

  function calcAge(dob) {
    if (!dob) return 0;
    const d = new Date(dob);
    const now = new Date();
    let age = now.getFullYear() - d.getFullYear();
    if (now.getMonth() < d.getMonth() || (now.getMonth() === d.getMonth() && now.getDate() < d.getDate())) age--;
    return age;
  }

  // ── Dashboard ──
  const { cacheResponse: _cacheTrain } = require('../../core/middleware/response-cache');

  router.get('/dashboard', authMiddleware, requirePermission('training.view'), _cacheTrain(15000), (req, res) => {
    const totalCategories = cnt('SELECT COUNT(*) as c FROM training_categories WHERE is_active=1');
    const totalExercises = cnt('SELECT COUNT(*) as c FROM training_exercises WHERE is_active=1');
    const totalPrograms = cnt('SELECT COUNT(*) as c FROM training_programs WHERE is_active=1');
    const enrolledMembers = cnt('SELECT COUNT(*) as c FROM training_member_profiles');
    const beginners = cnt("SELECT COUNT(*) as c FROM training_member_profiles WHERE experience_level='beginner'");
    const midLevel = cnt("SELECT COUNT(*) as c FROM training_member_profiles WHERE experience_level='mid'");
    const experts = cnt("SELECT COUNT(*) as c FROM training_member_profiles WHERE experience_level='expert'");
    const progressToday = cnt("SELECT COUNT(*) as c FROM training_progress WHERE date(completed_at)=date('now')");
    const byCategory = all(`SELECT c.name, c.name_ar, c.icon, COUNT(e.id) as exercise_count FROM training_categories c LEFT JOIN training_exercises e ON e.category_id=c.id AND e.is_active=1 WHERE c.is_active=1 GROUP BY c.id ORDER BY c.sort_order`);
    const recentEnrollments = all(`SELECT tp.*, m.first_name, m.middle_name, m.last_name, m.member_no, p.name as program_name FROM training_member_profiles tp JOIN members m ON m.id=tp.member_id LEFT JOIN training_programs p ON p.id=tp.assigned_program_id ORDER BY tp.created_at DESC LIMIT 10`);
    res.json({ success: true, data: { totalCategories, totalExercises, totalPrograms, enrolledMembers, beginners, midLevel, experts, progressToday, byCategory, recentEnrollments } });
  });

  // ── Bootstrap ──
  router.get('/bootstrap', authMiddleware, requirePermission('training.view'), (req, res) => {
    res.json({ success: true, data: {
      categories: all('SELECT * FROM training_categories WHERE is_active=1 ORDER BY sort_order'),
      programs: all('SELECT * FROM training_programs WHERE is_active=1 ORDER BY experience_level, name'),
    }});
  });

  // ── Categories CRUD ──
  router.get('/categories', authMiddleware, requirePermission('training.view'), (req, res) => {
    const rows = all(`SELECT c.*, (SELECT COUNT(*) FROM training_exercises e WHERE e.category_id=c.id AND e.is_active=1) as exercise_count FROM training_categories c ORDER BY c.sort_order`);
    res.json({ success: true, data: rows });
  });
  router.post('/categories', authMiddleware, requirePermission('training.manage'), (req, res) => {
    const { name, name_ar, code, icon, color, sort_order } = req.body || {};
    if (!name) return res.status(400).json({ success: false, error: 'Name required' });
    const r = run('INSERT INTO training_categories (name,name_ar,code,icon,color,sort_order) VALUES (?,?,?,?,?,?)',
      [name, name_ar||'', code||'', icon||'', color||'', sort_order||0]);
    res.json({ success: true, data: one('SELECT * FROM training_categories WHERE id=?', [r.lastInsertRowid]) });
  });
  router.put('/categories/:id', authMiddleware, requirePermission('training.manage'), (req, res) => {
    const cur = one('SELECT * FROM training_categories WHERE id=?', [req.params.id]);
    if (!cur) return res.status(404).json({ success: false, error: 'Not found' });
    const p = req.body || {};
    run('UPDATE training_categories SET name=?,name_ar=?,code=?,icon=?,color=?,sort_order=?,is_active=?,updated_at=datetime("now") WHERE id=?',
      [p.name||cur.name, p.name_ar??cur.name_ar, p.code??cur.code, p.icon??cur.icon, p.color??cur.color, p.sort_order??cur.sort_order, p.is_active??cur.is_active, req.params.id]);
    res.json({ success: true, data: one('SELECT * FROM training_categories WHERE id=?', [req.params.id]) });
  });

  // ── Exercises CRUD ──
  router.get('/exercises', authMiddleware, requirePermission('training.view'), (req, res) => {
    let sql = `SELECT e.*, c.name as category_name, c.name_ar as category_name_ar, c.icon as category_icon FROM training_exercises e JOIN training_categories c ON c.id=e.category_id WHERE e.is_active=1`;
    const params = [];
    if (req.query.category_id) { sql += ' AND e.category_id=?'; params.push(req.query.category_id); }
    if (req.query.level) { sql += ' AND (e.experience_level=? OR e.experience_level="all")'; params.push(req.query.level); }
    if (req.query.muscle) { sql += ' AND e.muscle_group LIKE ?'; params.push('%' + req.query.muscle + '%'); }
    if (req.query.equipment) { sql += ' AND e.equipment=?'; params.push(req.query.equipment); }
    if (req.query.search) { sql += ' AND e.name LIKE ?'; params.push('%' + req.query.search + '%'); }
    sql += ' ORDER BY c.sort_order, e.name';
    if (req.query.limit) { sql += ' LIMIT ?'; params.push(Math.min(Number(req.query.limit), 500)); }
    if (req.query.offset) { sql += ' OFFSET ?'; params.push(Number(req.query.offset)); }
    const rows = all(sql, params);
    // Parse JSON fields
    const data = rows.map(r => {
      try { r.instructionsArr = JSON.parse(r.instructions || '[]'); } catch(_) { r.instructionsArr = r.instructions ? [r.instructions] : []; }
      try { r.images = JSON.parse(r.images_json || '[]'); } catch(_) { r.images = []; }
      r.primaryMuscles = (r.muscle_group || '').split(',').map(s => s.trim()).filter(Boolean);
      r.secondaryMusclesArr = (r.secondary_muscles || '').split(',').map(s => s.trim()).filter(Boolean);
      return r;
    });
    res.json({ success: true, data });
  });
  router.get('/exercises/:id', authMiddleware, requirePermission('training.view'), (req, res) => {
    const row = one(`SELECT e.*, c.name as category_name, c.name_ar as category_name_ar FROM training_exercises e JOIN training_categories c ON c.id=e.category_id WHERE e.id=?`, [req.params.id]);
    if (!row) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, data: row });
  });
  router.post('/exercises', authMiddleware, requirePermission('training.manage'), (req, res) => {
    const b = req.body || {};
    if (!b.name || !b.category_id) return res.status(400).json({ success: false, error: 'Name and category required' });
    const r = run(`INSERT INTO training_exercises (name,name_ar,category_id,experience_level,video_url,image_url,thumbnail_url,sets_default,reps_default,rest_seconds,equipment,muscle_group,instructions,instructions_ar,difficulty) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [b.name, b.name_ar||'', b.category_id, b.experience_level||'all', b.video_url||'', b.image_url||'', b.thumbnail_url||'', b.sets_default||3, b.reps_default||'10-12', b.rest_seconds||60, b.equipment||'', b.muscle_group||'', b.instructions||'', b.instructions_ar||'', b.difficulty||1]);
    res.json({ success: true, data: one('SELECT * FROM training_exercises WHERE id=?', [r.lastInsertRowid]) });
  });
  router.put('/exercises/:id', authMiddleware, requirePermission('training.manage'), (req, res) => {
    const cur = one('SELECT * FROM training_exercises WHERE id=?', [req.params.id]);
    if (!cur) return res.status(404).json({ success: false, error: 'Not found' });
    const b = req.body || {};
    run(`UPDATE training_exercises SET name=?,name_ar=?,category_id=?,experience_level=?,video_url=?,image_url=?,thumbnail_url=?,sets_default=?,reps_default=?,rest_seconds=?,equipment=?,muscle_group=?,instructions=?,instructions_ar=?,difficulty=?,is_active=?,updated_at=datetime("now") WHERE id=?`,
      [b.name||cur.name, b.name_ar??cur.name_ar, b.category_id||cur.category_id, b.experience_level||cur.experience_level, b.video_url??cur.video_url, b.image_url??cur.image_url, b.thumbnail_url??cur.thumbnail_url, b.sets_default??cur.sets_default, b.reps_default??cur.reps_default, b.rest_seconds??cur.rest_seconds, b.equipment??cur.equipment, b.muscle_group??cur.muscle_group, b.instructions??cur.instructions, b.instructions_ar??cur.instructions_ar, b.difficulty??cur.difficulty, b.is_active??cur.is_active, req.params.id]);
    res.json({ success: true, data: one('SELECT * FROM training_exercises WHERE id=?', [req.params.id]) });
  });
  router.delete('/exercises/:id', authMiddleware, requirePermission('training.manage'), (req, res) => {
    run('UPDATE training_exercises SET is_active=0, updated_at=datetime("now") WHERE id=?', [req.params.id]);
    res.json({ success: true });
  });

  // ── Programs CRUD ──
  router.get('/programs', authMiddleware, requirePermission('training.view'), (req, res) => {
    const rows = all(`SELECT p.*, (SELECT COUNT(*) FROM training_program_exercises pe WHERE pe.program_id=p.id) as exercise_count, (SELECT COUNT(*) FROM training_member_profiles mp WHERE mp.assigned_program_id=p.id) as enrolled_count FROM training_programs p WHERE p.is_active=1 ORDER BY p.experience_level, p.name`);
    res.json({ success: true, data: rows });
  });
  router.get('/programs/:id', authMiddleware, requirePermission('training.view'), (req, res) => {
    const prog = one('SELECT * FROM training_programs WHERE id=?', [req.params.id]);
    if (!prog) return res.status(404).json({ success: false, error: 'Not found' });
    const exercises = all(`SELECT pe.*, e.name, e.name_ar, e.video_url, e.image_url, e.equipment, e.muscle_group, e.experience_level, c.name as category_name, c.icon as category_icon FROM training_program_exercises pe JOIN training_exercises e ON e.id=pe.exercise_id JOIN training_categories c ON c.id=e.category_id WHERE pe.program_id=? ORDER BY pe.day_number, pe.sort_order`, [req.params.id]);
    prog.exercises = exercises;
    res.json({ success: true, data: prog });
  });
  router.post('/programs', authMiddleware, requirePermission('training.manage'), (req, res) => {
    const b = req.body || {};
    if (!b.name) return res.status(400).json({ success: false, error: 'Name required' });
    const r = run('INSERT INTO training_programs (name,name_ar,description,description_ar,experience_level,duration_weeks,days_per_week,goal) VALUES (?,?,?,?,?,?,?,?)',
      [b.name, b.name_ar||'', b.description||'', b.description_ar||'', b.experience_level||'beginner', b.duration_weeks||4, b.days_per_week||3, b.goal||'general']);
    res.json({ success: true, data: one('SELECT * FROM training_programs WHERE id=?', [r.lastInsertRowid]) });
  });
  router.put('/programs/:id', authMiddleware, requirePermission('training.manage'), (req, res) => {
    const cur = one('SELECT * FROM training_programs WHERE id=?', [req.params.id]);
    if (!cur) return res.status(404).json({ success: false, error: 'Not found' });
    const b = req.body || {};
    run('UPDATE training_programs SET name=?,name_ar=?,description=?,description_ar=?,experience_level=?,duration_weeks=?,days_per_week=?,goal=?,is_active=?,updated_at=datetime("now") WHERE id=?',
      [b.name||cur.name, b.name_ar??cur.name_ar, b.description??cur.description, b.description_ar??cur.description_ar, b.experience_level||cur.experience_level, b.duration_weeks??cur.duration_weeks, b.days_per_week??cur.days_per_week, b.goal??cur.goal, b.is_active??cur.is_active, req.params.id]);
    res.json({ success: true, data: one('SELECT * FROM training_programs WHERE id=?', [req.params.id]) });
  });

  // ── Program exercises (add/remove exercises from a program) ──
  router.post('/programs/:id/exercises', authMiddleware, requirePermission('training.manage'), (req, res) => {
    const { exercise_id, day_number, sets, reps, rest_seconds, notes } = req.body || {};
    if (!exercise_id) return res.status(400).json({ success: false, error: 'exercise_id required' });
    const maxSort = one('SELECT MAX(sort_order) as m FROM training_program_exercises WHERE program_id=?', [req.params.id])?.m || 0;
    run('INSERT INTO training_program_exercises (program_id,exercise_id,day_number,sort_order,sets,reps,rest_seconds,notes) VALUES (?,?,?,?,?,?,?,?)',
      [req.params.id, exercise_id, day_number||1, maxSort+1, sets||3, reps||'10-12', rest_seconds||60, notes||'']);
    const exercises = all(`SELECT pe.*, e.name, e.name_ar, e.video_url, e.image_url, c.name as category_name FROM training_program_exercises pe JOIN training_exercises e ON e.id=pe.exercise_id JOIN training_categories c ON c.id=e.category_id WHERE pe.program_id=? ORDER BY pe.day_number, pe.sort_order`, [req.params.id]);
    res.json({ success: true, data: exercises });
  });
  router.delete('/programs/:programId/exercises/:id', authMiddleware, requirePermission('training.manage'), (req, res) => {
    run('DELETE FROM training_program_exercises WHERE id=? AND program_id=?', [req.params.id, req.params.programId]);
    res.json({ success: true });
  });

  // ── Member onboarding (birthday + experience → auto-assign program) ──
  router.post('/onboard', authMiddleware, requirePermission('training.manage'), (req, res) => {
    const { member_id, date_of_birth, experience_level, fitness_goal, health_notes } = req.body || {};
    if (!member_id) return res.status(400).json({ success: false, error: 'member_id required' });
    if (!experience_level) return res.status(400).json({ success: false, error: 'experience_level required' });

    const member = one('SELECT * FROM members WHERE id=?', [member_id]);
    if (!member) return res.status(404).json({ success: false, error: 'Member not found' });

    const age = calcAge(date_of_birth);
    const autoAssign = settingsService.get('training.auto_assign_program', true);

    // Find matching program for experience level
    let programId = null;
    if (autoAssign) {
      const prog = one('SELECT id FROM training_programs WHERE experience_level=? AND is_active=1 ORDER BY id ASC LIMIT 1', [experience_level]);
      programId = prog?.id || null;
    }

    // Upsert profile
    const existing = one('SELECT id FROM training_member_profiles WHERE member_id=?', [member_id]);
    if (existing) {
      run('UPDATE training_member_profiles SET date_of_birth=?,age=?,experience_level=?,fitness_goal=?,health_notes=?,assigned_program_id=?,onboarding_completed=1,updated_at=datetime("now") WHERE member_id=?',
        [date_of_birth||null, age, experience_level, fitness_goal||'general', health_notes||'', programId, member_id]);
    } else {
      run('INSERT INTO training_member_profiles (member_id,date_of_birth,age,experience_level,fitness_goal,health_notes,assigned_program_id,onboarding_completed) VALUES (?,?,?,?,?,?,?,1)',
        [member_id, date_of_birth||null, age, experience_level, fitness_goal||'general', health_notes||'', programId]);
    }

    // Update member DOB if provided and not already set
    if (date_of_birth) {
      try { run('UPDATE members SET date_of_birth=? WHERE id=? AND (date_of_birth IS NULL OR date_of_birth="")', [date_of_birth, member_id]); } catch(_){}
    }

    const profile = one(`SELECT tp.*, p.name as program_name, p.name_ar as program_name_ar FROM training_member_profiles tp LEFT JOIN training_programs p ON p.id=tp.assigned_program_id WHERE tp.member_id=?`, [member_id]);
    addTimeline(member_id, 'training_onboard', 'Training Onboarded', `Level: ${experience_level}, Program: ${profile?.program_name || 'None'}`, req.user?.id);
    res.json({ success: true, data: profile });
  });

  // ── Member profiles list ──
  router.get('/members', authMiddleware, requirePermission('training.view'), (req, res) => {
    const rows = all(`SELECT tp.*, m.first_name, m.middle_name, m.last_name, m.member_no, m.status as member_status, m.phone, p.name as program_name, p.name_ar as program_name_ar FROM training_member_profiles tp JOIN members m ON m.id=tp.member_id LEFT JOIN training_programs p ON p.id=tp.assigned_program_id ORDER BY tp.created_at DESC`);
    res.json({ success: true, data: rows });
  });

  // ── Member profile detail ──
  router.get('/members/:memberId', authMiddleware, requirePermission('training.view'), (req, res) => {
    const profile = one(`SELECT tp.*, m.first_name, m.middle_name, m.last_name, m.member_no, m.phone, m.status as member_status, p.name as program_name, p.name_ar as program_name_ar, p.experience_level as program_level, p.duration_weeks, p.days_per_week FROM training_member_profiles tp JOIN members m ON m.id=tp.member_id LEFT JOIN training_programs p ON p.id=tp.assigned_program_id WHERE tp.member_id=?`, [req.params.memberId]);
    if (!profile) return res.status(404).json({ success: false, error: 'Profile not found' });

    // Get assigned program exercises
    let exercises = [];
    if (profile.assigned_program_id) {
      exercises = all(`SELECT pe.*, e.name, e.name_ar, e.video_url, e.image_url, e.equipment, e.muscle_group, e.instructions, e.instructions_ar, c.name as category_name, c.icon as category_icon FROM training_program_exercises pe JOIN training_exercises e ON e.id=pe.exercise_id JOIN training_categories c ON c.id=e.category_id WHERE pe.program_id=? ORDER BY pe.day_number, pe.sort_order`, [profile.assigned_program_id]);
    }

    // Get recent progress
    const progress = all(`SELECT tp.*, e.name, e.name_ar FROM training_progress tp JOIN training_exercises e ON e.id=tp.exercise_id WHERE tp.member_id=? ORDER BY tp.completed_at DESC LIMIT 20`, [req.params.memberId]);

    res.json({ success: true, data: { ...profile, exercises, progress } });
  });

  // ── Search members (for onboarding) ──
  router.get('/members/search/available', authMiddleware, requirePermission('training.view'), (req, res) => {
    const q = String(req.query.q || '').trim();
    if (!q) return res.json({ success: true, data: [] });
    const like = `%${q}%`;
    const rows = all(`SELECT m.id, m.member_no, m.first_name, m.middle_name, m.last_name, m.phone, m.status, m.date_of_birth,
      tp.id as profile_id, tp.experience_level, tp.assigned_program_id
      FROM members m LEFT JOIN training_member_profiles tp ON tp.member_id=m.id
      WHERE m.member_no LIKE ? OR m.first_name LIKE ? OR m.middle_name LIKE ? OR m.last_name LIKE ? OR m.phone LIKE ?
      ORDER BY m.id DESC LIMIT 15`, [like, like, like, like, like]);
    res.json({ success: true, data: rows });
  });

  // ── Log progress ──
  router.post('/progress', authMiddleware, requirePermission('training.manage'), (req, res) => {
    const { member_id, exercise_id, program_id, sets_completed, reps_completed, weight_used, duration_minutes, notes } = req.body || {};
    if (!member_id || !exercise_id) return res.status(400).json({ success: false, error: 'member_id and exercise_id required' });
    run('INSERT INTO training_progress (member_id,exercise_id,program_id,sets_completed,reps_completed,weight_used,duration_minutes,notes) VALUES (?,?,?,?,?,?,?,?)',
      [member_id, exercise_id, program_id||null, sets_completed||0, reps_completed||'', weight_used||0, duration_minutes||0, notes||'']);
    res.json({ success: true });
  });

  // ── Import 800+ exercises from free-exercise-db ──
  router.post('/import-exercises', authMiddleware, requirePermission('training.manage'), async (req, res) => {
    try {
      const importer = require('./services/exercise-importer');
      const result = await importer.importExercises(database, { source: 'github' });
      res.json({ success: true, data: result });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ── Dashboard widgets ──
  eventBus.addFilter('dashboard.stats', (stats) => {
    stats.trainingEnrolled = cnt('SELECT COUNT(*) as c FROM training_member_profiles');
    stats.trainingExercises = cnt('SELECT COUNT(*) as c FROM training_exercises WHERE is_active=1');
    stats.trainingProgressToday = cnt("SELECT COUNT(*) as c FROM training_progress WHERE date(completed_at)=date('now')");
    return stats;
  });

  app.use('/api/training', router);
};
