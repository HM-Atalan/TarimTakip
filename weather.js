// ============================================================
// weather.js – Hava durumu ve arşiv
// ============================================================

window.fetchWXHistory = async (field) => {
  const id  = field.id;
  const now = Date.now();
  const CACHE_TTL = 21600000; // 6 saat
  if(WX_HISTORY[id] && (now - WX_HISTORY[id].updatedAt < CACHE_TTL)) {
    return WX_HISTORY[id].days;
  }
  const stored = window.loadWXHistoryLocal(id);
  if(stored?.length) {
    WX_HISTORY[id] = { days: stored, updatedAt: now - CACHE_TTL + 300000 };
  }
  try {
    const endDate   = new Date(); endDate.setDate(endDate.getDate() - 1);
    // RZWB keeps its own 90-day ledger window, but phenology/GDD seasons in
    // the crop table extend well beyond 90 days. Keep up to one full year of
    // weather so long-season crops are not silently calculated from a partial
    // temperature history.
    const startDate = new Date(); startDate.setDate(startDate.getDate() - 366);
    const ed = window.dateKey(endDate);
    const sd = window.dateKey(startDate);
    const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${field.lat}&longitude=${field.lon}` +
      `&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,et0_fao_evapotranspiration,shortwave_radiation_sum` +
      `&start_date=${sd}&end_date=${ed}&timezone=Europe%2FIstanbul`;
    const r = await fetch(url);
    if(!r.ok) throw new Error('Archive HTTP ' + r.status);
    const data = await r.json();
    const days = (data.daily?.time || []).map((t, i) => ({
      date:  t,
      tmax:  Math.round(data.daily.temperature_2m_max[i] ?? 25),
      tmin:  Math.round(data.daily.temperature_2m_min[i] ?? 12),
      rain:  +(data.daily.precipitation_sum[i] || 0).toFixed(1),
      et0:   +(data.daily.et0_fao_evapotranspiration?.[i] || 0).toFixed(1),
      solar: +(data.daily.shortwave_radiation_sum?.[i] || 0).toFixed(1),
    })).filter(d => d.date >= sd);
    const cutoffStr = sd;
    const existingDays  = WX_HISTORY[id]?.days || [];
    const existingDates = new Set(existingDays.map(d => d.date));
    const merged = [...existingDays.filter(d => d.date >= cutoffStr),
                    ...days.filter(d => !existingDates.has(d.date))];
    merged.sort((a, b) => a.date.localeCompare(b.date));
    WX_HISTORY[id] = { days: merged, updatedAt: now };
    window.saveWXHistoryLocal(id, merged);
    console.log(`📅 ${field.name}: ${merged.length} günlük arşiv verisi (en fazla 366g)`);
    return merged;
  } catch(e) {
    console.warn('WXHistory hatası:', e.message);
    return WX_HISTORY[id]?.days || [];
  }
};

window.saveWXHistoryLocal = (fieldId, days) => {
  try {
    const compact = days.map(d => [d.date, d.tmax, d.tmin,
      +(d.rain).toFixed(1), +(d.et0).toFixed(1)]);
    localStorage.setItem('tt_wxh_' + fieldId, JSON.stringify(compact));
  } catch(e) {}
};

window.loadWXHistoryLocal = (fieldId) => {
  try {
    const raw = localStorage.getItem('tt_wxh_' + fieldId);
    if(!raw) return null;
    const compact = JSON.parse(raw);
    return compact.map(d => ({ date:d[0], tmax:d[1], tmin:d[2], rain:d[3], et0:d[4], solar:0 }));
  } catch(e) { return null; }
};

window.getBestWXDays = (field) => {
  const hist = WX_HISTORY[field.id]?.days || [];
  const curr = WXC[field.id]?.days || [];
  const fallback = simWX(field.lat, field.lon);
  if(!hist.length && !curr.length) return fallback;
  const combined = {};
  fallback.forEach(d => { combined[d.date] = d; });
  hist.forEach(d => { combined[d.date] = d; });
  curr.forEach(d => { combined[d.date] = { ...combined[d.date], ...d }; });
  return Object.values(combined).sort((a, b) => a.date.localeCompare(b.date));
};

window.simWX = (lat, lon) => {
  const days=[]; const now=new Date();
  for(let i=-7;i<=7;i++){
    const d=new Date(now); d.setDate(now.getDate()+i);
    const sd=((lat*100+lon*50+d.getDate()*3+d.getMonth()*17)%97+97)%97;
    const base=16+Math.sin(d.getMonth()/2)*13+(lat>38?-3:3);
    const tmax=Math.round(base+sd%10-2);
    const rain=sd<18?+(sd*1.4).toFixed(1):sd<28?+((sd-18)*0.3).toFixed(1):0;
    const tmin = tmax-Math.round(5+sd%7);
    const date = window.dateKey(d);
    const et0 = window.calcFallbackET0({ date, tmax, tmin }, lat);
    days.push({date,tmax,tmin,rain,wind:Math.round(8+sd%22),code:rain>5?63:rain>0?80:sd>60?2:0,et0:+et0.toFixed(1),et0Source:'fao56-hargreaves-fallback'});
  }
  return days;
};

window.fetchWX = async (field) => {
  field = field||CUR; if(!field) return;
  const id=field.id, lat=field.lat, lon=field.lon;
  setBadge('wxsrc','om','load','Open-Meteo…');
  try{
    const url=`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,windspeed_10m_max,weathercode,et0_fao_evapotranspiration&past_days=7&forecast_days=8&timezone=Europe%2FIstanbul&cell_selection=land`;
    const r=await fetch(url); if(!r.ok) throw new Error('HTTP '+r.status);
    const d=await r.json();
    const days=d.daily.time.map((t,i)=>({
      date:t,tmax:Math.round(d.daily.temperature_2m_max[i]),tmin:Math.round(d.daily.temperature_2m_min[i]),
      rain:+(d.daily.precipitation_sum[i]||0).toFixed(1),wind:Math.round(d.daily.windspeed_10m_max[i]),
      code:d.daily.weathercode[i],et0:+(d.daily.et0_fao_evapotranspiration?.[i]||0).toFixed(1)
    }));
    window.WXC[id]={days,src:'om',at:Date.now()};
    setBadge('wxsrc','om','ok','Open-Meteo ✓');
    invSoil(id);
    renderWX(field);
    if(qs('#page-dash.on')) renderDash();
    if(qs('#page-field.on') && CUR?.id===id) renderFKPIs(field);
    setTimeout(() => fetchWXHistory(field), 2000);
  }catch(e){
    setBadge('wxsrc','om','err','Open-Meteo: '+e.message);
    if(!WXC[id]) WXC[id]={days:simWX(lat,lon),src:'sim',at:Date.now()};
    renderWX(field);
  }
  const ak = window.DB.s.acuKey;
  if(ak){
    setBadge('wxsrc','acu','load','AccuWeather…');
    try{
      const lr=await fetch(`https://dataservice.accuweather.com/locations/v1/cities/geoposition/search?apikey=${ak}&q=${lat}%2C${lon}`);
      if(!lr.ok) throw new Error(lr.status);
      const loc=await lr.json();
      const fr=await fetch(`https://dataservice.accuweather.com/forecasts/v1/daily/5day/${loc.Key}?apikey=${ak}&language=tr-TR&details=true&metric=true`);
      if(!fr.ok) throw new Error(fr.status);
      const fc=await fr.json();
      fc.DailyForecasts.forEach(df=>{
        const dt=df.Date.slice(0,10);
        const ex=WXC[id]?.days?.find(d=>d.date===dt);
        if(ex){ex.acuMax=Math.round(df.Temperature.Maximum.Value);ex.acuMin=Math.round(df.Temperature.Minimum.Value);ex.acuRain=df.Day.Rain?.Value||0;}
      });
      setBadge('wxsrc','acu','ok','AccuWeather ✓');
      invSoil(id); renderWX(field);
    }catch(e){ setBadge('wxsrc','acu','err','AccuWeather: '+e.message); }
  }
};

window.renderWX = (field) => {
  const data=WXC[field.id]; if(!data) return;
  const days=data.days, today=tstr();
  const past=days.filter(d=>d.date<today), futD=days.filter(d=>d.date>today), todayD=days.find(d=>d.date===today);
  const fmt=d=>new Date(d.date+'T12:00:00').toLocaleDateString('tr-TR',{day:'numeric',month:'short'});
  const cell=d=>{
    const tm=d.acuMax?Math.round((d.tmax+d.acuMax)/2):d.tmax;
    const tn=d.acuMin?Math.round((d.tmin+d.acuMin)/2):d.tmin;
    const rn=d.acuRain!=null?+((d.rain+d.acuRain)/2).toFixed(1):d.rain;
    return`<div class="wxcell"><div class="wxdate">${fmt(d)}</div><div class="wxicon">${wicon(d.code)}</div><div class="wxtemp">${tm}°/${tn}°</div><div class="wxrain">${rn>0?rn+'mm':''}</div><div class="wxwind">${d.wind}km/h</div></div>`;
  };
  const pp=qs('#wx-past'); if(pp) pp.innerHTML=past.map(cell).join('');
  const fp=qs('#wx-fut');  if(fp) fp.innerHTML=futD.map(cell).join('');
  const te=qs('#wx-today');
  if(te&&todayD){
    const tm=todayD.acuMax?Math.round((todayD.tmax+todayD.acuMax)/2):todayD.tmax;
    te.innerHTML=`<div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;padding:6px 0;">
      <div style="font-size:36px;">${wicon(todayD.code)}</div>
      <div><div style="font-size:22px;font-weight:800;">${tm}°C</div>
      <div style="color:var(--text2);font-size:13px;">Min: ${todayD.tmin}°C · Yağış: ${todayD.rain}mm · Rüzgar: ${todayD.wind}km/h${todayD.et0?' · ET₀: '+todayD.et0+'mm':''}</div></div>
      ${data.src==='sim'?'<span class="tag ta">⚠️ Simüle edilmiş veri</span>':'<span class="tag tg">📡 Gerçek veri</span>'}
    </div>`;
  }
  const totalR=days.reduce((s,d)=>s+d.rain,0), avgT=Math.round(days.reduce((s,d)=>s+d.tmax,0)/days.length);
  const rD=days.filter(d=>d.rain>1).length, totalET=days.reduce((s,d)=>s+(d.et0||0),0);
  const histDays = window.getBestWXDays(field).filter(d=>d.date<=tstr()).length;
  const se=qs('#wx-sum');
  if(se) se.innerHTML=`<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:9px;">
    <div class="kpi"><div class="kpi-l">14G Yağış</div><div class="kpi-v">${Math.round(totalR)}<small>mm</small></div></div>
    <div class="kpi"><div class="kpi-l">Ort. Maks.</div><div class="kpi-v">${avgT}<small>°C</small></div></div>
    <div class="kpi"><div class="kpi-l">Yağışlı Gün</div><div class="kpi-v">${rD}<small>/14</small></div></div>
    <div class="kpi"><div class="kpi-l">ET₀ Toplam</div><div class="kpi-v">${Math.round(totalET)}<small>mm</small></div></div>
  </div>
  <div style="font-size:11px;color:var(--text3);margin-top:6px;">📅 GDD hesaplaması için ${histDays} günlük hava geçmişi kullanılıyor (en fazla 366 gün)</div>`;
};
