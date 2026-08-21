// Analytics Reports — Peak Hours + Monthly Comparison
(function(){
  const { useState, useEffect, useCallback } = React;
  const { api, useI18n, useRouter } = GymOS.shared;

  function AnalyticsPage(){
    const {t,locale,formatCurrency}=useI18n();
    const isAr=locale==='ar';
    const money=v=>formatCurrency?formatCurrency(Number(v||0)):`${Number(v||0).toFixed(2)}`;
    const [tab,setTab]=useState('peak');
    const [peakData,setPeakData]=useState(null);
    const [monthlyData,setMonthlyData]=useState(null);
    const [loading,setLoading]=useState(true);
    const [days,setDays]=useState(30);

    const loadPeak=useCallback(()=>{
      api.get('/api/reports/peak-hours?days='+days).then(r=>setPeakData(r.data)).catch(()=>{});
    },[days]);
    const loadMonthly=useCallback(()=>{
      api.get('/api/reports/monthly-comparison?months=6').then(r=>setMonthlyData(r.data)).catch(()=>{});
    },[]);

    useEffect(()=>{setLoading(true);Promise.all([loadPeak(),loadMonthly()]).finally(()=>setLoading(false))},[]);
    useEffect(()=>{loadPeak()},[days]);

    if(loading&&!peakData)return <div className='pld'><span className='spinner'/></div>;

    const maxVisits=peakData?Math.max(...peakData.hours.map(h=>h.visits),1):1;
    const maxDayVisits=peakData?Math.max(...peakData.byDay.map(d=>d.visits),1):1;

    const monthlyMax=monthlyData?Math.max(...monthlyData.map(m=>m.totalRevenue),1):1;
    const memberMax=monthlyData?Math.max(...monthlyData.map(m=>m.newMembers),1):1;

    return <div className='pb'>
      <div className='ph'>
        <h1>{isAr?'التقارير والتحليلات':'Reports & Analytics'}</h1>
        <p style={{color:'var(--t3)',fontSize:13}}>{isAr?'ساعات الذروة والمقارنة الشهرية':'Peak hours and monthly comparison'}</p>
      </div>

      <div style={{display:'flex',gap:8,marginBottom:20}}>
        <button className={'btn '+(tab==='peak'?'btn-p':'btn-s')} onClick={()=>setTab('peak')}>{isAr?'ساعات الذروة':'Peak Hours'}</button>
        <button className={'btn '+(tab==='monthly'?'btn-p':'btn-s')} onClick={()=>setTab('monthly')}>{isAr?'مقارنة شهرية':'Monthly Comparison'}</button>
      </div>

      {tab==='peak'&&peakData&&<div style={{display:'grid',gap:16}}>
        <div style={{display:'flex',gap:10,alignItems:'center'}}>
          <span style={{fontSize:13,color:'var(--t3)'}}>{isAr?'الفترة:':'Period:'}</span>
          <select className='fi' style={{width:150,fontSize:13}} value={days} onChange={e=>setDays(Number(e.target.value))}>
            <option value={7}>{isAr?'آخر 7 أيام':'Last 7 days'}</option>
            <option value={30}>{isAr?'آخر 30 يوم':'Last 30 days'}</option>
            <option value={90}>{isAr?'آخر 3 أشهر':'Last 3 months'}</option>
            <option value={365}>{isAr?'آخر سنة':'Last year'}</option>
          </select>
        </div>

        {peakData.peakHour&&<div className='card' style={{margin:0,padding:16,background:'linear-gradient(135deg,#0891b2 0%,#06b6d4 100%)',color:'#fff',borderRadius:12}}>
          <div style={{fontSize:13,opacity:.8}}>{isAr?'ساعة الذروة':'Peak Hour'}</div>
          <div style={{fontSize:32,fontWeight:800}}>{peakData.peakHour.label}</div>
          <div style={{fontSize:14}}>{peakData.peakHour.visits} {isAr?'زيارة':'visits'} · {peakData.peakHour.unique_members} {isAr?'عضو':'members'}</div>
        </div>}

        <div className='card' style={{margin:0}}>
          <div className='ct'>{isAr?'توزيع الزيارات حسب الساعة':'Visits by Hour'}</div>
          <div style={{display:'flex',alignItems:'flex-end',gap:3,height:180,padding:'10px 0'}}>
            {peakData.hours.map(h=>{
              const pct=Math.max(2,(h.visits/maxVisits)*100);
              const isPeak=h.hour===peakData.peakHour?.hour;
              return <div key={h.hour} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:4}} title={`${h.label}: ${h.visits} visits`}>
                <div style={{fontSize:9,color:'var(--t3)',fontWeight:700}}>{h.visits||''}</div>
                <div style={{width:'100%',height:pct+'%',minHeight:2,background:isPeak?'#0891b2':h.visits>0?'#94a3b8':'#e2e8f0',borderRadius:3,transition:'height .3s'}}/>
                <div style={{fontSize:9,color:'var(--t3)'}}>{h.hour}</div>
              </div>
            })}
          </div>
        </div>

        <div className='card' style={{margin:0}}>
          <div className='ct'>{isAr?'توزيع الزيارات حسب اليوم':'Visits by Day of Week'}</div>
          <div style={{display:'grid',gap:8,padding:'10px 0'}}>
            {peakData.byDay.map(d=>{
              const pct=Math.max(2,(d.visits/maxDayVisits)*100);
              return <div key={d.dow} style={{display:'flex',alignItems:'center',gap:10}}>
                <div style={{width:60,fontSize:13,fontWeight:600,textAlign:'end'}}>{isAr?d.dayAr:d.dayEn}</div>
                <div style={{flex:1,height:24,background:'#f1f5f9',borderRadius:6,overflow:'hidden'}}>
                  <div style={{width:pct+'%',height:'100%',background:'#0891b2',borderRadius:6,transition:'width .3s'}}/>
                </div>
                <div style={{width:50,fontSize:12,fontWeight:700,textAlign:'start'}}>{d.visits}</div>
              </div>
            })}
          </div>
        </div>
      </div>}

      {tab==='monthly'&&monthlyData&&<div style={{display:'grid',gap:16}}>
        <div className='card' style={{margin:0}}>
          <div className='ct'>{isAr?'الإيرادات الشهرية':'Monthly Revenue'}</div>
          <div style={{display:'flex',alignItems:'flex-end',gap:8,height:200,padding:'10px 0'}}>
            {monthlyData.map(m=>{
              const pct=Math.max(4,(m.totalRevenue/monthlyMax)*100);
              return <div key={m.month} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:4}}>
                <div style={{fontSize:10,color:'var(--t3)',fontWeight:700}}>{money(m.totalRevenue)}</div>
                <div style={{width:'100%',display:'flex',flexDirection:'column',gap:1,height:pct+'%'}}>
                  <div style={{flex:m.revenue,background:'#10b981',borderRadius:'4px 4px 0 0',minHeight:2}} title={(isAr?'اشتراكات: ':'Memberships: ')+money(m.revenue)}/>
                  <div style={{flex:Math.max(m.cafRevenue,0.01),background:'#f59e0b',borderRadius:'0 0 4px 4px',minHeight:m.cafRevenue>0?2:0}} title={(isAr?'كافتيريا: ':'Cafeteria: ')+money(m.cafRevenue)}/>
                </div>
                <div style={{fontSize:10,color:'var(--t3)'}}>{m.month?.slice(5)||''}</div>
              </div>
            })}
          </div>
          <div style={{display:'flex',gap:16,justifyContent:'center',fontSize:12,marginTop:8}}>
            <span><span style={{display:'inline-block',width:10,height:10,borderRadius:3,background:'#10b981',marginLeft:4}}></span> {isAr?'اشتراكات':'Memberships'}</span>
            <span><span style={{display:'inline-block',width:10,height:10,borderRadius:3,background:'#f59e0b',marginLeft:4}}></span> {isAr?'كافتيريا':'Cafeteria'}</span>
          </div>
        </div>

        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))',gap:12}}>
          <div className='card' style={{margin:0}}>
            <div className='ct'>{isAr?'أعضاء جدد':'New Members'}</div>
            <div style={{display:'flex',alignItems:'flex-end',gap:6,height:120,padding:'10px 0'}}>
              {monthlyData.map(m=>{
                const pct=Math.max(4,(m.newMembers/memberMax)*100);
                return <div key={m.month} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:4}}>
                  <div style={{fontSize:10,fontWeight:700}}>{m.newMembers}</div>
                  <div style={{width:'100%',height:pct+'%',background:'#6366f1',borderRadius:4,minHeight:2}}/>
                  <div style={{fontSize:9,color:'var(--t3)'}}>{m.month?.slice(5)}</div>
                </div>
              })}
            </div>
          </div>
          <div className='card' style={{margin:0}}>
            <div className='ct'>{isAr?'معدل التجديد':'Renewal Rate'}</div>
            <div style={{display:'flex',alignItems:'flex-end',gap:6,height:120,padding:'10px 0'}}>
              {monthlyData.map(m=>{
                return <div key={m.month} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:4}}>
                  <div style={{fontSize:10,fontWeight:700}}>{m.renewalRate}%</div>
                  <div style={{width:'100%',height:Math.max(4,m.renewalRate)+'%',background:m.renewalRate>=50?'#10b981':m.renewalRate>=25?'#f59e0b':'#ef4444',borderRadius:4,minHeight:2}}/>
                  <div style={{fontSize:9,color:'var(--t3)'}}>{m.month?.slice(5)}</div>
                </div>
              })}
            </div>
          </div>
        </div>

        <div className='card' style={{margin:0}}>
          <div className='ct'>{isAr?'جدول المقارنة الشهرية':'Monthly Comparison Table'}</div>
          <div style={{overflowX:'auto'}}><table><thead><tr>
            <th>{isAr?'الشهر':'Month'}</th>
            <th>{isAr?'إيراد الاشتراكات':'Membership Rev.'}</th>
            <th>{isAr?'إيراد الكافتيريا':'Cafeteria Rev.'}</th>
            <th>{isAr?'الإجمالي':'Total'}</th>
            <th>{isAr?'أعضاء جدد':'New Members'}</th>
            <th>{isAr?'اشتراكات جديدة':'New Subs'}</th>
            <th>{isAr?'تجديدات':'Renewals'}</th>
            <th>{isAr?'معدل التجديد':'Renewal %'}</th>
            <th>{isAr?'الحضور':'Attendance'}</th>
          </tr></thead><tbody>
            {monthlyData.map(m=><tr key={m.month}>
              <td style={{fontWeight:700}}>{m.month}</td>
              <td>{money(m.revenue)}</td>
              <td>{money(m.cafRevenue)}</td>
              <td style={{fontWeight:700}}>{money(m.totalRevenue)}</td>
              <td>{m.newMembers}</td>
              <td>{m.newMemberships}</td>
              <td>{m.renewals}</td>
              <td><span className={'badge '+(m.renewalRate>=50?'b-active':m.renewalRate>=25?'b-partial':'b-danger')}>{m.renewalRate}%</span></td>
              <td>{m.attendance}</td>
            </tr>)}
          </tbody></table></div>
        </div>
      </div>}
    </div>;
  }

  GymOS.registerPage({ path:'/analytics', component:AnalyticsPage, module:'memberships', label:'Analytics', labelAr:'التحليلات', order:50 });
  GymOS.registerMenu({ path:'/analytics', label:'Analytics', labelAr:'التحليلات', icon:'bar-chart-2', order:50, module:'memberships' });
})();
