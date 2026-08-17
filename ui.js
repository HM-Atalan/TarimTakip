// ============================================================
// ui.js – Tüm arayüz render fonksiyonları
// ============================================================

window.renderAll = async () => {
  await window.computeAllSoils();
  await Promise.all([renderSB(), renderDash()]);
  renderCal();
  await renderRep();
};

window.renderSB = async () => {
  const el = qs('#sb-list'); if(!el) return;
  const allSoilData = await window.computeAllSoils();
  el.innerHTML = '';
  allSoilData.forEach(({ f, s, sc }) => {
    const d = document.createElement('div');
    d.className = 'fi' + (f.id === CUR?.id ? ' on' : '');
    d.onclick = () => { showField(f.id); clSBmob(); };
    d.innerHTML = `<div class="fi-dot" style="background:${window.safeCssColor(f.color)};"></div><div class="fi-info"><div class="fi-name">${window.esc(f.name)}</div><div class="fi-sub">${window.esc(f.crop||'Ürün yok')} · <span class="tag ${sc.tag}" style="font-size:9px;">${sc.l} %${s.surface?.pct||s.pct}%</span></div></div>`;
    el.appendChild(d);
  });
};

window.renderFKPIs = async (field) => {
  invSoil(field.id);
  const s = await calcSoil(field);
  const sc = scl(s.surface.pct);
  const tc = (field.events||[]).reduce((t,e)=>t+(e.total||(e.cost*(e.qty||1))),0);
  const ph = calcPheno(field);
  const he = calcHarvest(field);
  const el=qs('#fp-tags');
  if(el) el.innerHTML=`
    ${field.crop?`<span class="tag tg">${window.esc(field.crop)}</span>`:''}
    ${field.qty?`<span class="tag tgr">${field.qty} ${field.qunit}</span>`:''}
    <span class="tag tgr">${field.area} ${field.areaUnit||'dönüm'}</span>
    ${field.location?`<span class="tag tgr">📍 ${window.esc(field.location)}</span>`:''}
    <span class="tag ${sc.tag}">${sc.l} %${s.surface.pct}</span>
    ${field.irrigation?`<span class="tag tb">💧 ${field.irrigation}</span>`:''}
    ${field.fencing?`<span class="tag tgr">🔒 ${field.fencing}</span>`:''}`;
  const kp=qs('#fp-kpis');
  if(kp) kp.innerHTML=`
    <div class="kpi"><div class="kpi-l">Yüzey Nemi</div><div class="kpi-v" style="color:${sc.color};">${s.surface.pct}<small>%</small></div><div class="kpi-s">${sc.l}</div></div>
    <div class="kpi"><div class="kpi-l">Derin Nem</div><div class="kpi-v" style="color:${scl(s.deep.pct).color};">${s.deep.pct}<small>%</small></div><div class="kpi-s">${scl(s.deep.pct).l}</div></div>
    <div class="kpi"><div class="kpi-l">Gelişim Dönemi</div><div class="kpi-v" style="font-size:12px;">${ph?ph.stage:'—'}</div><div class="kpi-s">${ph?'%'+ph.totPct+' tamamlandı':'Ekim tarihi yok'}</div></div>
    <div class="kpi"><div class="kpi-l">Hasat Tahmini</div><div class="kpi-v" style="font-size:12px;color:${he?.already?'var(--green2)':'var(--text)'};">${he?(he.already?'🟢 Hazır!':he.daysLeft+'g'):'—'}</div><div class="kpi-s">${he&&!he.already?fd(he.estDate):'—'}</div></div>
    <div class="kpi"><div class="kpi-l">Toplam Maliyet</div><div class="kpi-v">${Math.round(tc).toLocaleString('tr-TR')}<small>₺</small></div></div>`;
};

window.renderDash = async () => {
  const now = new Date();
  qs('#ddate').textContent = now.toLocaleDateString('tr-TR',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
  const ta = DB.fields.reduce((s,f)=>s+(f.area||0), 0);
  const tc = DB.fields.reduce((s,f)=>s+(f.events||[]).reduce((c,e)=>c+(e.total||(e.cost*(e.qty||1))),0), 0);
  const activeCount = DB.fields.filter(f=>f.status!=='fallow').length;
  const fallowCount = DB.fields.filter(f=>f.status==='fallow').length;
  qs('#dkpis').innerHTML=`
  <div class="kpi"><div class="kpi-l">Tarla</div><div class="kpi-v">${DB.fields.length}</div></div>
  <div class="kpi"><div class="kpi-l">Toplam Alan</div><div class="kpi-v">${ta.toFixed(1)}</div></div>
  <div class="kpi"><div class="kpi-l">Toplam Maliyet</div><div class="kpi-v">${Math.round(tc).toLocaleString('tr-TR')}</div><div class="kpi-s">₺</div></div>
  <div class="kpi"><div class="kpi-l">Ekili Tarla</div><div class="kpi-v">${activeCount}<small>/${DB.fields.length}</small></div></div>
  <div class="kpi"><div class="kpi-l">Nadas</div><div class="kpi-v">${fallowCount}</div></div>`;
  const df = qs('#dfields');
  if(!DB.fields.length){
    df.innerHTML = '<div class="empty">🌾<br/>Tarla yok.<br/>"+ Yeni Tarla" ile başlayın.</div>';
    qs('#devents').innerHTML = ''; qs('#dplanned').innerHTML = ''; return;
  }
  const fieldsWithSoil = await window.computeAllSoils();
  df.innerHTML = fieldsWithSoil.map(({f,s,sc,ph,he}, fieldIndex)=>{
    return`<div class="evrow" data-field-index="${fieldIndex}" style="cursor:pointer;">
      <div class="evico" style="background:${window.safeCssColor(f.color)}22;font-size:14px;">🌿</div>
      <div class="evbody">
        <div class="evtitle">${window.esc(f.name)} ${f.status==='fallow'?'<span class="tag ta">Nadas</span>':f.status==='planned'?'<span class="tag tb">Planlanan</span>':''}</div>
        <div class="evsub">${window.esc(f.crop||'Ürün yok')} · ${window.esc(f.area)}${window.esc(f.areaUnit||'dön')} · ${window.esc(f.location||'—')}</div>
        ${ph?`<div class="evsub" style="margin-top:2px;">📍 ${ph.stage}${he&&!he.already?' · Hasat ~'+he.daysLeft+'g':he?.already?' · 🟢 Hasat zamanı!':''}</div>`:''}
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:3px;">
        <span class="tag ${sc.tag}">${sc.l}</span>
        <span style="font-size:10px;color:var(--text3);">Yüzey %${s.surface.pct}</span>
        <span style="font-size:10px;color:var(--text3);">Derin %${s.deep.pct}</span>
      </div>
    </div>`;
  }).join('');
  df.querySelectorAll('[data-field-index]').forEach(row => {
    const item = fieldsWithSoil[Number(row.dataset.fieldIndex)];
    if (item) row.addEventListener('click', () => showField(item.f.id));
  });
  const allEvs = [];
  DB.fields.forEach(f=>(f.events||[]).filter(e=>!e.planned).forEach(e=>allEvs.push({...e,fn:f.name})));
  allEvs.sort((a,b)=>b.date.localeCompare(a.date));
  qs('#devents').innerHTML = allEvs.slice(0,4).map(e=>`<div class="evrow"><div class="evico" style="background:${EVC[e.type]||'#eee'};font-size:12px;">${EVI[e.type]||'📝'}</div><div class="evbody"><div class="evtitle">${window.esc(e.fn)} — ${window.esc(e.type)}</div><div class="evsub">${fd(e.date)}${e.notes?' · '+window.esc(e.notes.slice(0,40)):''}</div></div>${e.total?`<span class="evcost">${Math.round(e.total).toLocaleString()}₺</span>`:''}</div>`).join('')||'<div style="color:var(--text3);font-size:13px;">Kayıt yok.</div>';
  const planned = [];
  DB.fields.forEach(f=>(f.events||[]).filter(e=>e.planned&&e.date>=tstr()).forEach(e=>planned.push({...e,fn:f.name,fc:f.color})));
  planned.sort((a,b)=>a.date.localeCompare(b.date));
  qs('#dplanned').innerHTML = planned.slice(0,4).map(e=>`<div class="evrow"><div class="evico" style="background:${e.fc||'#40916c'}22;font-size:13px;">${EVI[e.type]||'📝'}</div><div class="evbody"><div class="evtitle">${e.fn} — ${e.type}</div><div class="evsub">${fd(e.date)}</div></div></div>`).join('')||'<div style="color:var(--text3);font-size:13px;">Planlanan görev yok.</div>';
};

window.renderCal = () => {
  const now=new Date(); const y=now.getFullYear(), m=now.getMonth();
  const MO=['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];
  qs('#cal-hdr').textContent=MO[m]+' '+y;
  qs('#cal-heads').innerHTML=['Pt','Sa','Ça','Pe','Cu','Ct','Pz'].map(d=>`<div style="text-align:center;font-size:10px;font-weight:700;color:var(--text3);padding:3px 0;">${d}</div>`).join('');
  const first=(new Date(y,m,1).getDay()+6)%7, dc=new Date(y,m+1,0).getDate();
  const mon=now.toISOString().slice(0,7);
  const ed=new Set(); DB.fields.forEach(f=>(f.events||[]).forEach(e=>{ if(e.date.startsWith(mon)) ed.add(+e.date.slice(8,10)); }));
  let html=Array(first).fill('<div></div>').join('');
  for(let i=1;i<=dc;i++){ const isTd=i===now.getDate(); html+=`<div style="aspect-ratio:1;display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:12px;border-radius:7px;background:${isTd?'var(--gbg)':'transparent'};color:${isTd?'var(--green2)':'inherit'};font-weight:${isTd?700:400};position:relative;">${i}${ed.has(i)?`<span style="width:4px;height:4px;background:var(--green2);border-radius:50%;position:absolute;bottom:2px;"></span>`:''}</div>`; }
  qs('#cal-cells').innerHTML=html;
  const me=[]; DB.fields.forEach(f=>(f.events||[]).filter(e=>e.date.startsWith(mon)).forEach(e=>me.push({...e,fn:f.name})));
  me.sort((a,b)=>a.date.localeCompare(b.date));
  qs('#cal-evs').innerHTML=me.length?me.map(e=>`<div class="evrow"><div class="evico" style="background:${EVC[e.type]||'#eee'};font-size:12px;">${EVI[e.type]||'📝'}</div><div class="evbody"><div class="evtitle">${e.fn}</div><div class="evsub">${e.type} · ${fd(e.date)}</div></div>${e.total?`<span class="evcost">${Math.round(e.total).toLocaleString()}₺</span>`:''}</div>`).join(''):'<div style="color:var(--text3);font-size:13px;">Bu ay olay yok.</div>';
  const aiS=[]; DB.fields.forEach(f=>{ if(f.aiRecs?.length) aiS.push({fn:f.name,text:f.aiRecs[0].text.slice(0,130)+'...',date:f.aiRecs[0].date}); });
  qs('#cal-ai').innerHTML=aiS.length?aiS.map(s=>`<div class="ritem" style="background:var(--glt);"><div class="rico" style="background:var(--gbg);color:var(--green2);">🤖</div><div class="rbody"><div class="rtitle">${s.fn}</div><div class="rsub">${s.text}</div><div style="font-size:10px;color:var(--text3);margin-top:2px;">${fd(s.date)}</div></div></div>`).join(''):'<div style="color:var(--text3);font-size:13px;">AI analizi çalıştırarak öneri alın.</div>';
};

window.renderSoil = async (field) => {
  const s   = await calcSoil(field);
  const sc_surf = scl(s.surface.pct);
  const sc_deep = scl(s.deep.pct);
  const irr = calcIrrigationNeed(field, s);
  const p   = s.params || window.getRZWBParams(field);
  const lastIrr = (field.events||[]).filter(e=>e.type==='sulama'&&!e.planned)
    .sort((a,b)=>b.date.localeCompare(a.date))[0];
  const dsi = lastIrr ? Math.round((Date.now()-new Date(lastIrr.date))/(864e5)) : null;

  const sg = qs('#sg');
  if(sg) sg.innerHTML = `
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px;">
    <div style="background:var(--bg3);border-radius:var(--r);padding:12px;">
      <div style="font-size:10px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px;">🌿 Yüzey (0–10cm)</div>
      <div style="font-size:36px;font-weight:800;line-height:1;color:${sc_surf.color};">${s.surface.pct}%</div>
      <div style="margin:5px 0;display:flex;gap:4px;flex-wrap:wrap;">
        <span class="tag ${sc_surf.tag}">${sc_surf.l}</span>
        ${s.surface.Ks < 1 ? `<span class="tag ta">Ks ${s.surface.Ks.toFixed(2)}</span>` : ''}
      </div>
      <div style="position:relative;height:10px;border-radius:5px;background:var(--bg4);overflow:visible;margin:8px 0 4px;">
        <div style="height:100%;width:${s.surface.pct}%;border-radius:5px;background:${sc_surf.color};transition:width .6s;"></div>
        <div style="position:absolute;top:-3px;height:16px;width:2px;background:var(--amber);border-radius:1px;left:${irr.triggerPct}%;" title="RAW sulama eşiği %${irr.triggerPct}"></div>
      </div>
      <div style="font-size:10px;color:var(--text3);">${s.surface.moist}mm / ${p.fcs}mm FC · Dr=${s.surface.Dr?.toFixed(1)??'—'}mm</div>
      <div style="font-size:9px;color:var(--amber);margin-top:2px;">⚑ Sulama eşiği %${irr.triggerPct} (MAD=${irr.madPct}%)</div>
    </div>
    <div style="background:var(--bg3);border-radius:var(--r);padding:12px;">
      <div style="font-size:10px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px;">🌍 Derin (10–30cm)</div>
      <div style="font-size:36px;font-weight:800;line-height:1;color:${sc_deep.color};">${s.deep.pct}%</div>
      <div style="margin:5px 0;display:flex;gap:4px;flex-wrap:wrap;">
        <span class="tag ${sc_deep.tag}">${sc_deep.l}</span>
        ${s.deep.Ks < 1 ? `<span class="tag ta">Ks ${s.deep.Ks.toFixed(2)}</span>` : ''}
      </div>
      <div style="height:10px;border-radius:5px;background:var(--bg4);overflow:hidden;margin:8px 0 4px;">
        <div style="height:100%;width:${s.deep.pct}%;border-radius:5px;background:${sc_deep.color};transition:width .6s;"></div>
      </div>
      <div style="font-size:10px;color:var(--text3);">${s.deep.moist}mm / ${p.fcd}mm FC · Dr=${s.deep.Dr?.toFixed(1)??'—'}mm</div>
    </div>
  </div>
  <div style="background:var(--bg3);border-radius:var(--r);padding:8px 12px;font-size:11px;color:var(--text2);display:flex;flex-wrap:wrap;gap:10px;align-items:center;">
    <span>📐 FAO-56 RZWB · Kc=${s.kc?.toFixed(2)??'—'} · ETc=${s.ETc??'—'}mm/g</span>
    <span>TAW=${p.taw_s?.toFixed(0)}/${p.taw_d?.toFixed(0)}mm · RAW=${p.raw_s?.toFixed(0)}/${p.raw_d?.toFixed(0)}mm</span>
    <span>${dsi !== null ? `Son sulama: ${dsi}g önce` : 'Sulama kaydı yok'}</span>
    ${s.satCalibrated
      ? '<span class="tag tg" style="font-size:10px;">📡 Başlangıç: Uydu kalibreli</span>'
      : '<span class="tag ta" style="font-size:10px;">⚠️ Başlangıç: Model tahmini</span>'}
  </div>
  <div style="font-size:10px;color:var(--text3);margin-top:6px;">
    ℹ️ Model, uydudan sadece ilk kurulumda başlangıç nemi alır; sonrasında 90 günlük pencerede
    tamamen hava verisi + sulama kayıtlarına dayalı saf fiziksel simülasyon yürütür — günlük uydu düzeltmesi yapılmaz.
  </div>`;

  const COLORS = {
    kritik: { c:'var(--red)',    bg:'var(--rbg)', icon:'🚨' },
    stres:  { c:'var(--red)',    bg:'var(--rbg)', icon:'⚠️' },
    öneri:  { c:'var(--amber)',  bg:'var(--abg)', icon:'💧' },
    izle:   { c:'var(--amber)',  bg:'var(--abg)', icon:'👀' },
    yok:    { c:'var(--green2)', bg:'var(--glt)', icon:'✅' },
  };
  const uc = COLORS[irr.urgency] || COLORS.yok;

  const sw = qs('#sw');
  if(sw) sw.innerHTML = `
  <div style="background:${uc.bg};border-radius:var(--r);padding:13px 14px;margin-bottom:10px;">
    <div style="display:flex;align-items:flex-start;gap:10px;margin-bottom:10px;">
      <span style="font-size:24px;line-height:1;">${uc.icon}</span>
      <div>
        <div style="font-size:13px;font-weight:700;color:${uc.c};">${irr.label}</div>
        <div style="font-size:11px;color:var(--text2);margin-top:3px;">
          ${irr.stressLabel} · Ks=${irr.Ks?.toFixed(2)??'1.00'} · Dr=${irr.Dr_s}mm / RAW=${irr.raw_s?.toFixed(0)}mm / TAW=${irr.taw_s?.toFixed(0)}mm
        </div>
      </div>
    </div>
    ${irr.needsIrrigation ? `
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:10px;">
      <div style="background:var(--bg2);border-radius:8px;padding:9px;text-align:center;">
        <div style="font-size:10px;color:var(--text3);margin-bottom:2px;">Su Açığı</div>
        <div style="font-size:20px;font-weight:800;color:${uc.c};">${irr.deficitMm}<small style="font-size:11px;font-weight:400;">mm</small></div>
      </div>
      <div style="background:var(--bg2);border-radius:8px;padding:9px;text-align:center;">
        <div style="font-size:10px;color:var(--text3);margin-bottom:2px;">Önerilen Doz</div>
        <div style="font-size:20px;font-weight:800;color:var(--blue);">${irr.recommendedMm}<small style="font-size:11px;font-weight:400;">mm</small></div>
      </div>
      <div style="background:var(--bg2);border-radius:8px;padding:9px;text-align:center;">
        <div style="font-size:10px;color:var(--text3);margin-bottom:2px;">Kritik'e Kalan</div>
        <div style="font-size:20px;font-weight:800;color:var(--amber);">${irr.daysUntilCritical}<small style="font-size:11px;font-weight:400;">gün</small></div>
      </div>
    </div>` : ''}
    <div style="font-size:11px;color:var(--text2);padding-top:8px;border-top:1px solid var(--bdr);">
      7g net su dengesi: <strong>${irr.futRain7d}mm</strong> yağış − <strong>${irr.futET7d}mm</strong> ETc =
      <strong style="color:${irr.netBalance7d >= 0 ? 'var(--green2)' : 'var(--red)'};">
        ${irr.netBalance7d >= 0 ? '+' : ''}${irr.netBalance7d}mm
      </strong>
    </div>
  </div>`;

  const st = qs('#st');
  if(st) {
    const logs = (s.log || []).slice(-7);
    if(!logs.length) {
      st.innerHTML = `<div style="color:var(--text3);font-size:12px;padding:10px 0;">
        Henüz günlük RZWB kaydı yok. 🛰️ Uydu sekmesinden güncelleme yaparak verilerin
        toplanmasını bekleyin — kayıtlar otomatik birikiyor.
      </div>`;
    } else {
      st.innerHTML = `<div style="overflow-x:auto;"><table class="tbl">
        <thead><tr>
          <th>Tarih</th><th>Pe</th><th>Sulama</th>
          <th>ETc-Yüz</th><th>ETc-Der</th><th>Sızma</th><th>Bekleyen</th><th>Kök Altı</th>
          <th>Dr (mm)</th><th>Yüzey %</th><th>Derin %</th><th>Kc</th><th>Ks</th>
        </tr></thead>
        <tbody>${logs.map(r => {
          const pct_s = r.pct_s ?? r.pct_surf ?? 50;
          const sc2 = scl(pct_s);
          const ksVal = r.Ks_s ?? 1;
          const percDeep = r.percDeep ?? 0;
          const surplusS = r.surplus_s ?? 0;
          return `<tr>
            <td style="white-space:nowrap;">${fd(r.date)}</td>
            <td>${+(r.Pe ?? r.rain ?? 0).toFixed(1)}mm</td>
            <td>${r.irr > 0 ? r.irr + 'mm' : '—'}</td>
            <td>${+(r.ETc_s ?? r.et_surf ?? 0).toFixed(1)}mm</td>
            <td>${+(r.ETc_d ?? r.et_deep ?? 0).toFixed(1)}mm</td>
            <td>${+(r.perc ?? r.percolation ?? 0).toFixed(1)}mm</td>
            <td style="color:${surplusS>0?'var(--blue)':'inherit'};" title="Tarla kapasitesini aşan, henüz süzülmemiş ve yarına taşınan su (kademeli yerçekimi drenajı)">${surplusS>0?'🌊 '+surplusS.toFixed(1)+'mm':'—'}</td>
            <td style="color:${percDeep>0?'var(--amber)':'inherit'};" title="Kök bölgesi altına drene olan su (kalıcı kayıp)">${percDeep.toFixed(1)}mm</td>
            <td style="font-weight:600;">${+(r.Dr_s ?? 0).toFixed(1)}</td>
            <td><span class="tag ${sc2.tag}">${pct_s}%</span></td>
            <td>${r.pct_d ?? r.pct_deep ?? '—'}%</td>
            <td>${r.kc?.toFixed(2) ?? '—'}</td>
            <td style="font-weight:600;color:${ksVal < 1 ? 'var(--amber)' : 'var(--green2)'};">${ksVal.toFixed(2)}</td>
          </tr>`;
        }).join('')}</tbody>
      </table></div>`;
    }
  }
};

window.renderLocInfo = (field) => {
  const el=qs('#fp-locinfo'); if(!el) return;
  const infraHTML = [];
  if(field.irrigation) infraHTML.push(`<span class="tag tg">💧 ${window.esc(field.irrigation)}</span>`);
  if(field.fencing) infraHTML.push(`<span class="tag ${field.fencing==='Yok'?'tr':'tgr'}">🔒 Çit: ${window.esc(field.fencing)}</span>`);
  if(field.waterSource) infraHTML.push(`<span class="tag tb">🚿 Su: ${window.esc(field.waterSource)}</span>`);
  if(field.plantingAge) infraHTML.push(`<span class="tag tp2">🌳 Dikim yaşı: ${field.plantingAge} yıl</span>`);
  
  el.innerHTML=`<table class="tbl">
    <tr><td style="color:var(--text3);">Enlem</td><td>${field.lat?.toFixed(5)}°N</td></tr>
    <tr><td style="color:var(--text3);">Boylam</td><td>${field.lon?.toFixed(5)}°E</td></tr>
    <tr><td style="color:var(--text3);">Mevki</td><td>${window.esc(field.location||'—')}</td></tr>
    <tr><td style="color:var(--text3);">Alan</td><td>${field.area} ${field.areaUnit||'dönüm'}</td></tr>
    <tr><td style="color:var(--text3);">Ekim/Dikim</td><td>${fd(field.plantDate)}</td></tr>
    <tr><td style="color:var(--text3);">Hasat (Plan)</td><td>${fd(field.harvestDate)}</td></tr>
    ${field.notes?`<tr><td style="color:var(--text3);">Not</td><td style="font-size:11px;">${window.esc(field.notes.slice(0,120))}</td></tr>`:''}
  </table>
  ${infraHTML.length?`<div style="display:flex;flex-wrap:wrap;gap:5px;margin-top:10px;">${infraHTML.join('')}</div>`:''}
  ${field.polygon?.length >= 3 ? '<div style="font-size:11px;color:var(--green2);margin-top:6px;">📐 Tarla sınırı: '+field.polygon.length+' köşe noktalı poligon</div>' : ''}`;
  
  const wl=qs('#fp-wxlinks'); if(!wl) return;
  wl.innerHTML=[
    [`https://www.windy.com/?${field.lat},${field.lon},13`,'🌬️ Windy.com — Canlı Rüzgar & Yağış'],
    [`https://www.meteoblue.com/tr/hava/week/${field.lat.toFixed(3)}N${Math.abs(field.lon).toFixed(3)}E`,'🌤️ Meteoblue — Tarımsal Tahmin'],
    [`https://www.mgm.gov.tr/tahmin/il-ve-ilceler.aspx`,'🇹🇷 MGM — Türkiye Meteorolojisi'],
    [`https://maps.google.com/?q=${field.lat},${field.lon}`,'📍 Google Maps\'te Tarla Konumu']
  ].map(([u,l])=>`<a href="${u}" target="_blank" class="wxlink">${l}</a>`).join('');
};

window.buildAutoRecs = async (field) => {
  const recs=[];
  const s= await calcSoil(field);
  const wx=WXC[field.id]?.days||simWX(field.lat,field.lon);
  const today=tstr();
  const futWx=wx.filter(d=>d.date>today).slice(0,7);
  const futR=futWx.reduce((t,d)=>t+d.rain,0);
  const futET=futWx.reduce((t,d)=>t+(d.et0||s.et),0);
  const maxT=futWx.length?Math.max(...futWx.map(d=>d.tmax)):25;
  const rainyD=futWx.filter(d=>d.rain>3).length;
  let diseaseRisk=false, consecutiveHumid=0;
  for(let i=0;i<Math.min(futWx.length,5);i++){
    if(futWx[i].rain>2&&futWx[i].tmax>15&&futWx[i].tmax<28) consecutiveHumid++;
    else consecutiveHumid=0;
    if(consecutiveHumid>=3) diseaseRisk=true;
  }
  const evs=field.events||[];
  const dSince=type=>{ const e=evs.filter(x=>x.type===type&&!x.planned).sort((a,b)=>b.date.localeCompare(a.date))[0]; return e?Math.round((Date.now()-new Date(e.date))/(864e5)):999; };
  const a=window.agrd(field.crop);

  const irr = window.calcIrrigationNeed(field, s);
  if(irr.urgency === 'kritik') {
    recs.push({i:'🚨',bg:'var(--rbg)',c:'var(--red)',t:'ACİL Sulama — Kök Bölgesi Kritik',
      s:`Yüzey nemi %${s.surface.pct} (Dr=${irr.Dr_s}mm, RAW=${irr.raw_s?.toFixed(0)}mm). Su açığı: ${irr.deficitMm}mm. Önerilen doz: ${irr.recommendedMm}mm.`,pr:'YÜKSEK'});
  } else if(irr.urgency === 'stres') {
    recs.push({i:'⚠️',bg:'var(--rbg)',c:'var(--red)',t:`Bitki Su Stresi (Ks=${irr.Ks?.toFixed(2)})`,
      s:`${irr.stressLabel} — verim kaybı başlıyor. Önerilen sulama: ${irr.recommendedMm}mm. ${irr.daysUntilCritical}g içinde kritik.`,pr:'YÜKSEK'});
  } else if(irr.urgency === 'öneri') {
    recs.push({i:'💧',bg:'var(--abg)',c:'var(--amber)',t:'Sulama Planlanmalı (RAW Eşiği Aşıldı)',
      s:`Dr=${irr.Dr_s}mm > RAW=${irr.raw_s?.toFixed(0)}mm. 7g net: ${irr.netBalance7d}mm. Önerilen doz: ${irr.recommendedMm}mm.`,pr:'ORTA'});
  } else if(irr.urgency === 'izle') {
    recs.push({i:'👀',bg:'var(--abg)',c:'var(--amber)',t:'RAW Eşiği Aşıldı — Yağış Bekleniyor',
      s:`Nem sınırda (Dr=${irr.Dr_s}mm). 7g beklenen yağış: ${irr.futRain7d}mm. Yeterli gelmezse sulama gerekecek.`,pr:'DÜŞÜK'});
  }

  if(dSince('gübre')>45) recs.push({i:'🧪',bg:'var(--abg)',c:'var(--amber)',t:'Gübreleme Değerlendirin',s:`${dSince('gübre')<999?dSince('gübre')+' gündür':'Hiç'} gübreleme yapılmamış. ${a.fert?.slice(0,80)||'Dönemsel gübre planı yapın'}.`,pr:'ORTA'});
  if(diseaseRisk&&dSince('ilaç')>21) recs.push({i:'🔬',bg:'var(--pbg)',c:'var(--purple)',t:'Fungal Hastalık Riski (Yüksek)',s:`Art arda yağışlı ve ılık hava → külleme/mildiyö riski. Koruyucu ilaçlama değerlendirin.`,pr:'YÜKSEK'});
  else if(rainyD>=3&&dSince('ilaç')>21) recs.push({i:'🔬',bg:'var(--pbg)',c:'var(--purple)',t:'Fungal Hastalık Riski',s:`${rainyD} günlük yağışlı hava bekleniyor. Yüksek nem → fungus/mildiyö riski.`,pr:'ORTA'});
  if(maxT>a.tm) recs.push({i:'🌡️',bg:'var(--rbg)',c:'var(--red)',t:'Kritik Sıcaklık Stresi!',s:`${maxT}°C bekleniyor, ürün üst limiti ${a.tm}°C. Sabah erken sulama yapın.`,pr:'YÜKSEK'});
  else if(maxT>a.to+8) recs.push({i:'☀️',bg:'var(--abg)',c:'var(--amber)',t:'Yüksek Sıcaklık Uyarısı',s:`${maxT}°C bekleniyor. Optimum: ${a.to}°C.`,pr:'ORTA'});
  const he=calcHarvest(field);
  if(he&&!he.already&&he.daysLeft<=14&&he.daysLeft>=0) recs.push({i:'🌾',bg:'var(--gbg)',c:'var(--green2)',t:'Hasat Yaklaşıyor',s:`GDD tahmini: ${he.daysLeft} gün kaldı. GDD ilerlemesi: %${he.gddPct}.`,pr:'BİLGİ'});
  if(he?.already) recs.push({i:'🟢',bg:'var(--gbg)',c:'var(--green2)',t:'Hasat Zamanı!',s:'Fenolojik hesaplama hasat olgunluğuna ulaşıldığını gösteriyor.',pr:'YÜKSEK'});
  return recs;
};

window.renderRecTab = async (field) => {
  const ph=calcPheno(field);
  const he=calcHarvest(field);
  const sh=calcSolar(field);
  const a=window.agrd(field.crop);
  const phen=qs('#rec-pheno');
  if(phen){
    let html='';
    if(ph){
      const ageInfo = ph.plantingAge > 0 ? `<span class="tag tp2">🌳 ${ph.plantingAge} yaşında dikim</span>` : '';
      html+=`<div style="margin-bottom:14px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;flex-wrap:wrap;gap:4px;">
          <span style="font-size:12px;font-weight:700;">🌱 Gelişim Dönemi: <span style="color:var(--green2);">${ph.stage}</span></span>
          <div style="display:flex;gap:4px;">${ageInfo}<span class="tag tgr">${ph.days} gün</span></div>
        </div>
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
          <span style="font-size:10px;color:var(--text3);min-width:80px;">Sezon İlerlemesi</span>
          <div style="flex:1;height:7px;border-radius:4px;background:var(--bg3);overflow:hidden;"><div style="height:100%;border-radius:4px;background:var(--green2);width:${ph.totPct}%;transition:width .6s;"></div></div>
          <span style="font-size:11px;font-weight:700;">%${ph.totPct}</span>
        </div>
        <div style="font-size:11px;color:var(--text2);">GDD: ${ph.gdd} · Sezon: ${a.td} gün · ${window.getBestWXDays(field).filter(d=>d.date<=tstr()).length} günlük geçmiş verisi</div>
        <div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:7px;">${a.st.map((s,i)=>`<span style="font-size:9px;padding:2px 6px;border-radius:8px;background:${i<ph.si?'var(--gbg)':i===ph.si?'var(--green2)':'var(--bg3)'};color:${i<ph.si?'var(--green)':i===ph.si?'#fff':'var(--text3)'};">${s}</span>`).join('')}</div>
      </div>`;
    }
    if(sh){
      const hc={normal:'var(--green2)',uyarı:'var(--amber)',stres:'var(--red)',soğuk:'var(--blue)'};
      const hl={normal:'Normal',uyarı:'Sıcaklık Uyarısı',stres:'Isı Stresi',soğuk:'Soğuk Riski'};
      html+=`<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:12px;">
        <div class="kpi"><div class="kpi-l">☀️ Güneşlenme</div><div class="kpi-v">${sh.sunH}<small>sa</small></div></div>
        <div class="kpi"><div class="kpi-l">🌡️ Sıcaklık</div><div class="kpi-v" style="font-size:12px;color:${hc[sh.hs]};">${hl[sh.hs]}</div></div>
        <div class="kpi"><div class="kpi-l">⚡ Solar</div><div class="kpi-v">${sh.rad}<small>MJ/m²</small></div></div>
      </div>`;
    }
    if(he){
      const cc={yüksek:'var(--green2)',orta:'var(--amber)',düşük:'var(--red)',manuel:'var(--blue)'};
      html+=`<div style="background:var(--glt);border:1px solid var(--gbg);border-radius:var(--r);padding:12px 14px;">
        <div style="font-size:13px;font-weight:700;margin-bottom:6px;">🌾 GDD Hasat Tahmini</div>
        <div style="font-size:18px;font-weight:800;color:${he.already?'var(--green2)':'var(--text)'};">${he.already?'🟢 Hasat Zamanı!':he.daysLeft+' gün kaldı'}</div>
        <div style="font-size:12px;color:var(--text2);margin-top:3px;">${fd(he.estDate)}</div>
        ${!he.already&&he.gddPct!==null?`<div style="display:flex;align-items:center;gap:8px;margin-top:8px;"><span style="font-size:10px;color:var(--text3);min-width:80px;">GDD %${he.gddPct}</span><div style="flex:1;height:6px;border-radius:4px;background:var(--bg3);overflow:hidden;"><div style="height:100%;border-radius:4px;background:var(--amber);width:${he.gddPct}%;"></div></div><span style="font-size:11px;font-weight:700;">${he.gddAcc}/${he.gddTarget}</span></div>`:''}
        <div style="font-size:10px;color:var(--text3);margin-top:5px;">Güvenilirlik: <span style="font-weight:700;color:${cc[he.conf]||'var(--text)'};">${he.conf.toUpperCase()}</span>${he.manDate?` · Manuel: ${fd(he.manDate)}${he.dev!==null?` (${he.dev>0?'+':''}${he.dev}g sapma)`:''}`:''}${window.getBestWXDays(field).filter(d=>d.date<=tstr()).length>60?' · ✅ 6 ay geçmiş verisi kullanılıyor':''}</div>
      </div>`;
    }else if(!field.plantDate){
      html+=`<div style="color:var(--text3);font-size:12px;padding:12px 0;">Ekim tarihi girildiğinde fenoloji ve hasat tahmini hesaplanır.</div>`;
    }
    phen.innerHTML=html;
  }

  const recs= await buildAutoRecs(field);
  const ar=qs('#rec-auto');
  if(ar) ar.innerHTML=recs.length
    ? recs.map(r=>`<div class="ritem" style="background:${r.bg};"><div class="rico" style="background:${r.bg};color:${r.c};font-size:15px;">${r.i}</div><div class="rbody"><div class="rtitle">${r.t}<span class="rpri" style="background:${r.c}22;color:${r.c};">${r.pr}</span></div><div class="rsub">${r.s}</div></div></div>`).join('')
    : '<div style="color:var(--green2);font-size:13px;">✅ Kritik uyarı yok.</div>';

  const fertH=(field.events||[]).filter(e=>e.type==='gübre').sort((a,b)=>b.date.localeCompare(a.date)).slice(0,3)
    .map(e=>`${fd(e.date)}: ${e.extra?.['e-ft']||''} (${e.qty||'?'}${e.unit||'kg'})`);
  const fr=qs('#rec-fert');
  if(fr) fr.innerHTML=`<div style="font-size:13px;font-weight:600;margin-bottom:8px;">${field.crop||'Ürün seçilmemiş'} — Gübre Programı</div><div style="font-size:13px;line-height:1.7;background:var(--bg3);padding:10px 12px;border-radius:var(--r);">${a.fert}</div>${fertH.length?`<div style="font-size:11px;color:var(--text3);margin-top:8px;">Son gübrelemeler: ${fertH.join(' · ')}</div>`:''}`;

  const futWx=(WXC[field.id]?.days||simWX(field.lat,field.lon)).filter(d=>d.date>tstr()).slice(0,7);
  const avgR=futWx.reduce((s,d)=>s+d.rain,0)/Math.max(futWx.length,1);
  const avgT=futWx.reduce((s,d)=>s+d.tmax,0)/Math.max(futWx.length,1);
  let rl='DÜŞÜK';
  if(avgR>5&&avgT>18) rl='YÜKSEK';
  else if(avgR>2||avgT>24) rl='ORTA';
  const rc={YÜKSEK:'var(--red)',ORTA:'var(--amber)',DÜŞÜK:'var(--green2)'}[rl];
  const pests=PEST_DATA[field.crop]||PEST_DATA.default;
  const pr=qs('#rec-pest');
  if(pr){
    pr.innerHTML=`<div style="display:flex;align-items:center;gap:8px;margin-bottom:9px;">
      <span style="font-size:13px;">7 günlük hava verilerine göre risk:</span>
      <span class="tag" style="background:${rc}22;color:${rc};">${rl}</span>
    </div>
    ${pests.map(p=>`<div class="ritem" style="background:var(--bg3);padding:7px 10px;margin-bottom:5px;"><div class="rico" style="background:var(--pbg);color:var(--purple);font-size:12px;">🔬</div><div class="rbody"><div class="rtitle" style="font-size:12px;">${p}</div></div></div>`).join('')}
    <div style="font-size:11px;color:var(--text3);margin-top:7px;">⚠️ İlaçlama öncesi zirai mühendis ve resmi etiket bilgilerine başvurun.</div>
    <button class="btn btns btnp" style="margin-top:10px;" onclick="aiPestAnalysis('${field.id}')">🤖 AI Hastalık & Zararlı Analizi</button>
    <div id="rec-pest-ai" style="margin-top:8px;"></div>`;
  }

  const ar2=qs('#rec-ai');
  if(ar2) ar2.innerHTML=field.aiRecs?.length
    ? `<div class="bubble bb" style="white-space:pre-line;">${window.esc(field.aiRecs[0].text)}</div><div style="font-size:10px;color:var(--text3);margin-top:4px;">${fd(field.aiRecs[0].date)} tarihli analiz</div>`
    : '<div style="color:var(--text3);font-size:13px;">🤖 AI Analiz butonu ile tüm veriler harmanlanarak bütünsel uzman yorumu oluşturulur.</div>';
};

window.goTab = async (t) => {
  curTab=t;
  document.querySelectorAll('.tab').forEach(x=>x.classList.remove('on'));
  document.querySelectorAll('.tp').forEach(x=>x.classList.remove('on'));
  qs(`.tab[data-t="${t}"]`)?.classList.add('on');
  qs('#tp-'+t)?.classList.add('on');
  if(!CUR) return;
  if(t==='map') requestAnimationFrame(()=>{ setTimeout(()=>{ initMap(CUR.lat,CUR.lon,CUR); renderLocInfo(CUR); },80); });
  else if(t==='wx'){ if(!WXC[CUR.id]) fetchWX(CUR); else renderWX(CUR); }
  else if(t==='sat'){ if(!SATC[CUR.id]||Date.now()-SATC[CUR.id].at>3600000) fetchSat(CUR); else renderSat(CUR,SATC[CUR.id].data); }
  else if(t==='soil') await renderSoil(CUR);
  else if(t==='ev') renderEvTab(CUR);
  else if(t==='rec') await renderRecTab(CUR);
  else if(t==='ph') renderPhTab(CUR);
  else if(t==='ai'){
    const chat=qs('#ai-chat');
    if(chat&&!chat.children.length){
      const memLen = window.getAIMemory(CUR.id).length;
      chat.innerHTML=`<div class="bubble bs">👋 <strong>${CUR.name}</strong> tarlası için AI asistanı hazır.${memLen>0?`<br/>🧠 <strong>${memLen}</strong> mesajlık konuşma hafızası yüklendi.`:''}<br/>🤖 <strong>AI Analiz</strong> butonuna basın → Hava + toprak (2 katman) + uydu + fenoloji + konuşma geçmişi tek bütünsel uzman yorumu.</div>`;
    }
    const qq=qs('#qqbtns');
    if(qq) qq.innerHTML=['Sulama planı','Gübre tavsiyesi',`${CUR.crop||'ürün'} hastalık riskleri`,'Bu hafta ne yapmalıyım?','Toprak nemi yorumu'].map(q=>`<button style="padding:4px 9px;border-radius:7px;font-size:11px;border:1px solid var(--bdr2);background:transparent;color:var(--text2);cursor:pointer;" onmouseover="this.style.borderColor='var(--green2)';this.style.color='var(--green2)'" onmouseout="this.style.borderColor='var(--bdr2)';this.style.color='var(--text2)'" onclick="qs('#ai-inp').value='${q}';sendChat()">${q}</button>`).join('');
  }
};

window.goPage = async (p) => {
  document.querySelectorAll('.page').forEach(x=>x.classList.remove('on'));
  qs('#page-'+p)?.classList.add('on');
  document.querySelectorAll('.tn').forEach(b=>b.classList.remove('on'));
  const idx={dash:0,cal:1,rep:2,cfg:3}[p];
  if(idx!==undefined) document.querySelectorAll('.tn')[idx]?.classList.add('on');
  if(p==='dash'){ invSoilAll(); await renderDash(); }
  if(p==='cal') renderCal();
  if(p==='rep'){ invSoilAll(); await renderRep(); }
  clSBmob();
};

window.closeM = (id) => { qs('#m-'+id)?.classList.remove('on'); };
