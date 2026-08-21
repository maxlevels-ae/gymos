// ═══════════════════════════════════════════════════════════
// GymOS HR V2 — Odoo-style workspace
// Single page · top header navigation · all GymOS native classes
// ═══════════════════════════════════════════════════════════
(function () {
  const { useState, useEffect, useCallback, useMemo } = React;
  const { api, useI18n, Modal, Ic, toast, formatMoney } = shared;

  // ── Helpers ──────────────────────────────────────────────
  function fmt(v) { return formatMoney ? formatMoney(v || 0) : String(Number(v || 0).toFixed(3)); }
  function today() { return new Date().toISOString().slice(0, 10); }
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

  function useBootstrap() {
    return useLoad('/api/hr/bootstrap', [], { branches: [], departments: [], positions: [], leaveTypes: [], employees: [] });
  }

  // ── Status badge ─────────────────────────────────────────
  function SBadge({ state }) {
    const { locale } = useI18n();
    const map = {
      draft:      { en: 'Draft',      ar: 'مسودة',       cls: 'b-pending'  },
      probation:  { en: 'Probation',  ar: 'تجربة',       cls: 'b-warning'  },
      active:     { en: 'Active',     ar: 'نشط',         cls: 'b-active'   },
      suspended:  { en: 'Suspended',  ar: 'موقوف',       cls: 'b-disabled' },
      terminated: { en: 'Terminated', ar: 'منتهي',       cls: 'b-cancelled'},
      pending:    { en: 'Pending',    ar: 'معلق',        cls: 'b-warning'  },
      approved:   { en: 'Approved',   ar: 'معتمد',       cls: 'b-active'   },
      rejected:   { en: 'Rejected',   ar: 'مرفوض',      cls: 'b-danger'   },
      expired:    { en: 'Expired',    ar: 'منتهي',       cls: 'b-cancelled'},
      present:    { en: 'Present',    ar: 'حاضر',        cls: 'b-active'   },
      late:       { en: 'Late',       ar: 'متأخر',       cls: 'b-warning'  },
      absent:     { en: 'Absent',     ar: 'غائب',        cls: 'b-danger'   },
      leave:      { en: 'Leave',      ar: 'إجازة',       cls: 'b-info'     },
      paid:       { en: 'Paid',       ar: 'مدفوع',       cls: 'b-paid'     },
      new:        { en: 'New',        ar: 'جديد',        cls: 'b-new'      },
      screening:  { en: 'Screening',  ar: 'فرز',         cls: 'b-info'     },
      interview:  { en: 'Interview',  ar: 'مقابلة',      cls: 'b-warning'  },
      offer:      { en: 'Offer',      ar: 'عرض',         cls: 'b-active'   },
      hired:      { en: 'Hired',      ar: 'تم التعيين',  cls: 'b-paid'     },
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

  // ── Form field wrapper ────────────────────────────────────
  function F({ label, children, span3 }) {
    return (
      <div className='fg' style={span3 ? { gridColumn: '1 / -1' } : {}}>
        <label>{label}</label>
        {children}
      </div>
    );
  }

  // ── Generic form modal ────────────────────────────────────
  function FormModal({ title, fields, refs, initial, onClose, onSave, wide }) {
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
              const options = typeof f.options === 'function' ? f.options(refs, form) : (f.options || []);
              if (f.type === 'textarea') return <div className='fg' key={f.key} style={{ gridColumn: '1 / -1' }}><label>{label}</label><textarea className='fi' value={value} onChange={e => set(f.key, e.target.value)} /></div>;
              if (f.type === 'select') return <div className='fg' key={f.key}><label>{label}</label><select className='fi' value={value} onChange={e => set(f.key, e.target.value)}><option value=''>{locale === 'ar' ? 'اختر' : 'Select'}</option>{options.map(o => <option key={o.value ?? o.id} value={o.value ?? o.id}>{locale === 'ar' && (o.labelAr || o.name_ar) ? (o.labelAr || o.name_ar) : (o.label || o.name)}</option>)}</select></div>;
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
    const { locale } = useI18n();
    const [stats, loading] = useLoad('/api/hr/dashboard', [], null);

    if (loading || !stats) return <div className='pb'><div className='pld'><span className='spinner' /></div></div>;

    const cards = [
      ['Employees', 'الموظفون', stats.totalEmployees],
      ['Active', 'النشطون', stats.activeEmployees],
      ['Departments', 'الأقسام', stats.departments],
      ['Present Today', 'الحاضرون اليوم', stats.presentToday],
      ['Pending Leaves', 'إجازات معلقة', stats.pendingLeaves],
      ['Payroll (MTD)', 'رواتب الشهر', fmt(stats.payrollMonth)],
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
            <div className='ct'>{locale === 'ar' ? 'التوزيع حسب القسم' : 'Department Distribution'}</div>
            <table>
              <thead><tr><th>{locale === 'ar' ? 'القسم' : 'Department'}</th><th>{locale === 'ar' ? 'العدد' : 'Count'}</th></tr></thead>
              <tbody>
                {(stats.byDepartment || []).length === 0
                  ? <tr><td colSpan={2}><div className='empty'><h3>{locale === 'ar' ? 'لا أقسام' : 'No departments'}</h3></div></td></tr>
                  : (stats.byDepartment || []).map((r, i) => <tr key={i}><td>{r.name || '—'}</td><td>{r.count}</td></tr>)
                }
              </tbody>
            </table>
          </div>
          <div className='card'>
            <div className='ct'>{locale === 'ar' ? 'عقود تنتهي قريباً' : 'Contracts Ending Soon'}</div>
            {(stats.upcomingContracts || []).length === 0
              ? <div className='empty'><h3>{locale === 'ar' ? 'لا توجد عقود قريبة الانتهاء' : 'No contracts ending soon'}</h3></div>
              : (stats.upcomingContracts || []).map((r, i) => (
                <div key={i} style={{ padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{r.full_name}</div>
                  <div style={{ fontSize: 12, color: 'var(--t3)' }}>{r.contract_ref || '—'} · {r.end_date}</div>
                </div>
              ))
            }
          </div>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════
  // EMPLOYEES SECTION — with detail view and inline tabs
  // ══════════════════════════════════════════════════════════
  // ── Employee Fingerprint Tab ──
  function EmployeeFingerprintTab({ emp }) {
    const { locale } = useI18n();
    const isAr = locale === 'ar';
    const [identity, setIdentity] = useState(null);
    const [enrolled, setEnrolled] = useState(!!emp.fingerprint_enrolled);
    const [fpDate, setFpDate] = useState(emp.fingerprint_date || '');
    const [scanning, setScanning] = useState(false);
    const [scanStep, setScanStep] = useState(0);
    const [scanMsg, setScanMsg] = useState('');
    const [removing, setRemoving] = useState(false);
    const [bridgeOk, setBridgeOk] = useState(null);

    // Check bridge status and load identity on mount
    useEffect(() => {
      api.get('/api/access-control/status').then(r => setBridgeOk(r.data?.bridge?.connected || false)).catch(() => setBridgeOk(false));
      api.post('/api/access-control/employees/' + emp.id + '/bootstrap-identity').then(r => setIdentity(r.data)).catch(() => {});
      api.get('/api/hr/employees/' + emp.id + '/fingerprint').then(r => { setEnrolled(r.data?.enrolled); setFpDate(r.data?.date || ''); }).catch(() => {});
    }, [emp.id]);

    const startEnroll = async () => {
      if (!identity) {
        try {
          const r = await api.post('/api/access-control/employees/' + emp.id + '/bootstrap-identity');
          setIdentity(r.data);
        } catch (e) { return toast(e.message || 'Failed to create identity', 'e'); }
      }
      const identityId = identity?.id;
      if (!identityId) return toast(isAr ? 'فشل في إنشاء الهوية' : 'Identity creation failed', 'e');

      setScanning(true); setScanStep(0); setScanMsg(isAr ? 'جاري بدء جلسة التسجيل...' : 'Starting enrollment session...');

      try {
        // Step 1: Start enrollment session
        const session = await api.post('/api/access-control/identities/' + identityId + '/enroll/start');
        const sessionKey = session.data?.sessionKey;
        if (!sessionKey) throw new Error('No session key');

        // Step 2: 3 fingerprint captures
        for (let i = 1; i <= 3; i++) {
          setScanStep(i);
          setScanMsg(i === 1 ? (isAr ? 'ضع إصبعك على الماسح...' : 'Place your finger on the scanner...') : i === 2 ? (isAr ? 'ارفع إصبعك ثم ضعه مرة أخرى...' : 'Lift and place your finger again...') : (isAr ? 'المسح الأخير — ضع إصبعك...' : 'Final scan — place your finger...'));
          const capture = await api.post('/api/access-control/enroll/' + sessionKey + '/capture');
          if (!capture.success) throw new Error(capture.error || 'Capture failed at scan ' + i);
        }

        // Step 3: Merge templates
        setScanStep(4); setScanMsg(isAr ? 'جاري دمج البصمات وحفظها...' : 'Merging templates and saving...');
        await api.post('/api/access-control/enroll/' + sessionKey + '/merge');

        // Step 4: Update employee record
        await api.post('/api/hr/employees/' + emp.id + '/fingerprint/enroll');
        setEnrolled(true);
        setFpDate(new Date().toISOString().split('T')[0]);
        toast(isAr ? 'تم تسجيل البصمة بنجاح ✓' : 'Fingerprint enrolled successfully ✓');
      } catch (e) {
        toast(e.message || (isAr ? 'فشل في تسجيل البصمة' : 'Enrollment failed'), 'e');
      } finally { setScanning(false); setScanStep(0); setScanMsg(''); }
    };

    const removeFp = async () => {
      if (!confirm(isAr ? 'هل أنت متأكد من حذف البصمة؟' : 'Remove fingerprint?')) return;
      try {
        setRemoving(true);
        await api.del('/api/hr/employees/' + emp.id + '/fingerprint');
        setEnrolled(false); setFpDate('');
        toast(isAr ? 'تم حذف البصمة' : 'Fingerprint removed');
      } catch (e) { toast(e.message, 'e'); }
      finally { setRemoving(false); }
    };

    return React.createElement('div', { style: { display: 'grid', gap: 20 } },
      // Bridge status banner
      bridgeOk !== null && React.createElement('div', { className: 'card', style: { margin: 0, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10, background: bridgeOk ? 'var(--green-g)' : 'var(--red-g)', border: '1px solid ' + (bridgeOk ? 'rgba(16,185,129,.2)' : 'rgba(239,68,68,.2)') } },
        React.createElement('span', { style: { fontSize: 16 } }, bridgeOk ? '🟢' : '🔴'),
        React.createElement('span', { style: { fontSize: 13, fontWeight: 600, color: bridgeOk ? 'var(--green)' : 'var(--red)' } }, bridgeOk ? (isAr ? 'جهاز البصمة متصل وجاهز' : 'Fingerprint device connected & ready') : (isAr ? 'جهاز البصمة غير متصل — تأكد من تشغيل Bridge' : 'Fingerprint device not connected — check Bridge service'))),

      // Scanning overlay
      scanning && React.createElement('div', { style: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' } },
        React.createElement('div', { style: { background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 20, padding: 40, textAlign: 'center', maxWidth: 400, animation: 'cpc-in .3s ease' } },
          React.createElement('div', { style: { position: 'relative', width: 120, height: 150, margin: '0 auto 20px' } },
            React.createElement('svg', { viewBox: '0 0 120 150', width: 120, height: 150, style: { animation: scanStep < 4 ? 'sp .8s linear infinite' : 'none' } },
              React.createElement('defs', null, React.createElement('linearGradient', { id: 'fps', x1: 0, y1: 0, x2: 0, y2: 1 },
                React.createElement('stop', { offset: '0%', stopColor: scanStep >= 4 ? 'var(--green)' : 'var(--accent)' }),
                React.createElement('stop', { offset: '100%', stopColor: scanStep >= 4 ? 'var(--green)' : 'var(--accent)', stopOpacity: .3 }))),
              React.createElement('g', { fill: 'none', stroke: 'url(#fps)', strokeWidth: 2.5 },
                React.createElement('ellipse', { cx: 60, cy: 85, rx: 35, ry: 45 }), React.createElement('ellipse', { cx: 60, cy: 85, rx: 28, ry: 38 }),
                React.createElement('ellipse', { cx: 60, cy: 85, rx: 21, ry: 31 }), React.createElement('ellipse', { cx: 60, cy: 85, rx: 14, ry: 24 }),
                React.createElement('ellipse', { cx: 60, cy: 85, rx: 7, ry: 17 }),
                React.createElement('path', { d: 'M25 60 Q35 30 60 25 Q85 30 95 60' }), React.createElement('path', { d: 'M30 55 Q40 35 60 30 Q80 35 90 55' }))),
            scanStep > 0 && React.createElement('div', { style: { position: 'absolute', bottom: -8, left: '50%', transform: 'translateX(-50%)', background: scanStep >= 4 ? 'var(--green)' : 'var(--accent)', color: '#fff', borderRadius: 20, padding: '4px 14px', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' } }, scanStep >= 4 ? '✓' : scanStep + '/3')),
          React.createElement('div', { style: { fontSize: 16, fontWeight: 700, marginBottom: 8 } }, scanMsg),
          React.createElement('div', { style: { display: 'flex', gap: 8, justifyContent: 'center', marginTop: 16 } },
            [1, 2, 3].map(s => React.createElement('div', { key: s, style: { width: 40, height: 4, borderRadius: 2, background: s <= scanStep ? (scanStep >= 4 ? 'var(--green)' : 'var(--accent)') : 'var(--bg-4)', transition: 'background .3s' } }))))),

      // Main content
      React.createElement('div', { style: { display: 'flex', gap: 24, alignItems: 'flex-start', flexWrap: 'wrap' } },
        React.createElement('div', { className: 'fp-visual', style: { padding: 28 } },
          React.createElement('div', { style: { textAlign: 'center' } },
            React.createElement('svg', { viewBox: '0 0 120 150', width: 120, height: 150, style: { opacity: enrolled ? 1 : .2 } },
              React.createElement('defs', null, React.createElement('linearGradient', { id: 'fpge', x1: 0, y1: 0, x2: 0, y2: 1 },
                React.createElement('stop', { offset: '0%', stopColor: enrolled ? 'var(--green)' : 'var(--t4)' }),
                React.createElement('stop', { offset: '100%', stopColor: enrolled ? 'var(--green)' : 'var(--t4)', stopOpacity: .3 }))),
              React.createElement('g', { fill: 'none', stroke: 'url(#fpge)', strokeWidth: 2 },
                React.createElement('ellipse', { cx: 60, cy: 85, rx: 35, ry: 45 }), React.createElement('ellipse', { cx: 60, cy: 85, rx: 28, ry: 38 }),
                React.createElement('ellipse', { cx: 60, cy: 85, rx: 21, ry: 31 }), React.createElement('ellipse', { cx: 60, cy: 85, rx: 14, ry: 24 }),
                React.createElement('ellipse', { cx: 60, cy: 85, rx: 7, ry: 17 }),
                React.createElement('path', { d: 'M25 60 Q35 30 60 25 Q85 30 95 60' }), React.createElement('path', { d: 'M30 55 Q40 35 60 30 Q80 35 90 55' })),
              enrolled && React.createElement('circle', { cx: 95, cy: 25, r: 14, fill: 'var(--green)' }),
              enrolled && React.createElement('path', { d: 'M88 25 L93 30 L102 20', stroke: '#fff', strokeWidth: 2.5, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' })),
            React.createElement('div', { style: { marginTop: 12, fontSize: 12, color: enrolled ? 'var(--green)' : 'var(--t4)', fontWeight: 600 } },
              enrolled ? (isAr ? '✓ مسجّلة' : '✓ Enrolled') : (isAr ? '✗ غير مسجّلة' : '✗ Not Enrolled')))),
        React.createElement('div', { style: { flex: 1, minWidth: 240 } },
          React.createElement('div', { style: { fontSize: 20, fontWeight: 800, marginBottom: 4 } }, isAr ? 'بصمة الموظف' : 'Employee Fingerprint'),
          React.createElement('div', { style: { fontSize: 13, color: 'var(--t3)', marginBottom: 16 } }, isAr ? 'تُستخدم لتسجيل الحضور والانصراف وفتح البوابة تلقائياً' : 'Used for automatic clock-in/out and gate access'),
          React.createElement('div', { className: 'dg', style: { marginBottom: 20 } },
            React.createElement('div', { className: 'di' }, React.createElement('div', { className: 'dl' }, isAr ? 'الحالة' : 'Status'), React.createElement('div', { className: 'dv' }, React.createElement('span', { className: 'badge ' + (enrolled ? 'b-active' : 'b-danger'), style: { fontSize: 12 } }, enrolled ? (isAr ? '✓ مسجّلة' : '✓ Enrolled') : (isAr ? '✗ غير مسجّلة' : '✗ Not Enrolled')))),
            fpDate && React.createElement('div', { className: 'di' }, React.createElement('div', { className: 'dl' }, isAr ? 'تاريخ التسجيل' : 'Enrolled On'), React.createElement('div', { className: 'dv' }, fpDate)),
            React.createElement('div', { className: 'di' }, React.createElement('div', { className: 'dl' }, isAr ? 'رقم الموظف' : 'Employee No'), React.createElement('div', { className: 'dv', style: { fontFamily: 'monospace' } }, emp.employee_no || '—')),
            React.createElement('div', { className: 'di' }, React.createElement('div', { className: 'dl' }, isAr ? 'QR / بطاقة' : 'QR / Badge'), React.createElement('div', { className: 'dv', style: { fontFamily: 'monospace', fontSize: 11 } }, emp.badge_id || '—'))),
          !enrolled
            ? React.createElement('button', { className: 'btn btn-p', onClick: startEnroll, disabled: scanning || bridgeOk === false, style: { fontSize: 15, padding: '12px 24px' } },
                React.createElement(Ic, { name: 'fingerprint', size: 15 }), ' ', isAr ? 'تسجيل البصمة الآن' : 'Enroll Fingerprint Now')
            : React.createElement('div', { style: { display: 'flex', gap: 10, flexWrap: 'wrap' } },
                React.createElement('button', { className: 'btn btn-s', onClick: startEnroll, disabled: scanning }, React.createElement(Ic, { name: 'refresh', size: 14 }), ' ', isAr ? 'إعادة تسجيل' : 'Re-enroll'),
                React.createElement('button', { className: 'btn btn-d btn-sm', onClick: removeFp, disabled: removing }, removing ? '...' : React.createElement(React.Fragment, null, React.createElement(Ic, { name: 'trash', size: 13 }), ' ', isAr ? 'حذف' : 'Remove'))))));
  }

  // ── Employee Attendance Log Tab ──
  function EmployeeAttendanceLog({ emp }) {
    const { locale } = useI18n();
    const isAr = locale === 'ar';
    const now = new Date();
    const [year, setYear] = useState(now.getFullYear());
    const [month, setMonth] = useState(now.getMonth() + 1);
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const load = () => {
      setLoading(true);
      api.get(`/api/hr/employees/${emp.id}/attendance-summary?year=${year}&month=${month}`)
        .then(r => setData(r.data)).catch(() => setData(null)).finally(() => setLoading(false));
    };
    useEffect(() => { load(); }, [year, month]);

    const months = isAr
      ? ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر']
      : ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    const statusBadge = (s) => {
      const map = { present: 'b-active', late: 'b-warning', absent: 'b-danger', leave: 'b-info' };
      const label = isAr ? { present: 'حاضر', late: 'متأخر', absent: 'غائب', leave: 'إجازة' } : {};
      return React.createElement('span', { className: 'badge ' + (map[s] || 'b-inactive') }, label[s] || s);
    };

    if (loading) return React.createElement('div', { className: 'pld' }, React.createElement('span', { className: 'spinner' }));

    return React.createElement('div', { style: { display: 'grid', gap: 16 } },
      React.createElement('div', { className: 'fb', style: { margin: 0 } },
        React.createElement('select', { className: 'fi', value: month, onChange: e => setMonth(Number(e.target.value)), style: { maxWidth: 150 } },
          months.map((m, i) => React.createElement('option', { key: i + 1, value: i + 1 }, m))),
        React.createElement('input', { className: 'fi', type: 'number', value: year, onChange: e => setYear(Number(e.target.value)), style: { width: 80 } })),
      data && React.createElement('div', { className: 'sg', style: { gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))' } },
        [
          [isAr ? 'أيام حضور' : 'Present', data.presentDays, 'var(--green)'],
          [isAr ? 'أيام تأخير' : 'Late', data.lateDays, 'var(--amber)'],
          [isAr ? 'أيام غياب' : 'Absent', data.absentDays, 'var(--red)'],
          [isAr ? 'ساعات العمل' : 'Hours Worked', Number(data.totalWorkedHours || 0).toFixed(1), 'var(--accent)'],
          [isAr ? 'ساعات إضافية' : 'OT Hours', Number(data.totalOvertimeHours || 0).toFixed(1), 'var(--cyan)'],
          [isAr ? 'خصم التأخير' : 'Late Penalty', Number(data.latePenalty || 0).toFixed(2), 'var(--amber)'],
          [isAr ? 'خصم الغياب' : 'Absent Penalty', Number(data.absentPenalty || 0).toFixed(2), 'var(--red)'],
          [isAr ? 'إجمالي الخصومات' : 'Total Deductions', Number(data.totalDeductions || 0).toFixed(2), 'var(--red)'],
        ].map(([label, val, color], i) => React.createElement('div', { className: 'sc', key: i, style: { '--kpi-color': color } },
          React.createElement('div', { className: 'sl' }, label),
          React.createElement('div', { className: 'sv', style: { fontSize: 18, color: i >= 5 ? color : 'inherit' } }, val)))),
      data?.logs?.length > 0
        ? React.createElement('div', { className: 'card', style: { margin: 0, padding: 0, overflow: 'hidden' } },
            React.createElement('table', null,
              React.createElement('thead', null, React.createElement('tr', null,
                [isAr ? 'التاريخ' : 'Date', isAr ? 'الدخول' : 'Clock In', isAr ? 'الخروج' : 'Clock Out', isAr ? 'الساعات' : 'Hours', isAr ? 'إضافي' : 'OT', isAr ? 'الحالة' : 'Status', isAr ? 'المصدر' : 'Source'].map((h, i) => React.createElement('th', { key: i }, h)))),
              React.createElement('tbody', null, data.logs.map(l => React.createElement('tr', { key: l.id },
                React.createElement('td', { style: { fontSize: 12 } }, l.attendance_date),
                React.createElement('td', { style: { fontSize: 12, fontFamily: 'monospace' } }, l.check_in || '—'),
                React.createElement('td', { style: { fontSize: 12, fontFamily: 'monospace' } }, l.check_out || (l.status !== 'absent' ? React.createElement('span', { className: 'badge b-active' }, isAr ? 'لم يسجل' : 'No out') : '—')),
                React.createElement('td', { style: { fontSize: 12 } }, Number(l.worked_hours || 0).toFixed(1) + 'h'),
                React.createElement('td', { style: { fontSize: 12 } }, Number(l.overtime_hours || 0) > 0 ? Number(l.overtime_hours).toFixed(1) + 'h' : '—'),
                React.createElement('td', null, statusBadge(l.status)),
                React.createElement('td', null, React.createElement('span', { className: 'badge ' + (l.source === 'fingerprint' ? 'b-new' : 'b-inactive'), style: { fontSize: 10 } }, l.source === 'fingerprint' ? React.createElement(React.Fragment, null, React.createElement(Ic, { name: 'fingerprint', size: 10 }), ' ', isAr ? 'بصمة' : 'FP') : (l.source || 'manual'))))))))
        : React.createElement('div', { className: 'empty', style: { padding: 30 } }, React.createElement('h3', null, isAr ? 'لا يوجد سجل حضور لهذا الشهر' : 'No attendance records for this month')),
      data && React.createElement('div', { className: 'card', style: { margin: 0, background: 'rgba(245,158,11,.06)', border: '1px solid rgba(245,158,11,.15)' } },
        React.createElement('div', { style: { display: 'flex', gap: 12, alignItems: 'flex-start' } },
          React.createElement('span', { style: { fontSize: 20, flexShrink: 0 } }, React.createElement(Ic, { name: 'bar-chart', size: 20 })),
          React.createElement('div', null,
            React.createElement('div', { style: { fontSize: 13, fontWeight: 600, marginBottom: 4 } }, isAr ? 'تأثير الحضور على الراتب' : 'Payroll Impact'),
            React.createElement('div', { style: { fontSize: 12, color: 'var(--t3)', lineHeight: 1.7 } },
              isAr
                ? `معدل اليوم: ${Number(data.dailyRate || 0).toFixed(2)} · تأخير (${data.lateDays} يوم × 25%): -${Number(data.latePenalty || 0).toFixed(2)} · غياب (${data.absentDays} يوم × 100%): -${Number(data.absentPenalty || 0).toFixed(2)} · إجمالي الخصم: -${Number(data.totalDeductions || 0).toFixed(2)}`
                : `Daily rate: ${Number(data.dailyRate || 0).toFixed(2)} · Late (${data.lateDays}d × 25%): -${Number(data.latePenalty || 0).toFixed(2)} · Absent (${data.absentDays}d × 100%): -${Number(data.absentPenalty || 0).toFixed(2)} · Total deduction: -${Number(data.totalDeductions || 0).toFixed(2)}`)))));
  }

  function EmployeeDetail({ emp, refs, onClose, onRefresh }) {
    const { locale } = useI18n();
    const [editTab, setEditTab] = useState('info');
    const [form, setForm] = useState({ ...emp });
    const [saving, setSaving] = useState(false);
    const sf = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

    const save = async () => {
      try {
        setSaving(true);
        await api.put(`/api/hr/employees/${emp.id}`, form);
        toast(locale === 'ar' ? 'تم الحفظ' : 'Saved');
        onRefresh();
      } catch (e) { toast(e.message || 'Failed', 'e'); }
      finally { setSaving(false); }
    };

    const statusOptions = [
      { value: 'draft', label: 'Draft', labelAr: 'مسودة' },
      { value: 'probation', label: 'Probation', labelAr: 'تجربة' },
      { value: 'active', label: 'Active', labelAr: 'نشط' },
      { value: 'suspended', label: 'Suspended', labelAr: 'موقوف' },
      { value: 'terminated', label: 'Terminated', labelAr: 'منتهي' },
    ];
    const typeOptions = [
      { value: 'full_time', label: 'Full Time', labelAr: 'دوام كامل' },
      { value: 'part_time', label: 'Part Time', labelAr: 'دوام جزئي' },
      { value: 'contract', label: 'Contract', labelAr: 'عقد' },
    ];

    return (
      <div>
        <div className='hr-form-hdr'>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div className='hr-emp-avatar'>{initials(emp.full_name)}</div>
            <div>
              <div className='hr-emp-name'>{emp.full_name}</div>
              <div className='hr-emp-meta'>{emp.employee_no} · {emp.position_name || '—'} · {emp.department_name || '—'}</div>
            </div>
            <SBadge state={emp.employee_status} />
          </div>
          <div className='hr-form-acts'>
            <button className='btn btn-s' onClick={onClose}>{locale === 'ar' ? 'رجوع' : 'Back'}</button>
            <button className='btn btn-p' onClick={save} disabled={saving}>{saving ? '...' : (locale === 'ar' ? 'حفظ' : 'Save')}</button>
          </div>
        </div>
        <div className='hr-form-body'>
          <div className='hr-sub-tabs'>
            {[['info', 'Personal Info', 'المعلومات الشخصية'], ['job', 'Job', 'الوظيفة'], ['salary', 'Salary', 'الراتب'], ['leaves', 'Leave Balance', 'الإجازات'], ['fingerprint', 'Fingerprint', 'البصمة'], ['att_log', 'Attendance Log', 'سجل الحضور']].map(([k, en, ar]) => (
              <button key={k} className={`hr-sub-tab ${editTab === k ? 'active' : ''}`} onClick={() => setEditTab(k)}>{locale === 'ar' ? ar : en}</button>
            ))}
          </div>

          {editTab === 'info' && (
            <div className='fr3'>
              <div className='fg'><label>{locale === 'ar' ? 'الاسم الأول' : 'First Name'}</label><input className='fi' value={form.first_name || ''} onChange={sf('first_name')} /></div>
              <div className='fg'><label>{locale === 'ar' ? 'اسم العائلة' : 'Last Name'}</label><input className='fi' value={form.last_name || ''} onChange={sf('last_name')} /></div>
              <div className='fg'><label>{locale === 'ar' ? 'البريد الوظيفي' : 'Work Email'}</label><input className='fi' type='email' value={form.work_email || ''} onChange={sf('work_email')} /></div>
              <div className='fg'><label>{locale === 'ar' ? 'الجوال' : 'Mobile'}</label><input className='fi' value={form.mobile || ''} onChange={sf('mobile')} /></div>
              <div className='fg'><label>{locale === 'ar' ? 'الجنس' : 'Gender'}</label>
                <select className='fi' value={form.gender || 'male'} onChange={sf('gender')}>
                  <option value='male'>{locale === 'ar' ? 'ذكر' : 'Male'}</option>
                  <option value='female'>{locale === 'ar' ? 'أنثى' : 'Female'}</option>
                </select>
              </div>
              <div className='fg'><label>{locale === 'ar' ? 'الجنسية' : 'Nationality'}</label><input className='fi' value={form.nationality || ''} onChange={sf('nationality')} /></div>
              <div className='fg'><label>{locale === 'ar' ? 'تاريخ الميلاد' : 'Date of Birth'}</label><input className='fi' type='date' value={form.date_of_birth || ''} onChange={sf('date_of_birth')} /></div>
              <div className='fg'><label>{locale === 'ar' ? 'الرقم الوطني' : 'National ID'}</label><input className='fi' value={form.national_id || ''} onChange={sf('national_id')} /></div>
              <div className='fg' style={{ gridColumn: '1 / -1' }}><label>{locale === 'ar' ? 'ملاحظات' : 'Notes'}</label><textarea className='fi' value={form.notes || ''} onChange={sf('notes')} /></div>
            </div>
          )}

          {editTab === 'job' && (
            <div className='fr3'>
              <div className='fg'><label>{locale === 'ar' ? 'تاريخ التعيين' : 'Hire Date'}</label><input className='fi' type='date' value={form.hire_date || ''} onChange={sf('hire_date')} /></div>
              <div className='fg'><label>{locale === 'ar' ? 'الحالة' : 'Status'}</label>
                <select className='fi' value={form.employee_status || 'draft'} onChange={sf('employee_status')}>
                  {statusOptions.map(o => <option key={o.value} value={o.value}>{locale === 'ar' ? o.labelAr : o.label}</option>)}
                </select>
              </div>
              <div className='fg'><label>{locale === 'ar' ? 'نوع التوظيف' : 'Employment Type'}</label>
                <select className='fi' value={form.employment_type || 'full_time'} onChange={sf('employment_type')}>
                  {typeOptions.map(o => <option key={o.value} value={o.value}>{locale === 'ar' ? o.labelAr : o.label}</option>)}
                </select>
              </div>
              <div className='fg'><label>{locale === 'ar' ? 'الفرع' : 'Branch'}</label>
                <select className='fi' value={form.branch_id || ''} onChange={sf('branch_id')}>
                  <option value=''>{locale === 'ar' ? 'اختر' : 'Select'}</option>
                  {(refs.branches || []).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div className='fg'><label>{locale === 'ar' ? 'القسم' : 'Department'}</label>
                <select className='fi' value={form.department_id || ''} onChange={sf('department_id')}>
                  <option value=''>{locale === 'ar' ? 'اختر' : 'Select'}</option>
                  {(refs.departments || []).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div className='fg'><label>{locale === 'ar' ? 'الوظيفة' : 'Position'}</label>
                <select className='fi' value={form.position_id || ''} onChange={sf('position_id')}>
                  <option value=''>{locale === 'ar' ? 'اختر' : 'Select'}</option>
                  {(refs.positions || []).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className='fg'><label>{locale === 'ar' ? 'المدير' : 'Manager'}</label>
                <select className='fi' value={form.manager_employee_id || ''} onChange={sf('manager_employee_id')}>
                  <option value=''>{locale === 'ar' ? 'اختر' : 'Select'}</option>
                  {(refs.employees || []).filter(e => e.id !== emp.id).map(e => <option key={e.id} value={e.id}>{e.full_name}</option>)}
                </select>
              </div>
            </div>
          )}

          {editTab === 'salary' && (
            <div className='fr3'>
              <div className='fg'><label>{locale === 'ar' ? 'الراتب الأساسي' : 'Basic Salary'}</label><input className='fi' type='number' value={form.base_salary || 0} onChange={sf('base_salary')} /></div>
              <div className='fg'><label>{locale === 'ar' ? 'بدل سكن' : 'Housing Allowance'}</label><input className='fi' type='number' value={form.housing_allowance || 0} onChange={sf('housing_allowance')} /></div>
              <div className='fg'><label>{locale === 'ar' ? 'بدل نقل' : 'Transport Allowance'}</label><input className='fi' type='number' value={form.transport_allowance || 0} onChange={sf('transport_allowance')} /></div>
              <div className='fg'><label>{locale === 'ar' ? 'بدلات أخرى' : 'Other Allowances'}</label><input className='fi' type='number' value={form.other_allowance || 0} onChange={sf('other_allowance')} /></div>
              <div className='fg'><label>{locale === 'ar' ? 'سعر الإضافي/ساعة' : 'OT Rate / Hour'}</label><input className='fi' type='number' value={form.overtime_rate || 0} onChange={sf('overtime_rate')} /></div>
              <div className='fg'><label style={{ color: 'var(--t3)', fontSize: 12 }}>{locale === 'ar' ? 'الإجمالي الشهري' : 'Monthly Total'}</label>
                <div style={{ padding: '8px 12px', background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 'var(--rs)', fontSize: 15, fontWeight: 700, color: 'var(--green)' }}>
                  {fmt((Number(form.base_salary) || 0) + (Number(form.housing_allowance) || 0) + (Number(form.transport_allowance) || 0) + (Number(form.other_allowance) || 0))}
                </div>
              </div>
            </div>
          )}

          {editTab === 'leaves' && (
            <div className='fr'>
              <div className='fg'><label>{locale === 'ar' ? 'رصيد الإجازات (أيام)' : 'Leave Balance (days)'}</label><input className='fi' type='number' value={form.leave_balance || 0} onChange={sf('leave_balance')} /></div>
              <div style={{ padding: '12px 0', color: 'var(--t3)', fontSize: 13 }}>
                {locale === 'ar' ? 'رصيد الإجازات يُخصم تلقائياً عند اعتماد طلب الإجازة.' : 'Leave balance is automatically deducted when a leave request is approved.'}
              </div>
            </div>
          )}

          {editTab === 'fingerprint' && <EmployeeFingerprintTab emp={emp} />}
          {editTab === 'att_log' && <EmployeeAttendanceLog emp={emp} />}
        </div>
      </div>
    );
  }

  function EmployeesSection() {
    const { locale } = useI18n();
    const [view, setView] = useState('list');
    const [sel, setSel] = useState(null);
    const [showNew, setShowNew] = useState(false);
    const [statusF, setStatusF] = useState('');
    const [search, setSearch] = useState('');
    const [bootstrap] = useBootstrap();
    const [items, loading,, reload] = useLoad('/api/hr/employees', [], []);

    const filtered = useMemo(() => {
      let r = items;
      if (statusF) r = r.filter(e => e.employee_status === statusF);
      if (search) r = r.filter(e => (e.full_name + e.employee_no + e.work_email).toLowerCase().includes(search.toLowerCase()));
      return r;
    }, [items, statusF, search]);

    const newFields = [
      { key: 'first_name', label: 'First Name', labelAr: 'الاسم الأول' },
      { key: 'last_name', label: 'Last Name', labelAr: 'اسم العائلة' },
      { key: 'work_email', label: 'Work Email', labelAr: 'البريد الوظيفي', type: 'email' },
      { key: 'mobile', label: 'Mobile', labelAr: 'الجوال' },
      { key: 'hire_date', label: 'Hire Date', labelAr: 'تاريخ التعيين', type: 'date' },
      { key: 'employee_status', label: 'Status', labelAr: 'الحالة', type: 'select', options: [{ value: 'draft', label: 'Draft', labelAr: 'مسودة' }, { value: 'probation', label: 'Probation', labelAr: 'تجربة' }, { value: 'active', label: 'Active', labelAr: 'نشط' }] },
      { key: 'employment_type', label: 'Type', labelAr: 'نوع التوظيف', type: 'select', options: [{ value: 'full_time', label: 'Full Time', labelAr: 'دوام كامل' }, { value: 'part_time', label: 'Part Time', labelAr: 'جزئي' }, { value: 'contract', label: 'Contract', labelAr: 'عقد' }] },
      { key: 'branch_id', label: 'Branch', labelAr: 'الفرع', type: 'select', options: (refs) => (refs.branches || []).map(x => ({ id: x.id, name: x.name })) },
      { key: 'department_id', label: 'Department', labelAr: 'القسم', type: 'select', options: (refs) => (refs.departments || []).map(x => ({ id: x.id, name: x.name })) },
      { key: 'position_id', label: 'Position', labelAr: 'الوظيفة', type: 'select', options: (refs) => (refs.positions || []).map(x => ({ id: x.id, name: x.name })) },
      { key: 'base_salary', label: 'Basic Salary', labelAr: 'الراتب الأساسي', type: 'number' },
    ];

    if (view === 'detail' && sel) {
      return <EmployeeDetail emp={sel} refs={bootstrap} onClose={() => { setView('list'); setSel(null); }} onRefresh={() => { reload(); setView('list'); setSel(null); }} />;
    }

    const cols = [
      { key: 'employee_no', label: 'Code', ar: 'الرمز' },
      { key: 'full_name', label: 'Employee', ar: 'الموظف' },
      { key: 'department_name', label: 'Department', ar: 'القسم' },
      { key: 'position_name', label: 'Position', ar: 'الوظيفة' },
      { key: 'branch_name', label: 'Branch', ar: 'الفرع' },
      { key: 'employee_status', label: 'Status', ar: 'الحالة', render: r => <SBadge state={r.employee_status} /> },
    ];

    return (
      <div className='pb'>
        <div className='hr-bar'>
          <div className='fb' style={{ margin: 0 }}>
            <input className='fi' style={{ minWidth: 200 }} value={search} onChange={e => setSearch(e.target.value)} placeholder={locale === 'ar' ? 'بحث...' : 'Search...'} />
            <select className='fi' style={{ minWidth: 140 }} value={statusF} onChange={e => setStatusF(e.target.value)}>
              <option value=''>{locale === 'ar' ? 'كل الحالات' : 'All Statuses'}</option>
              {[['draft', 'مسودة'], ['probation', 'تجربة'], ['active', 'نشط'], ['suspended', 'موقوف'], ['terminated', 'منتهي']].map(([v, a]) => (
                <option key={v} value={v}>{locale === 'ar' ? a : v.charAt(0).toUpperCase() + v.slice(1)}</option>
              ))}
            </select>
          </div>
          <button className='btn btn-p' onClick={() => setShowNew(true)}>
            <Ic name='plus' size={14} /> {locale === 'ar' ? 'موظف جديد' : 'New Employee'}
          </button>
        </div>
        <Tbl rows={filtered} cols={cols} loading={loading}
          onRow={r => { setSel(r); setView('detail'); }}
          emptyLabel={locale === 'ar' ? 'لا يوجد موظفون' : 'No employees found'}
          emptyAction={locale === 'ar' ? 'موظف جديد' : 'New Employee'} onEmptyAction={() => setShowNew(true)} />
        {showNew && (
          <FormModal title={locale === 'ar' ? 'موظف جديد' : 'New Employee'} fields={newFields} refs={bootstrap} initial={{}}
            onClose={() => setShowNew(false)}
            onSave={async (data) => { await api.post('/api/hr/employees', data); toast(locale === 'ar' ? 'تم الإنشاء' : 'Created'); setShowNew(false); reload(); }} />
        )}
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════
  // ORGANIZATION SECTION (Departments + Positions)
  // ══════════════════════════════════════════════════════════
  function OrganizationSection() {
    const { locale } = useI18n();
    const [sub, setSub] = useState('departments');
    const [bootstrap, bL, , reloadBootstrap] = useBootstrap();
    const [depts, dL,, reloadD] = useLoad('/api/hr/departments', [], []);
    const [positions, pL,, reloadP] = useLoad('/api/hr/positions', [], []);
    const [showD, setShowD] = useState(false);
    const [showP, setShowP] = useState(false);
    const [editD, setEditD] = useState(null);
    const [editP, setEditP] = useState(null);

    const deptFields = [
      { key: 'name', label: 'Department Name', labelAr: 'اسم القسم' },
      { key: 'code', label: 'Code', labelAr: 'الرمز' },
      { key: 'branch_id', label: 'Branch', labelAr: 'الفرع', type: 'select', options: (refs) => (refs.branches || []).map(x => ({ id: x.id, name: x.name })) },
      { key: 'manager_employee_id', label: 'Manager', labelAr: 'المدير', type: 'select', options: (refs) => (refs.employees || []).map(x => ({ id: x.id, name: x.full_name })) },
      { key: 'notes', label: 'Notes', labelAr: 'ملاحظات', type: 'textarea' },
    ];
    const posFields = [
      { key: 'name', label: 'Position', labelAr: 'الوظيفة' },
      { key: 'department_id', label: 'Department', labelAr: 'القسم', type: 'select', options: (refs) => (refs.departments || []).map(x => ({ id: x.id, name: x.name })) },
      { key: 'grade', label: 'Grade', labelAr: 'الدرجة' },
      { key: 'employment_type', label: 'Employment Type', labelAr: 'نوع التوظيف', type: 'select', options: [{ value: 'full_time', label: 'Full Time', labelAr: 'دوام كامل' }, { value: 'part_time', label: 'Part Time', labelAr: 'جزئي' }, { value: 'contract', label: 'Contract', labelAr: 'عقد' }] },
    ];
    const saveD = async (data) => {
      if (editD?.id) await api.put('/api/hr/departments/' + editD.id, data);
      else await api.post('/api/hr/departments', data);
      toast(locale === 'ar' ? 'تم الحفظ' : 'Saved'); setShowD(false); setEditD(null); reloadD(); reloadBootstrap();
    };
    const saveP = async (data) => {
      if (editP?.id) await api.put('/api/hr/positions/' + editP.id, data);
      else await api.post('/api/hr/positions', data);
      toast(locale === 'ar' ? 'تم الحفظ' : 'Saved'); setShowP(false); setEditP(null); reloadP(); reloadBootstrap();
    };

    return (
      <div className='pb'>
        <div className='hr-sub-tabs'>
          <button className={`hr-sub-tab ${sub === 'departments' ? 'active' : ''}`} onClick={() => setSub('departments')}>{locale === 'ar' ? 'الأقسام' : 'Departments'}</button>
          <button className={`hr-sub-tab ${sub === 'positions' ? 'active' : ''}`} onClick={() => setSub('positions')}>{locale === 'ar' ? 'الوظائف' : 'Positions'}</button>
        </div>

        {sub === 'departments' && <>
          <div className='hr-bar'>
            <span />
            <button className='btn btn-p' onClick={() => { setEditD(null); setShowD(true); }}><Ic name='plus' size={14} /> {locale === 'ar' ? 'قسم جديد' : 'New Department'}</button>
          </div>
          <Tbl rows={depts} cols={[
            { key: 'name', label: 'Department', ar: 'القسم' },
            { key: 'branch_name', label: 'Branch', ar: 'الفرع' },
            { key: 'manager_name', label: 'Manager', ar: 'المدير' },
            { key: 'employees_count', label: 'Employees', ar: 'الموظفون' },
          ]} loading={dL}
            onRow={r => { setEditD(r); setShowD(true); }}
            emptyLabel={locale === 'ar' ? 'لا توجد أقسام' : 'No departments'}
            emptyAction={locale === 'ar' ? 'قسم جديد' : 'New Department'} onEmptyAction={() => setShowD(true)} />
        </>}

        {sub === 'positions' && <>
          <div className='hr-bar'>
            <span />
            <button className='btn btn-p' onClick={() => { setEditP(null); setShowP(true); }}><Ic name='plus' size={14} /> {locale === 'ar' ? 'وظيفة جديدة' : 'New Position'}</button>
          </div>
          <Tbl rows={positions} cols={[
            { key: 'name', label: 'Position', ar: 'الوظيفة' },
            { key: 'department_name', label: 'Department', ar: 'القسم' },
            { key: 'grade', label: 'Grade', ar: 'الدرجة' },
            { key: 'employment_type', label: 'Type', ar: 'النوع' },
          ]} loading={pL}
            onRow={r => { setEditP(r); setShowP(true); }}
            emptyLabel={locale === 'ar' ? 'لا توجد وظائف' : 'No positions'}
            emptyAction={locale === 'ar' ? 'وظيفة جديدة' : 'New Position'} onEmptyAction={() => setShowP(true)} />
        </>}

        {showD && <FormModal title={locale === 'ar' ? (editD ? 'تعديل القسم' : 'قسم جديد') : (editD ? 'Edit Department' : 'New Department')} fields={deptFields} refs={bootstrap} initial={editD || {}} onClose={() => { setShowD(false); setEditD(null); }} onSave={saveD} />}
        {showP && <FormModal title={locale === 'ar' ? (editP ? 'تعديل الوظيفة' : 'وظيفة جديدة') : (editP ? 'Edit Position' : 'New Position')} fields={posFields} refs={bootstrap} initial={editP || {}} onClose={() => { setShowP(false); setEditP(null); }} onSave={saveP} />}
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════
  // EMPLOYEE CLOCK-IN POPUP CARD
  // ══════════════════════════════════════════════════════════
  function EmpClockPopup({ emp, onClose, onClockIn, onClockOut }) {
    const { locale } = useI18n();
    const isAr = locale === 'ar';
    const status = emp?.employee_status || 'unknown';
    const isClockedIn = emp?.is_clocked_in;
    const canClock = ['active', 'probation'].includes(status);
    const statusColor = status === 'active' ? 'var(--green)' : status === 'probation' ? 'var(--amber)' : 'var(--red)';
    const statusBg = status === 'active' ? 'var(--green-g)' : status === 'probation' ? 'var(--amber-g)' : 'var(--red-g)';
    const statusLabel = { active: isAr ? 'نشط' : 'Active', probation: isAr ? 'تجربة' : 'Probation', suspended: isAr ? 'موقوف' : 'Suspended', terminated: isAr ? 'منتهي' : 'Terminated', draft: isAr ? 'مسودة' : 'Draft' }[status] || status;
    const now = new Date(); const h12 = now.getHours() % 12 || 12; const timeStr = `${h12}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')} ${now.getHours() >= 12 ? (isAr ? 'م' : 'PM') : (isAr ? 'ص' : 'AM')}`;

    return React.createElement('div', { className: 'mo', onClick: e => e.target === e.currentTarget && onClose() },
      React.createElement('div', { className: 'cpc', dir: isAr ? 'rtl' : 'ltr' },
        React.createElement('button', { className: 'cpc-close', onClick: onClose }, '×'),
        React.createElement('div', { className: 'cpc-status-bar', style: { background: statusBg, borderColor: statusColor } },
          React.createElement('div', { className: 'cpc-status-icon', style: { color: statusColor } }, isClockedIn ? React.createElement(Ic, { name: 'clock', size: 22 }) : (canClock ? React.createElement(Ic, { name: 'check', size: 22 }) : React.createElement(Ic, { name: 'x', size: 22 }))),
          React.createElement('div', null,
            React.createElement('div', { className: 'cpc-status-text', style: { color: statusColor } }, isClockedIn ? (isAr ? 'في الدوام حالياً' : 'Currently Clocked In') : (isAr ? 'الموظف ' + statusLabel : 'Employee ' + statusLabel)),
            React.createElement('div', { className: 'cpc-time' }, timeStr))),
        React.createElement('div', { className: 'cpc-body' },
          React.createElement('div', { className: 'cpc-profile' },
            React.createElement('div', { className: 'cpc-avatar', style: { background: statusColor } }, (emp?.first_name || emp?.full_name || '?')[0]),
            React.createElement('div', { className: 'cpc-info' },
              React.createElement('div', { className: 'cpc-name' }, emp?.full_name || '—'),
              React.createElement('div', { className: 'cpc-phone' }, (isAr ? 'جوال: ' : 'Mobile: ') + (emp?.mobile || '—')),
              React.createElement('div', { className: 'cpc-member-no' }, emp?.employee_no || '—'))),
          React.createElement('div', { className: 'cpc-plan-grid' },
            React.createElement('div', { className: 'cpc-plan-item' }, React.createElement('div', { className: 'cpc-plan-label' }, isAr ? 'القسم' : 'Department'), React.createElement('div', { className: 'cpc-plan-value' }, emp?.department_name || emp?.dept || '—')),
            React.createElement('div', { className: 'cpc-plan-item' }, React.createElement('div', { className: 'cpc-plan-label' }, isAr ? 'الوظيفة' : 'Position'), React.createElement('div', { className: 'cpc-plan-value' }, emp?.position_name || emp?.pos || '—')),
            React.createElement('div', { className: 'cpc-plan-item' }, React.createElement('div', { className: 'cpc-plan-label' }, isAr ? 'البطاقة' : 'Badge'), React.createElement('div', { className: 'cpc-plan-value', style: { fontFamily: 'monospace', fontSize: 11 } }, emp?.badge_id || '—'))),
          emp?.today_log && React.createElement('div', { className: 'cpc-money-grid', style: { marginTop: 12 } },
            React.createElement('div', { className: 'cpc-money-item' }, React.createElement('div', { className: 'cpc-plan-label' }, isAr ? 'دخول' : 'Clock In'), React.createElement('div', { className: 'cpc-money-val', style: { fontSize: 13, fontFamily: 'monospace' } }, emp.today_log.check_in || '—')),
            React.createElement('div', { className: 'cpc-money-item' }, React.createElement('div', { className: 'cpc-plan-label' }, isAr ? 'خروج' : 'Clock Out'), React.createElement('div', { className: 'cpc-money-val', style: { fontSize: 13, fontFamily: 'monospace' } }, emp.today_log.check_out || (isAr ? '—' : '—'))),
            React.createElement('div', { className: 'cpc-money-item' }, React.createElement('div', { className: 'cpc-plan-label' }, isAr ? 'الساعات' : 'Hours'), React.createElement('div', { className: 'cpc-money-val', style: { fontSize: 13 } }, emp.today_log.worked_hours ? Number(emp.today_log.worked_hours).toFixed(1) + 'h' : '—')))),
        React.createElement('div', { className: 'cpc-footer' },
          isClockedIn
            ? React.createElement('button', { className: 'btn cpc-btn cpc-btn-out', onClick: () => onClockOut(emp.id) }, React.createElement('span', { style: { fontSize: 18 } }, React.createElement(Ic, { name: 'refresh', size: 18 })), isAr ? 'تسجيل خروج' : 'Clock Out')
            : canClock
              ? React.createElement('button', { className: 'btn cpc-btn cpc-btn-in', onClick: () => onClockIn(emp.id) }, React.createElement('span', { style: { fontSize: 18 } }, React.createElement(Ic, { name: 'check', size: 18 })), isAr ? 'تسجيل دخول' : 'Clock In')
              : React.createElement('button', { className: 'btn cpc-btn cpc-btn-disabled', disabled: true }, React.createElement('span', { style: { fontSize: 18 } }, React.createElement(Ic, { name: 'x', size: 18 })), isAr ? 'غير مسموح' : 'Not Allowed'),
          React.createElement('button', { className: 'btn btn-s', onClick: onClose, style: { padding: '10px 20px' } }, isAr ? 'إغلاق' : 'Close'))));
  }

  // ══════════════════════════════════════════════════════════
  // ATTENDANCE SECTION — Automated clock-in/out
  // ══════════════════════════════════════════════════════════
  function AttendanceSection() {
    const { locale } = useI18n();
    const isAr = locale === 'ar';
    const [bootstrap] = useBootstrap();
    const [stats, setStats] = useState(null);
    const [todayLogs, setTodayLogs] = useState([]);
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [popup, setPopup] = useState(null);
    const [showManual, setShowManual] = useState(false);
    const [editLog, setEditLog] = useState(null);
    const [dateF, setDateF] = useState(today());
    const [historyItems, histLoading,, reloadHist] = useLoad(`/api/hr/attendance?date=${dateF}`, [dateF], []);

    const loadToday = () => {
      api.get('/api/hr/clock/stats').then(r => setStats(r.data)).catch(() => {});
      api.get('/api/hr/clock/today').then(r => setTodayLogs(r.data || [])).catch(() => {});
    };
    useEffect(() => { loadToday(); const iv = setInterval(loadToday, 30000); return () => clearInterval(iv); }, []);

    useEffect(() => {
      if (query.length < 2) return setResults([]);
      const tm = setTimeout(() => { api.get('/api/hr/clock/search?q=' + encodeURIComponent(query)).then(r => setResults(r.data || [])).catch(() => {}); }, 250);
      return () => clearTimeout(tm);
    }, [query]);

    const showPopup = async (emp) => {
      try { const r = await api.get('/api/hr/clock/status/' + emp.id); setPopup(r.data); } catch (_) { setPopup({ ...emp, is_clocked_in: false }); }
    };

    const clockIn = async (empId) => {
      try { await api.post('/api/hr/clock/in', { employee_id: empId, source: 'fingerprint' }); toast(isAr ? 'تم تسجيل الدخول' : 'Clocked In'); setPopup(null); setQuery(''); setResults([]); loadToday(); } catch (e) { toast(e.message, 'e'); }
    };
    const clockOut = async (empId) => {
      try { await api.post('/api/hr/clock/out', { employee_id: empId }); toast(isAr ? 'تم تسجيل الخروج' : 'Clocked Out'); setPopup(null); loadToday(); } catch (e) { toast(e.message, 'e'); }
    };

    const manualFields = [
      { key: 'employee_id', label: 'Employee', labelAr: 'الموظف', type: 'select', options: (refs) => (refs.employees || []).map(x => ({ id: x.id, name: x.full_name })) },
      { key: 'attendance_date', label: 'Date', labelAr: 'التاريخ', type: 'date' },
      { key: 'check_in', label: 'Check In', labelAr: 'دخول', type: 'datetime-local' },
      { key: 'check_out', label: 'Check Out', labelAr: 'خروج', type: 'datetime-local' },
      { key: 'worked_hours', label: 'Worked Hours', labelAr: 'ساعات العمل', type: 'number' },
      { key: 'overtime_hours', label: 'Overtime', labelAr: 'الإضافي', type: 'number' },
      { key: 'status', label: 'Status', labelAr: 'الحالة', type: 'select', options: [{ value: 'present', label: 'Present', labelAr: 'حاضر' }, { value: 'late', label: 'Late', labelAr: 'متأخر' }, { value: 'absent', label: 'Absent', labelAr: 'غائب' }, { value: 'leave', label: 'Leave', labelAr: 'إجازة' }] },
      { key: 'source', label: 'Source', labelAr: 'المصدر', type: 'select', options: [{ value: 'manual', label: 'Manual', labelAr: 'يدوي' }, { value: 'fingerprint', label: 'Fingerprint', labelAr: 'بصمة' }, { value: 'barcode', label: 'Barcode/QR', labelAr: 'باركود' }] },
      { key: 'note', label: 'Note', labelAr: 'ملاحظة', type: 'textarea' },
    ];
    const saveManual = async (data) => {
      if (editLog?.id) await api.put('/api/hr/attendance/' + editLog.id, data);
      else await api.post('/api/hr/attendance', data);
      toast(isAr ? 'تم الحفظ' : 'Saved'); setShowManual(false); setEditLog(null); reloadHist(); loadToday();
    };

    return (
      <div className='pb'>
        {stats && <div className='sg' style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
          {[
            [isAr ? 'حضور اليوم' : 'Today', stats.today, 'var(--green)'],
            [isAr ? 'في الدوام' : 'Clocked In', stats.clockedIn, 'var(--accent)'],
            [isAr ? 'متأخرون' : 'Late', stats.late, 'var(--amber)'],
            [isAr ? 'غائبون' : 'Absent', stats.absent, 'var(--red)'],
          ].map(([l, v, c], i) => <div className='sc' key={i}><div className='sl'>{l}</div><div className='sv' style={{ color: i > 1 && v > 0 ? c : 'inherit' }}>{v}</div></div>)}
        </div>}

        <div className='checkin-hero'>
          <div style={{ fontSize: 16, fontWeight: 600 }}>{isAr ? 'تسجيل حضور الموظفين' : 'Employee Clock In / Out'}</div>
          <div style={{ fontSize: 13, color: 'var(--t3)' }}>{isAr ? 'ابحث بالاسم أو رقم الموظف أو امسح البطاقة أو ضع البصمة' : 'Search by name, employee number, scan badge, or use fingerprint'}</div>
          <input className='fi' placeholder={isAr ? 'اسم، رقم موظف، هاتف، أو بصمة...' : 'Name, employee no, phone, or fingerprint...'} value={query} onChange={e => setQuery(e.target.value)} autoFocus style={{ fontSize: 18, textAlign: 'center', maxWidth: 500, marginTop: 10 }} />
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 12 }}>
            <span className='badge b-info' style={{ fontSize: 11, padding: '4px 10px' }}><Ic name='search' size={11} /> {isAr ? 'بحث' : 'Search'}</span>
            <span className='badge b-active' style={{ fontSize: 11, padding: '4px 10px' }}><Ic name='scan-line' size={11} /> {isAr ? 'QR / باركود' : 'QR / Badge'}</span>
            <span className='badge b-new' style={{ fontSize: 11, padding: '4px 10px' }}><Ic name='fingerprint' size={11} /> {isAr ? 'بصمة' : 'Fingerprint'}</span>
          </div>
        </div>

        {results.length > 0 && <div className='card'>{results.map(e =>
          <div key={e.id} className='cpc-search-row' onClick={() => showPopup(e)}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div className='mws-av' style={{ width: 36, height: 36, fontSize: 14 }}>{(e.first_name || e.full_name || '?')[0]}</div>
              <div><strong style={{ fontSize: 13 }}>{e.full_name}</strong><div style={{ fontSize: 11, color: 'var(--t4)' }}>{e.employee_no} · {e.dept || '—'} · {e.pos || '—'}</div></div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <SBadge state={e.employee_status} />
              <span style={{ fontSize: 18, color: 'var(--accent-h)' }}>→</span>
            </div>
          </div>
        )}</div>}

        <div className='card'>
          <div className='ct'>{isAr ? 'سجل اليوم' : 'Today\'s Log'} ({todayLogs.length})
            <button className='btn btn-s btn-sm' onClick={() => { setEditLog(null); setShowManual(true); }}><Ic name='edit' size={13} /> {isAr ? 'تعديل يدوي' : 'Manual Override'}</button>
          </div>
          {todayLogs.length ? <table><thead><tr>
            <th>{isAr ? 'الموظف' : 'Employee'}</th><th>{isAr ? 'دخول' : 'Clock In'}</th><th>{isAr ? 'خروج' : 'Clock Out'}</th>
            <th>{isAr ? 'الساعات' : 'Hours'}</th><th>{isAr ? 'المصدر' : 'Source'}</th><th>{isAr ? 'إجراءات' : 'Actions'}</th>
          </tr></thead><tbody>{todayLogs.map(l => <tr key={l.id}>
            <td><strong style={{ fontSize: 12 }}>{l.full_name}</strong> <span style={{ fontSize: 10, color: 'var(--t4)' }}>{l.employee_no}</span></td>
            <td style={{ fontSize: 12, fontFamily: 'monospace' }}>{l.check_in || '—'}</td>
            <td style={{ fontSize: 12, fontFamily: 'monospace' }}>{l.check_out || <span className='badge b-active'>{isAr ? 'في الدوام' : 'In'}</span>}</td>
            <td style={{ fontSize: 12 }}>{l.worked_hours ? Number(l.worked_hours).toFixed(1) + 'h' : '—'}</td>
            <td><span className={'badge ' + (l.source === 'fingerprint' ? 'b-new' : l.source === 'barcode' ? 'b-info' : 'b-inactive')} style={{ fontSize: 10 }}>{l.source === 'fingerprint' ? <Ic name='fingerprint' size={10} /> : l.source === 'barcode' ? <Ic name='scan-line' size={10} /> : <Ic name='edit' size={10} />} {l.source || 'manual'}</span></td>
            <td>{!l.check_out && <button className='btn btn-s btn-sm' onClick={() => clockOut(l.employee_id)}>{isAr ? 'خروج' : 'Out'}</button>}</td>
          </tr>)}</tbody></table> : <div className='empty'><h3>{isAr ? 'لا يوجد سجل حضور لليوم بعد' : 'No attendance records today'}</h3></div>}
        </div>

        <div className='card' style={{ marginTop: 14 }}>
          <div className='ct'>{isAr ? 'سجل تاريخي' : 'History'}
            <input className='fi' type='date' value={dateF} onChange={e => setDateF(e.target.value)} style={{ width: 160, fontSize: 12 }} />
          </div>
          {histLoading ? <div className='pld'><span className='spinner' /></div> :
          historyItems.length ? <table><thead><tr>
            <th>{isAr ? 'التاريخ' : 'Date'}</th><th>{isAr ? 'الموظف' : 'Employee'}</th><th>{isAr ? 'دخول' : 'In'}</th><th>{isAr ? 'خروج' : 'Out'}</th>
            <th>{isAr ? 'الساعات' : 'Hours'}</th><th>{isAr ? 'الحالة' : 'Status'}</th><th>{isAr ? 'المصدر' : 'Source'}</th>
          </tr></thead><tbody>{historyItems.map(r => <tr key={r.id} onClick={() => { setEditLog(r); setShowManual(true); }} style={{ cursor: 'pointer' }}>
            <td style={{ fontSize: 12 }}>{r.attendance_date}</td><td style={{ fontSize: 12 }}>{r.full_name}</td>
            <td style={{ fontSize: 11, fontFamily: 'monospace' }}>{r.check_in || '—'}</td><td style={{ fontSize: 11, fontFamily: 'monospace' }}>{r.check_out || '—'}</td>
            <td style={{ fontSize: 12 }}>{r.worked_hours || '—'}</td><td><SBadge state={r.status} /></td>
            <td><span className={'badge ' + (r.source === 'fingerprint' ? 'b-new' : r.source === 'barcode' ? 'b-info' : 'b-inactive')} style={{ fontSize: 10 }}>{r.source || 'manual'}</span></td>
          </tr>)}</tbody></table> : <div className='empty' style={{ padding: 20 }}><h3>{isAr ? 'لا يوجد سجلات' : 'No records'}</h3></div>}
        </div>

        {popup && <EmpClockPopup emp={popup} onClose={() => setPopup(null)} onClockIn={clockIn} onClockOut={clockOut} />}
        {showManual && <FormModal title={isAr ? (editLog ? 'تعديل السجل' : 'إضافة يدوية') : (editLog ? 'Edit Record' : 'Manual Entry')} fields={manualFields} refs={bootstrap} initial={editLog || { attendance_date: today(), status: 'present', source: 'manual' }} onClose={() => { setShowManual(false); setEditLog(null); }} onSave={saveManual} />}
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════
  // LEAVES SECTION — with approve / reject flow
  // ══════════════════════════════════════════════════════════
  function LeavesSection() {
    const { locale } = useI18n();
    const [bootstrap] = useBootstrap();
    const [statusF, setStatusF] = useState('');
    const [items, loading,, reload] = useLoad('/api/hr/leaves', [], []);
    const [showNew, setShowNew] = useState(false);

    const filtered = statusF ? items.filter(i => i.status === statusF) : items;

    const fields = [
      { key: 'employee_id', label: 'Employee', labelAr: 'الموظف', type: 'select', options: (refs) => (refs.employees || []).map(x => ({ id: x.id, name: x.full_name })) },
      { key: 'leave_type_id', label: 'Leave Type', labelAr: 'نوع الإجازة', type: 'select', options: (refs) => (refs.leaveTypes || []).map(x => ({ id: x.id, name: x.name })) },
      { key: 'date_from', label: 'From', labelAr: 'من', type: 'date' },
      { key: 'date_to', label: 'To', labelAr: 'إلى', type: 'date' },
      { key: 'days', label: 'Days', labelAr: 'عدد الأيام', type: 'number' },
      { key: 'reason', label: 'Reason', labelAr: 'السبب', type: 'textarea' },
    ];

    const approve = async (id) => {
      await api.post('/api/hr/leaves/' + id + '/approve', {});
      toast(locale === 'ar' ? 'تم الاعتماد' : 'Approved'); reload();
    };
    const reject = async (id) => {
      const reason = prompt(locale === 'ar' ? 'سبب الرفض:' : 'Reject reason:');
      if (reason === null) return;
      await api.post('/api/hr/leaves/' + id + '/reject', { reason });
      toast(locale === 'ar' ? 'تم الرفض' : 'Rejected'); reload();
    };

    const cols = [
      { key: 'request_no', label: 'Request', ar: 'الطلب' },
      { key: 'full_name', label: 'Employee', ar: 'الموظف' },
      { key: 'leave_type_name', label: 'Type', ar: 'النوع' },
      { key: 'date_from', label: 'From', ar: 'من' },
      { key: 'date_to', label: 'To', ar: 'إلى' },
      { key: 'days', label: 'Days', ar: 'الأيام' },
      { key: 'status', label: 'Status', ar: 'الحالة', render: r => <SBadge state={r.status} /> },
      {
        key: 'actions', label: '', ar: '', render: r => r.status === 'pending'
          ? <div style={{ display: 'flex', gap: 6 }}>
            <button className='btn btn-g btn-sm' onClick={e => { e.stopPropagation(); approve(r.id); }}><Ic name='check' size={14} /></button>
            <button className='btn btn-d btn-sm' onClick={e => { e.stopPropagation(); reject(r.id); }}><Ic name='x' size={14} /></button>
          </div>
          : null
      },
    ];

    return (
      <div className='pb'>
        <div className='hr-bar'>
          <div className='fb' style={{ margin: 0 }}>
            <select className='fi' style={{ minWidth: 140 }} value={statusF} onChange={e => setStatusF(e.target.value)}>
              <option value=''>{locale === 'ar' ? 'كل الحالات' : 'All'}</option>
              <option value='pending'>{locale === 'ar' ? 'معلق' : 'Pending'}</option>
              <option value='approved'>{locale === 'ar' ? 'معتمد' : 'Approved'}</option>
              <option value='rejected'>{locale === 'ar' ? 'مرفوض' : 'Rejected'}</option>
            </select>
          </div>
          <button className='btn btn-p' onClick={() => setShowNew(true)}><Ic name='plus' size={14} /> {locale === 'ar' ? 'طلب إجازة' : 'New Leave Request'}</button>
        </div>
        <Tbl rows={filtered} cols={cols} loading={loading}
          emptyLabel={locale === 'ar' ? 'لا توجد طلبات إجازة' : 'No leave requests'}
          emptyAction={locale === 'ar' ? 'طلب إجازة' : 'New Request'} onEmptyAction={() => setShowNew(true)} />
        {showNew && <FormModal title={locale === 'ar' ? 'طلب إجازة جديد' : 'New Leave Request'} fields={fields} refs={bootstrap} initial={{ days: 1 }} onClose={() => setShowNew(false)} onSave={async (data) => { await api.post('/api/hr/leaves', data); toast(locale === 'ar' ? 'تم الإرسال' : 'Submitted'); setShowNew(false); reload(); }} />}
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════
  // CONTRACTS SECTION
  // ══════════════════════════════════════════════════════════
  function ContractsSection() {
    const { locale } = useI18n();
    const [bootstrap] = useBootstrap();
    const [statusF, setStatusF] = useState('');
    const [items, loading,, reload] = useLoad('/api/hr/contracts', [], []);
    const [show, setShow] = useState(false);
    const [edit, setEdit] = useState(null);
    const filtered = statusF ? items.filter(c => c.status === statusF) : items;

    const fields = [
      { key: 'employee_id', label: 'Employee', labelAr: 'الموظف', type: 'select', options: (refs) => (refs.employees || []).map(x => ({ id: x.id, name: x.full_name })) },
      { key: 'contract_type', label: 'Type', labelAr: 'النوع', type: 'select', options: [{ value: 'permanent', label: 'Permanent', labelAr: 'دائم' }, { value: 'limited', label: 'Limited', labelAr: 'محدد' }, { value: 'temporary', label: 'Temporary', labelAr: 'مؤقت' }] },
      { key: 'start_date', label: 'Start Date', labelAr: 'تاريخ البداية', type: 'date' },
      { key: 'end_date', label: 'End Date', labelAr: 'تاريخ النهاية', type: 'date' },
      { key: 'probation_days', label: 'Probation Days', labelAr: 'أيام التجربة', type: 'number' },
      { key: 'wage', label: 'Wage', labelAr: 'الأجر', type: 'number' },
      { key: 'allowance_total', label: 'Total Allowances', labelAr: 'إجمالي البدلات', type: 'number' },
      { key: 'payroll_cycle', label: 'Payroll Cycle', labelAr: 'دورة الرواتب', type: 'select', options: [{ value: 'monthly', label: 'Monthly', labelAr: 'شهري' }, { value: 'biweekly', label: 'Biweekly', labelAr: 'نصف شهري' }, { value: 'weekly', label: 'Weekly', labelAr: 'أسبوعي' }] },
      { key: 'status', label: 'Status', labelAr: 'الحالة', type: 'select', options: [{ value: 'draft', label: 'Draft', labelAr: 'مسودة' }, { value: 'active', label: 'Active', labelAr: 'نشط' }, { value: 'expired', label: 'Expired', labelAr: 'منتهي' }] },
      { key: 'notes', label: 'Notes', labelAr: 'ملاحظات', type: 'textarea' },
    ];
    const save = async (data) => {
      if (edit?.id) await api.put('/api/hr/contracts/' + edit.id, data);
      else await api.post('/api/hr/contracts', data);
      toast(locale === 'ar' ? 'تم الحفظ' : 'Saved'); setShow(false); setEdit(null); reload();
    };

    return (
      <div className='pb'>
        <div className='hr-bar'>
          <div className='fb' style={{ margin: 0 }}>
            <select className='fi' style={{ minWidth: 130 }} value={statusF} onChange={e => setStatusF(e.target.value)}>
              <option value=''>{locale === 'ar' ? 'كل الحالات' : 'All'}</option>
              <option value='draft'>{locale === 'ar' ? 'مسودة' : 'Draft'}</option>
              <option value='active'>{locale === 'ar' ? 'نشط' : 'Active'}</option>
              <option value='expired'>{locale === 'ar' ? 'منتهي' : 'Expired'}</option>
            </select>
          </div>
          <button className='btn btn-p' onClick={() => { setEdit(null); setShow(true); }}><Ic name='plus' size={14} /> {locale === 'ar' ? 'عقد جديد' : 'New Contract'}</button>
        </div>
        <Tbl rows={filtered} cols={[
          { key: 'contract_ref', label: 'Reference', ar: 'المرجع' },
          { key: 'full_name', label: 'Employee', ar: 'الموظف' },
          { key: 'contract_type', label: 'Type', ar: 'النوع' },
          { key: 'start_date', label: 'Start', ar: 'البداية' },
          { key: 'end_date', label: 'End', ar: 'النهاية' },
          { key: 'wage', label: 'Wage', ar: 'الأجر', render: r => fmt(r.wage) },
          { key: 'status', label: 'Status', ar: 'الحالة', render: r => <SBadge state={r.status} /> },
        ]} loading={loading}
          onRow={r => { setEdit(r); setShow(true); }}
          emptyLabel={locale === 'ar' ? 'لا توجد عقود' : 'No contracts'}
          emptyAction={locale === 'ar' ? 'عقد جديد' : 'New Contract'} onEmptyAction={() => setShow(true)} />
        {show && <FormModal title={locale === 'ar' ? (edit ? 'تعديل العقد' : 'عقد جديد') : (edit ? 'Edit Contract' : 'New Contract')} fields={fields} refs={bootstrap} initial={edit || {}} onClose={() => { setShow(false); setEdit(null); }} onSave={save} />}
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════
  // PAYROLL SECTION — Odoo-like generate → review → approve
  // ══════════════════════════════════════════════════════════
  function PayrollSection() {
    const { locale } = useI18n();
    const now = new Date();
    const [year, setYear] = useState(now.getFullYear());
    const [month, setMonth] = useState(now.getMonth() + 1);
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [generating, setGenerating] = useState(false);

    const load = () => {
      setLoading(true);
      api.get(`/api/hr/payroll?year=${year}&month=${month}`)
        .then(r => setData(r.data))
        .catch(e => toast(e.message, 'e'))
        .finally(() => setLoading(false));
    };
    useEffect(() => { load(); }, [year, month]);

    const generate = async () => {
      try {
        setGenerating(true);
        const r = await api.post('/api/hr/payroll/generate', { year, month });
        toast(locale === 'ar' ? `تم توليد ${r.data.generated} راتب` : `Generated ${r.data.generated} payslips`);
        load();
      } catch (e) { toast(e.message || 'Failed', 'e'); }
      finally { setGenerating(false); }
    };

    const months = locale === 'ar'
      ? ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر']
      : ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    return (
      <div className='pb'>
        <div className='hr-bar'>
          <div className='fb' style={{ margin: 0 }}>
            <select className='fi' value={month} onChange={e => setMonth(Number(e.target.value))}>
              {months.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
            </select>
            <input className='fi' type='number' value={year} onChange={e => setYear(Number(e.target.value))} style={{ width: 90 }} />
          </div>
          <button className='btn btn-p' onClick={generate} disabled={generating}>
            {generating ? '...' : (locale === 'ar' ? 'توليد الرواتب' : 'Generate Payroll')}
          </button>
        </div>

        {loading
          ? <div className='pld'><span className='spinner' /></div>
          : data?.summary ? <>
            <div className='sg' style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
              {[
                [locale === 'ar' ? 'الموظفون' : 'Employees', data.summary.employees],
                [locale === 'ar' ? 'الأساسي' : 'Basic', fmt(data.summary.basic)],
                [locale === 'ar' ? 'البدلات' : 'Allowances', fmt(data.summary.allowances)],
                [locale === 'ar' ? 'الإضافي' : 'Overtime', fmt(data.summary.overtime)],
                [locale === 'ar' ? 'الصافي' : 'Net Pay', fmt(data.summary.net)],
              ].map(([label, val], i) => (
                <div className='sc' key={i}>
                  <div className='sl'>{label}</div>
                  <div className='sv' style={{ fontSize: i === 4 ? 20 : 18, color: i === 4 ? 'var(--green)' : 'inherit' }}>{val}</div>
                </div>
              ))}
            </div>
            <div className='card' style={{ padding: 0, overflow: 'hidden', marginTop: 14 }}>
              <table>
                <thead><tr>
                  <th>{locale === 'ar' ? 'رقم الموظف' : 'Employee No'}</th>
                  <th>{locale === 'ar' ? 'الموظف' : 'Employee'}</th>
                  <th>{locale === 'ar' ? 'الأساسي' : 'Basic'}</th>
                  <th>{locale === 'ar' ? 'البدلات' : 'Allowances'}</th>
                  <th>{locale === 'ar' ? 'الإضافي' : 'OT'}</th>
                  <th>{locale === 'ar' ? 'الخصومات' : 'Deductions'}</th>
                  <th>{locale === 'ar' ? 'الصافي' : 'Net'}</th>
                  <th>{locale === 'ar' ? 'الحالة' : 'Status'}</th>
                </tr></thead>
                <tbody>
                  {(data.rows || []).length === 0
                    ? <tr><td colSpan={8}><div className='empty'><h3>{locale === 'ar' ? 'لا توجد رواتب لهذا الشهر — اضغط توليد الرواتب' : 'No payslips for this period — click Generate'}</h3></div></td></tr>
                    : (data.rows || []).map(r => {
                      let dd = null;
                      try { dd = r.deduction_details ? JSON.parse(r.deduction_details) : null; } catch (_) {}
                      return (
                      <tr key={r.id}>
                        <td>{r.employee_no}</td>
                        <td>{r.full_name}</td>
                        <td>{fmt(r.basic)}</td>
                        <td>{fmt(r.allowances)}</td>
                        <td>{fmt(r.overtime_amount)}</td>
                        <td style={{ position: 'relative' }}>
                          <span style={{ fontWeight: Number(r.deductions) > 0 ? 700 : 400, color: Number(r.deductions) > 0 ? 'var(--red)' : 'inherit' }}>{fmt(r.deductions)}</span>
                          {dd && (dd.lateDays > 0 || dd.absentDays > 0) && <div style={{ fontSize: 10, color: 'var(--t3)', marginTop: 2 }}>
                            {dd.lateDays > 0 && <span style={{ color: 'var(--amber)' }}>{locale === 'ar' ? `تأخير ${dd.lateDays}ي` : `${dd.lateDays}d late`} </span>}
                            {dd.absentDays > 0 && <span style={{ color: 'var(--red)' }}>{locale === 'ar' ? `غياب ${dd.absentDays}ي` : `${dd.absentDays}d absent`}</span>}
                          </div>}
                        </td>
                        <td style={{ fontWeight: 600, color: 'var(--green)' }}>{fmt(r.net_amount)}</td>
                        <td><SBadge state={r.status} /></td>
                      </tr>
                    );})
                  }
                </tbody>
              </table>
            </div>
          </>
          : <div className='empty'><h3>{locale === 'ar' ? 'اضغط توليد الرواتب لبدء كشف رواتب هذا الشهر' : 'Click Generate Payroll to create this period\'s payslips'}</h3></div>
        }
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════
  // RECRUITMENT SECTION — Kanban pipeline + list
  // ══════════════════════════════════════════════════════════
  function RecruitmentSection() {
    const { locale } = useI18n();
    const [bootstrap] = useBootstrap();
    const [view, setView] = useState('pipeline');
    const [items, loading,, reload] = useLoad('/api/hr/recruitment', [], []);
    const [show, setShow] = useState(false);
    const [edit, setEdit] = useState(null);

    const stages = [
      { key: 'new', en: 'New', ar: 'جديد' },
      { key: 'screening', en: 'Screening', ar: 'فرز' },
      { key: 'interview', en: 'Interview', ar: 'مقابلة' },
      { key: 'offer', en: 'Offer', ar: 'عرض' },
      { key: 'hired', en: 'Hired', ar: 'تم التعيين' },
      { key: 'rejected', en: 'Rejected', ar: 'مرفوض' },
    ];

    const fields = [
      { key: 'full_name', label: 'Applicant Name', labelAr: 'اسم المتقدم' },
      { key: 'email', label: 'Email', labelAr: 'البريد', type: 'email' },
      { key: 'mobile', label: 'Mobile', labelAr: 'الجوال' },
      { key: 'position_id', label: 'Position', labelAr: 'الوظيفة', type: 'select', options: (refs) => (refs.positions || []).map(x => ({ id: x.id, name: x.name })) },
      { key: 'source', label: 'Source', labelAr: 'المصدر' },
      { key: 'stage', label: 'Stage', labelAr: 'المرحلة', type: 'select', options: stages.map(s => ({ value: s.key, label: s.en, labelAr: s.ar })) },
      { key: 'expected_salary', label: 'Expected Salary', labelAr: 'الراتب المتوقع', type: 'number' },
      { key: 'available_from', label: 'Available From', labelAr: 'متاح من', type: 'date' },
      { key: 'notes', label: 'Notes', labelAr: 'ملاحظات', type: 'textarea' },
    ];

    const save = async (data) => {
      if (edit?.id) await api.put('/api/hr/recruitment/' + edit.id, data);
      else await api.post('/api/hr/recruitment', data);
      toast(locale === 'ar' ? 'تم الحفظ' : 'Saved'); setShow(false); setEdit(null); reload();
    };

    return (
      <div className='pb'>
        <div className='hr-bar'>
          <div style={{ display: 'flex', gap: 4 }}>
            <button className={`btn ${view === 'pipeline' ? 'btn-p' : 'btn-s'} btn-sm`} onClick={() => setView('pipeline')}><Ic name='grid' size={14} /> {locale === 'ar' ? 'بايبلاين' : 'Pipeline'}</button>
            <button className={`btn ${view === 'list' ? 'btn-p' : 'btn-s'} btn-sm`} onClick={() => setView('list')}><Ic name='menu' size={14} /> {locale === 'ar' ? 'قائمة' : 'List'}</button>
          </div>
          <button className='btn btn-p' onClick={() => { setEdit(null); setShow(true); }}><Ic name='plus' size={14} /> {locale === 'ar' ? 'متقدم جديد' : 'New Applicant'}</button>
        </div>

        {loading
          ? <div className='pld'><span className='spinner' /></div>
          : view === 'pipeline'
            ? <div className='hr-pipeline'>
              {stages.map(s => {
                const group = items.filter(i => i.stage === s.key);
                return (
                  <div className='hr-pipeline-col' key={s.key}>
                    <div className='hr-pipeline-hdr'>
                      {locale === 'ar' ? s.ar : s.en}
                      <span className='hr-pipeline-count'>{group.length}</span>
                    </div>
                    {group.length === 0
                      ? <div style={{ padding: '12px', fontSize: 12, color: 'var(--t4)', textAlign: 'center' }}>—</div>
                      : group.map(a => (
                        <div className='hr-pipeline-card' key={a.id} onClick={() => { setEdit(a); setShow(true); }}>
                          <div className='hr-pipeline-card-name'>{a.full_name}</div>
                          <div className='hr-pipeline-card-sub'>{a.position_name || '—'}</div>
                          {a.expected_salary ? <div className='hr-pipeline-card-sub'>{fmt(a.expected_salary)}</div> : null}
                        </div>
                      ))
                    }
                  </div>
                );
              })}
            </div>
            : <Tbl rows={items} cols={[
              { key: 'full_name', label: 'Applicant', ar: 'المتقدم' },
              { key: 'position_name', label: 'Position', ar: 'الوظيفة' },
              { key: 'source', label: 'Source', ar: 'المصدر' },
              { key: 'stage', label: 'Stage', ar: 'المرحلة', render: r => <SBadge state={r.stage} /> },
              { key: 'expected_salary', label: 'Expected Salary', ar: 'الراتب المتوقع', render: r => fmt(r.expected_salary) },
            ]} onRow={r => { setEdit(r); setShow(true); }}
              emptyLabel={locale === 'ar' ? 'لا يوجد متقدمون' : 'No applicants'}
              emptyAction={locale === 'ar' ? 'متقدم جديد' : 'New Applicant'} onEmptyAction={() => setShow(true)} />
        }

        {show && <FormModal title={locale === 'ar' ? (edit ? 'تعديل المتقدم' : 'متقدم جديد') : (edit ? 'Edit Applicant' : 'New Applicant')} fields={fields} refs={bootstrap} initial={edit || { stage: 'new' }} onClose={() => { setShow(false); setEdit(null); }} onSave={save} />}
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════
  // MAIN HR WORKSPACE
  // ══════════════════════════════════════════════════════════
  function HrWorkspace() {
    const { locale } = useI18n();
    const [tab, setTab] = useState('dashboard');

    const tabs = [
      ['dashboard', 'Dashboard',    'لوحة التحكم', <Ic name='grid' size={14}/>],
      ['employees', 'Employees',    'الموظفون',    <Ic name='user' size={14} />],
      ['organization','Organization','الهيكل التنظيمي',<Ic name='building' size={14} />],
      ['attendance', 'Attendance',  'الحضور',      <Ic name='calendar' size={14} />],
      ['leaves',    'Leaves',       'الإجازات',    <Ic name='palm-tree' size={14} />],
      ['contracts', 'Contracts',    'العقود',      <Ic name='clipboard' size={14} />],
      ['payroll',   'Payroll',      'الرواتب',     <Ic name='dollar-sign' size={14} />],
      ['recruitment','Recruitment', 'التوظيف',     <Ic name='target' size={14} />],
    ];

    return (
      <div>
        {/* Top Navigation */}
        <div className='hr-top-nav'>
          <div className='hr-top-nav-brand'>
            <Ic name='users' size={16} /> {locale === 'ar' ? 'الموارد البشرية' : 'HR'}
          </div>
          <div className='hr-top-nav-tabs'>
            {tabs.map(([k, en, ar, icon]) => (
              <button key={k} className={`hr-nav-tab ${tab === k ? 'active' : ''}`} onClick={() => setTab(k)}>
                <span style={{ fontSize: 13 }}>{icon}</span>
                <span>{locale === 'ar' ? ar : en}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Page header */}
        <div className='ph'>
          <h1>{locale === 'ar' ? tabs.find(t => t[0] === tab)?.[2] : tabs.find(t => t[0] === tab)?.[1]}</h1>
          <p style={{ color: 'var(--t3)', fontSize: 13 }}>
            {locale === 'ar' ? 'إدارة الموارد البشرية على نمط أودو' : 'Odoo-style human resources management'}
          </p>
        </div>

        {/* Sections */}
        {tab === 'dashboard'    && <DashboardSection />}
        {tab === 'employees'    && <EmployeesSection />}
        {tab === 'organization' && <OrganizationSection />}
        {tab === 'attendance'   && <AttendanceSection />}
        {tab === 'leaves'       && <LeavesSection />}
        {tab === 'contracts'    && <ContractsSection />}
        {tab === 'payroll'      && <PayrollSection />}
        {tab === 'recruitment'  && <RecruitmentSection />}
      </div>
    );
  }

  // Single page registration
  GymOS.registerPage({
    path: '/hr',
    component: HrWorkspace,
    module: 'hr',
    label: 'HR',
    labelAr: 'الموارد البشرية',
    order: 60
  });

})();
