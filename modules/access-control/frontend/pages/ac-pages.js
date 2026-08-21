// ═══════════════════════════════════════════════════════════
// GymOS Access Control V2 — Odoo-style workspace
// Single page · top header navigation · all GymOS native classes
// ZKTeco fingerprint bridge integration with 3-scan enrollment
// ═══════════════════════════════════════════════════════════
(function () {
  const { useState, useEffect, useCallback, useMemo } = React;
  const { api, useI18n, Modal, Ic, toast, formatMoney } = shared;

  // ── Helpers ──────────────────────────────────────────────
  function initials(name) { return (name || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase(); }

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

  // ── Status badge ─────────────────────────────────────────
  function SBadge({ state }) {
    const { locale } = useI18n();
    const map = {
      active:    { en: 'Active',    ar: 'نشط',         cls: 'b-active'   },
      inactive:  { en: 'Inactive',  ar: 'غير نشط',     cls: 'b-disabled' },
      suspended: { en: 'Suspended', ar: 'موقوف',       cls: 'b-warning'  },
      granted:   { en: 'Granted',   ar: 'مسموح',       cls: 'b-paid'     },
      denied:    { en: 'Denied',    ar: 'مرفوض',       cls: 'b-danger'   },
      collecting:{ en: 'Collecting', ar: 'جمع',        cls: 'b-info'     },
      completed: { en: 'Completed', ar: 'مكتمل',       cls: 'b-active'   },
      unknown:   { en: 'Unknown',   ar: 'غير معروف',   cls: 'b-inactive' },
    };
    const s = map[state] || { en: state || '—', ar: state || '—', cls: 'b-inactive' };
    return <span className={`badge ${s.cls}`}>{locale === 'ar' ? s.ar : s.en}</span>;
  }

  // ── Generic Table ────────────────────────────────────────
  function Tbl({ rows = [], cols = [], loading, onRow, emptyLabel, emptyAction, onEmptyAction }) {
    const { locale } = useI18n();
    if (loading) return <div className='pld'><span className='spinner' /></div>;
    return (
      <div className='card' style={{ padding: 0, overflow: 'hidden' }}>
        <table>
          <thead><tr>{cols.map(c => <th key={c.key}>{locale === 'ar' && c.ar ? c.ar : c.label}</th>)}</tr></thead>
          <tbody>
            {rows.length === 0
              ? <tr><td colSpan={cols.length}>
                <div className='empty'>
                  <h3>{emptyLabel || (locale === 'ar' ? 'لا توجد بيانات' : 'No records')}</h3>
                  {emptyAction && <button className='btn btn-p btn-sm' style={{ marginTop: 8 }} onClick={onEmptyAction}>{emptyAction}</button>}
                </div>
              </td></tr>
              : rows.map((row, i) => (
                <tr key={row.id || i} onClick={() => onRow && onRow(row)} style={onRow ? { cursor: 'pointer' } : {}}>
                  {cols.map(c => <td key={c.key}>{c.render ? c.render(row, locale) : String(row[c.key] ?? '—')}</td>)}
                </tr>
              ))
            }
          </tbody>
        </table>
      </div>
    );
  }

  // ── Generic Form Modal ──────────────────────────────────
  function FormModal({ title, fields, initial, onClose, onSave, wide }) {
    const { locale } = useI18n();
    const [form, setForm] = useState(() => ({ ...(initial || {}) }));
    const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
    const [saving, setSaving] = useState(false);
    const save = async () => {
      try { setSaving(true); await onSave(form); }
      catch (e) { toast(e.message || 'Save failed', 'e'); setSaving(false); }
    };
    return (
      <Modal title={title} onClose={onClose} wide={wide !== false}>
        <div className='mdl-b'>
          <div className='fr3'>
            {fields.map(f => {
              const label = locale === 'ar' && f.labelAr ? f.labelAr : f.label;
              const value = form[f.key] ?? '';
              const options = f.options || [];
              if (f.type === 'textarea') return <div className='fg' key={f.key} style={{ gridColumn: '1 / -1' }}><label>{label}</label><textarea className='fi' value={value} onChange={e => set(f.key, e.target.value)} /></div>;
              if (f.type === 'select') return <div className='fg' key={f.key}><label>{label}</label><select className='fi' value={value} onChange={e => set(f.key, e.target.value)}><option value=''>{locale === 'ar' ? 'اختر' : 'Select'}</option>{options.map(o => <option key={o.value} value={o.value}>{locale === 'ar' && o.labelAr ? o.labelAr : o.label}</option>)}</select></div>;
              if (f.type === 'checkbox') return <div className='fg' key={f.key}><label style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 22, cursor: 'pointer' }}><input type='checkbox' checked={!!value} onChange={e => set(f.key, e.target.checked)} style={{ width: 15, height: 15 }} /> {label}</label></div>;
              return <div className='fg' key={f.key}><label>{label}</label><input className='fi' type={f.type || 'text'} value={value} onChange={e => set(f.key, e.target.value)} /></div>;
            })}
          </div>
        </div>
        <div className='mdl-f'>
          <button className='btn btn-s' onClick={onClose} disabled={saving}>{locale === 'ar' ? 'إلغاء' : 'Cancel'}</button>
          <button className='btn btn-p' onClick={save} disabled={saving}>{saving ? '...' : (locale === 'ar' ? 'حفظ' : 'Save')}</button>
        </div>
      </Modal>
    );
  }

  // ══════════════════════════════════════════════════════════
  // DASHBOARD
  // ══════════════════════════════════════════════════════════
  function DashboardSection() {
    const { locale, formatDateTime } = useI18n();
    const [stats, loading] = useLoad('/api/access-control/dashboard', [], null);
    const [status] = useLoad('/api/access-control/status', [], null);

    if (loading || !stats) return <div className='pb'><div className='pld'><span className='spinner' /></div></div>;

    const cards = [
      ['Events Today',   'أحداث اليوم',       stats.today || 0],
      ['Total Events',   'إجمالي الأحداث',    stats.total || 0],
      ['Granted',        'مسموح',             stats.granted || 0],
      ['Denied',         'مرفوض',             stats.denied || 0],
      ['Success Rate',   'نسبة النجاح',       (stats.successRate || 0) + '%'],
      ['Bridge Status',  'حالة الجسر',        status?.bridge?.connected ? (locale === 'ar' ? 'متصل' : 'Online') : (locale === 'ar' ? 'غير متصل' : 'Offline')],
    ];

    return (
      <div className='pb'>
        <div className='sg' style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))' }}>
          {cards.map(([en, ar, val], i) => (
            <div className='sc' key={i}>
              <div className='sl'>{locale === 'ar' ? ar : en}</div>
              <div className='sv' style={{ fontSize: 22 }}>{val}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 14, marginTop: 4 }}>
          <div className='card'>
            <div className='ct'>{locale === 'ar' ? 'آخر الأحداث' : 'Recent Events'}</div>
            <table>
              <thead><tr>
                <th>{locale === 'ar' ? 'الوقت' : 'Time'}</th>
                <th>{locale === 'ar' ? 'الهوية' : 'Identity'}</th>
                <th>{locale === 'ar' ? 'النتيجة' : 'Result'}</th>
                <th>{locale === 'ar' ? 'السكور' : 'Score'}</th>
              </tr></thead>
              <tbody>
                {(stats.recent || []).length === 0
                  ? <tr><td colSpan={4}><div className='empty'><h3>{locale === 'ar' ? 'لا أحداث بعد' : 'No events yet'}</h3></div></td></tr>
                  : (stats.recent || []).slice(0, 10).map((e, i) => (
                    <tr key={i}>
                      <td style={{ fontSize: 12, color: 'var(--t3)' }}>{formatDateTime(e.created_at)}</td>
                      <td>{e.display_name || [e.first_name, e.middle_name, e.last_name].filter(Boolean).join(' ') || '—'}</td>
                      <td><SBadge state={e.result} /></td>
                      <td>{e.score || 0}</td>
                    </tr>
                  ))
                }
              </tbody>
            </table>
          </div>
          <div className='card'>
            <div className='ct'>{locale === 'ar' ? 'معلومات النظام' : 'System Info'}</div>
            <div className='ac-device-card' style={{ margin: '12px 0' }}>
              <div className={`ac-device-dot ${status?.bridge?.connected ? 'online' : 'offline'}`} />
              <div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{locale === 'ar' ? 'جسر البصمة ZK4500' : 'ZK4500 Fingerprint Bridge'}</div>
                <div style={{ fontSize: 12, color: 'var(--t3)' }}>{status?.bridge?.error || (status?.bridge?.connected ? (locale === 'ar' ? 'متصل ويعمل' : 'Connected & operational') : (locale === 'ar' ? 'غير متصل' : 'Disconnected'))}</div>
              </div>
            </div>
            <div style={{ padding: '10px 0', borderTop: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 13 }}>
                <span style={{ color: 'var(--t3)' }}>{locale === 'ar' ? 'الهويات المسجلة' : 'Identities'}</span>
                <strong>{status?.stats?.totalIdentities || 0}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 13 }}>
                <span style={{ color: 'var(--t3)' }}>{locale === 'ar' ? 'مرتبطة بأعضاء' : 'Linked to Members'}</span>
                <strong>{status?.stats?.linkedMembers || 0}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 13 }}>
                <span style={{ color: 'var(--t3)' }}>{locale === 'ar' ? 'قوالب البصمات' : 'Templates'}</span>
                <strong>{status?.stats?.templates || 0}</strong>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════
  // IDENTITIES SECTION — with detail view and inline tabs
  // ══════════════════════════════════════════════════════════
  function IdentityDetail({ identity, onClose, onRefresh, onEnroll }) {
    const { locale, formatDateTime } = useI18n();
    const [editTab, setEditTab] = useState('info');
    const [form, setForm] = useState({ ...identity });
    const [saving, setSaving] = useState(false);
    const sf = k => e => setForm(p => ({ ...p, [k]: e.target.value }));
    const [templates] = useLoad(`/api/access-control/identities/${identity.id}/templates`, [identity.id], []);
    const [events] = useLoad(`/api/access-control/identities/${identity.id}/events`, [identity.id], []);

    const save = async () => {
      try {
        setSaving(true);
        await api.put(`/api/access-control/identities/${identity.id}`, form);
        toast(locale === 'ar' ? 'تم الحفظ' : 'Saved');
        onRefresh();
      } catch (e) { toast(e.message || 'Failed', 'e'); }
      finally { setSaving(false); }
    };

    return (
      <div>
        <div className='ac-form-hdr'>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div className='ac-id-avatar'>{initials(identity.display_name)}</div>
            <div>
              <div className='ac-id-name'>{identity.display_name}</div>
              <div className='ac-id-meta'>{identity.code || '—'} · {identity.member_no || (locale === 'ar' ? 'غير مربوط' : 'Not linked')} · {identity.template_count || 0} {locale === 'ar' ? 'بصمة' : 'template(s)'}</div>
            </div>
            <SBadge state={identity.status} />
          </div>
          <div className='ac-form-acts'>
            <button className='btn btn-s' onClick={onClose}>{locale === 'ar' ? 'رجوع' : 'Back'}</button>
            <button className='btn btn-g' onClick={() => onEnroll(identity)}><Ic name='fingerprint' size={14} /> {locale === 'ar' ? 'تسجيل بصمة' : 'Enroll Fingerprint'}</button>
            <button className='btn btn-p' onClick={save} disabled={saving}>{saving ? '...' : (locale === 'ar' ? 'حفظ' : 'Save')}</button>
          </div>
        </div>
        <div className='ac-form-body'>
          <div className='ac-sub-tabs'>
            {[['info', 'Identity Info', 'معلومات الهوية'], ['templates', 'Fingerprints', 'البصمات'], ['history', 'Access History', 'سجل الدخول']].map(([k, en, ar]) => (
              <button key={k} className={`ac-sub-tab ${editTab === k ? 'active' : ''}`} onClick={() => setEditTab(k)}>{locale === 'ar' ? ar : en}</button>
            ))}
          </div>

          {editTab === 'info' && (
            <div className='fr3'>
              <div className='fg'><label>{locale === 'ar' ? 'الاسم' : 'Display Name'}</label><input className='fi' value={form.display_name || ''} onChange={sf('display_name')} /></div>
              <div className='fg'><label>{locale === 'ar' ? 'الكود' : 'Code'}</label><input className='fi' value={form.code || ''} onChange={sf('code')} /></div>
              <div className='fg'><label>{locale === 'ar' ? 'الحالة' : 'Status'}</label>
                <select className='fi' value={form.status || 'active'} onChange={sf('status')}>
                  <option value='active'>{locale === 'ar' ? 'نشط' : 'Active'}</option>
                  <option value='inactive'>{locale === 'ar' ? 'غير نشط' : 'Inactive'}</option>
                  <option value='suspended'>{locale === 'ar' ? 'موقوف' : 'Suspended'}</option>
                </select>
              </div>
              <div className='fg'><label>{locale === 'ar' ? 'رقم العضو' : 'Member No'}</label>
                <div style={{ padding: '8px 12px', background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 'var(--rs)', fontSize: 13, color: 'var(--t2)' }}>
                  {identity.member_no || (locale === 'ar' ? 'غير مربوط' : 'Not linked')}
                </div>
              </div>
              <div className='fg'><label>{locale === 'ar' ? 'العضو' : 'Linked Member'}</label>
                <div style={{ padding: '8px 12px', background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 'var(--rs)', fontSize: 13, color: 'var(--t2)' }}>
                  {identity.member_id ? [identity.first_name, identity.middle_name, identity.last_name].filter(Boolean).join(' ') : (locale === 'ar' ? 'غير مربوط' : 'Not linked')}
                </div>
              </div>
              <div className='fg' style={{ gridColumn: '1 / -1' }}><label>{locale === 'ar' ? 'ملاحظات' : 'Notes'}</label><textarea className='fi' value={form.notes || ''} onChange={sf('notes')} /></div>
            </div>
          )}

          {editTab === 'templates' && (
            <div>
              <div className='ac-note'>
                {locale === 'ar'
                  ? 'يتم تسجيل البصمة عبر قراءة الإصبع 3 مرات على جهاز ZKTeco ثم دمج القراءات في قالب واحد موحد. استخدم زر "تسجيل بصمة" في الأعلى لبدء عملية التسجيل.'
                  : 'Fingerprints are enrolled by scanning the finger 3 times on the ZK4500 reader, then merging the 3 scans into a single unified template. Use the "Enroll Fingerprint" button above to start.'}
              </div>
              {templates.length === 0
                ? <div className='empty'><h3>{locale === 'ar' ? 'لا توجد بصمات مسجلة' : 'No fingerprints enrolled yet'}</h3>
                    <button className='btn btn-p btn-sm' style={{ marginTop: 8 }} onClick={() => onEnroll(identity)}>{locale === 'ar' ? 'تسجيل بصمة' : 'Enroll Fingerprint'}</button>
                  </div>
                : <table>
                    <thead><tr>
                      <th>#</th>
                      <th>{locale === 'ar' ? 'المصدر' : 'Source'}</th>
                      <th>{locale === 'ar' ? 'مدمج' : 'Merged'}</th>
                      <th>{locale === 'ar' ? 'الحجم' : 'Size'}</th>
                      <th>{locale === 'ar' ? 'الجودة' : 'Quality'}</th>
                      <th>{locale === 'ar' ? 'التاريخ' : 'Date'}</th>
                    </tr></thead>
                    <tbody>
                      {templates.map((t, i) => (
                        <tr key={t.id}>
                          <td>{i + 1}</td>
                          <td>{t.source}</td>
                          <td>{t.is_merged ? <Ic name='check' size={14} /> : '—'}</td>
                          <td>{t.template_size || 0} bytes</td>
                          <td>{t.quality || 0}</td>
                          <td style={{ fontSize: 12, color: 'var(--t3)' }}>{formatDateTime(t.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
              }
            </div>
          )}

          {editTab === 'history' && (
            <div>
              {events.length === 0
                ? <div className='empty'><h3>{locale === 'ar' ? 'لا يوجد سجل دخول' : 'No access history'}</h3></div>
                : <table>
                    <thead><tr>
                      <th>{locale === 'ar' ? 'الوقت' : 'Time'}</th>
                      <th>{locale === 'ar' ? 'النوع' : 'Type'}</th>
                      <th>{locale === 'ar' ? 'الاتجاه' : 'Direction'}</th>
                      <th>{locale === 'ar' ? 'النتيجة' : 'Result'}</th>
                      <th>{locale === 'ar' ? 'السكور' : 'Score'}</th>
                      <th>{locale === 'ar' ? 'الرسالة' : 'Message'}</th>
                    </tr></thead>
                    <tbody>
                      {events.map(e => (
                        <tr key={e.id}>
                          <td style={{ fontSize: 12, color: 'var(--t3)' }}>{formatDateTime(e.created_at)}</td>
                          <td>{e.event_type}</td>
                          <td>{e.direction}</td>
                          <td><SBadge state={e.result} /></td>
                          <td>{e.score || 0}</td>
                          <td style={{ fontSize: 12 }}>{e.message || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
              }
            </div>
          )}
        </div>
      </div>
    );
  }

  function IdentitiesSection({ onEnroll }) {
    const { locale } = useI18n();
    const [view, setView] = useState('list');
    const [sel, setSel] = useState(null);
    const [showNew, setShowNew] = useState(false);
    const [statusF, setStatusF] = useState('');
    const [search, setSearch] = useState('');
    const [items, loading,, reload] = useLoad('/api/access-control/identities', [], []);

    const filtered = useMemo(() => {
      let r = items;
      if (statusF) r = r.filter(i => i.status === statusF);
      if (search) r = r.filter(i => (i.display_name + (i.code || '') + (i.member_no || '')).toLowerCase().includes(search.toLowerCase()));
      return r;
    }, [items, statusF, search]);

    const newFields = [
      { key: 'display_name', label: 'Display Name', labelAr: 'الاسم' },
      { key: 'code', label: 'Code (optional)', labelAr: 'الكود (اختياري)' },
      { key: 'notes', label: 'Notes', labelAr: 'ملاحظات', type: 'textarea' },
    ];

    const saveNew = async (form) => {
      await api.post('/api/access-control/identities', form);
      toast(locale === 'ar' ? 'تم إنشاء الهوية' : 'Identity created');
      setShowNew(false);
      reload();
    };

    if (view === 'detail' && sel) {
      return <IdentityDetail identity={sel} onClose={() => { setView('list'); setSel(null); }} onRefresh={() => { reload(); setView('list'); setSel(null); }} onEnroll={onEnroll} />;
    }

    const cols = [
      { key: 'code', label: 'Code', ar: 'الكود' },
      { key: 'display_name', label: 'Name', ar: 'الاسم' },
      { key: 'member_no', label: 'Member', ar: 'العضو', render: (r) => r.member_no || '—' },
      { key: 'template_count', label: 'Templates', ar: 'البصمات', render: (r) => <span>{(r.template_count || 0)} <Ic name='hand' size={14} /></span> },
      { key: 'status', label: 'Status', ar: 'الحالة', render: r => <SBadge state={r.status} /> },
    ];

    return (
      <div className='pb'>
        <div className='ac-bar'>
          <div className='fb' style={{ margin: 0 }}>
            <input className='fi' style={{ minWidth: 200 }} value={search} onChange={e => setSearch(e.target.value)} placeholder={locale === 'ar' ? 'بحث...' : 'Search...'} />
            <select className='fi' style={{ minWidth: 140 }} value={statusF} onChange={e => setStatusF(e.target.value)}>
              <option value=''>{locale === 'ar' ? 'كل الحالات' : 'All Statuses'}</option>
              {[['active', 'نشط'], ['inactive', 'غير نشط'], ['suspended', 'موقوف']].map(([v, a]) => (
                <option key={v} value={v}>{locale === 'ar' ? a : v.charAt(0).toUpperCase() + v.slice(1)}</option>
              ))}
            </select>
          </div>
          <div className='ac-bar-right'>
            <button className='btn btn-p' onClick={() => setShowNew(true)}>
              <Ic name='plus' size={14} /> {locale === 'ar' ? 'هوية جديدة' : 'New Identity'}
            </button>
          </div>
        </div>
        <Tbl rows={filtered} cols={cols} loading={loading}
          onRow={r => { setSel(r); setView('detail'); }}
          emptyLabel={locale === 'ar' ? 'لا توجد هويات' : 'No identities found'}
          emptyAction={locale === 'ar' ? 'هوية جديدة' : 'New Identity'} onEmptyAction={() => setShowNew(true)} />
        {showNew && <FormModal title={locale === 'ar' ? 'هوية دخول جديدة' : 'New Access Identity'} fields={newFields} initial={{}} onClose={() => setShowNew(false)} onSave={saveNew} />}
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════
  // ENROLLMENT SECTION — 3 scan + merge workflow
  // ══════════════════════════════════════════════════════════
  function EnrollmentSection() {
    const { locale, formatDateTime } = useI18n();
    const [identities] = useLoad('/api/access-control/identities', [], []);
    const [selectedId, setSelectedId] = useState('');
    const [session, setSession] = useState(null);
    const [busy, setBusy] = useState(false);
    const [search, setSearch] = useState('');

    const filtered = useMemo(() => {
      if (!search) return identities;
      return identities.filter(i => (i.display_name + (i.code || '') + (i.member_no || '')).toLowerCase().includes(search.toLowerCase()));
    }, [identities, search]);

    const startEnroll = async (identityId) => {
      if (!identityId) return;
      try {
        setBusy(true);
        const r = await api.post(`/api/access-control/identities/${identityId}/enroll/start`, {});
        setSession({ ...r.data, scans: 0, lastQuality: 0 });
        setSelectedId(identityId);
      } catch (e) { toast(e.message, 'e'); }
      finally { setBusy(false); }
    };

    const capture = async () => {
      if (!session) return;
      try {
        setBusy(true);
        const r = await api.post(`/api/access-control/enroll/${session.sessionKey}/capture`, {});
        setSession(p => ({ ...p, scans: r.data.captured, lastQuality: r.data.quality }));
        toast(locale === 'ar' ? `تم التقاط البصمة رقم ${r.data.captured}` : `Scan ${r.data.captured} captured (quality: ${r.data.quality})`);
      } catch (e) { toast(e.message, 'e'); }
      finally { setBusy(false); }
    };

    const merge = async () => {
      if (!session) return;
      try {
        setBusy(true);
        await api.post(`/api/access-control/enroll/${session.sessionKey}/merge`, {});
        toast(locale === 'ar' ? 'تم حفظ البصمة بنجاح' : 'Fingerprint enrolled successfully!');
        setSession(null);
        setSelectedId('');
      } catch (e) { toast(e.message, 'e'); }
      finally { setBusy(false); }
    };

    const scans = session?.scans || 0;

    return (
      <div className='pb'>
        <div className='ac-note'>
          {locale === 'ar'
            ? 'عملية تسجيل البصمة: 1) اختر الهوية 2) ضع الإصبع على قارئ ZKTeco ثلاث مرات 3) اضغط دمج وحفظ. يتم دمج 3 قراءات في قالب واحد موحد عبر ZKTeco SDK.'
            : 'Enrollment workflow: 1) Select identity 2) Place finger on ZK4500 reader three times 3) Click Merge & Save. Three scans are merged into one unified template via ZKTeco zkfp SDK.'}
        </div>

        {!session ? (
          <div className='card'>
            <div className='ct'>{locale === 'ar' ? 'اختر هوية للتسجيل' : 'Select Identity to Enroll'}</div>
            <div style={{ padding: '12px 0' }}>
              <input className='fi' value={search} onChange={e => setSearch(e.target.value)} placeholder={locale === 'ar' ? 'بحث عن هوية...' : 'Search identities...'} style={{ marginBottom: 12 }} />
              {filtered.length === 0
                ? <div className='empty'><h3>{locale === 'ar' ? 'لا توجد هويات' : 'No identities found'}</h3></div>
                : <div className='mkt-list'>
                    {filtered.map(i => (
                      <div className='mkt-row' key={i.id}>
                        <div>
                          <div className='mkt-row-title'>{i.display_name}</div>
                          <div className='mkt-row-sub'>{i.code || '—'} · {i.member_no || (locale === 'ar' ? 'غير مربوط' : 'not linked')} · {i.template_count || 0} {locale === 'ar' ? 'بصمة' : 'template(s)'}</div>
                        </div>
                        <div className='mkt-actions'>
                          <button className='btn btn-p btn-sm' onClick={() => startEnroll(i.id)} disabled={busy}>{locale === 'ar' ? 'بدء التسجيل' : 'Start Enroll'}</button>
                        </div>
                      </div>
                    ))}
                  </div>
              }
            </div>
          </div>
        ) : (
          <div className='card'>
            <div className='ac-form-hdr'>
              <h2>{locale === 'ar' ? 'تسجيل بصمة' : 'Fingerprint Enrollment'} — {session.identity?.display_name || ''}</h2>
              <div className='ac-form-acts'>
                <button className='btn btn-s' onClick={() => { setSession(null); setSelectedId(''); }}>{locale === 'ar' ? 'إلغاء' : 'Cancel'}</button>
              </div>
            </div>
            <div style={{ padding: 18 }}>
              <div className='dg' style={{ marginBottom: 16 }}>
                <div className='di'><div className='dl'>{locale === 'ar' ? 'الجلسة' : 'Session'}</div><div className='dv' style={{ fontFamily: 'monospace', fontSize: 12 }}>{session.sessionKey?.slice(0, 12)}...</div></div>
                <div className='di'><div className='dl'>{locale === 'ar' ? 'الهوية' : 'Identity'}</div><div className='dv'>{session.identity?.display_name || '—'}</div></div>
              </div>

              {/* 3-scan progress indicator */}
              <div className='ac-scan-progress'>
                {[1, 2, 3].map((n, idx) => (
                  <React.Fragment key={n}>
                    {idx > 0 && <div className={`ac-scan-line ${scans >= n ? 'done' : ''}`} />}
                    <div className={`ac-scan-dot ${scans >= n ? 'done' : (scans === n - 1 ? 'active' : '')}`}>
                      {scans >= n ? <Ic name='check' size={14} /> : n}
                    </div>
                  </React.Fragment>
                ))}
              </div>

              <div style={{ textAlign: 'center', margin: '16px 0' }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--t1)', marginBottom: 4 }}>
                  {scans >= 3
                    ? (locale === 'ar' ? 'تم جمع 3 قراءات — جاهز للدمج' : 'All 3 scans collected — ready to merge')
                    : (locale === 'ar' ? `ضع الإصبع على القارئ — القراءة ${scans + 1} من 3` : `Place finger on reader — Scan ${scans + 1} of 3`)}
                </div>
                {session.lastQuality > 0 && <div style={{ fontSize: 12, color: 'var(--t3)' }}>
                  {locale === 'ar' ? `آخر جودة: ${session.lastQuality}` : `Last quality: ${session.lastQuality}`}
                </div>}
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 16 }}>
                <button className='btn btn-p' onClick={capture} disabled={busy || scans >= 3} style={{ minWidth: 160 }}>
                  {busy ? <span className='spinner' /> : <Ic name='scan-line' size={14} />}
                  {locale === 'ar' ? 'التقاط قراءة' : 'Capture Scan'}
                </button>
                <button className='btn btn-g' onClick={merge} disabled={busy || scans < 3} style={{ minWidth: 160 }}>
                  {locale === 'ar' ? 'دمج وحفظ' : 'Merge & Save'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════
  // LIVE VERIFY SECTION
  // ══════════════════════════════════════════════════════════
  function LiveVerifySection() {
    const { locale, formatDateTime } = useI18n();
    const [busy, setBusy] = useState(false);
    const [result, setResult] = useState(null);
    const [history, setHistory] = useState([]);

    const verify = async () => {
      setBusy(true);
      setResult(null);
      try {
        const r = await api.post('/api/access-control/verify-and-open', {});
        setResult(r.data);
        setHistory(p => [{ ...r.data, ts: new Date().toISOString() }, ...p].slice(0, 20));
      } catch (e) { toast(e.message, 'e'); }
      finally { setBusy(false); }
    };

    return (
      <div className='pb'>
        <div className='ac-note'>
          {locale === 'ar'
            ? 'التحقق الحي: يلتقط بصمة من القارئ ويقارنها مع جميع القوالب المسجلة. إذا تطابقت ونجح التحقق من الاشتراك، يتم فتح البوابة وتسجيل الحضور.'
            : 'Live verification: captures a fingerprint from the reader and matches against all enrolled templates. If matched and membership is valid, the gate opens and attendance is logged.'}
        </div>

        <div style={{ textAlign: 'center', padding: '24px 0' }}>
          <button className='btn btn-g' onClick={verify} disabled={busy} style={{ minWidth: 240, padding: '14px 28px', fontSize: 16 }}>
            {busy ? <span className='spinner' /> : <Ic name='scan-line' size={18} />}
            {locale === 'ar' ? 'تحقق وافتح البوابة' : 'Verify & Open Gate'}
          </button>
        </div>

        {result && (
          <div className={`ac-verify-result ${result.allowed ? 'granted' : 'denied'}`}>
            <div className='ac-verify-icon'>{result.allowed ? <Ic name='check' size={40} /> : <Ic name='x' size={40} />}</div>
            <div className='ac-verify-name'>
              {result.identity?.display_name || (locale === 'ar' ? 'غير معروف' : 'Unknown')}
            </div>
            <div className='ac-verify-sub'>
              {result.matched
                ? (result.allowed
                    ? (locale === 'ar' ? `تم السماح بالدخول — سكور: ${result.score}` : `Access granted — Score: ${result.score}`)
                    : (locale === 'ar' ? `${result.reason || 'مرفوض'} — سكور: ${result.score}` : `${result.reason || 'Denied'} — Score: ${result.score}`))
                : (locale === 'ar' ? 'لم يتم العثور على تطابق' : 'No fingerprint match found')}
            </div>
            {result.attendance && result.attendance.success && (
              <div style={{ marginTop: 8, fontSize: 12, color: 'var(--t3)' }}>
                {locale === 'ar' ? 'تم تسجيل الحضور تلقائياً' : 'Attendance logged automatically'}
              </div>
            )}
          </div>
        )}

        {history.length > 0 && (
          <div className='card' style={{ marginTop: 14 }}>
            <div className='ct'>{locale === 'ar' ? 'سجل هذه الجلسة' : 'Session History'}</div>
            <table>
              <thead><tr>
                <th>{locale === 'ar' ? 'الوقت' : 'Time'}</th>
                <th>{locale === 'ar' ? 'الهوية' : 'Identity'}</th>
                <th>{locale === 'ar' ? 'النتيجة' : 'Result'}</th>
                <th>{locale === 'ar' ? 'السكور' : 'Score'}</th>
                <th>{locale === 'ar' ? 'السبب' : 'Reason'}</th>
              </tr></thead>
              <tbody>
                {history.map((h, i) => (
                  <tr key={i}>
                    <td style={{ fontSize: 12, color: 'var(--t3)' }}>{formatDateTime(h.ts)}</td>
                    <td>{h.identity?.display_name || '—'}</td>
                    <td><SBadge state={h.allowed ? 'granted' : 'denied'} /></td>
                    <td>{h.score || 0}</td>
                    <td style={{ fontSize: 12 }}>{h.reason || (h.allowed ? (locale === 'ar' ? 'مسموح' : 'Granted') : '—')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════
  // MEMBER LINKING SECTION
  // ══════════════════════════════════════════════════════════
  function MemberLinkSection({ onEnroll }) {
    const { locale } = useI18n();
    const [search, setSearch] = useState('');
    const [results, setResults] = useState([]);
    const [searching, setSearching] = useState(false);

    useEffect(() => {
      if (!search || search.length < 2) { setResults([]); return; }
      const tm = setTimeout(() => {
        setSearching(true);
        api.get('/api/access-control/members/search?q=' + encodeURIComponent(search))
          .then(r => setResults(r.data || []))
          .catch(() => setResults([]))
          .finally(() => setSearching(false));
      }, 300);
      return () => clearTimeout(tm);
    }, [search]);

    const bootstrap = async (memberId) => {
      try {
        const r = await api.post(`/api/access-control/members/${memberId}/bootstrap-identity`, {});
        toast(locale === 'ar' ? 'تم إنشاء هوية الدخول' : 'Access identity created');
        setSearch('');
        setResults([]);
        if (r.data) onEnroll(r.data);
      } catch (e) { toast(e.message, 'e'); }
    };

    return (
      <div className='pb'>
        <div className='ac-note'>
          {locale === 'ar'
            ? 'ابحث عن عضو لربطه بهوية دخول. إذا لم يكن لديه هوية، سيتم إنشاء واحدة تلقائياً. يمكنك بعدها تسجيل بصمته مباشرة.'
            : 'Search for a member to link them to an access identity. If they don\'t have one, it will be created automatically. You can then enroll their fingerprint directly.'}
        </div>

        <div className='card'>
          <div className='ct'>{locale === 'ar' ? 'بحث عن عضو' : 'Search Members'}</div>
          <div style={{ padding: '12px 0' }}>
            <input className='fi' value={search} onChange={e => setSearch(e.target.value)}
              placeholder={locale === 'ar' ? 'بحث بالاسم، الهاتف، أو رقم العضوية...' : 'Search by name, phone, or member number...'} />
          </div>
          {searching && <div className='pld'><span className='spinner' /></div>}
          {results.length > 0 && (
            <div className='mkt-list'>
              {results.map(m => (
                <div className='mkt-row' key={m.id}>
                  <div>
                    <div className='mkt-row-title'>{[m.first_name, m.middle_name, m.last_name].filter(Boolean).join(' ')}</div>
                    <div className='mkt-row-sub'>
                      {m.member_no || '—'} · {m.plan_name || (locale === 'ar' ? 'بدون اشتراك' : 'No plan')}
                      {m.end_date ? ` · ${locale === 'ar' ? 'حتى' : 'until'} ${m.end_date}` : ''}
                      {m.access_identity_id ? ` · ✓ ${locale === 'ar' ? 'لديه هوية دخول' : 'Has identity'}` : ''}
                    </div>
                  </div>
                  <div className='mkt-actions'>
                    <button className='btn btn-p btn-sm' onClick={() => bootstrap(m.id)}>
                      {m.access_identity_id ? (locale === 'ar' ? 'تسجيل بصمة' : 'Enroll') : (locale === 'ar' ? 'ربط وتسجيل' : 'Link & Enroll')}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {search.length >= 2 && !searching && results.length === 0 && (
            <div className='empty'><h3>{locale === 'ar' ? 'لم يتم العثور على نتائج' : 'No results found'}</h3></div>
          )}
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════
  // EVENTS / LOG SECTION
  // ══════════════════════════════════════════════════════════
  function EventsSection() {
    const { locale, formatDateTime } = useI18n();
    const [events, loading,, reload] = useLoad('/api/access-control/events', [], []);
    const [filterResult, setFilterResult] = useState('');
    const [search, setSearch] = useState('');

    const filtered = useMemo(() => {
      let r = events;
      if (filterResult) r = r.filter(e => e.result === filterResult);
      if (search) r = r.filter(e => ((e.display_name || '') + (e.first_name || '') + (e.last_name || '') + (e.message || '')).toLowerCase().includes(search.toLowerCase()));
      return r;
    }, [events, filterResult, search]);

    const cols = [
      { key: 'created_at', label: 'Time', ar: 'الوقت', render: (r) => <span style={{ fontSize: 12, color: 'var(--t3)' }}>{formatDateTime(r.created_at)}</span> },
      { key: 'display_name', label: 'Identity', ar: 'الهوية', render: r => r.display_name || [r.first_name, r.middle_name, r.last_name].filter(Boolean).join(' ') || '—' },
      { key: 'event_type', label: 'Type', ar: 'النوع' },
      { key: 'direction', label: 'Direction', ar: 'الاتجاه' },
      { key: 'result', label: 'Result', ar: 'النتيجة', render: r => <SBadge state={r.result} /> },
      { key: 'score', label: 'Score', ar: 'السكور', render: r => r.score || 0 },
      { key: 'message', label: 'Message', ar: 'الرسالة', render: r => <span style={{ fontSize: 12 }}>{r.message || '—'}</span> },
    ];

    return (
      <div className='pb'>
        <div className='ac-bar'>
          <div className='fb' style={{ margin: 0 }}>
            <input className='fi' style={{ minWidth: 200 }} value={search} onChange={e => setSearch(e.target.value)} placeholder={locale === 'ar' ? 'بحث...' : 'Search...'} />
            <select className='fi' style={{ minWidth: 140 }} value={filterResult} onChange={e => setFilterResult(e.target.value)}>
              <option value=''>{locale === 'ar' ? 'كل النتائج' : 'All Results'}</option>
              <option value='granted'>{locale === 'ar' ? 'مسموح' : 'Granted'}</option>
              <option value='denied'>{locale === 'ar' ? 'مرفوض' : 'Denied'}</option>
            </select>
          </div>
          <button className='btn btn-s' onClick={reload}><Ic name='refresh-cw' size={14} /> {locale === 'ar' ? 'تحديث' : 'Refresh'}</button>
        </div>
        <Tbl rows={filtered} cols={cols} loading={loading}
          emptyLabel={locale === 'ar' ? 'لا يوجد سجل حتى الآن' : 'No access events yet'} />
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════
  // FACE ENROLLMENT — map member ↔ face-terminal ID
  // ══════════════════════════════════════════════════════════
  function FaceEnrollSection() {
    const { locale } = useI18n(); const ar = locale === 'ar';
    const [q, setQ] = useState(''); const [results, setResults] = useState([]);
    const [sel, setSel] = useState(null); const [code, setCode] = useState(''); const [saving, setSaving] = useState(false);
    const [enrolled, loadingE, , reloadE] = useLoad('/api/access-control/face/enrolled', [], []);
    const nameOf = (m) => [m.first_name, m.middle_name, m.last_name].filter(Boolean).join(' ') || m.member_no || ('#' + m.id);
    const search = async (v) => { setQ(v); if (v.trim().length < 2) { setResults([]); return; } try { const r = await api.get('/api/access-control/members/search?q=' + encodeURIComponent(v)); setResults(r.data || []); } catch (_) {} };
    const pick = (m) => { setSel(m); setResults([]); setQ(''); const ex = (enrolled || []).find(e => e.member_id === m.id); setCode(ex ? ex.code : ''); };
    const auto = async () => { try { const r = await api.get('/api/access-control/face/next-id'); setCode(r.data.code); } catch (_) {} };
    const save = async () => { if (!sel || !code) return; setSaving(true); try { await api.post('/api/access-control/face/assign', { memberId: sel.id, code }); toast(ar ? 'تم حفظ معرّف الوجه' : 'Face ID saved'); reloadE(); setSel(null); setCode(''); } catch (e) { toast(e.message, 'e'); } finally { setSaving(false); } };
    const cols = [
      { key: 'code', label: 'Face ID', ar: 'معرّف الوجه', render: r => <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{r.code}</span> },
      { key: 'display_name', label: 'Member', ar: 'العضو', render: r => r.display_name || ('#' + r.member_id) },
      { key: 'member_no', label: 'No', ar: 'الرقم', render: r => r.member_no || '—' },
      { key: 'plan_name', label: 'Plan', ar: 'الباقة', render: r => r.plan_name || '—' },
    ];
    return <div className='pb'>
      <div className='ac-note'>{ar
        ? 'سجّل وجه العضو على جهاز الوجه مقابل هذا الرقم. عند التعرّف يرسل الجهاز الرقم إلى اللوحة → يفتح الباب وتظهر بطاقة العضو تلقائياً.'
        : 'Enroll the member\'s face on the face terminal against this ID. On a match the terminal sends the ID to the panel → the door opens and the member card pops up.'}</div>
      <div style={{ maxWidth: 560 }}>
        <div className='fg' style={{ position: 'relative' }}>
          <label>{ar ? 'ابحث عن عضو' : 'Search member'}</label>
          <input className='fi' value={q} onChange={e => search(e.target.value)} placeholder={ar ? 'الاسم أو الرقم أو الهاتف...' : 'name / no / phone...'} />
          {results.length > 0 && <div style={{ position: 'absolute', top: '100%', insetInline: 0, background: '#fff', border: '1px solid var(--o-border,#e5e5e5)', borderRadius: 8, zIndex: 5, maxHeight: 240, overflowY: 'auto', boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}>
            {results.map(m => <div key={m.id} onClick={() => pick(m)} style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9' }}>
              <div style={{ fontWeight: 600 }}>{nameOf(m)}</div>
              <div style={{ fontSize: 12, color: 'var(--t3)' }}>#{m.member_no}{m.plan_name ? ' · ' + m.plan_name : ''}{m.access_identity_id ? (ar ? ' · مسجّل' : ' · enrolled') : ''}</div>
            </div>)}
          </div>}
        </div>
        {sel && <div className='fg' style={{ background: 'var(--o-bg-light,#f6f4f7)', padding: 14, borderRadius: 12 }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>{nameOf(sel)} <span style={{ fontSize: 12, color: 'var(--t3)' }}>#{sel.member_no}</span></div>
          <label>{ar ? 'معرّف الوجه (رقم)' : 'Face ID (number)'}</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input className='fi' value={code} onChange={e => setCode(e.target.value.replace(/[^0-9]/g, ''))} placeholder='1001' style={{ flex: 1 }} />
            <button className='btn btn-s' onClick={auto}>{ar ? 'توليد' : 'Auto'}</button>
            <button className='btn btn-p' onClick={save} disabled={saving || !code}>{saving ? '...' : (ar ? 'حفظ' : 'Save')}</button>
          </div>
          <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 6 }}>{ar ? 'رقم بين 1 و 16,777,215 (Wiegand-26) — نفس الرقم يُسجَّل على الجهاز.' : '1..16,777,215 (Wiegand-26) — enroll the same number on the terminal.'}</div>
        </div>}
      </div>
      <h3 style={{ margin: '18px 0 8px', fontSize: 15 }}>{ar ? 'الأعضاء المسجّلون' : 'Enrolled members'}</h3>
      <Tbl rows={enrolled || []} cols={cols} loading={loadingE} emptyLabel={ar ? 'لا يوجد أعضاء مسجّلون بعد' : 'No enrolled members yet'} />
    </div>;
  }

  // ══════════════════════════════════════════════════════════
  // CHECK-INS SECTION (C3 turnstile log)
  // ══════════════════════════════════════════════════════════
  function CheckInsSection() {
    const { locale, formatDateTime } = useI18n();
    const ar = locale === 'ar';
    const [rows, loading,, reload] = useLoad('/api/access-control/check-ins', [], []);
    const [st,, , reloadSt] = useLoad('/api/access-control/c3/status', [], null);
    const [filter, setFilter] = useState('');
    const [search, setSearch] = useState('');

    const filtered = useMemo(() => {
      let r = rows;
      if (filter === 'allowed') r = r.filter(x => x.allowed);
      else if (filter === 'denied') r = r.filter(x => !x.allowed);
      if (search) { const q = search.toLowerCase(); r = r.filter(x => ((x.member_name || '') + (x.card_no || '') + (x.reason || '')).toLowerCase().includes(q)); }
      return r;
    }, [rows, filter, search]);

    const cols = [
      { key: 'scanned_at', label: 'Time', ar: 'الوقت', render: r => <span style={{ fontSize: 12, color: 'var(--t3)' }}>{formatDateTime(r.scanned_at)}</span> },
      { key: 'member_name', label: 'Member', ar: 'العضو', render: r => r.member_name || (r.member_id ? '#' + r.member_id : '—') },
      { key: 'card_no', label: 'Card', ar: 'البطاقة', render: r => <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{r.card_no || '—'}</span> },
      { key: 'door_no', label: 'Door', ar: 'الباب', render: r => r.door_no || 1 },
      { key: 'allowed', label: 'Result', ar: 'النتيجة', render: r => <SBadge state={r.allowed ? 'granted' : 'denied'} /> },
      { key: 'reason', label: 'Reason', ar: 'السبب', render: r => <span style={{ fontSize: 12 }}>{r.reason || '—'}</span> },
    ];

    const refreshAll = () => { reload(); reloadSt(); };
    const panelOnline = st && st.panel && !st.panel.error;

    return (
      <div className='pb'>
        {/* Bridge status strip */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
          <span className={`ac-pill ${st?.enabled ? 'ac-pill-green' : 'ac-pill-red'}`}>{st?.enabled ? (ar ? 'الجسر مُفعّل' : 'Bridge ON') : (ar ? 'الجسر متوقف' : 'Bridge OFF')}</span>
          <span className={`ac-pill ${panelOnline ? 'ac-pill-green' : 'ac-pill-red'}`}>{panelOnline ? (ar ? 'اللوحة متصلة' : 'Panel online') : (ar ? 'اللوحة غير متصلة' : 'Panel offline')}</span>
          <span className='ac-pill'>{(ar ? 'قائمة السماح: ' : 'Allowlist: ') + (st?.allowlistCount ?? '—')}</span>
          <span className='ac-pill'>{(ar ? 'أعضاء نشطون: ' : 'Active: ') + (st?.activeMembers ?? '—')}</span>
          {st && !st.secretConfigured && <span className='ac-pill ac-pill-red'>{ar ? 'لم يُضبط سر QR' : 'QR secret not set'}</span>}
          <div style={{ flex: 1 }} />
          <span style={{ fontSize: 12, color: 'var(--t3)' }}>{ar ? 'معاينة النافذة:' : 'Preview popup:'}</span>
          {[['active', ar ? 'فعّال' : 'Active'], ['debt', ar ? 'ذمة' : 'Debt'], ['blocked', ar ? 'منع' : 'Blocked'], ['expired', ar ? 'منتهي' : 'Expired'], ['unknown', ar ? 'غير معروف' : 'Unknown']].map(([s, lbl]) => (
            <button key={s} className='btn btn-s' style={{ padding: '3px 10px', fontSize: 12 }}
              onClick={() => api.post('/api/access-control/checkin/test-popup', { state: s }).catch(() => {})}>{lbl}</button>
          ))}
        </div>
        <div className='ac-bar'>
          <div className='fb' style={{ margin: 0 }}>
            <input className='fi' style={{ minWidth: 200 }} value={search} onChange={e => setSearch(e.target.value)} placeholder={ar ? 'بحث بالاسم/البطاقة...' : 'Search name / card...'} />
            <select className='fi' style={{ minWidth: 140 }} value={filter} onChange={e => setFilter(e.target.value)}>
              <option value=''>{ar ? 'الكل' : 'All'}</option>
              <option value='allowed'>{ar ? 'مسموح' : 'Allowed'}</option>
              <option value='denied'>{ar ? 'مرفوض' : 'Denied'}</option>
            </select>
          </div>
          <button className='btn btn-s' onClick={refreshAll}><Ic name='refresh-cw' size={14} /> {ar ? 'تحديث' : 'Refresh'}</button>
        </div>
        <Tbl rows={filtered} cols={cols} loading={loading}
          emptyLabel={ar ? 'لا توجد عمليات دخول عبر البوابة بعد' : 'No turnstile check-ins yet'} />
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════
  // DEVICES SECTION
  // ══════════════════════════════════════════════════════════
  function DevicesSection() {
    const { locale, formatDateTime } = useI18n();
    const [status, loading] = useLoad('/api/access-control/status', [], null);
    const [devices, dLoading,, reloadDevices] = useLoad('/api/access-control/devices', [], []);
    const [showNew, setShowNew] = useState(false);

    const newFields = [
      { key: 'name', label: 'Device Name', labelAr: 'اسم الجهاز' },
      { key: 'device_type', label: 'Type', labelAr: 'النوع', type: 'select', options: [
        { value: 'fingerprint', label: 'ZK4500 Fingerprint Reader', labelAr: 'قارئ بصمة ZK4500' },
        { value: 'panel', label: 'C3-100 Access Panel', labelAr: 'لوحة تحكم C3-100' },
        { value: 'card', label: 'Card Reader', labelAr: 'قارئ بطاقة' },
      ]},
      { key: 'connection_type', label: 'Connection', labelAr: 'نوع الاتصال', type: 'select', options: [
        { value: 'bridge', label: 'USB Bridge', labelAr: 'جسر USB' },
        { value: 'network', label: 'Network/LAN', labelAr: 'شبكة' },
      ]},
      { key: 'bridge_url', label: 'Bridge URL', labelAr: 'رابط الجسر' },
      { key: 'gate_open_url', label: 'Gate Open URL', labelAr: 'رابط فتح البوابة' },
    ];

    const saveDevice = async (form) => {
      await api.post('/api/access-control/devices', form);
      toast(locale === 'ar' ? 'تم إضافة الجهاز' : 'Device added');
      setShowNew(false);
      reloadDevices();
    };

    return (
      <div className='pb'>
        <div className='ac-note'>
          {locale === 'ar'
            ? 'الأجهزة: قارئ البصمة ZKTeco ZK4500 (USB) يتصل عبر تطبيق FingerprintBridge. لوحة التحكم بالأبواب ZKTeco C3-100 (IP/TCP منفذ 4370) تتحكم بالقفل الكهربائي للباب.'
            : 'Hardware: ZKTeco ZK4500 USB fingerprint reader connects via FingerprintBridge app. ZKTeco C3-100 IP-based door access control panel (TCP port 4370) controls the electric door lock.'}
        </div>

        <div className='ac-bar'>
          <h3 style={{ margin: 0, fontSize: 14 }}>{locale === 'ar' ? 'الأجهزة المسجلة' : 'Registered Devices'}</h3>
          <button className='btn btn-p' onClick={() => setShowNew(true)}><Ic name='plus' size={14} /> {locale === 'ar' ? 'جهاز جديد' : 'New Device'}</button>
        </div>

        <div className='ac-device-card' style={{ marginBottom: 12 }}>
          <div className={`ac-device-dot ${status?.bridge?.connected ? 'online' : 'offline'}`} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 13 }}>ZKTeco ZK4500 Fingerprint Bridge</div>
            <div style={{ fontSize: 12, color: 'var(--t3)' }}>
              {status?.bridge?.connected
                ? `${locale === 'ar' ? 'متصل' : 'Connected'} · ${status?.bridge?.imageWidth || 0}x${status?.bridge?.imageHeight || 0}px`
                : (status?.bridge?.error || (locale === 'ar' ? 'غير متصل' : 'Disconnected'))}
            </div>
          </div>
          <span className={`ac-pill ${status?.bridge?.connected ? 'ac-pill-green' : 'ac-pill-red'}`}>
            {status?.bridge?.connected ? (locale === 'ar' ? 'متصل' : 'ONLINE') : (locale === 'ar' ? 'غير متصل' : 'OFFLINE')}
          </span>
        </div>

        {devices.length > 0 && devices.map(d => (
          <div className='ac-device-card' key={d.id} style={{ marginBottom: 8 }}>
            <div className={`ac-device-dot ${d.is_active ? 'online' : 'offline'}`} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{d.name}</div>
              <div style={{ fontSize: 12, color: 'var(--t3)' }}>
                {d.device_type} · {d.connection_type} {d.last_seen_at ? `· ${locale === 'ar' ? 'آخر اتصال' : 'Last seen'}: ${formatDateTime(d.last_seen_at)}` : ''}
              </div>
            </div>
          </div>
        ))}

        {showNew && <FormModal title={locale === 'ar' ? 'جهاز جديد' : 'New Device'} fields={newFields} initial={{ device_type: 'fingerprint', connection_type: 'bridge' }} onClose={() => setShowNew(false)} onSave={saveDevice} />}
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════
  // SETTINGS SECTION
  // ══════════════════════════════════════════════════════════
  function SettingsSection() {
    const { locale } = useI18n();
    const [settings, loading] = useLoad('/api/access-control/settings', [], null);
    const [form, setForm] = useState({});
    const [saving, setSaving] = useState(false);
    const [subTab, setSubTab] = useState('bridge');

    useEffect(() => {
      if (settings) setForm({ ...settings });
    }, [settings]);

    const sf = k => e => setForm(p => ({ ...p, [k]: e.target.value }));
    const sfn = k => e => setForm(p => ({ ...p, [k]: Number(e.target.value) }));

    const save = async () => {
      try {
        setSaving(true);
        await api.post('/api/access-control/settings', form);
        toast(locale === 'ar' ? 'تم حفظ الإعدادات' : 'Settings saved');
      } catch (e) { toast(e.message, 'e'); }
      finally { setSaving(false); }
    };

    if (loading || !settings) return <div className='pb'><div className='pld'><span className='spinner' /></div></div>;

    return (
      <div className='pb'>
        <div className='ac-form-hdr'>
          <h2>{locale === 'ar' ? 'إعدادات التحكم بالدخول' : 'Access Control Settings'}</h2>
          <button className='btn btn-p' onClick={save} disabled={saving}>{saving ? '...' : (locale === 'ar' ? 'حفظ الإعدادات' : 'Save Settings')}</button>
        </div>
        <div className='ac-form-body'>
          <div className='ac-sub-tabs'>
            {[['bridge', 'ZK4500 Bridge', 'جسر ZK4500'], ['gate', 'C3-100 Gate', 'بوابة C3-100'], ['checkin', 'Check-in & Debt', 'الدخول والذمم'], ['rules', 'Rules', 'القواعد']].map(([k, en, ar]) => (
              <button key={k} className={`ac-sub-tab ${subTab === k ? 'active' : ''}`} onClick={() => setSubTab(k)}>{locale === 'ar' ? ar : en}</button>
            ))}
          </div>

          {subTab === 'bridge' && (
            <div>
              <div className='ac-note'>
                {locale === 'ar'
                  ? 'قارئ البصمة ZKTeco ZK4500 يتصل عبر USB بجهاز Windows ويعمل من خلال تطبيق FingerprintBridge (.NET) على المنفذ 7001. يستخدم ZKTeco zkfp SDK لالتقاط البصمات ودمجها ومطابقتها.'
                  : 'The ZKTeco ZK4500 USB fingerprint reader connects to a Windows PC and is controlled via the FingerprintBridge (.NET) app on port 7001. It uses the ZKTeco zkfp SDK for capture, merge, and identification.'}
              </div>
              <div className='fr3'>
                <div className='fg'>
                  <label>{locale === 'ar' ? 'رابط الجسر (Bridge URL)' : 'ZK4500 Bridge URL'}</label>
                  <input className='fi' value={form.bridgeUrl || ''} onChange={sf('bridgeUrl')} placeholder='http://localhost:7001' />
                </div>
                <div className='fg'>
                  <label>{locale === 'ar' ? 'حد المطابقة (Score Threshold)' : 'Score Threshold'}</label>
                  <input className='fi' type='number' value={form.scoreThreshold || 45} onChange={sfn('scoreThreshold')} />
                </div>
              </div>
            </div>
          )}

          {subTab === 'gate' && (
            <div>
              <div className='ac-note'>
                {locale === 'ar'
                  ? 'لوحة التحكم ZKTeco C3-100: لوحة تحكم بالأبواب عبر الشبكة (IP). تتصل عبر TCP/IP على المنفذ 4370. تدعم باب واحد مع قفل كهربائي ومخرج مساعد. IP الافتراضي: 192.168.1.201.'
                  : 'ZKTeco C3-100: IP-based 1-door access control panel. Connects via TCP/IP on port 4370 (PULL SDK protocol). Supports 1 door with electric lock relay and auxiliary output. Default IP: 192.168.1.201.'}
              </div>
              <div className='fr3'>
                <div className='fg'>
                  <label>{locale === 'ar' ? 'مزود فتح البوابة' : 'Gate Provider'}</label>
                  <select className='fi' value={form.gateProvider || 'mock'} onChange={sf('gateProvider')}>
                    <option value='mock'>{locale === 'ar' ? 'تجريبي (Mock)' : 'Mock (no gate)'}</option>
                    <option value='c3-100'>{locale === 'ar' ? 'ZKTeco C3-100 (TCP مباشر)' : 'ZKTeco C3-100 (TCP Direct)'}</option>
                    <option value='webhook'>{locale === 'ar' ? 'ويب هوك (Webhook)' : 'Webhook (HTTP POST)'}</option>
                  </select>
                </div>
                {form.gateProvider === 'c3-100' && (
                  <React.Fragment>
                    <div className='fg'>
                      <label>{locale === 'ar' ? 'عنوان IP للوحة C3-100' : 'C3-100 Panel IP'}</label>
                      <input className='fi' value={form.c3PanelIp || ''} onChange={sf('c3PanelIp')} placeholder='192.168.1.201' />
                    </div>
                    <div className='fg'>
                      <label>{locale === 'ar' ? 'منفذ TCP' : 'TCP Port'}</label>
                      <input className='fi' type='number' value={form.c3PanelPort || 4370} onChange={sfn('c3PanelPort')} />
                    </div>
                    <div className='fg'>
                      <label>{locale === 'ar' ? 'رقم الباب' : 'Door Number'}</label>
                      <input className='fi' type='number' value={form.c3DoorNumber || 1} onChange={sfn('c3DoorNumber')} min='1' max='1' />
                    </div>
                    <div className='fg'>
                      <label>{locale === 'ar' ? 'مدة الفتح (ثوان)' : 'Open Duration (seconds)'}</label>
                      <input className='fi' type='number' value={form.c3OpenDuration || 5} onChange={sfn('c3OpenDuration')} min='1' max='254' />
                    </div>
                    <div className='fg'>
                      <label>{locale === 'ar' ? 'كلمة مرور اللوحة' : 'Panel Password'}</label>
                      <input className='fi' value={form.c3Password || ''} onChange={sf('c3Password')} type='password' placeholder={locale === 'ar' ? 'اختياري' : 'optional'} />
                    </div>

                    <div className='fg' style={{ gridColumn: '1 / -1', borderTop: '1px solid var(--o-border,#e5e5e5)', paddingTop: 12, marginTop: 4 }}>
                      <label style={{ fontWeight: 600 }}>{locale === 'ar' ? 'جسر خدمة C3 (البوابة الدوّارة)' : 'C3 Microservice Bridge (Turnstile)'}</label>
                      <div style={{ fontSize: 12, opacity: 0.7 }}>{locale === 'ar'
                        ? 'يوصل GymOS بخدمة Python التي تتحدث مع اللوحة. يتم التحقق من رمز QR الدوّار (HMAC) هنا؛ قائمة السماح هي احتياطي دون اتصال فقط.'
                        : 'Connects GymOS to the Python C3 service. Rotating QR tokens (HMAC) are validated here; the allowlist is offline fallback only.'}</div>
                    </div>
                    <div className='fg'>
                      <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 22, cursor: 'pointer' }}>
                        <input type='checkbox' checked={!!form.c3ServiceEnabled} onChange={e => setForm(p => ({ ...p, c3ServiceEnabled: e.target.checked }))} style={{ width: 15, height: 15 }} />
                        {locale === 'ar' ? 'تفعيل جسر البوابة الدوّارة' : 'Enable turnstile bridge'}
                      </label>
                    </div>
                    <div className='fg'>
                      <label>{locale === 'ar' ? 'رابط خدمة C3' : 'C3 Microservice URL'}</label>
                      <input className='fi' value={form.c3ServiceUrl || ''} onChange={sf('c3ServiceUrl')} placeholder='http://127.0.0.1:8081' />
                    </div>
                    <div className='fg'>
                      <label>{locale === 'ar' ? 'مفتاح API للخدمة' : 'Service API Key'}</label>
                      <input className='fi' value={form.c3ServiceKey || ''} onChange={sf('c3ServiceKey')} type='password'
                        placeholder={form.c3ServiceKeySet ? '•••••••• ' + (locale === 'ar' ? '(محفوظ — اتركه فارغاً للإبقاء)' : '(saved — leave blank to keep)') : (locale === 'ar' ? 'أدخل المفتاح' : 'enter key')} />
                    </div>
                    <div className='fg'>
                      <label>{locale === 'ar' ? 'سر توقيع رمز QR (HMAC)' : 'QR Token HMAC Secret'}</label>
                      <input className='fi' value={form.c3TokenSecret || ''} onChange={sf('c3TokenSecret')} type='password'
                        placeholder={form.c3TokenSecretSet ? '•••••••• ' + (locale === 'ar' ? '(محفوظ — اتركه فارغاً للإبقاء)' : '(saved — leave blank to keep)') : (locale === 'ar' ? 'يجب أن يطابق تطبيق العضو' : 'must match member app')} />
                    </div>
                    <div className='fg'>
                      <label>{locale === 'ar' ? 'ترميز رمز QR' : 'QR Encoding'}</label>
                      <select className='fi' value={form.c3QrMode || 'code24'} onChange={sf('c3QrMode')}>
                        <option value='code24'>{locale === 'ar' ? 'رقم 24-بت (قارئ Wiegand)' : '24-bit number (Wiegand reader)'}</option>
                        <option value='token'>{locale === 'ar' ? 'رمز كامل (قارئ HTTP)' : 'Full token (HTTP reader)'}</option>
                      </select>
                      <div style={{ fontSize: 11, opacity: 0.65 }}>{locale === 'ar'
                        ? 'Wiegand: القارئ يرسل رقماً للوحة. HTTP: القارئ يرسل النص الكامل للخادم.'
                        : 'Wiegand: reader emits a number to the panel. HTTP: reader posts the full string to the ERP.'}</div>
                    </div>
                  </React.Fragment>
                )}
                {form.gateProvider === 'webhook' && (
                  <React.Fragment>
                    <div className='fg'>
                      <label>{locale === 'ar' ? 'رابط فتح البوابة' : 'Gate Open URL'}</label>
                      <input className='fi' value={form.gateOpenUrl || ''} onChange={sf('gateOpenUrl')} placeholder='https://...' />
                    </div>
                    <div className='fg'>
                      <label>{locale === 'ar' ? 'سر البوابة (Gate Secret)' : 'Gate Secret'}</label>
                      <input className='fi' value={form.gateSecret || ''} onChange={sf('gateSecret')} type='password' />
                    </div>
                  </React.Fragment>
                )}
              </div>
            </div>
          )}

          {subTab === 'checkin' && (
            <div>
              <div className='ac-note'>
                {locale === 'ar'
                  ? 'عند مسح العضو على البوابة تظهر بطاقته على شاشة الاستقبال (نافذة منبثقة). الخادم هو من يقرر السماح أو المنع؛ الشاشة تعرض القرار فقط.'
                  : 'When a member scans at the turnstile their card pops up on the reception screen. The SERVER decides allow/deny; the popup only renders the decision.'}
              </div>
              <div className='fg'>
                <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4, cursor: 'pointer' }}>
                  <input type='checkbox' checked={form.checkinPopupEnabled !== false} onChange={e => setForm(p => ({ ...p, checkinPopupEnabled: e.target.checked }))} style={{ width: 15, height: 15 }} />
                  {locale === 'ar' ? 'تفعيل نافذة الاستقبال المنبثقة' : 'Enable reception check-in popup'}
                </label>
              </div>

              <h3 style={{ margin: '18px 0 4px', fontSize: 15 }}>{locale === 'ar' ? 'سياسة الذمم المالية' : 'Debt Policy'}</h3>
              <div className='ac-note'>
                {locale === 'ar'
                  ? 'التنبيه والمنع سياستان منفصلتان. المنتهي الاشتراك ممنوع دائماً بغض النظر عن هذه الإعدادات.'
                  : 'Alerting and blocking are independent. Expired members are always denied regardless of these settings.'}
              </div>
              <div className='fr3'>
                <div className='fg'>
                  <label>{locale === 'ar' ? 'حد التنبيه (د.أ)' : 'Alert Threshold'}</label>
                  <input className='fi' type='number' step='0.01' value={form.debtAlertThreshold || 0} onChange={sfn('debtAlertThreshold')} />
                  <div style={{ fontSize: 11, opacity: 0.65 }}>{locale === 'ar' ? 'ينبّه الاستقبال عند وجود ذمة أكبر من هذا المبلغ (0 = أي مبلغ).' : 'Warn reception when debt exceeds this (0 = any amount).'}</div>
                </div>
                <div className='fg'>
                  <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 22, cursor: 'pointer' }}>
                    <input type='checkbox' checked={!!form.debtBlockEnabled} onChange={e => setForm(p => ({ ...p, debtBlockEnabled: e.target.checked }))} style={{ width: 15, height: 15 }} />
                    {locale === 'ar' ? 'منع الدخول عند الذمة' : 'Block entry on debt'}
                  </label>
                </div>
                <div className='fg'>
                  <label>{locale === 'ar' ? 'حد المنع (د.أ)' : 'Block Threshold'}</label>
                  <input className='fi' type='number' step='0.01' value={form.debtBlockThreshold || 0} onChange={sfn('debtBlockThreshold')} disabled={!form.debtBlockEnabled} />
                  <div style={{ fontSize: 11, opacity: 0.65 }}>{locale === 'ar' ? 'يُمنع فقط إذا كانت الذمة أكبر تماماً من هذا الحد.' : 'Block only when debt is strictly greater than this.'}</div>
                </div>
                <div className='fg'>
                  <label>{locale === 'ar' ? 'فترة سماح (أيام)' : 'Grace Period (days)'}</label>
                  <input className='fi' type='number' value={form.debtBlockGraceDays || 0} onChange={sfn('debtBlockGraceDays')} disabled={!form.debtBlockEnabled} />
                  <div style={{ fontSize: 11, opacity: 0.65 }}>{locale === 'ar' ? 'يُسمح بالدخول (مع تنبيه) إذا كانت الذمة أحدث من هذه المدة. 0 = بدون سماح.' : 'Allow (with alert) if the debt is newer than this. 0 = no grace.'}</div>
                </div>
              </div>
              <div style={{ marginTop: 10, padding: '10px 14px', borderRadius: 10, background: 'var(--o-bg-light,#f6f4f7)', fontSize: 13, fontWeight: 600 }}>
                {(() => {
                  const aT = Number(form.debtAlertThreshold || 0), bOn = !!form.debtBlockEnabled, bT = Number(form.debtBlockThreshold || 0), g = parseInt(form.debtBlockGraceDays || 0, 10);
                  return locale === 'ar'
                    ? `الحالي: التنبيه عند ${aT > 0 ? `أكثر من ${aT} د.أ` : 'أي مبلغ'}، ${bOn ? `المنع فوق ${bT} د.أ${g > 0 ? ` بعد ${g} يوم سماح` : ''}` : 'بدون منع (تنبيه فقط)'}.`
                    : `Now: alert ${aT > 0 ? `over ${aT}` : 'on any amount'}, ${bOn ? `block over ${bT}${g > 0 ? ` after ${g}d grace` : ''}` : 'no blocking (alert only)'}.`;
                })()}
              </div>
            </div>
          )}

          {subTab === 'rules' && (
            <div className='fr3'>
              <div className='fg'>
                <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8, cursor: 'pointer' }}>
                  <input type='checkbox' checked={form.allowMemberCheckin !== false} onChange={e => setForm(p => ({ ...p, allowMemberCheckin: e.target.checked }))} style={{ width: 15, height: 15 }} />
                  {locale === 'ar' ? 'تسجيل حضور العضو تلقائياً عند النجاح' : 'Auto-create attendance on successful access'}
                </label>
              </div>
              <div className='ac-note' style={{ gridColumn: '1 / -1' }}>
                {locale === 'ar'
                  ? 'عند تفعيل هذا الخيار، يتم تسجيل حضور العضو تلقائياً عند نجاح التحقق من البصمة والاشتراك. يتم التحقق من: حالة العضو، الاشتراك النشط، تاريخ الانتهاء، الجلسات المتبقية.'
                  : 'When enabled, member attendance is automatically logged on successful fingerprint verification. The system checks: member status, active membership, expiry date, and remaining sessions.'}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════
  // MAIN ACCESS CONTROL WORKSPACE
  // ══════════════════════════════════════════════════════════
  function AccessControlWorkspace() {
    const { locale } = useI18n();
    const [tab, setTab] = useState('dashboard');
    const [status] = useLoad('/api/access-control/status', [], null);

    const tabs = [
      ['dashboard',  'Dashboard',       'لوحة التحكم',   <Ic name='grid' size={14}/>],
      ['faceid',     'Face Enrollment', 'تسجيل الوجه',   <Ic name='scan-line' size={14} />],
      ['identities', 'Identities',      'الهويات',       <Ic name='user' size={14} />],
      ['members',    'Link Members',    'ربط الأعضاء',   <Ic name='link' size={14} />],
      ['events',     'Events Log',   'سجل الأحداث',   <Ic name='clipboard' size={14} />],
      ['checkins',   'Turnstile Log','سجل البوابة',   <Ic name='scan-line' size={14} />],
      ['devices',    'Devices',      'الأجهزة',       <Ic name='plug' size={14} />],
      ['settings',   'Settings',     'الإعدادات',     <Ic name='settings' size={14} />],
    ];

    // Handler to switch to the Face Enrollment tab
    const handleEnroll = (identity) => {
      setTab('faceid');
    };

    return (
      <div>
        {/* Top Navigation */}
        <div className='ac-top-nav'>
          <div className='ac-top-nav-brand'>
            <Ic name='shield' size={18} /> {locale === 'ar' ? 'التحكم بالدخول' : 'Access Control'}
          </div>
          <div className='ac-top-nav-tabs'>
            {tabs.map(([k, en, ar, icon]) => (
              <button key={k} className={`ac-nav-tab ${tab === k ? 'active' : ''}`} onClick={() => setTab(k)}>
                <span style={{ fontSize: 13 }}>{icon}</span>
                <span>{locale === 'ar' ? ar : en}</span>
              </button>
            ))}
          </div>
          <div className='ac-top-nav-meta'>
            <span className={`ac-pill ${status?.bridge?.connected ? 'ac-pill-green' : 'ac-pill-red'}`}>
              {status?.bridge?.connected ? (locale === 'ar' ? 'متصل' : 'ONLINE') : (locale === 'ar' ? 'غير متصل' : 'OFFLINE')}
            </span>
          </div>
        </div>

        {/* Page header */}
        <div className='ph'>
          <h1>{locale === 'ar' ? tabs.find(t => t[0] === tab)?.[2] : tabs.find(t => t[0] === tab)?.[1]}</h1>
          <p style={{ color: 'var(--t3)', fontSize: 13 }}>
            {locale === 'ar' ? 'التحكم بالدخول بالوجه — التعرّف على الوجه يفتح الباب ويعرض بطاقة العضو · دخول QR إضافي' : 'Face access control — face recognition opens the door and shows the member card · QR access too'}
          </p>
        </div>

        {/* Sections */}
        {tab === 'dashboard'  && <DashboardSection />}
        {tab === 'faceid'     && <FaceEnrollSection />}
        {tab === 'identities' && <IdentitiesSection onEnroll={handleEnroll} />}
        {tab === 'members'    && <MemberLinkSection onEnroll={handleEnroll} />}
        {tab === 'events'     && <EventsSection />}
        {tab === 'checkins'   && <CheckInsSection />}
        {tab === 'devices'    && <DevicesSection />}
        {tab === 'settings'   && <SettingsSection />}
      </div>
    );
  }

  // Single page registration
  GymOS.registerPage({
    path: '/access-control',
    component: AccessControlWorkspace,
    module: 'access-control',
    label: 'Access Control',
    labelAr: 'التحكم بالدخول',
    order: 27
  });

})();
