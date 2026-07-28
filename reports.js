// ============================================================
// reports.js – Gelişmiş raporlama ve filtreleme
// ============================================================

window.filterEvents = (events, filter) => {
  return (events||[]).filter(e => {
    if(filter.period === 'all') return true;
    const d = e.date;
    if(filter.period === 'year') return d.startsWith(String(filter.year));
    if(filter.period === 'month') return d.startsWith(`${filter.year}-${String(filter.month).padStart(2,'0')}`);
    if(filter.period === 'custom') return d >= filter.startDate && d <= filter.endDate;
    return true;
  });
};

window.getRepLabel = () => {
  const f = window.REP_FILTER;
  if(f.period==='all') return 'Tüm Zamanlar';
  if(f.period==='year') return String(f.year)+' Yılı';
  const MO=['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara'];
  if(f.period==='month') return MO[(f.month||1)-1]+' '+f.year;
  return `${f.startDate||'?'} — ${f.endDate||'?'}`;
};

window.renderRep = async () => {
  const rc = qs('#rep-content'); if(!rc) return;
  if(!DB.fields.length){ rc.innerHTML='<div class="empty">📊<br/>Tarla ekleyin.</div>'; return; }
  
  const filter = window.REP_FILTER;
  const label = window.getRepLabel();
  
  const filterUI = `
  <div class="card" style="margin-bottom:14px;">
    <div class="ct">🔍 Dönem Filtresi <span class="tag tg">${label}</span></div>
    <div style="display:flex;gap:7px;flex-wrap:wrap;align-items:center;">
      <select id="rep-period-sel" style="width:auto;flex:none;" onchange="window.onRepPeriodChange(this.value)">
        <option value="all" ${filter.period==='all'?'selected':''}>Tüm Zamanlar</option>
        <option value="year" ${filter.period==='year'?'selected':''}>Yıllık</option>
        <option value="month" ${filter.period==='month'?'selected':''}>Aylık</option>
        <option value="custom" ${filter.period==='custom'?'selected':''}>Özel Aralık</option>
      </select>
      <div id="rep-period-extra" style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;">${window.buildRepPeriodExtra()}</div>
      <button class="btn btns btnp" onclick="window.renderRep()">Uygula</button>
    </div>
  </div>`;
  
  const allFilteredEvs = [];
  DB.fields.forEach(f => {
    window.filterEvents(f.events, filter).forEach(e => allFilteredEvs.push({...e, fn:f.name, fc:f.color, fid:f.id}));
  });
  
  const totalCost = allFilteredEvs.reduce((s,e)=>s+(e.total||(e.cost*(e.qty||1))),0);
  const totalRevenue = allFilteredEvs.reduce((s,e)=>s+(e.revenue||0),0);
  const totalProfit = totalRevenue - totalCost;
  const ta = DB.fields.reduce((s,f)=>s+(f.area||0),0);
  
  const byCat = {};
  allFilteredEvs.filter(e=>e.cost>0).forEach(e=>{
    const t=e.total||(e.cost*(e.qty||1));
    byCat[e.type]=(byCat[e.type]||0)+t;
  });

  const fieldData = await Promise.all(DB.fields.map(async f => {
    const filtEvs = window.filterEvents(f.events, filter);
    const fc = filtEvs.reduce((c,e)=>c+(e.total||(e.cost*(e.qty||1))),0);
    const rev = filtEvs.reduce((c,e)=>c+(e.revenue||0),0);
    const profit = rev - fc;
    const s = await calcSoil(f);
    const ph = calcPheno(f);
    const he = calcHarvest(f);
    return {f, fc, rev, profit, s, ph, he, evCount:filtEvs.length};
  }));
  
  const monthlyData = {};
  const MO=['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara'];
  for(let m=1;m<=12;m++) monthlyData[m]={cost:0,rev:0,evs:0};
  
  const yearEvs = (filter.period==='all'||filter.period==='year')
    ? DB.fields.flatMap(f=>(f.events||[]).filter(e=>e.date.startsWith(String(filter.year))))
    : allFilteredEvs;
  yearEvs.forEach(e=>{
    const m = parseInt(e.date.slice(5,7));
    if(monthlyData[m]){
      monthlyData[m].cost += e.total||(e.cost*(e.qty||1));
      monthlyData[m].rev += e.revenue||0;
      monthlyData[m].evs++;
    }
  });
  
  const recurringMap = {};
  DB.fields.forEach(f => {
    (f.events||[]).forEach(e => {
      const key = e.type;
      if(!recurringMap[key]) recurringMap[key] = [];
      recurringMap[key].push({...e, fn:f.name, fid:f.id});
    });
  });
  const recurring = Object.entries(recurringMap)
    .filter(([,evs])=>evs.length>=3)
    .sort((a,b)=>b[1].length-a[1].length)
    .slice(0,5);
  
  const maxMonthCost = Math.max(...Object.values(monthlyData).map(m=>m.cost), 1);
  const monthBars = MO.map((name,i)=>{
    const m = monthlyData[i+1];
    const pct = Math.round(m.cost/maxMonthCost*100);
    const revPct = m.cost>0?Math.round(m.rev/maxMonthCost*100):0;
    return `<div style="display:flex;flex-direction:column;align-items:center;flex:1;min-width:0;gap:2px;">
      <div style="width:100%;height:70px;display:flex;align-items:flex-end;gap:1px;position:relative;">
        ${m.cost>0?`<div style="flex:1;background:var(--red);opacity:.7;border-radius:2px 2px 0 0;height:${pct}%;" title="${Math.round(m.cost).toLocaleString()}₺ maliyet"></div>`:'<div style="flex:1;background:var(--bg3);border-radius:2px;height:4px;align-self:flex-end;"></div>'}
        ${m.rev>0?`<div style="flex:1;background:var(--green2);opacity:.8;border-radius:2px 2px 0 0;height:${revPct}%;" title="${Math.round(m.rev).toLocaleString()}₺ gelir"></div>`:''}
      </div>
      <div style="font-size:8px;color:var(--text3);">${name}</div>
      ${m.evs>0?`<div style="font-size:7px;color:var(--text3);">${m.evs}</div>`:''}
    </div>`;
  }).join('');

  rc.innerHTML = filterUI + `
  <div class="krow" style="margin-bottom:14px;">
    <div class="kpi" style="border-left:3px solid var(--red);"><div class="kpi-l">💸 Toplam Maliyet</div><div class="kpi-v">${Math.round(totalCost).toLocaleString('tr-TR')}</div><div class="kpi-s">₺ · ${getRepLabel()}</div></div>
    <div class="kpi" style="border-left:3px solid var(--green2);"><div class="kpi-l">💰 Toplam Gelir</div><div class="kpi-v">${Math.round(totalRevenue).toLocaleString('tr-TR')}</div><div class="kpi-s">₺</div></div>
    <div class="kpi" style="border-left:3px solid ${totalProfit>=0?'var(--green2)':'var(--red)'};"><div class="kpi-l">📈 Net Kar/Zarar</div><div class="kpi-v" style="color:${totalProfit>=0?'var(--green2)':'var(--red)'};">${Math.round(totalProfit).toLocaleString('tr-TR')}</div><div class="kpi-s">₺${ta?' · '+(Math.round(totalProfit/ta).toLocaleString())+'₺/birim':''}</div></div>
    <div class="kpi"><div class="kpi-l">📋 Toplam Kayıt</div><div class="kpi-v">${allFilteredEvs.length}</div><div class="kpi-s">işlem</div></div>
  </div>
  
  <div class="card">
    <div class="ct">📊 Aylık Maliyet & Gelir Trendi (${filter.year}) <span style="font-size:10px;color:var(--text3);margin-left:6px;">🟥 Maliyet 🟩 Gelir — rakam = işlem sayısı</span></div>
    <div style="display:flex;gap:2px;height:100px;align-items:flex-end;">${monthBars}</div>
  </div>
  
  <div class="g2">
    <div class="card">
      <div class="ct">🌾 Tarla Bazlı Maliyet & Karlılık</div>
      ${fieldData.map(({f,fc,rev,profit})=>{
        const profitColor = profit>=0?'var(--green2)':'var(--red)';
        return`<div style="padding:8px 0;border-bottom:1px solid var(--bdr);">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
            <span style="font-size:12px;font-weight:600;display:flex;align-items:center;gap:4px;"><span style="width:8px;height:8px;border-radius:50%;background:${f.color};display:inline-block;"></span>${f.name}</span>
            <span style="font-size:11px;font-weight:700;color:${profitColor};">${profit>=0?'+':''}${Math.round(profit).toLocaleString()}₺</span>
          </div>
          <div style="height:4px;border-radius:2px;background:var(--bg3);overflow:hidden;margin-bottom:4px;">
            <div style="height:100%;width:${totalCost?Math.round(fc/totalCost*100):0}%;background:${f.color};border-radius:2px;"></div>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:10px;color:var(--text3);">
            <span>Maliyet: ${Math.round(fc).toLocaleString()}₺</span>
            <span>Gelir: ${Math.round(rev).toLocaleString()}₺</span>
          </div>
        </div>`;
      }).join('')}
    </div>
    <div class="card">
      <div class="ct">🏷️ İşlem Türüne Göre Dağılım</div>
      ${Object.keys(byCat).length
        ?Object.entries(byCat).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`
          <div class="pr">
            <span class="prl">${EVI[k]||'📝'} ${k}</span>
            <div class="prt"><div class="prf" style="width:${totalCost?Math.round(v/totalCost*100):0}%;background:${EVC[k]||'var(--green2)'};"></div></div>
            <span class="prv">${Math.round(v).toLocaleString()}₺</span>
          </div>`).join('')
        :'<div style="color:var(--text3);">Kayıt yok</div>'}
      ${totalCost>0?`<div style="border-top:1px solid var(--bdr);padding-top:8px;margin-top:8px;display:flex;justify-content:space-between;font-weight:700;font-size:13px;"><span>Toplam Maliyet</span><span>${Math.round(totalCost).toLocaleString('tr-TR')}₺</span></div>`:''}
    </div>
  </div>
  
  ${recurring.length?`<div class="card">
    <div class="ct">🔄 Tekrar Eden Kayıt Türleri (En Sık)</div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;">
      ${recurring.map(([type,evs])=>{
        const totCost = evs.reduce((s,e)=>s+(e.total||(e.cost*(e.qty||1))),0);
        const avgCost = totCost/evs.length;
        const dates = evs.map(e=>e.date).sort();
        const lastDate = dates[dates.length-1];
        return`<div style="background:var(--bg3);border-radius:var(--r);padding:10px;">
          <div style="font-size:18px;margin-bottom:4px;">${EVI[type]||'📝'}</div>
          <div style="font-size:12px;font-weight:700;">${type}</div>
          <div style="font-size:11px;color:var(--text2);">${evs.length} kayıt</div>
          <div style="font-size:10px;color:var(--text3);">Ort: ${Math.round(avgCost).toLocaleString()}₺</div>
          <div style="font-size:10px;color:var(--text3);">Son: ${fd(lastDate)}</div>
        </div>`;
      }).join('')}
    </div>
  </div>`:''}
  
  <div class="card">
    <div class="ct">📋 Tarla Özet Tablosu — ${label}</div>
    <div style="overflow-x:auto;"><table class="tbl">
      <thead><tr><th>Tarla</th><th>Ürün</th><th>Alan</th><th>Dönem</th><th>Yüzey Nem</th><th>Hasat</th><th>Maliyet</th><th>Gelir</th><th>Kar</th><th>İşlem</th></tr></thead>
      <tbody>${fieldData.map(({f,fc,rev,profit,s,ph,he,evCount})=>{
        const sc=scl(s.surface.pct);
        return`<tr>
          <td style="font-weight:600;white-space:nowrap;"><span style="width:8px;height:8px;border-radius:50%;background:${f.color};display:inline-block;margin-right:5px;"></span>${f.name}</td>
          <td>${f.crop||'—'}</td><td>${f.area} ${f.areaUnit||'dön'}</td>
          <td style="font-size:11px;">${ph?ph.stage:'—'}</td>
          <td><span class="tag ${sc.tag}">${sc.l} %${s.surface.pct}</span></td>
          <td style="font-size:11px;">${he?(he.already?'🟢 Hazır!':he.daysLeft+'g'):'—'}</td>
          <td>${Math.round(fc).toLocaleString()}₺</td>
          <td>${Math.round(rev).toLocaleString()}₺</td>
          <td style="color:${profit>=0?'var(--green2)':'var(--red)'};font-weight:700;">${Math.round(profit).toLocaleString()}₺</td>
          <td>${evCount}</td>
        </tr>`;
      }).join('')}</tbody>
    </table></div>
  </div>`;
};

window.buildRepPeriodExtra = () => {
  const f = window.REP_FILTER;
  const years = [];
  const curY = new Date().getFullYear();
  for(let y=curY;y>=curY-4;y--) years.push(y);
  
  if(f.period==='year') {
    return `<select id="rep-year" style="width:auto;" onchange="window.REP_FILTER.year=parseInt(this.value)">
      ${years.map(y=>`<option value="${y}" ${y===f.year?'selected':''}>${y}</option>`).join('')}
    </select>`;
  }
  if(f.period==='month') {
    const MO=['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];
    return `<select id="rep-year" style="width:auto;" onchange="window.REP_FILTER.year=parseInt(this.value)">
      ${years.map(y=>`<option value="${y}" ${y===f.year?'selected':''}>${y}</option>`).join('')}
    </select>
    <select id="rep-month" style="width:auto;" onchange="window.REP_FILTER.month=parseInt(this.value)">
      ${MO.map((m,i)=>`<option value="${i+1}" ${(i+1)===f.month?'selected':''}>${m}</option>`).join('')}
    </select>`;
  }
  if(f.period==='custom') {
    return `<input type="date" id="rep-start" value="${f.startDate||''}" style="width:auto;" onchange="window.REP_FILTER.startDate=this.value"/>
    <span>—</span>
    <input type="date" id="rep-end" value="${f.endDate||''}" style="width:auto;" onchange="window.REP_FILTER.endDate=this.value"/>`;
  }
  return '';
};

window.onRepPeriodChange = (val) => {
  window.REP_FILTER.period = val;
  if(val==='month' && !window.REP_FILTER.month) window.REP_FILTER.month = new Date().getMonth()+1;
  const extra = qs('#rep-period-extra');
  if(extra) extra.innerHTML = window.buildRepPeriodExtra();
};

window.calcYield = (field) => {
  const a = window.agrd(field.crop);
  if(!a.yieldMax) return null;
  const ph = window.calcPheno(field);
  const gddPct = ph ? ph.totPct : 0;
  const ndvi = SATC[field.id]?.data?.ndvi || 0.4;
  const wxAll = window.getBestWXDays(field);
  const seasonRain = wxAll.reduce((s,d)=>s+(d.rain||0),0);
  const rainFactor = Math.min(1, seasonRain/(a.optRain||350));
  const yieldEst = a.yieldMax * (gddPct/100 * 0.4 + ndvi/0.8 * 0.4 + rainFactor * 0.2);
  return Math.round(yieldEst);
};