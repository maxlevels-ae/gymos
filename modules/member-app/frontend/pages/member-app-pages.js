// ═══════════════════════════════════════════════════════════
// GymOS Member App (PWA management) — admin workspace
// Manage meal plans, member assignments, broadcast notifications,
// and PWA settings (gym capacity). Everything the PWA shows is
// controlled from here — nothing hard-coded in the app.
// ═══════════════════════════════════════════════════════════
(function () {
  const { useState, useEffect, useCallback } = React;
  const { api, useI18n, Modal, Ic, toast } = shared;
  const T = (loc, ar, en) => (loc === 'ar' ? ar : en);

  const GOALS = [
    { value: 'any', ar: 'الكل', en: 'Any' },
    { value: 'bulk', ar: 'تضخيم', en: 'Bulk' },
    { value: 'cut', ar: 'تنشيف', en: 'Cut' },
    { value: 'maintain', ar: 'محافظة', en: 'Maintain' },
  ];
  const goalLabel = (g, loc) => { const x = GOALS.find(o => o.value === (g || 'any')); return x ? T(loc, x.ar, x.en) : g; };

  function useLoad(url, deps = [], fallback = []) {
    const [data, setData] = useState(fallback);
    const [loading, setLoading] = useState(true);
    const reload = useCallback(() => {
      let live = true; setLoading(true);
      api.get(url).then(r => { if (live) setData(r.data ?? fallback); })
        .catch(() => { if (live) setData(fallback); })
        .finally(() => { if (live) setLoading(false); });
      return () => { live = false; };
    }, [url]);
    useEffect(() => reload(), [...deps]);
    return [data, loading, reload, setData];
  }

  // ── Overview ──
  function Overview() {
    const { locale: loc } = useI18n();
    const [d] = useLoad('/api/member-app/overview', [], {});
    const cards = [
      [d.activePlans, T(loc, 'خطط غذائية نشطة', 'Active meal plans')],
      [d.assignedMembers, T(loc, 'أعضاء لديهم خطة', 'Members with a plan')],
      [d.notifs7d, T(loc, 'إشعارات (٧ أيام)', 'Notifications (7d)')],
      [d.weighins7d, T(loc, 'تسجيلات وزن (٧ أيام)', 'Weigh-ins (7d)')],
    ];
    return (
      <div>
        <div className='ma-stats'>
          {cards.map(([n, l], i) => <div className='ma-stat' key={i}><div className='n'>{n ?? 0}</div><div className='l'>{l}</div></div>)}
        </div>
        <div className='card' style={{ padding: 16 }}>
          <p style={{ fontSize: 13, color: 'var(--t3)', lineHeight: 1.7 }}>
            {T(loc,
              'كل ما يظهر في تطبيق العضو يُدار من هنا: الخطط الغذائية والوجبات، تعيينها للأعضاء، بث الإشعارات، وسعة النادي القصوى. لا شيء ثابت في التطبيق — كل البيانات ديناميكية.',
              'Everything the member app shows is managed here: meal plans & meals, member assignments, broadcast notifications, and gym capacity. Nothing is hard-coded — all data is dynamic.')}
          </p>
        </div>
      </div>
    );
  }

  // ── Meal Plans ──
  function emptyMeal() { return { title: '', title_ar: '', time_label: '', time_sort: '08:00', calories: 0 }; }
  function PlanModal({ plan, onClose, onSaved }) {
    const { locale: loc } = useI18n();
    const [f, setF] = useState(() => ({
      name: plan?.name || '', name_ar: plan?.name_ar || '', goal: plan?.goal || 'any',
      daily_calories: plan?.daily_calories || 0, protein_g: plan?.protein_g || 0, carbs_g: plan?.carbs_g || 0,
      fat_g: plan?.fat_g || 0, water_glasses: plan?.water_glasses ?? 8, is_active: plan?.is_active !== 0,
      meals: (plan?.meals || []).map(m => ({ title: m.title, title_ar: m.title_ar, time_label: m.time_label, time_sort: m.time_sort, calories: m.calories })),
    }));
    const [saving, setSaving] = useState(false);
    const set = (k, v) => setF(p => ({ ...p, [k]: v }));
    const setMeal = (i, k, v) => setF(p => { const meals = [...p.meals]; meals[i] = { ...meals[i], [k]: v }; return { ...p, meals }; });
    const save = async () => {
      if (!f.name && !f.name_ar) { toast(T(loc, 'أدخل اسم الخطة', 'Enter a plan name'), 'e'); return; }
      setSaving(true);
      try {
        const body = { ...f, is_active: f.is_active };
        if (plan?.id) await api.put('/api/member-app/meal-plans/' + plan.id, body);
        else await api.post('/api/member-app/meal-plans', body);
        toast(T(loc, 'تم الحفظ', 'Saved')); onSaved();
      } catch (e) { toast(e.message || 'Failed', 'e'); setSaving(false); }
    };
    return (
      <Modal title={plan?.id ? T(loc, 'تعديل خطة غذائية', 'Edit meal plan') : T(loc, 'خطة غذائية جديدة', 'New meal plan')} onClose={onClose} wide>
        <div className='fr'>
          <div className='fg'><label>{T(loc, 'الاسم (عربي)', 'Name (AR)')}</label><input className='fi' value={f.name_ar} onChange={e => set('name_ar', e.target.value)} /></div>
          <div className='fg'><label>{T(loc, 'الاسم (إنجليزي)', 'Name (EN)')}</label><input className='fi' value={f.name} onChange={e => set('name', e.target.value)} /></div>
          <div className='fg'><label>{T(loc, 'الهدف', 'Goal')}</label><select className='fi' value={f.goal} onChange={e => set('goal', e.target.value)}>{GOALS.map(o => <option key={o.value} value={o.value}>{T(loc, o.ar, o.en)}</option>)}</select></div>
          <div className='fg'><label>{T(loc, 'الحالة', 'Status')}</label><select className='fi' value={f.is_active ? '1' : '0'} onChange={e => set('is_active', e.target.value === '1')}><option value='1'>{T(loc, 'نشطة', 'Active')}</option><option value='0'>{T(loc, 'موقوفة', 'Inactive')}</option></select></div>
          <div className='fg'><label>{T(loc, 'السعرات اليومية', 'Daily calories')}</label><input className='fi' type='number' value={f.daily_calories} onChange={e => set('daily_calories', e.target.value)} /></div>
          <div className='fg'><label>{T(loc, 'أكواب الماء', 'Water glasses')}</label><input className='fi' type='number' value={f.water_glasses} onChange={e => set('water_glasses', e.target.value)} /></div>
          <div className='fg'><label>{T(loc, 'بروتين (غ)', 'Protein (g)')}</label><input className='fi' type='number' value={f.protein_g} onChange={e => set('protein_g', e.target.value)} /></div>
          <div className='fg'><label>{T(loc, 'كربوهيدرات (غ)', 'Carbs (g)')}</label><input className='fi' type='number' value={f.carbs_g} onChange={e => set('carbs_g', e.target.value)} /></div>
          <div className='fg'><label>{T(loc, 'دهون (غ)', 'Fat (g)')}</label><input className='fi' type='number' value={f.fat_g} onChange={e => set('fat_g', e.target.value)} /></div>
        </div>
        <div style={{ marginTop: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <label style={{ fontSize: 13, fontWeight: 600 }}>{T(loc, 'الوجبات', 'Meals')}</label>
            <button className='btn btn-s btn-sm' onClick={() => set('meals', [...f.meals, emptyMeal()])}><Ic name='plus' size={12} /> {T(loc, 'وجبة', 'Meal')}</button>
          </div>
          {f.meals.map((m, i) => (
            <div className='ma-meal-row' key={i}>
              <input className='fi' placeholder={T(loc, 'اسم عربي', 'Title AR')} value={m.title_ar} onChange={e => setMeal(i, 'title_ar', e.target.value)} />
              <input className='fi' placeholder={T(loc, 'اسم إنجليزي', 'Title EN')} value={m.title} onChange={e => setMeal(i, 'title', e.target.value)} />
              <input className='fi' type='time' value={m.time_sort} onChange={e => setMeal(i, 'time_sort', e.target.value)} />
              <input className='fi' type='number' placeholder='kcal' value={m.calories} onChange={e => setMeal(i, 'calories', e.target.value)} />
              <button className='btn btn-s btn-sm' onClick={() => set('meals', f.meals.filter((_, j) => j !== i))}><Ic name='x' size={12} /></button>
            </div>
          ))}
          {f.meals.length === 0 && <div style={{ fontSize: 12, color: 'var(--t3)' }}>{T(loc, 'لا وجبات — أضف وجبة', 'No meals — add one')}</div>}
        </div>
        <div className='mdl-f'><button className='btn btn-s' onClick={onClose} disabled={saving}>{T(loc, 'إلغاء', 'Cancel')}</button><button className='btn btn-p' onClick={save} disabled={saving}>{saving ? '...' : T(loc, 'حفظ', 'Save')}</button></div>
      </Modal>
    );
  }

  function AssignModal({ plan, onClose, onSaved }) {
    const { locale: loc } = useI18n();
    const [members] = useLoad('/api/member-app/members', [], []);
    const [mode, setMode] = useState('goal');
    const [goal, setGoal] = useState(plan?.goal && plan.goal !== 'any' ? plan.goal : 'bulk');
    const [picked, setPicked] = useState([]);
    const [saving, setSaving] = useState(false);
    const toggle = id => setPicked(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);
    const save = async () => {
      setSaving(true);
      try {
        const body = mode === 'goal' ? { goal } : { member_ids: picked };
        const r = await api.post('/api/member-app/meal-plans/' + plan.id + '/assign', body);
        toast(T(loc, `تم التعيين لـ ${r.data.assigned} عضو`, `Assigned to ${r.data.assigned} members`)); onSaved();
      } catch (e) { toast(e.message || 'Failed', 'e'); setSaving(false); }
    };
    return (
      <Modal title={T(loc, 'تعيين الخطة', 'Assign plan') + ' · ' + (loc === 'ar' ? plan.name_ar || plan.name : plan.name)} onClose={onClose} wide>
        <div className='fg'><label>{T(loc, 'طريقة التعيين', 'Assign by')}</label>
          <select className='fi' value={mode} onChange={e => setMode(e.target.value)}>
            <option value='goal'>{T(loc, 'حسب الهدف', 'By goal')}</option>
            <option value='select'>{T(loc, 'اختيار أعضاء', 'Select members')}</option>
          </select>
        </div>
        {mode === 'goal'
          ? <div className='fg'><label>{T(loc, 'الهدف', 'Goal')}</label><select className='fi' value={goal} onChange={e => setGoal(e.target.value)}>{GOALS.filter(g => g.value !== 'any').map(o => <option key={o.value} value={o.value}>{T(loc, o.ar, o.en)}</option>)}</select></div>
          : <div style={{ maxHeight: 260, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--rs)', padding: 8 }}>
            {members.map(m => (
              <label key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 4px', fontSize: 13, cursor: 'pointer' }}>
                <input type='checkbox' checked={picked.includes(m.id)} onChange={() => toggle(m.id)} />
                <span>{m.member_no} · {m.name || '—'}</span>
                <span style={{ marginInlineStart: 'auto', fontSize: 11, color: 'var(--t3)' }}>{goalLabel(m.fitness_goal, loc)}</span>
              </label>
            ))}
            {members.length === 0 && <div style={{ fontSize: 12, color: 'var(--t3)' }}>{T(loc, 'لا أعضاء', 'No members')}</div>}
          </div>}
        <div className='mdl-f'><button className='btn btn-s' onClick={onClose} disabled={saving}>{T(loc, 'إلغاء', 'Cancel')}</button><button className='btn btn-p' onClick={save} disabled={saving || (mode === 'select' && !picked.length)}>{saving ? '...' : T(loc, 'تعيين', 'Assign')}</button></div>
      </Modal>
    );
  }

  function MealPlans() {
    const { locale: loc } = useI18n();
    const [plans, loading, reload] = useLoad('/api/member-app/meal-plans', [], []);
    const [edit, setEdit] = useState(null);
    const [assign, setAssign] = useState(null);
    const del = async (p) => {
      if (!window.confirm(T(loc, 'حذف هذه الخطة؟', 'Delete this plan?'))) return;
      try { await api.delete('/api/member-app/meal-plans/' + p.id); toast(T(loc, 'تم الحذف', 'Deleted')); reload(); }
      catch (e) { toast(e.message || 'Failed', 'e'); }
    };
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 13, color: 'var(--t3)' }}>{plans.length} {T(loc, 'خطة', 'plans')}</div>
          <button className='btn btn-p' onClick={() => setEdit({})}><Ic name='plus' size={14} /> {T(loc, 'خطة جديدة', 'New plan')}</button>
        </div>
        {loading ? <div className='empty'><h3>...</h3></div> : plans.length === 0 ? <div className='empty'><h3>{T(loc, 'لا توجد خطط', 'No plans')}</h3></div> : (
          <div className='ma-plan-grid'>
            {plans.map(p => (
              <div className='ma-plan' key={p.id}>
                <div className='ma-plan-hd'>
                  <div>
                    <div className='ma-plan-title'>{loc === 'ar' ? p.name_ar || p.name : p.name || p.name_ar}</div>
                    <div style={{ fontSize: 12, color: 'var(--t3)', marginTop: 2 }}>{p.daily_calories} kcal · {p.assigned} {T(loc, 'عضو', 'members')}{p.is_active ? '' : ' · ' + T(loc, 'موقوفة', 'inactive')}</div>
                  </div>
                  <span className='ma-goal'>{goalLabel(p.goal, loc)}</span>
                </div>
                <div className='ma-macros'>
                  <div><b>{p.protein_g}</b>{T(loc, 'بروتين', 'protein')}</div>
                  <div><b>{p.carbs_g}</b>{T(loc, 'كربوهيدرات', 'carbs')}</div>
                  <div><b>{p.fat_g}</b>{T(loc, 'دهون', 'fat')}</div>
                  <div><b>{p.water_glasses}</b>{T(loc, 'ماء', 'water')}</div>
                </div>
                <div style={{ fontSize: 12, color: 'var(--t3)', marginBottom: 10 }}>{(p.meals || []).length} {T(loc, 'وجبات', 'meals')}: {(p.meals || []).map(m => loc === 'ar' ? m.title_ar || m.title : m.title).filter(Boolean).join('، ') || '—'}</div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className='btn btn-s btn-sm' onClick={() => setEdit(p)}><Ic name='edit' size={12} /> {T(loc, 'تعديل', 'Edit')}</button>
                  <button className='btn btn-s btn-sm' onClick={() => setAssign(p)}><Ic name='users' size={12} /> {T(loc, 'تعيين', 'Assign')}</button>
                  <button className='btn btn-s btn-sm' onClick={() => del(p)} style={{ marginInlineStart: 'auto' }}><Ic name='x' size={12} /></button>
                </div>
              </div>
            ))}
          </div>
        )}
        {edit && <PlanModal plan={edit.id ? edit : null} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); reload(); }} />}
        {assign && <AssignModal plan={assign} onClose={() => setAssign(null)} onSaved={() => { setAssign(null); reload(); }} />}
      </div>
    );
  }

  // ── Assignments ──
  function Assignments() {
    const { locale: loc } = useI18n();
    const [rows, loading] = useLoad('/api/member-app/assignments', [], []);
    return (
      <div className='card' style={{ padding: 0, overflow: 'hidden' }}>
        <table>
          <thead><tr><th>{T(loc, 'رقم العضوية', 'Member #')}</th><th>{T(loc, 'العضو', 'Member')}</th><th>{T(loc, 'الخطة', 'Plan')}</th></tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={3}><div className='empty'><h3>...</h3></div></td></tr>
              : rows.length === 0 ? <tr><td colSpan={3}><div className='empty'><h3>{T(loc, 'لا تعيينات', 'No assignments')}</h3></div></td></tr>
                : rows.map(r => <tr key={r.member_id}><td>{r.member_no}</td><td>{r.member_name || '—'}</td><td>{loc === 'ar' ? r.plan_name_ar || r.plan_name : r.plan_name || '—'}</td></tr>)}
          </tbody>
        </table>
      </div>
    );
  }

  // ── Notifications ──
  const CATS = [
    { value: 'general', ar: 'عام', en: 'General' },
    { value: 'subscription', ar: 'الاشتراك', en: 'Subscription' },
    { value: 'training', ar: 'التدريب', en: 'Training' },
    { value: 'nutrition', ar: 'التغذية', en: 'Nutrition' },
  ];
  function NotificationsPanel() {
    const { locale: loc } = useI18n();
    const [f, setF] = useState({ target: 'all', category: 'general', title_ar: '', title: '', body_ar: '', body: '' });
    const [busy, setBusy] = useState(false);
    const set = (k, v) => setF(p => ({ ...p, [k]: v }));
    const send = async () => {
      if (!f.title_ar && !f.title) { toast(T(loc, 'أدخل عنوان الإشعار', 'Enter a title'), 'e'); return; }
      setBusy(true);
      try { const r = await api.post('/api/member-app/notifications/send', f); toast(T(loc, `تم الإرسال إلى ${r.data.sent} عضو`, `Sent to ${r.data.sent} members`)); setF(p => ({ ...p, title_ar: '', title: '', body_ar: '', body: '' })); }
      catch (e) { toast(e.message || 'Failed', 'e'); }
      setBusy(false);
    };
    const runGen = async () => { setBusy(true); try { await api.post('/api/member-app/notifications/run-generation', {}); toast(T(loc, 'تم توليد الإشعارات التلقائية', 'Auto-notifications generated')); } catch (e) { toast(e.message || 'Failed', 'e'); } setBusy(false); };
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr)', gap: 16, maxWidth: 720 }}>
        <div className='card' style={{ padding: 18 }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 14 }}>{T(loc, 'بث إشعار', 'Broadcast a notification')}</h2>
          <div className='fr'>
            <div className='fg'><label>{T(loc, 'المستهدفون', 'Target')}</label><select className='fi' value={f.target} onChange={e => set('target', e.target.value)}>
              <option value='all'>{T(loc, 'كل الأعضاء النشطين', 'All active members')}</option>
              <option value='expiring'>{T(loc, 'اشتراكات تنتهي قريباً', 'Expiring soon (≤14d)')}</option>
            </select></div>
            <div className='fg'><label>{T(loc, 'التصنيف', 'Category')}</label><select className='fi' value={f.category} onChange={e => set('category', e.target.value)}>{CATS.map(c => <option key={c.value} value={c.value}>{T(loc, c.ar, c.en)}</option>)}</select></div>
            <div className='fg'><label>{T(loc, 'العنوان (عربي)', 'Title (AR)')}</label><input className='fi' value={f.title_ar} onChange={e => set('title_ar', e.target.value)} /></div>
            <div className='fg'><label>{T(loc, 'العنوان (إنجليزي)', 'Title (EN)')}</label><input className='fi' value={f.title} onChange={e => set('title', e.target.value)} /></div>
            <div className='fg' style={{ gridColumn: '1 / -1' }}><label>{T(loc, 'النص (عربي)', 'Body (AR)')}</label><textarea className='fi' rows='2' value={f.body_ar} onChange={e => set('body_ar', e.target.value)} /></div>
            <div className='fg' style={{ gridColumn: '1 / -1' }}><label>{T(loc, 'النص (إنجليزي)', 'Body (EN)')}</label><textarea className='fi' rows='2' value={f.body} onChange={e => set('body', e.target.value)} /></div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}><button className='btn btn-p' onClick={send} disabled={busy}>{busy ? '...' : T(loc, 'إرسال', 'Send')}</button></div>
        </div>
        <div className='card' style={{ padding: 18 }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>{T(loc, 'الإشعارات التلقائية', 'Automatic notifications')}</h2>
          <p style={{ fontSize: 12, color: 'var(--t3)', lineHeight: 1.7, marginBottom: 12 }}>{T(loc, 'تُنشأ تلقائياً كل ٦ ساعات: تنبيهات قرب انتهاء الاشتراك (٧/٣/١ يوم) وتذكير التمرين. اضغط للتوليد الآن.', 'Generated automatically every 6h: subscription-expiry alerts (7/3/1 days) and workout reminders. Run now:')}</p>
          <button className='btn btn-s' onClick={runGen} disabled={busy}><Ic name='refresh' size={13} /> {T(loc, 'توليد الآن', 'Run now')}</button>
        </div>
      </div>
    );
  }

  // ── Settings ──
  function SettingsPanel() {
    const { locale: loc } = useI18n();
    const [d, loading, reload] = useLoad('/api/member-app/settings', [], {});
    const [cap, setCap] = useState('');
    const [busy, setBusy] = useState(false);
    useEffect(() => { if (d && d.gym_max_capacity != null) setCap(String(d.gym_max_capacity)); }, [d]);
    const save = async () => { setBusy(true); try { await api.put('/api/member-app/settings', { gym_max_capacity: Number(cap) }); toast(T(loc, 'تم الحفظ', 'Saved')); reload(); } catch (e) { toast(e.message || 'Failed', 'e'); } setBusy(false); };
    return (
      <div className='card' style={{ padding: 18, maxWidth: 480 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>{T(loc, 'سعة النادي', 'Gym capacity')}</h2>
        <p style={{ fontSize: 12, color: 'var(--t3)', marginBottom: 14 }}>{T(loc, 'تُستخدم لحساب مستوى الازدحام في الصفحة الرئيسية للتطبيق (هادئ / متوسط / مزدحم).', 'Used to compute the busy level on the app home (quiet / medium / busy).')}</p>
        <div className='fg'><label>{T(loc, 'السعة القصوى', 'Max capacity')}</label><input className='fi' type='number' value={cap} onChange={e => setCap(e.target.value)} disabled={loading} /></div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}><button className='btn btn-p' onClick={save} disabled={busy || loading}>{busy ? '...' : T(loc, 'حفظ', 'Save')}</button></div>
      </div>
    );
  }

  // ── Messages / PWA ──
  function MessagesPanel() {
    const { locale: loc } = useI18n();
    const [d, loading, reload] = useLoad('/api/member-app/settings', [], {});
    const [f, setF] = useState(null);
    const [busy, setBusy] = useState(false);
    const [testPhone, setTestPhone] = useState('');
    const [testMsg, setTestMsg] = useState('');
    const [testing, setTesting] = useState(false);
    useEffect(() => { if (d && !loading) setF({
      welcome_message_enabled: !!d.welcome_message_enabled,
      welcome_message_template: d.welcome_message_template || '',
      pwa_invite_enabled: !!d.pwa_invite_enabled,
      pwa_invite_template: d.pwa_invite_template || '',
      pwa_link: d.pwa_link || '', public_url: d.public_url || '',
      ios_video_link: d.ios_video_link || '', android_video_link: d.android_video_link || '',
    }); }, [d, loading]);
    if (!f) return <div className='empty'><h3>...</h3></div>;
    const set = (k, v) => setF(p => ({ ...p, [k]: v }));
    const save = async () => { setBusy(true); try { await api.put('/api/member-app/settings', f); toast(T(loc, 'تم الحفظ', 'Saved')); reload(); } catch (e) { toast(e.message || 'Failed', 'e'); } setBusy(false); };
    const sendTest = async () => { if (!testPhone.trim()) { toast(T(loc, 'أدخل رقم الهاتف', 'Enter a phone'), 'e'); return; } setTesting(true); try { const r = await api.post('/api/member-app/test-message', { phone: testPhone, message: testMsg || undefined }); const rd = r.data || {}; if (rd.sent) toast(T(loc, 'تم إرسال الرسالة التجريبية', 'Test sent')); else toast(T(loc, 'فشل: ', 'Failed: ') + (rd.error || ''), 'e'); } catch (e) { toast(e.message || 'Failed', 'e'); } setTesting(false); };
    const vars = '{name} · {member_no} · {company} · {pwa_link} · {ios_video_link} · {android_video_link}';
    return (
      <div style={{ display: 'grid', gap: 16, maxWidth: 720 }}>
        <div className='card' style={{ padding: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ width: 9, height: 9, borderRadius: '50%', background: d.gateway_configured ? '#22c55e' : '#ef4444', flexShrink: 0 }} />
          <span style={{ fontSize: 13, fontWeight: 600 }}>{d.gateway_configured ? T(loc, 'بوابة واتساب متصلة', 'WhatsApp gateway connected') : T(loc, 'بوابة واتساب غير مهيأة — راجع الإعدادات › التكامل', 'WhatsApp gateway not configured — see Settings › Integrations')}</span>
        </div>
        <div className='card' style={{ padding: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, gap: 10 }}>
            <h2 style={{ fontSize: 15, fontWeight: 600 }}>{T(loc, 'رسالة الترحيب وتحميل التطبيق', 'Welcome & app-download message')}</h2>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--t3)', whiteSpace: 'nowrap' }}><input type='checkbox' checked={f.welcome_message_enabled} onChange={e => set('welcome_message_enabled', e.target.checked)} />{T(loc, 'مفعّلة', 'Enabled')}</label>
          </div>
          <p style={{ fontSize: 12, color: 'var(--t3)', marginBottom: 10 }}>{T(loc, 'تُرسل عبر واتساب تلقائياً عند إضافة عضو جديد.', 'Sent automatically via WhatsApp when a new member is added.')}</p>
          <textarea className='fi' rows='8' value={f.welcome_message_template} onChange={e => set('welcome_message_template', e.target.value)} style={{ resize: 'vertical' }} />
          <p style={{ fontSize: 11, color: 'var(--t3)', marginTop: 6, direction: 'ltr', textAlign: 'left' }}>{T(loc, 'المتغيرات: ', 'Variables: ')}{vars}</p>
        </div>
        <div className='card' style={{ padding: 18 }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 10 }}>{T(loc, 'روابط التطبيق', 'App links')}</h2>
          <div className='fr'>
            <div className='fg' style={{ gridColumn: '1 / -1' }}><label>{T(loc, 'الرابط العام (Public URL)', 'Public URL')}</label><input className='fi' value={f.public_url} onChange={e => set('public_url', e.target.value)} placeholder='https://yourgym.com' dir='ltr' /></div>
            <div className='fg'><label>{T(loc, 'رابط التطبيق', 'PWA link')}</label><input className='fi' value={f.pwa_link} onChange={e => set('pwa_link', e.target.value)} dir='ltr' /></div>
            <div className='fg'><label>{T(loc, 'فيديو تثبيت iPhone', 'iOS install video')}</label><input className='fi' value={f.ios_video_link} onChange={e => set('ios_video_link', e.target.value)} dir='ltr' /></div>
            <div className='fg'><label>{T(loc, 'فيديو تثبيت Android', 'Android install video')}</label><input className='fi' value={f.android_video_link} onChange={e => set('android_video_link', e.target.value)} dir='ltr' /></div>
          </div>
          <p style={{ fontSize: 11, color: 'var(--t3)', marginTop: 8 }}>{T(loc, 'إذا كان رابط التطبيق نسبياً (/member/) فسيُدمج مع الرابط العام ليصبح قابلاً للنقر على الهاتف.', 'If the PWA link is relative (/member/), it is combined with the Public URL so it is clickable on phones.')}</p>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}><button className='btn btn-p' onClick={save} disabled={busy}>{busy ? '...' : T(loc, 'حفظ الإعدادات', 'Save settings')}</button></div>
        <div className='card' style={{ padding: 18 }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>{T(loc, 'إرسال رسالة تجريبية', 'Send a test message')}</h2>
          <p style={{ fontSize: 12, color: 'var(--t3)', marginBottom: 12 }}>{T(loc, 'أرسل رسالة واتساب إلى أي رقم للتأكد من عمل البوابة.', 'Send a WhatsApp to any number to verify the gateway works.')}</p>
          <div className='fr'>
            <div className='fg'><label>{T(loc, 'رقم الهاتف', 'Phone number')}</label><input className='fi' value={testPhone} onChange={e => setTestPhone(e.target.value)} placeholder='07XXXXXXXX' dir='ltr' /></div>
            <div className='fg' style={{ gridColumn: '1 / -1' }}><label>{T(loc, 'نص الرسالة (اختياري)', 'Message (optional)')}</label><textarea className='fi' rows='3' value={testMsg} onChange={e => setTestMsg(e.target.value)} placeholder={T(loc, 'رسالة تجريبية...', 'Test message...')} /></div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}><button className='btn btn-s' onClick={sendTest} disabled={testing}><Ic name='message' size={14} /> {testing ? '...' : T(loc, 'إرسال تجريبي', 'Send test')}</button></div>
        </div>
      </div>
    );
  }

  // ── Workspace ──
  function MemberAppWorkspace() {
    const { locale: loc } = useI18n();
    const [tab, setTab] = useState('overview');
    const tabs = [
      ['overview', 'نظرة عامة', 'Overview', <Ic name='grid' size={16} />],
      ['plans', 'الخطط الغذائية', 'Meal plans', <Ic name='utensils' size={16} />],
      ['assign', 'التعيينات', 'Assignments', <Ic name='link' size={16} />],
      ['notifs', 'الإشعارات', 'Notifications', <Ic name='bell' size={16} />],
      ['messages', 'الرسائل والتطبيق', 'Messages', <Ic name='message' size={16} />],
      ['settings', 'الإعدادات', 'Settings', <Ic name='settings' size={16} />],
    ];
    const cur = tabs.find(t => t[0] === tab);
    return (
      <div>
        <div className='ma-top-nav'>
          <div className='ma-brand'><Ic name='smartphone' size={18} /> {T(loc, 'تطبيق الأعضاء', 'Member App')}</div>
          <div className='ma-tabs'>
            {tabs.map(([k, ar, en, icon]) => (
              <button key={k} className={`ma-tab ${tab === k ? 'active' : ''}`} onClick={() => setTab(k)}><span>{icon}</span><span>{T(loc, ar, en)}</span></button>
            ))}
          </div>
        </div>
        <div className='ph'>
          <h1>{T(loc, cur?.[1], cur?.[2])}</h1>
          <p style={{ color: 'var(--t3)', fontSize: 13 }}>{T(loc, 'إدارة تطبيق العضو (PWA) — خطط غذائية، تعيينات، إشعارات، وإعدادات ديناميكية بالكامل.', 'Member PWA management — meal plans, assignments, notifications, and fully dynamic settings.')}</p>
        </div>
        <div className='pb'>
          {tab === 'overview' && <Overview />}
          {tab === 'plans' && <MealPlans />}
          {tab === 'assign' && <Assignments />}
          {tab === 'notifs' && <NotificationsPanel />}
          {tab === 'messages' && <MessagesPanel />}
          {tab === 'settings' && <SettingsPanel />}
        </div>
      </div>
    );
  }

  GymOS.registerPage({ path: '/member-app', component: MemberAppWorkspace, module: 'member-app', label: 'Member App', labelAr: 'تطبيق الأعضاء', order: 26 });
})();
