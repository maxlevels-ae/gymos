// ═══════════════════════════════════════════════════════════
// GymOS Training V1 — Odoo-style workspace
// Single page · top header navigation · all GymOS native classes
// Member training: onboard (birthday + experience) → auto-assign program
// ═══════════════════════════════════════════════════════════
(function () {
  const { useState, useEffect, useCallback, useMemo } = React;
  const { api, useI18n, Modal, Ic, toast } = shared;

  // ── Helpers ──
  function initials(name) { return (name || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase(); }
  function fullName(r) { return [r.first_name, r.middle_name, r.last_name].filter(Boolean).join(' '); }

  function useLoad(url, deps = [], fallback = []) {
    const [data, setData] = useState(fallback);
    const [loading, setLoading] = useState(true);
    const reload = useCallback(() => {
      let live = true;
      setLoading(true);
      api.get(url)
        .then(r => { if (live) setData(r.data ?? fallback); })
        .catch(() => { if (live) setData(Array.isArray(fallback) ? [] : fallback); })
        .finally(() => { if (live) setLoading(false); });
      return () => { live = false; };
    }, [url]);
    useEffect(() => reload(), [...deps, url]);
    return [data, loading, setData, reload];
  }

  // ── Level badge ──
  function LevelBadge({ level }) {
    const { locale } = useI18n();
    const map = {
      beginner: { en: 'Beginner', ar: 'مبتدئ', cls: 'trn-level-beginner' },
      mid:      { en: 'Intermediate', ar: 'متوسط', cls: 'trn-level-mid' },
      expert:   { en: 'Expert', ar: 'متقدم', cls: 'trn-level-expert' },
      all:      { en: 'All Levels', ar: 'جميع المستويات', cls: '' },
    };
    const s = map[level] || map.all;
    return <span className={`trn-level ${s.cls}`}>{locale === 'ar' ? s.ar : s.en}</span>;
  }

  // ── Status badge (reuse pattern) ──
  function SBadge({ state }) {
    const { locale } = useI18n();
    const map = {
      active:   { en: 'Active', ar: 'نشط', cls: 'b-active' },
      inactive: { en: 'Inactive', ar: 'غير نشط', cls: 'b-disabled' },
      expired:  { en: 'Expired', ar: 'منتهي', cls: 'b-cancelled' },
    };
    const s = map[state] || { en: state || '—', ar: state || '—', cls: 'b-inactive' };
    return <span className={`badge ${s.cls}`}>{locale === 'ar' ? s.ar : s.en}</span>;
  }

  // ── Generic Table ──
  function Tbl({ rows = [], cols = [], loading, onRow, emptyLabel, emptyAction, onEmptyAction }) {
    const { locale } = useI18n();
    if (loading) return <div className='pld'><span className='spinner' /></div>;
    return (
      <div className='card' style={{ padding: 0, overflow: 'hidden' }}>
        <table>
          <thead><tr>{cols.map(c => <th key={c.key}>{locale === 'ar' && c.ar ? c.ar : c.label}</th>)}</tr></thead>
          <tbody>
            {rows.length === 0
              ? <tr><td colSpan={cols.length}><div className='empty'><h3>{emptyLabel || (locale === 'ar' ? 'لا توجد بيانات' : 'No records')}</h3>{emptyAction && <button className='btn btn-p btn-sm' style={{ marginTop: 8 }} onClick={onEmptyAction}>{emptyAction}</button>}</div></td></tr>
              : rows.map((row, i) => (
                <tr key={row.id || i} onClick={() => onRow && onRow(row)} style={onRow ? { cursor: 'pointer' } : {}}>
                  {cols.map(c => <td key={c.key}>{c.render ? c.render(row, locale) : String(row[c.key] ?? '—')}</td>)}
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    );
  }

  // ── Form Modal ──
  function FormModal({ title, fields, refs, initial, onClose, onSave, wide }) {
    const { locale } = useI18n();
    const [form, setForm] = useState(() => ({ ...(initial || {}) }));
    const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
    const [saving, setSaving] = useState(false);
    const save = async () => { try { setSaving(true); await onSave(form); } catch (e) { toast(e.message || 'Failed', 'e'); setSaving(false); } };
    return (
      <Modal title={title} onClose={onClose} wide={wide !== false}>
        <div className='mdl-b'><div className='fr3'>
          {fields.map(f => {
            const label = locale === 'ar' && f.labelAr ? f.labelAr : f.label;
            const value = form[f.key] ?? '';
            const options = typeof f.options === 'function' ? f.options(refs, form) : (f.options || []);
            if (f.type === 'textarea') return <div className='fg' key={f.key} style={{ gridColumn: '1 / -1' }}><label>{label}</label><textarea className='fi' value={value} onChange={e => set(f.key, e.target.value)} /></div>;
            if (f.type === 'select') return <div className='fg' key={f.key}><label>{label}</label><select className='fi' value={value} onChange={e => set(f.key, e.target.value)}><option value=''>{locale === 'ar' ? 'اختر' : 'Select'}</option>{options.map(o => <option key={o.value ?? o.id} value={o.value ?? o.id}>{locale === 'ar' && (o.labelAr || o.name_ar) ? (o.labelAr || o.name_ar) : (o.label || o.name)}</option>)}</select></div>;
            return <div className='fg' key={f.key}><label>{label}</label><input className='fi' type={f.type || 'text'} value={value} onChange={e => set(f.key, e.target.value)} /></div>;
          })}
        </div></div>
        <div className='mdl-f'><button className='btn btn-s' onClick={onClose} disabled={saving}>{locale === 'ar' ? 'إلغاء' : 'Cancel'}</button><button className='btn btn-p' onClick={save} disabled={saving}>{saving ? '...' : (locale === 'ar' ? 'حفظ' : 'Save')}</button></div>
      </Modal>
    );
  }

  // ── Safe video helper ──
  function VideoEmbed({ url }) {
    if (!url) return null;
    const { locale } = useI18n();

    const parseVideoMeta = (rawUrl) => {
      try {
        const u = new URL(rawUrl);
        const host = u.hostname.replace(/^www\./, '');
        let videoId = '';

        if (host === 'youtube.com' || host === 'm.youtube.com') {
          videoId = u.searchParams.get('v') || '';
          if (!videoId && u.pathname.startsWith('/embed/')) videoId = u.pathname.split('/embed/')[1]?.split('/')[0] || '';
          if (!videoId) videoId = u.pathname.split('/').filter(Boolean).pop() || '';
        } else if (host === 'youtu.be') {
          videoId = u.pathname.split('/').filter(Boolean).pop() || '';
        }

        return {
          href: rawUrl,
          isYouTube: Boolean(videoId),
          videoId,
        };
      } catch (_) {
        return { href: rawUrl, isYouTube: false, videoId: '' };
      }
    };

    const meta = parseVideoMeta(url);
    const openLabel = locale === 'ar' ? 'فتح الفيديو' : 'Open Video';
    const ytLabel = locale === 'ar' ? 'شاهد على YouTube' : 'Watch on YouTube';
    const desc = locale === 'ar'
      ? 'بعض فيديوهات YouTube قد تمنع التشغيل داخل النظام أو الـ PWA. لذلك نعرض معاينة آمنة مع فتح الفيديو مباشرة.'
      : 'Some YouTube videos block in-app playback. This safe preview opens the video directly when needed.';

    if (!meta.isYouTube) {
      return (
        <div className='trn-video-card'>
          <div className='trn-video-card__body'>
            <div className='trn-video-card__icon'>▶</div>
            <div className='trn-video-card__content'>
              <div className='trn-video-card__title'>{locale === 'ar' ? 'فيديو التمرين' : 'Exercise Video'}</div>
              <div className='trn-video-card__desc'>{desc}</div>
            </div>
          </div>
          <div className='trn-video-card__actions'>
            <a className='btn btn-p' href={meta.href} target='_blank' rel='noopener noreferrer'>{openLabel}</a>
          </div>
        </div>
      );
    }

    const thumb = `https://img.youtube.com/vi/${meta.videoId}/hqdefault.jpg`;

    return (
      <div className='trn-video-card'>
        <a className='trn-video-thumb' href={meta.href} target='_blank' rel='noopener noreferrer' aria-label={ytLabel}>
          <img src={thumb} alt={locale === 'ar' ? 'معاينة الفيديو' : 'Video preview'} loading='lazy' />
          <span className='trn-video-thumb__play'>▶</span>
        </a>
        <div className='trn-video-card__body'>
          <div className='trn-video-card__content'>
            <div className='trn-video-card__title'>{locale === 'ar' ? 'فيديو التمرين' : 'Exercise Video'}</div>
            <div className='trn-video-card__desc'>{desc}</div>
          </div>
        </div>
        <div className='trn-video-card__actions'>
          <a className='btn btn-p' href={meta.href} target='_blank' rel='noopener noreferrer'>{ytLabel}</a>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════
  // DASHBOARD
  // ══════════════════════════════════════════════════════════
  function DashboardSection() {
    const { locale } = useI18n();
    const [stats, loading] = useLoad('/api/training/dashboard', [], null);
    if (loading || !stats) return <div className='pb'><div className='pld'><span className='spinner' /></div></div>;

    const cards = [
      ['Categories',     'الأقسام',        stats.totalCategories],
      ['Exercises',      'التمارين',       stats.totalExercises],
      ['Programs',       'البرامج',        stats.totalPrograms],
      ['Enrolled',       'المسجلون',       stats.enrolledMembers],
      ['Beginners',      'مبتدئ',          stats.beginners],
      ['Intermediate',   'متوسط',          stats.midLevel],
      ['Expert',         'متقدم',          stats.experts],
      ['Progress Today', 'تقدم اليوم',     stats.progressToday],
    ];
    return (
      <div className='pb'>
        <div className='sg' style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))' }}>
          {cards.map(([en, ar, val], i) => <div className='sc' key={i}><div className='sl'>{locale === 'ar' ? ar : en}</div><div className='sv' style={{ fontSize: 20 }}>{val}</div></div>)}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 14, marginTop: 4 }}>
          <div className='card'>
            <div className='ct'>{locale === 'ar' ? 'التمارين حسب القسم' : 'Exercises by Category'}</div>
            <table><thead><tr><th></th><th>{locale === 'ar' ? 'القسم' : 'Category'}</th><th>{locale === 'ar' ? 'العدد' : 'Count'}</th></tr></thead>
            <tbody>{(stats.byCategory || []).map((c, i) => <tr key={i}><td><Ic name='dumbbell' size={15} /></td><td>{locale === 'ar' ? c.name_ar || c.name : c.name}</td><td>{c.exercise_count}</td></tr>)}</tbody></table>
          </div>
          <div className='card'>
            <div className='ct'>{locale === 'ar' ? 'آخر المسجلين' : 'Recent Enrollments'}</div>
            {(stats.recentEnrollments || []).length === 0
              ? <div className='empty'><h3>{locale === 'ar' ? 'لا يوجد مسجلون' : 'No enrollments yet'}</h3></div>
              : (stats.recentEnrollments || []).slice(0, 6).map((r, i) => <div key={i} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{fullName(r)}</div>
                <div style={{ fontSize: 12, color: 'var(--t3)' }}>{r.member_no} · <LevelBadge level={r.experience_level} /> · {r.program_name || '—'}</div>
              </div>)}
          </div>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════
  // CATEGORIES
  // ══════════════════════════════════════════════════════════
  function CategoriesSection() {
    const { locale } = useI18n();
    const [items, loading,, reload] = useLoad('/api/training/categories', [], []);
    const [showNew, setShowNew] = useState(false);
    const fields = [
      { key: 'name', label: 'Name', labelAr: 'الاسم' },
      { key: 'name_ar', label: 'Name (Arabic)', labelAr: 'الاسم بالعربي' },
      { key: 'code', label: 'Code', labelAr: 'الكود' },
      { key: 'icon', label: 'Icon (Emoji)', labelAr: 'الأيقونة' },
      { key: 'color', label: 'Color', labelAr: 'اللون' },
      { key: 'sort_order', label: 'Sort Order', labelAr: 'الترتيب', type: 'number' },
    ];
    const saveNew = async (form) => { await api.post('/api/training/categories', form); toast(locale === 'ar' ? 'تم الإضافة' : 'Added'); setShowNew(false); reload(); };
    const cols = [
      { key: 'icon', label: '', ar: '' },
      { key: 'name', label: 'Name', ar: 'الاسم', render: (r, l) => l === 'ar' ? r.name_ar || r.name : r.name },
      { key: 'code', label: 'Code', ar: 'الكود' },
      { key: 'exercise_count', label: 'Exercises', ar: 'التمارين' },
      { key: 'is_active', label: 'Active', ar: 'نشط', render: r => r.is_active ? <Ic name='check' size={14} /> : '—' },
    ];
    return (
      <div className='pb'>
        <div className='trn-bar'><h3 style={{ margin: 0 }}>{locale === 'ar' ? 'أقسام التمارين' : 'Exercise Categories'}</h3>
          <button className='btn btn-p' onClick={() => setShowNew(true)}><Ic name='plus' size={14} /> {locale === 'ar' ? 'قسم جديد' : 'New Category'}</button></div>
        <Tbl rows={items} cols={cols} loading={loading} />
        {showNew && <FormModal title={locale === 'ar' ? 'قسم جديد' : 'New Category'} fields={fields} initial={{}} onClose={() => setShowNew(false)} onSave={saveNew} />}
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════
  // EXERCISES — grid with detail modal
  // ══════════════════════════════════════════════════════════
  function ExercisesSection() {
    const { locale } = useI18n();
    const [bootstrap] = useLoad('/api/training/bootstrap', [], { categories: [], programs: [] });
    const [levelF, setLevelF] = useState('');
    const [catF, setCatF] = useState('');
    const [search, setSearch] = useState('');
    const url = `/api/training/exercises?${catF ? 'category_id=' + catF + '&' : ''}${levelF ? 'level=' + levelF : ''}`;
    const [items, loading,, reload] = useLoad(url, [catF, levelF], []);
    const [sel, setSel] = useState(null);
    const [showNew, setShowNew] = useState(false);

    const filtered = useMemo(() => {
      if (!search) return items;
      return items.filter(e => (e.name + (e.name_ar || '') + (e.muscle_group || '') + (e.equipment || '')).toLowerCase().includes(search.toLowerCase()));
    }, [items, search]);

    const newFields = [
      { key: 'name', label: 'Name', labelAr: 'الاسم' },
      { key: 'name_ar', label: 'Name (Arabic)', labelAr: 'الاسم بالعربي' },
      { key: 'category_id', label: 'Category', labelAr: 'القسم', type: 'select', options: (refs) => (refs?.categories || []).map(c => ({ id: c.id, name: c.name, name_ar: c.name_ar })) },
      { key: 'experience_level', label: 'Level', labelAr: 'المستوى', type: 'select', options: [{ value: 'all', label: 'All', labelAr: 'الكل' }, { value: 'beginner', label: 'Beginner', labelAr: 'مبتدئ' }, { value: 'mid', label: 'Intermediate', labelAr: 'متوسط' }, { value: 'expert', label: 'Expert', labelAr: 'متقدم' }] },
      { key: 'video_url', label: 'Video URL', labelAr: 'رابط الفيديو' },
      { key: 'image_url', label: 'Image URL', labelAr: 'رابط الصورة' },
      { key: 'sets_default', label: 'Sets', labelAr: 'المجموعات', type: 'number' },
      { key: 'reps_default', label: 'Reps', labelAr: 'التكرارات' },
      { key: 'rest_seconds', label: 'Rest (sec)', labelAr: 'الراحة (ثوان)', type: 'number' },
      { key: 'equipment', label: 'Equipment', labelAr: 'المعدات' },
      { key: 'muscle_group', label: 'Muscle Group', labelAr: 'العضلات' },
      { key: 'instructions', label: 'Instructions', labelAr: 'التعليمات', type: 'textarea' },
      { key: 'instructions_ar', label: 'Instructions (AR)', labelAr: 'التعليمات بالعربي', type: 'textarea' },
    ];
    const saveNew = async (form) => { await api.post('/api/training/exercises', form); toast(locale === 'ar' ? 'تم الإضافة' : 'Added'); setShowNew(false); reload(); };

    return (
      <div className='pb'>
        <div className='trn-bar'>
          <div className='fb' style={{ margin: 0 }}>
            <input className='fi' style={{ minWidth: 180 }} value={search} onChange={e => setSearch(e.target.value)} placeholder={locale === 'ar' ? 'بحث...' : 'Search...'} />
            <select className='fi' style={{ minWidth: 130 }} value={catF} onChange={e => setCatF(e.target.value)}>
              <option value=''>{locale === 'ar' ? 'كل الأقسام' : 'All Categories'}</option>
              {(bootstrap.categories || []).map(c => <option key={c.id} value={c.id}>{locale === 'ar' ? c.name_ar || c.name : c.name}</option>)}
            </select>
            <select className='fi' style={{ minWidth: 130 }} value={levelF} onChange={e => setLevelF(e.target.value)}>
              <option value=''>{locale === 'ar' ? 'كل المستويات' : 'All Levels'}</option>
              <option value='beginner'>{locale === 'ar' ? 'مبتدئ' : 'Beginner'}</option>
              <option value='mid'>{locale === 'ar' ? 'متوسط' : 'Intermediate'}</option>
              <option value='expert'>{locale === 'ar' ? 'متقدم' : 'Expert'}</option>
            </select>
          </div>
          <button className='btn btn-p' onClick={() => setShowNew(true)}><Ic name='plus' size={14} /> {locale === 'ar' ? 'تمرين جديد' : 'New Exercise'}</button>
        </div>
        {loading ? <div className='pld'><span className='spinner' /></div> : filtered.length === 0 ? <div className='empty'><h3>{locale === 'ar' ? 'لا توجد تمارين' : 'No exercises found'}</h3></div> :
          <div className='trn-ex-grid'>
            {filtered.map(ex => (
              <div className='trn-ex-card' key={ex.id} onClick={() => setSel(ex)}>
                {ex.image_url ? <img className='trn-ex-thumb' src={ex.image_url} alt={ex.name} onError={e => { e.target.style.display='none'; }} />
                  : <div className='trn-ex-thumb'><Ic name='dumbbell' size={32} /></div>}
                <div className='trn-ex-body'>
                  <div className='trn-ex-title'>{locale === 'ar' ? ex.name_ar || ex.name : ex.name}</div>
                  <div className='trn-ex-sub'>
                    <span className='trn-cat-chip'><Ic name='dumbbell' size={12} /> {locale === 'ar' ? ex.category_name_ar || ex.category_name : ex.category_name}</span>
                    {' '}<LevelBadge level={ex.experience_level} />
                  </div>
                  <div className='trn-ex-sub' style={{ marginTop: 4 }}>{ex.sets_default} × {ex.reps_default} · {ex.muscle_group || '—'}</div>
                </div>
              </div>
            ))}
          </div>
        }
        {sel && <ExerciseDetailModal exercise={sel} onClose={() => setSel(null)} />}
        {showNew && <FormModal title={locale === 'ar' ? 'تمرين جديد' : 'New Exercise'} fields={newFields} refs={bootstrap} initial={{ experience_level: 'all', sets_default: 3, reps_default: '10-12', rest_seconds: 60 }} onClose={() => setShowNew(false)} onSave={saveNew} />}
      </div>
    );
  }

  function ExerciseDetailModal({ exercise, onClose }) {
    const { locale } = useI18n();
    const ex = exercise;
    return (
      <Modal title={locale === 'ar' ? ex.name_ar || ex.name : ex.name} onClose={onClose} wide>
        <div className='mdl-b'>
          <VideoEmbed url={ex.video_url} />
          <div className='fr3'>
            <div className='fg'><label>{locale === 'ar' ? 'القسم' : 'Category'}</label><div className='trn-cat-chip'><Ic name='dumbbell' size={12} /> {locale === 'ar' ? ex.category_name_ar || ex.category_name : ex.category_name}</div></div>
            <div className='fg'><label>{locale === 'ar' ? 'المستوى' : 'Level'}</label><LevelBadge level={ex.experience_level} /></div>
            <div className='fg'><label>{locale === 'ar' ? 'المعدات' : 'Equipment'}</label><div style={{ fontSize: 13 }}>{ex.equipment || '—'}</div></div>
            <div className='fg'><label>{locale === 'ar' ? 'العضلات' : 'Muscles'}</label><div style={{ fontSize: 13 }}>{ex.muscle_group || '—'}</div></div>
            <div className='fg'><label>{locale === 'ar' ? 'المجموعات' : 'Sets'}</label><div style={{ fontSize: 13 }}>{ex.sets_default}</div></div>
            <div className='fg'><label>{locale === 'ar' ? 'التكرارات' : 'Reps'}</label><div style={{ fontSize: 13 }}>{ex.reps_default}</div></div>
          </div>
          {(ex.instructions || ex.instructions_ar) && <div className='trn-note' style={{ marginTop: 14 }}>{locale === 'ar' ? ex.instructions_ar || ex.instructions : ex.instructions}</div>}
        </div>
        <div className='mdl-f'><button className='btn btn-s' onClick={onClose}>{locale === 'ar' ? 'إغلاق' : 'Close'}</button></div>
      </Modal>
    );
  }

  // ══════════════════════════════════════════════════════════
  // PROGRAMS — list + detail with exercise schedule
  // ══════════════════════════════════════════════════════════
  function ProgramsSection() {
    const { locale } = useI18n();
    const [items, loading,, reload] = useLoad('/api/training/programs', [], []);
    const [sel, setSel] = useState(null);
    const [showNew, setShowNew] = useState(false);
    const newFields = [
      { key: 'name', label: 'Name', labelAr: 'الاسم' },
      { key: 'name_ar', label: 'Name (Arabic)', labelAr: 'الاسم بالعربي' },
      { key: 'experience_level', label: 'Level', labelAr: 'المستوى', type: 'select', options: [{ value: 'beginner', label: 'Beginner', labelAr: 'مبتدئ' }, { value: 'mid', label: 'Intermediate', labelAr: 'متوسط' }, { value: 'expert', label: 'Expert', labelAr: 'متقدم' }] },
      { key: 'duration_weeks', label: 'Weeks', labelAr: 'الأسابيع', type: 'number' },
      { key: 'days_per_week', label: 'Days/Week', labelAr: 'أيام/أسبوع', type: 'number' },
      { key: 'goal', label: 'Goal', labelAr: 'الهدف', type: 'select', options: [{ value: 'general', label: 'General Fitness', labelAr: 'لياقة عامة' }, { value: 'muscle', label: 'Muscle Building', labelAr: 'بناء عضلات' }, { value: 'weight_loss', label: 'Weight Loss', labelAr: 'خسارة وزن' }, { value: 'bodybuilding', label: 'Bodybuilding', labelAr: 'بناء أجسام' }] },
      { key: 'description', label: 'Description', labelAr: 'الوصف', type: 'textarea' },
    ];
    const saveNew = async (form) => { await api.post('/api/training/programs', form); toast(locale === 'ar' ? 'تم الإضافة' : 'Added'); setShowNew(false); reload(); };

    if (sel) return <ProgramDetail id={sel.id} onBack={() => setSel(null)} />;

    const cols = [
      { key: 'name', label: 'Program', ar: 'البرنامج', render: (r, l) => l === 'ar' ? r.name_ar || r.name : r.name },
      { key: 'experience_level', label: 'Level', ar: 'المستوى', render: r => <LevelBadge level={r.experience_level} /> },
      { key: 'duration_weeks', label: 'Weeks', ar: 'أسابيع', render: r => `${r.duration_weeks}w · ${r.days_per_week}d` },
      { key: 'exercise_count', label: 'Exercises', ar: 'التمارين' },
      { key: 'enrolled_count', label: 'Enrolled', ar: 'المسجلون' },
    ];
    return (
      <div className='pb'>
        <div className='trn-bar'><h3 style={{ margin: 0 }}>{locale === 'ar' ? 'برامج التدريب' : 'Training Programs'}</h3>
          <button className='btn btn-p' onClick={() => setShowNew(true)}><Ic name='plus' size={14} /> {locale === 'ar' ? 'برنامج جديد' : 'New Program'}</button></div>
        <Tbl rows={items} cols={cols} loading={loading} onRow={r => setSel(r)} emptyLabel={locale === 'ar' ? 'لا توجد برامج' : 'No programs'} />
        {showNew && <FormModal title={locale === 'ar' ? 'برنامج جديد' : 'New Program'} fields={newFields} initial={{ experience_level: 'beginner', duration_weeks: 4, days_per_week: 3, goal: 'general' }} onClose={() => setShowNew(false)} onSave={saveNew} />}
      </div>
    );
  }

  function ProgramDetail({ id, onBack }) {
    const { locale } = useI18n();
    const [prog, loading] = useLoad(`/api/training/programs/${id}`, [id], null);
    if (loading || !prog) return <div className='pb'><div className='pld'><span className='spinner' /></div></div>;
    const days = {};
    (prog.exercises || []).forEach(e => { if (!days[e.day_number]) days[e.day_number] = []; days[e.day_number].push(e); });
    return (
      <div className='pb'>
        <div className='trn-form-hdr'>
          <div><h2>{locale === 'ar' ? prog.name_ar || prog.name : prog.name}</h2>
            <div style={{ fontSize: 12, color: 'var(--t3)', marginTop: 3 }}><LevelBadge level={prog.experience_level} /> · {prog.duration_weeks} {locale === 'ar' ? 'أسبوع' : 'weeks'} · {prog.days_per_week} {locale === 'ar' ? 'يوم/أسبوع' : 'days/week'}</div></div>
          <button className='btn btn-s' onClick={onBack}>{locale === 'ar' ? 'رجوع' : 'Back'}</button>
        </div>
        <div className='trn-form-body'>
          {prog.description && <div className='trn-note'>{locale === 'ar' ? prog.description_ar || prog.description : prog.description}</div>}
          {Object.keys(days).length === 0 ? <div className='empty'><h3>{locale === 'ar' ? 'لا توجد تمارين في هذا البرنامج' : 'No exercises in this program'}</h3></div> :
            Object.entries(days).map(([day, exs]) => (
              <div key={day} style={{ marginBottom: 14 }}>
                <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>{locale === 'ar' ? `اليوم ${day}` : `Day ${day}`}</h3>
                <div className='card' style={{ padding: 0, overflow: 'hidden' }}>
                  <table><thead><tr><th></th><th>{locale === 'ar' ? 'التمرين' : 'Exercise'}</th><th>{locale === 'ar' ? 'العضلات' : 'Muscles'}</th><th>{locale === 'ar' ? 'المجموعات' : 'Sets'}</th><th>{locale === 'ar' ? 'التكرارات' : 'Reps'}</th></tr></thead>
                  <tbody>{exs.map(e => <tr key={e.id}><td><Ic name='dumbbell' size={15} /></td><td style={{ fontWeight: 500 }}>{locale === 'ar' ? e.name_ar || e.name : e.name}</td><td style={{ fontSize: 12, color: 'var(--t3)' }}>{e.muscle_group || '—'}</td><td>{e.sets}</td><td>{e.reps}</td></tr>)}</tbody></table>
                </div>
              </div>
            ))}
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════
  // ONBOARD MEMBER — ask birthday + experience → auto-assign
  // ══════════════════════════════════════════════════════════
  function OnboardSection() {
    const { locale } = useI18n();
    const [search, setSearch] = useState('');
    const [results, setResults] = useState([]);
    const [searching, setSearching] = useState(false);
    const [selMember, setSelMember] = useState(null);
    const [form, setForm] = useState({ date_of_birth: '', experience_level: '', fitness_goal: 'general', health_notes: '' });
    const [saving, setSaving] = useState(false);
    const [result, setResult] = useState(null);
    const sf = (k, v) => setForm(p => ({ ...p, [k]: v }));

    useEffect(() => {
      if (!search || search.length < 2) { setResults([]); return; }
      const tm = setTimeout(() => {
        setSearching(true);
        api.get('/api/training/members/search/available?q=' + encodeURIComponent(search)).then(r => setResults(r.data || [])).catch(() => setResults([])).finally(() => setSearching(false));
      }, 300);
      return () => clearTimeout(tm);
    }, [search]);

    const selectMember = (m) => {
      setSelMember(m);
      setForm({ date_of_birth: m.date_of_birth || '', experience_level: m.experience_level || '', fitness_goal: 'general', health_notes: '' });
      setResult(null);
    };

    const submit = async () => {
      if (!form.experience_level) { toast(locale === 'ar' ? 'اختر المستوى' : 'Select experience level', 'e'); return; }
      try {
        setSaving(true);
        const r = await api.post('/api/training/onboard', { member_id: selMember.id, ...form });
        setResult(r.data);
        toast(locale === 'ar' ? 'تم التسجيل في التدريب!' : 'Training onboarded!');
      } catch (e) { toast(e.message, 'e'); }
      finally { setSaving(false); }
    };

    return (
      <div className='pb'>
        <div className='trn-note'>
          {locale === 'ar'
            ? 'سجّل العضو في نظام التدريب: أدخل تاريخ الميلاد، اختر مستوى الخبرة (مبتدئ / متوسط / متقدم)، وسيتم تعيين برنامج تدريبي مناسب تلقائياً مع فيديوهات وصور التمارين.'
            : 'Onboard a member to training: enter their birthday, select experience level (Beginner / Intermediate / Expert), and a matching training program with exercise videos and images will be auto-assigned.'}
        </div>

        {!selMember ? (
          <div className='card'>
            <div className='ct'>{locale === 'ar' ? 'بحث عن عضو' : 'Search Member'}</div>
            <input className='fi' value={search} onChange={e => setSearch(e.target.value)} placeholder={locale === 'ar' ? 'بحث بالاسم، الهاتف، أو رقم العضوية...' : 'Search by name, phone, or member number...'} style={{ marginTop: 8 }} />
            {searching && <div className='pld'><span className='spinner' /></div>}
            {results.length > 0 && <div className='mkt-list' style={{ marginTop: 8 }}>
              {results.map(m => <div className='mkt-row' key={m.id}>
                <div><div className='mkt-row-title'>{fullName(m)}</div>
                  <div className='mkt-row-sub'>{m.member_no} · {m.phone || '—'} {m.profile_id ? ` · ✓ ${locale === 'ar' ? 'مسجل بالفعل' : 'Already enrolled'}` : ''}</div></div>
                <div className='mkt-actions'><button className='btn btn-p btn-sm' onClick={() => selectMember(m)}>{m.profile_id ? (locale === 'ar' ? 'تحديث' : 'Update') : (locale === 'ar' ? 'تسجيل' : 'Onboard')}</button></div>
              </div>)}
            </div>}
          </div>
        ) : result ? (
          <div className='trn-onboard-card'>
            <div style={{ textAlign: 'center', marginBottom: 8 }}><Ic name='check' size={48} /></div>
            <div className='trn-onboard-title'>{locale === 'ar' ? 'تم التسجيل بنجاح!' : 'Onboarded Successfully!'}</div>
            <div className='trn-onboard-sub'>{fullName(selMember)}</div>
            <div className='dg'>
              <div className='di'><div className='dl'>{locale === 'ar' ? 'المستوى' : 'Level'}</div><div className='dv'><LevelBadge level={result.experience_level} /></div></div>
              <div className='di'><div className='dl'>{locale === 'ar' ? 'البرنامج' : 'Program'}</div><div className='dv'>{locale === 'ar' ? result.program_name_ar || result.program_name || '—' : result.program_name || '—'}</div></div>
              <div className='di'><div className='dl'>{locale === 'ar' ? 'العمر' : 'Age'}</div><div className='dv'>{result.age || '—'}</div></div>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 16 }}>
              <button className='btn btn-s' onClick={() => { setSelMember(null); setResult(null); setSearch(''); }}>{locale === 'ar' ? 'عضو آخر' : 'Another Member'}</button>
            </div>
          </div>
        ) : (
          <div className='trn-onboard-card'>
            <div className='trn-onboard-title'>{locale === 'ar' ? 'تسجيل في التدريب' : 'Training Onboarding'}</div>
            <div className='trn-onboard-sub'>{fullName(selMember)} · {selMember.member_no}</div>
            <div className='fg'><label>{locale === 'ar' ? 'تاريخ الميلاد' : 'Date of Birth'}</label>
              <input className='fi' type='date' value={form.date_of_birth} onChange={e => sf('date_of_birth', e.target.value)} /></div>
            <div className='fg' style={{ marginTop: 12 }}><label>{locale === 'ar' ? 'مستوى الخبرة في كمال الأجسام' : 'Bodybuilding Experience Level'}</label>
              <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                {[['beginner', <Ic name='sprout' size={24} />, 'Beginner', 'مبتدئ'], ['mid', <Ic name='dumbbell' size={24} />, 'Intermediate', 'متوسط'], ['expert', <Ic name='trophy' size={24} />, 'Expert', 'متقدم']].map(([val, icon, en, ar]) => (
                  <button key={val} className={`btn ${form.experience_level === val ? 'btn-p' : 'btn-s'}`}
                    style={{ flex: 1, padding: '14px 8px', flexDirection: 'column', gap: 4, fontSize: 13 }}
                    onClick={() => sf('experience_level', val)}>
                    <span style={{ fontSize: 24 }}>{icon}</span>
                    <span>{locale === 'ar' ? ar : en}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className='fg' style={{ marginTop: 12 }}><label>{locale === 'ar' ? 'الهدف' : 'Fitness Goal'}</label>
              <select className='fi' value={form.fitness_goal} onChange={e => sf('fitness_goal', e.target.value)}>
                <option value='general'>{locale === 'ar' ? 'لياقة عامة' : 'General Fitness'}</option>
                <option value='muscle'>{locale === 'ar' ? 'بناء عضلات' : 'Muscle Building'}</option>
                <option value='weight_loss'>{locale === 'ar' ? 'خسارة وزن' : 'Weight Loss'}</option>
                <option value='bodybuilding'>{locale === 'ar' ? 'بناء أجسام' : 'Bodybuilding'}</option>
              </select>
            </div>
            <div className='fg' style={{ marginTop: 12 }}><label>{locale === 'ar' ? 'ملاحظات صحية' : 'Health Notes'}</label>
              <textarea className='fi' value={form.health_notes} onChange={e => sf('health_notes', e.target.value)} placeholder={locale === 'ar' ? 'إصابات، حالات طبية...' : 'Injuries, medical conditions...'} /></div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 18 }}>
              <button className='btn btn-s' onClick={() => setSelMember(null)}>{locale === 'ar' ? 'رجوع' : 'Back'}</button>
              <button className='btn btn-p' onClick={submit} disabled={saving} style={{ minWidth: 160 }}>{saving ? '...' : (locale === 'ar' ? 'تسجيل وتعيين برنامج' : 'Onboard & Assign Program')}</button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════
  // ENROLLED MEMBERS — list + detail with assigned exercises
  // ══════════════════════════════════════════════════════════
  function EnrolledSection() {
    const { locale, formatDateTime } = useI18n();
    const [items, loading,, reload] = useLoad('/api/training/members', [], []);
    const [sel, setSel] = useState(null);
    const [search, setSearch] = useState('');
    const [levelF, setLevelF] = useState('');

    const filtered = useMemo(() => {
      let r = items;
      if (levelF) r = r.filter(m => m.experience_level === levelF);
      if (search) r = r.filter(m => (fullName(m) + (m.member_no || '')).toLowerCase().includes(search.toLowerCase()));
      return r;
    }, [items, levelF, search]);

    if (sel) return <MemberTrainingDetail memberId={sel.member_id} onBack={() => { setSel(null); reload(); }} />;

    const cols = [
      { key: 'member_no', label: 'Member No', ar: 'رقم العضو' },
      { key: 'full_name', label: 'Name', ar: 'الاسم', render: (r) => fullName(r) },
      { key: 'experience_level', label: 'Level', ar: 'المستوى', render: r => <LevelBadge level={r.experience_level} /> },
      { key: 'program_name', label: 'Program', ar: 'البرنامج', render: (r, l) => l === 'ar' ? r.program_name_ar || r.program_name || '—' : r.program_name || '—' },
      { key: 'age', label: 'Age', ar: 'العمر' },
      { key: 'member_status', label: 'Status', ar: 'الحالة', render: r => <SBadge state={r.member_status} /> },
    ];
    return (
      <div className='pb'>
        <div className='trn-bar'>
          <div className='fb' style={{ margin: 0 }}>
            <input className='fi' style={{ minWidth: 180 }} value={search} onChange={e => setSearch(e.target.value)} placeholder={locale === 'ar' ? 'بحث...' : 'Search...'} />
            <select className='fi' style={{ minWidth: 130 }} value={levelF} onChange={e => setLevelF(e.target.value)}>
              <option value=''>{locale === 'ar' ? 'كل المستويات' : 'All Levels'}</option>
              <option value='beginner'>{locale === 'ar' ? 'مبتدئ' : 'Beginner'}</option>
              <option value='mid'>{locale === 'ar' ? 'متوسط' : 'Intermediate'}</option>
              <option value='expert'>{locale === 'ar' ? 'متقدم' : 'Expert'}</option>
            </select>
          </div>
        </div>
        <Tbl rows={filtered} cols={cols} loading={loading} onRow={r => setSel(r)} emptyLabel={locale === 'ar' ? 'لا يوجد أعضاء مسجلون' : 'No enrolled members'} />
      </div>
    );
  }

  function MemberTrainingDetail({ memberId, onBack }) {
    const { locale, formatDateTime } = useI18n();
    const [data, loading] = useLoad(`/api/training/members/${memberId}`, [memberId], null);
    const [subTab, setSubTab] = useState('program');

    if (loading || !data) return <div className='pb'><div className='pld'><span className='spinner' /></div></div>;

    const days = {};
    (data.exercises || []).forEach(e => { if (!days[e.day_number]) days[e.day_number] = []; days[e.day_number].push(e); });

    return (
      <div className='pb'>
        <div className='trn-form-hdr'>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div className='trn-avatar'>{initials(fullName(data))}</div>
            <div>
              <div className='trn-name'>{fullName(data)}</div>
              <div className='trn-meta'>{data.member_no} · <LevelBadge level={data.experience_level} /> · {locale === 'ar' ? 'العمر' : 'Age'}: {data.age || '—'} · {locale === 'ar' ? data.program_name_ar || data.program_name || '—' : data.program_name || '—'}</div>
            </div>
          </div>
          <button className='btn btn-s' onClick={onBack}>{locale === 'ar' ? 'رجوع' : 'Back'}</button>
        </div>
        <div className='trn-form-body'>
          <div className='trn-sub-tabs'>
            {[['program', 'My Program', 'برنامجي'], ['exercises', 'Exercises', 'التمارين'], ['progress', 'Progress', 'التقدم']].map(([k, en, ar]) => (
              <button key={k} className={`trn-sub-tab ${subTab === k ? 'active' : ''}`} onClick={() => setSubTab(k)}>{locale === 'ar' ? ar : en}</button>
            ))}
          </div>

          {subTab === 'program' && (
            <div>
              <div className='dg' style={{ marginBottom: 14 }}>
                <div className='di'><div className='dl'>{locale === 'ar' ? 'البرنامج' : 'Program'}</div><div className='dv'>{locale === 'ar' ? data.program_name_ar || data.program_name || '—' : data.program_name || '—'}</div></div>
                <div className='di'><div className='dl'>{locale === 'ar' ? 'المدة' : 'Duration'}</div><div className='dv'>{data.duration_weeks || '—'} {locale === 'ar' ? 'أسبوع' : 'weeks'}</div></div>
                <div className='di'><div className='dl'>{locale === 'ar' ? 'أيام/أسبوع' : 'Days/Week'}</div><div className='dv'>{data.days_per_week || '—'}</div></div>
                <div className='di'><div className='dl'>{locale === 'ar' ? 'الهدف' : 'Goal'}</div><div className='dv'>{data.fitness_goal || '—'}</div></div>
              </div>
              {Object.keys(days).length === 0 ? <div className='empty'><h3>{locale === 'ar' ? 'لم يتم تعيين برنامج' : 'No program assigned'}</h3></div> :
                Object.entries(days).map(([day, exs]) => (
                  <div key={day} style={{ marginBottom: 14 }}>
                    <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>{locale === 'ar' ? `اليوم ${day}` : `Day ${day}`}</h3>
                    <div className='trn-ex-grid'>
                      {exs.map(e => (
                        <div className='trn-ex-card' key={e.id}>
                          {e.image_url ? <img className='trn-ex-thumb' src={e.image_url} alt={e.name} onError={ev => { ev.target.style.display='none'; }} /> : <div className='trn-ex-thumb'><Ic name='dumbbell' size={32} /></div>}
                          <div className='trn-ex-body'>
                            <div className='trn-ex-title'>{locale === 'ar' ? e.name_ar || e.name : e.name}</div>
                            <div className='trn-ex-sub'><Ic name='dumbbell' size={12} /> {locale === 'ar' ? e.category_name : e.category_name} · {e.sets} × {e.reps}</div>
                            {e.video_url && <div style={{ marginTop: 4 }}><a href={e.video_url} target='_blank' rel='noopener' style={{ fontSize: 12, color: 'var(--accent-h)' }}>▶ {locale === 'ar' ? 'شاهد الفيديو' : 'Watch Video'}</a></div>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
            </div>
          )}

          {subTab === 'exercises' && (
            <div className='trn-ex-grid'>
              {(data.exercises || []).map(e => (
                <div className='trn-ex-card' key={e.id}>
                  {e.image_url ? <img className='trn-ex-thumb' src={e.image_url} alt={e.name} onError={ev => { ev.target.style.display='none'; }} /> : <div className='trn-ex-thumb'><Ic name='dumbbell' size={32} /></div>}
                  <div className='trn-ex-body'>
                    <div className='trn-ex-title'>{locale === 'ar' ? e.name_ar || e.name : e.name}</div>
                    <div className='trn-ex-sub'>{e.muscle_group || '—'} · {e.equipment || '—'}</div>
                    <div className='trn-ex-sub'>{e.sets} × {e.reps} · {locale === 'ar' ? 'راحة' : 'rest'} {e.rest_seconds}s</div>
                    {e.video_url && <a href={e.video_url} target='_blank' rel='noopener' style={{ fontSize: 12, color: 'var(--accent-h)' }}>▶ {locale === 'ar' ? 'فيديو' : 'Video'}</a>}
                  </div>
                </div>
              ))}
              {(data.exercises || []).length === 0 && <div className='empty' style={{ gridColumn: '1/-1' }}><h3>{locale === 'ar' ? 'لا توجد تمارين' : 'No exercises'}</h3></div>}
            </div>
          )}

          {subTab === 'progress' && (
            <div>
              {(data.progress || []).length === 0 ? <div className='empty'><h3>{locale === 'ar' ? 'لا يوجد تقدم مسجل' : 'No progress logged yet'}</h3></div> :
                <table><thead><tr><th>{locale === 'ar' ? 'التمرين' : 'Exercise'}</th><th>{locale === 'ar' ? 'مجموعات' : 'Sets'}</th><th>{locale === 'ar' ? 'تكرارات' : 'Reps'}</th><th>{locale === 'ar' ? 'الوزن' : 'Weight'}</th><th>{locale === 'ar' ? 'التاريخ' : 'Date'}</th></tr></thead>
                <tbody>{(data.progress || []).map(p => <tr key={p.id}><td>{locale === 'ar' ? p.name_ar || p.name : p.name}</td><td>{p.sets_completed}</td><td>{p.reps_completed}</td><td>{p.weight_used ? p.weight_used + ' kg' : '—'}</td><td style={{ fontSize: 12, color: 'var(--t3)' }}>{formatDateTime(p.completed_at)}</td></tr>)}</tbody></table>}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════
  // MAIN TRAINING WORKSPACE
  // ══════════════════════════════════════════════════════════
  function TrainingWorkspace() {
    const { locale } = useI18n();
    const [tab, setTab] = useState('dashboard');

    const tabs = [
      ['dashboard',  'Dashboard',   'لوحة التحكم',     <Ic name='grid' size={14} />],
      ['categories', 'Categories',  'الأقسام',         <Ic name='folder' size={14} />],
      ['exercises',  'Exercises',   'التمارين',        <Ic name='dumbbell' size={14} />],
      ['programs',   'Programs',    'البرامج',         <Ic name='clipboard' size={14} />],
      ['onboard',    'Onboard',     'تسجيل عضو',      <Ic name='target' size={14} />],
      ['enrolled',   'Members',     'الأعضاء',         <Ic name='users' size={14} />],
    ];

    return (
      <div>
        <div className='trn-top-nav'>
          <div className='trn-top-nav-brand'><Ic name='dumbbell' size={18} /> {locale === 'ar' ? 'التدريب' : 'Training'}</div>
          <div className='trn-top-nav-tabs'>
            {tabs.map(([k, en, ar, icon]) => (
              <button key={k} className={`trn-nav-tab ${tab === k ? 'active' : ''}`} onClick={() => setTab(k)}>
                <span style={{ fontSize: 13 }}>{icon}</span><span>{locale === 'ar' ? ar : en}</span>
              </button>
            ))}
          </div>
        </div>
        <div className='ph'>
          <h1>{locale === 'ar' ? tabs.find(t => t[0] === tab)?.[2] : tabs.find(t => t[0] === tab)?.[1]}</h1>
          <p style={{ color: 'var(--t3)', fontSize: 13 }}>
            {locale === 'ar' ? 'إدارة التدريب — تسجيل الأعضاء حسب مستوى الخبرة وتعيين برامج تدريبية مع فيديوهات وصور تلقائياً' : 'Training management — onboard members by experience level and auto-assign programs with exercise videos & images'}
          </p>
        </div>
        {tab === 'dashboard'  && <DashboardSection />}
        {tab === 'categories' && <CategoriesSection />}
        {tab === 'exercises'  && <ExercisesSection />}
        {tab === 'programs'   && <ProgramsSection />}
        {tab === 'onboard'    && <OnboardSection />}
        {tab === 'enrolled'   && <EnrolledSection />}
      </div>
    );
  }

  GymOS.registerPage({ path: '/training', component: TrainingWorkspace, module: 'training', label: 'Training', labelAr: 'التدريب', order: 30 });
})();
