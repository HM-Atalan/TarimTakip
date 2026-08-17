// ============================================================
// satellite.js – Uydu verileri, NDVI, SoilGrids
//
// DÜZELTME: fetchSat() artık her çalıştığında toprak nem modelini
// (RZWB ledger) günlük olarak uyduya doğru "düzeltmiyor". Uydu verisi
// sadece soilModel.js içindeki bootstrap (ilk kurulum) aşamasında
// başlangıç nemini tahmin etmek için kullanılıyor; softCalibrateRZWB
// çağrısı bilerek kaldırıldı.
// ============================================================

window.ndviCls = (v) => {
  const n=parseFloat(v);
  if(n>0.7) return {l:'Çok İyi',   tag:'tg', color:'var(--green2)', bar:'#2d6a4f'};
  if(n>0.5) return {l:'İyi',       tag:'tg', color:'var(--green2)', bar:'#40916c'};
  if(n>0.3) return {l:'Orta',      tag:'tgr',color:'var(--text2)',  bar:'#888'};
  if(n>0.15)return {l:'Zayıf',     tag:'ta', color:'var(--amber)',  bar:'#e67e22'};
  return           {l:'Çok Zayıf', tag:'tr', color:'var(--red)',    bar:'#e74c3c'};
};

window.fetchSat = async (field) => {
  field = field||CUR; if(!field) return;
  const id=field.id, lat=field.lat, lon=field.lon;
  const sb=(sid,cls,lbl)=>setBadge('sat-src',sid,cls,lbl);
  sb('agro','load','Open-Meteo Agro…'); sb('nasa','load','NASA POWER…'); sb('s2','load','Sentinel-2…');
  const R={};

  try{
    const url=`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=soil_temperature_0cm,soil_temperature_6cm,soil_moisture_0_to_1cm,soil_moisture_1_to_3cm,soil_moisture_3_to_9cm,soil_moisture_9_to_27cm,vapor_pressure_deficit,relative_humidity_2m&daily=et0_fao_evapotranspiration,shortwave_radiation_sum&past_days=7&forecast_days=3&timezone=Europe%2FIstanbul`;
    const r=await fetch(url);
    if(r.ok){
      const d=await r.json();
      const today=tstr(); const ti=d.daily?.time?.indexOf(today)??-1; const hi=new Date().getHours(); const hb=(ti>=0?ti:0)*24;
      R.soilT0=d.hourly?.soil_temperature_0cm?.[hb+hi]?.toFixed(1);
      R.soilT6=d.hourly?.soil_temperature_6cm?.[hb+hi]?.toFixed(1);
      R.soilM1=d.hourly?.soil_moisture_0_to_1cm?.[hb+hi];
      R.soilM3=d.hourly?.soil_moisture_3_to_9cm?.[hb+hi];
      R.soilMDeep=d.hourly?.soil_moisture_9_to_27cm?.[hb+hi];
      R.vpd=d.hourly?.vapor_pressure_deficit?.[hb+hi]?.toFixed(2);
      R.humidity = d.hourly?.relative_humidity_2m?.[hb+hi]?.toFixed(0);
      R.et0=ti>=0?d.daily?.et0_fao_evapotranspiration?.[ti]?.toFixed(1):null;
      R.solar=ti>=0?d.daily?.shortwave_radiation_sum?.[ti]?.toFixed(1):null;
      R.past7Solar=d.daily?.shortwave_radiation_sum?.slice(0,8)||[];
      R.past7Dates=d.daily?.time?.slice(0,8)||[];
      sb('agro','ok','Open-Meteo Agro ✓');
    }else sb('agro','err','Agro: '+r.status);
  }catch(e){ sb('agro','err','Agro: '+e.message); }

  try{
    const ed=tstr().replace(/-/g,''); const sdt=new Date(); sdt.setDate(sdt.getDate()-30);
    const sd=sdt.toISOString().slice(0,10).replace(/-/g,'');
    const url=`https://power.larc.nasa.gov/api/temporal/daily/point?parameters=ALLSKY_SFC_SW_DWN,T2M_MAX,PRECTOTCORR&community=AG&longitude=${lon}&latitude=${lat}&start=${sd}&end=${ed}&format=JSON`;
    const r=await fetch(url);
    if(r.ok){
      const d=await r.json();
      const props=d.properties?.parameter||{};
      const solar=props['ALLSKY_SFC_SW_DWN']||{};
      const dates=Object.keys(solar).sort(); const last14=dates.slice(-14);
      R.nasaSolar14=(last14.reduce((s,k)=>s+(solar[k]>0?solar[k]:0),0)/Math.max(last14.length,1)).toFixed(1);
      R.nasaRain30=Object.values(props['PRECTOTCORR']||{}).slice(-30).reduce((s,v)=>s+(v>0?v:0),0).toFixed(1);
      R.nasaDates=last14; R.nasaSolarArr=last14.map(k=>solar[k]);
      sb('nasa','ok','NASA POWER ✓');
    }else sb('nasa','err','NASA: '+r.status);
  }catch(e){ sb('nasa','err','NASA: '+e.message); }

  try{
    const bbox=[lon-0.01,lat-0.01,lon+0.01,lat+0.01];
    const edt=new Date(); const sdt2=new Date(); sdt2.setDate(edt.getDate()-45);
    const body={collections:['sentinel-2-l2a'],bbox,datetime:sdt2.toISOString().slice(0,10)+'T00:00:00Z/'+edt.toISOString().slice(0,10)+'T23:59:59Z',query:{'eo:cloud_cover':{lte:35}},limit:3};
    const r=await fetch('https://earth-search.aws.element84.com/v1/search',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    if(r.ok){
      const d=await r.json();
      R.s2count=d.features?.length||0;
      R.s2date=d.features?.[0]?.properties?.datetime?.slice(0,10)||null;
      R.s2cloud=d.features?.[0]?.properties?.['eo:cloud_cover']?.toFixed(0)||null;
      sb('s2', R.s2count>0?'ok':'err', R.s2count>0?`Sentinel-2 ✓ (${R.s2count} geçiş, son:${R.s2date})`:'S2: Uygun görüntü yok');
    }else sb('s2','err','S2 STAC: '+r.status);
  }catch(e){ sb('s2','err','Sentinel-2: '+e.message); }

  const month=new Date().getMonth()+1;
  const sf=Math.sin((month-3)*Math.PI/6)*0.2+0.7;
  const solf=R.nasaSolar14?Math.min(1,parseFloat(R.nasaSolar14)/25):0.7;
  const rainf=R.nasaRain30?Math.min(1,parseFloat(R.nasaRain30)/60):0.5;
  const tempf=R.soilT6?Math.max(0,Math.min(1,(parseFloat(R.soilT6)-5)/25)):0.6;
  const a=window.agrd(field.crop);
  const cropf=Math.min(1,(a.to||22)/30);
  const ndvi=Math.max(0.05,Math.min(0.95,(sf*0.3+solf*0.25+rainf*0.25+tempf*0.2)*cropf));
  R.ndvi=ndvi.toFixed(3); R.evi=(ndvi*0.88).toFixed(3);
  const ndwiRaw=(rainf*0.6+(R.soilM3||0.2)*0.4)-0.1;
  R.ndwi=Math.max(-0.5,Math.min(0.8,ndwiRaw)).toFixed(3);
  R.lst=R.soilT0||R.soilT6||'—';
  // Earth Search is queried only for acquisition metadata; no Sentinel-2
  // spectral asset is downloaded in this application. Therefore the indices
  // below remain model estimates even when a recent S2 scene exists.
  R.isEst=true;
  R.indexSource='weather-soil-model-estimate';
  R.soilMoistureSource=(Number.isFinite(R.soilM3) || Number.isFinite(R.soilMDeep))
    ? 'open-meteo-model' : 'unavailable';
  R.s2MetadataOnly=!!R.s2date;

  SATC[id]={data:R, at:Date.now()};
  invSoil(id);
  renderSat(field, R);

  // NOT: Önceden burada her uydu yenilemesinde bugünün RZWB kaydını
  // uyduya doğru çeken bir "softCalibrateRZWB" çağrısı vardı. Bu,
  // 90 günlük fiziksel simülasyonu keyfi biçimde bozduğu için
  // kaldırıldı. Uydu artık sadece ledger boşken (bootstrap) başlangıç
  // seviyesi tahmini için kullanılıyor — bkz. soilModel.js.
};

window.renderSat = (field, R) => {
  if(!R) return;
  const nc=ndviCls(R.ndvi);
  const bar=(v,max,color)=>`<div style="height:7px;border-radius:4px;background:var(--bg3);overflow:hidden;margin-top:5px;"><div style="height:100%;width:${Math.min(100,Math.max(0,(parseFloat(v)+0.5)/(max+0.5)*100))}%;background:${color};border-radius:4px;"></div></div>`;

  const nel=qs('#sat-ndvi');
  if(nel) nel.innerHTML=`<div style="text-align:center;padding:8px 0;"><div style="font-size:28px;font-weight:800;color:${nc.color};">${R.ndvi}</div><span class="tag ${nc.tag}" style="margin-top:4px;display:inline-flex;">${nc.l}</span></div>${bar(R.ndvi,0.95,nc.bar)}<div style="font-size:10px;color:var(--text3);margin-top:4px;">-1 (çıplak) ← 0 → +1 (yoğun bitki)</div><div class="tag ta" style="font-size:9px;margin-top:5px;display:inline-flex;">⚠️ Model tahmini${R.s2date?' · S2 geçiş metadata: '+R.s2date:''}</div>`;

  const eel=qs('#sat-evi');
  if(eel) eel.innerHTML=`<div style="text-align:center;padding:8px 0;"><div style="font-size:28px;font-weight:800;color:var(--green2);">${R.evi}</div><span class="tag tg" style="margin-top:4px;display:inline-flex;">${parseFloat(R.evi)>0.4?'İyi Vejetasyon':'Gelişmekte'}</span></div>${bar(R.evi,0.9,'var(--green2)')}<div style="font-size:10px;color:var(--text3);margin-top:4px;">Hava-toprak modeli tahmini (0–0.9), uydu bant hesabı değildir</div>`;

  const nwl=parseFloat(R.ndwi)>0.3?'Yüksek Su':parseFloat(R.ndwi)>0?'Orta':parseFloat(R.ndwi)>-0.2?'Düşük':'Kuru/Stres';
  const wel=qs('#sat-ndwi');
  if(wel) wel.innerHTML=`<div style="text-align:center;padding:8px 0;"><div style="font-size:28px;font-weight:800;color:var(--blue);">${R.ndwi}</div><span class="tag tb" style="margin-top:4px;display:inline-flex;">${nwl}</span></div>${bar((parseFloat(R.ndwi)+0.5),1.3,'var(--blue)')}<div style="font-size:10px;color:var(--text3);margin-top:4px;">Model tabanlı su stresi tahmini, gerçek NDWI bant hesabı değildir</div>`;

  const lv=parseFloat(R.lst)||20;
  const lel=qs('#sat-lst');
  if(lel){
    const surfPct = R.soilM3 ? (parseFloat(R.soilM3)*100).toFixed(0) : '—';
    const deepPct = R.soilMDeep ? (parseFloat(R.soilMDeep)*100).toFixed(0) : '—';
    lel.innerHTML=`<div style="text-align:center;padding:8px 0;"><div style="font-size:28px;font-weight:800;color:${lv>35?'var(--red)':lv>25?'var(--amber)':'var(--green2)'};">${R.lst}°C</div><span class="tag ${lv>35?'tr':lv>25?'ta':'tg'}" style="margin-top:4px;display:inline-flex;">${lv>35?'Yüksek Sıcaklık':lv>25?'Ilık':'Normal'}</span></div>
    <div style="font-size:11px;color:var(--text2);margin-top:5px;">
      Toprak 0cm: ${R.soilT0||'—'}°C · 6cm: ${R.soilT6||'—'}°C${R.vpd?' · VPD: '+R.vpd+'kPa':''}${R.humidity?' · Nem: '+R.humidity+'%':''}
    </div>
    <div style="margin-top:8px;font-size:11px;color:var(--text2);">
      <div style="display:flex;justify-content:space-between;margin-bottom:3px;"><span>🌿 Yüzey nemi (3-9cm):</span><span style="font-weight:700;">${surfPct}%</span></div>
      <div style="height:5px;border-radius:3px;background:var(--bg3);overflow:hidden;margin-bottom:6px;"><div style="height:100%;width:${surfPct}%;background:var(--blue);border-radius:3px;"></div></div>
      <div style="display:flex;justify-content:space-between;margin-bottom:3px;"><span>🌍 Derin nem (9-27cm):</span><span style="font-weight:700;">${deepPct}%</span></div>
      <div style="height:5px;border-radius:3px;background:var(--bg3);overflow:hidden;"><div style="height:100%;width:${deepPct}%;background:var(--green2);border-radius:3px;"></div></div>
    </div>`;
  }

  const tel=qs('#sat-trend');
  const arr=R.past7Solar?.length?R.past7Solar:R.nasaSolarArr||[];
  const dts=R.past7Dates?.length?R.past7Dates:R.nasaDates||[];
  if(tel&&arr.length){
    const mx=Math.max(...arr.filter(v=>v>0),1);
    const bars=arr.map((v,i)=>{
      const p=v>0?Math.round(v/mx*100):0; const col=p>70?'#40916c':p>40?'#e67e22':'#e74c3c';
      const dt=(dts[i]||'').slice(5);
      return`<div style="display:flex;flex-direction:column;align-items:center;flex:1;min-width:0;"><div style="width:100%;height:60px;background:var(--bg3);border-radius:3px;display:flex;align-items:flex-end;"><div style="width:100%;height:${p}%;background:${col};border-radius:2px;"></div></div><div style="font-size:8px;color:var(--text3);margin-top:2px;white-space:nowrap;">${dt}</div></div>`;
    }).join('');
    tel.innerHTML=`<div style="font-size:11px;color:var(--text2);margin-bottom:8px;">Solar Radyasyon (MJ/m²)${R.nasaRain30?' · 30 günlük yağış: '+R.nasaRain30+'mm':''}${R.et0?' · ET₀ bugün: '+R.et0+'mm':''}</div><div style="display:flex;gap:3px;height:80px;">${bars}</div><div style="font-size:10px;color:var(--text3);margin-top:5px;">Ort. Solar (14g): ${R.nasaSolar14||'—'} MJ/m²/gün</div>`;
  }

  const iel=qs('#sat-interp');
  if(iel){
    const nv=parseFloat(R.ndvi), nw=parseFloat(R.ndwi);
    let msg='';
    if(nv>0.6&&nw>0.1)    msg='✅ Bitki örtüsü yoğun ve su dengesi iyi. Vejetasyon sağlıklı görünüyor.';
    else if(nv>0.5&&nw<-0.1) msg='⚠️ İyi NDVI ancak NDWI düşük → su stresi belirtisi. Sulama değerlendirin.';
    else if(nv<0.3)        msg='🚨 Düşük NDVI → yetersiz bitki örtüsü veya erken gelişim dönemi. Fenoloji ile karşılaştırın.';
    else                   msg='🌱 Normal gelişim seyri. Uydu indeksleri dönemle tutarlı.';
    const sm=R.soilM3?`Yüzey nemi (3-9cm): ${(parseFloat(R.soilM3)*100).toFixed(0)}% · Derin nem (9-27cm): ${R.soilMDeep?(parseFloat(R.soilMDeep)*100).toFixed(0)+'%':'—'}`:'';
    const vpdm=R.vpd?(parseFloat(R.vpd)>2.5?' · ⚠️ VPD yüksek (transpirasyon stresi)':' · VPD normal'):'';
    iel.innerHTML=`<div class="ritem" style="background:var(--glt);"><div class="rico" style="background:var(--gbg);color:var(--green2);font-size:16px;">🛰️</div><div class="rbody"><div class="rtitle" style="margin-bottom:5px;">Model Tabanlı Vejetasyon Değerlendirmesi</div><div class="rsub">${msg}${sm?'<br/>'+sm+vpdm:''}</div><div style="font-size:10px;color:var(--text3);margin-top:6px;">NDVI:${R.ndvi} · EVI:${R.evi} · NDWI:${R.ndwi} · LST:${R.lst}°C${R.solar?' · Solar:'+R.solar+'MJ/m²':''} · Model tahmini${R.s2date?' · S2 yalnız metadata:'+R.s2date:''}</div></div></div>`;
  }

  const lnkel=qs('#sat-links');
  if(lnkel){
    const lat = Number(field.lat);
    const lon = Number(field.lon);
    const bbox=`${(lon-0.02).toFixed(4)},${(lat-0.02).toFixed(4)},${(lon+0.02).toFixed(4)},${(lat+0.02).toFixed(4)}`;
    lnkel.innerHTML=[
      [`https://apps.sentinel-hub.com/sentinel-playground/?lat=${lat}&lng=${lon}&zoom=14`,'🛰️ Sentinel Playground (Gerçek Renkli / NDVI)'],
      [`https://apps.sentinel-hub.com/eo-browser/?lat=${lat}&lng=${lon}&zoom=14`,'🔬 EO Browser (Çok Bantlı Analiz)'],
      [`https://worldview.earthdata.nasa.gov/?l=HLS_L30_Nadir_BRDF_Adjusted_Reflectance,Reference_Features&t=${tstr()}&z=8&v=${bbox}`,'🌍 NASA Worldview (HLS/MODIS)'],
      [`https://power.larc.nasa.gov/data-access-viewer/?lat=${lat}&lng=${lon}`,'⚡ NASA POWER (İklim & Enerji Verisi)'],
      [`https://land.copernicus.eu/global/products/ndvi`,'📊 Copernicus Global NDVI']
    ].map(([u,l])=>`<a href="${u}" target="_blank" class="wxlink">${l}</a>`).join('');
  }
};

window.satCtxStr = (field) => {
  const R=SATC[field?.id]?.data;
  if(!R) return 'Uydu verisi henüz alınmadı (🛰️ Uydu sekmesinden güncelleyin).';
  const surfPct = R.soilM3 ? (parseFloat(R.soilM3)*100).toFixed(0)+'%' : '—';
  const deepPct = R.soilMDeep ? (parseFloat(R.soilMDeep)*100).toFixed(0)+'%' : '—';
  return `NDVI:${R.ndvi}(${ndviCls(R.ndvi).l}) EVI:${R.evi} NDWI:${R.ndwi} LST:${R.lst}°C ET₀:${R.et0||'—'}mm Solar:${R.solar||'—'}MJ/m² YüzeyNem(3-9cm):${surfPct} DerinNem(9-27cm):${deepPct} VPD:${R.vpd||'—'}kPa NASA30gYağış:${R.nasaRain30||'—'}mm S2geçişMetadata:${R.s2count||0}(son:${R.s2date||'—'}) Kaynak:ModelTahmini`;
};

window.fetchAllSatellites = async () => {
  if(!DB.fields.length) return;
  const results = await Promise.allSettled(DB.fields.map(f => fetchSat(f)));
  const succeeded = results.filter(r=>r.status==='fulfilled').length;
  invSoilAll();
  await computeAllSoils(true);
  await renderAll();
  toast(`🛰️ ${succeeded} tarla için uydu verileri güncellendi.`, false);
};

window.fetchSoilTypeFromCoords = async (lat, lon) => {
  const textureMap = {1:'Sand',2:'Loamy Sand',3:'Sandy Loam',4:'Silt Loam',5:'Silt',6:'Loam',7:'Sandy Clay Loam',8:'Silty Clay Loam',9:'Clay Loam',10:'Sandy Clay',11:'Silty Clay',12:'Clay'};
  const soilMap = {'Clay':'killi','Silty Clay':'killi','Sandy Clay':'killi','Clay Loam':'killiTin','Silty Clay Loam':'killiTin','Sandy Clay Loam':'killiTin','Loam':'tinli','Silt Loam':'tinli','Silt':'tinli','Sandy Loam':'kumlu','Loamy Sand':'kumlu','Sand':'kumlu'};
  try {
    const txUrl=`https://rest.isric.org/soilgrids/v2.0/properties/query?lon=${lon}&lat=${lat}&property=texture_class&depth=0-5cm&value=mean`;
    const txRes=await fetch(txUrl);
    let soilType='tinli';
    if(txRes.ok){
      const txData=await txRes.json();
      const txCode=txData?.properties?.layers?.[0]?.depths?.[0]?.values?.mean;
      if(txCode!=null){ const txName=textureMap[Math.round(txCode)]||'Loam'; soilType=soilMap[txName]||'tinli'; }
    }
    const compUrl=`https://rest.isric.org/soilgrids/v2.0/properties/query?lon=${lon}&lat=${lat}&property=clay&property=sand&property=silt&depth=0-5cm&value=mean`;
    const compRes=await fetch(compUrl);
    if(compRes.ok){
      const compData=await compRes.json();
      const layers=compData?.properties?.layers||[];
      const getVal=name=>{ const layer=layers.find(l=>l.name===name); const raw=layer?.depths?.[0]?.values?.mean; return raw!=null?raw/10:null; };
      const clay=getVal('clay'), sand=getVal('sand'), silt=getVal('silt');
      if(clay!=null&&sand!=null&&silt!=null){
        window.tempSoilComposition={clay,sand,silt};
        if(clay>=40) soilType='killi';
        else if(clay>=25&&silt>=15) soilType='killiTin';
        else if(sand>=70) soilType='kumlu';
        else if(silt>=50) soilType='tinli';
        else soilType='tinli';
      }
    }
    return soilType;
  }catch(e){ console.warn('SoilGrids hatası:', e); return null; }
};

window.autoFillSoilFromCoords = async () => {
  const lat=parseFloat(qs('#f-lat')?.value), lon=parseFloat(qs('#f-lon')?.value);
  if(isNaN(lat)||isNaN(lon)) return;
  const soilSelect=qs('#f-soil'); if(!soilSelect) return;
  soilSelect.disabled=true; soilSelect.style.opacity='0.6';
  try {
    const soilType=await window.fetchSoilTypeFromCoords(lat,lon);
    if(soilType&&soilSelect.querySelector(`option[value="${soilType}"]`)){
      soilSelect.value=soilType;
      if(window.tempSoilComposition){ window.pendingSoilComp=window.tempSoilComposition; delete window.tempSoilComposition; }
      const badge=qs('#soil-auto-badge'); if(badge) badge.style.display='inline';
      window.toast(`🌱 Toprak tipi SoilGrids'den belirlendi: ${soilType}`, false);
    }
  }catch(e){ window.toast('Toprak tahmini sırasında hata.', true); }
  finally { soilSelect.disabled=false; soilSelect.style.opacity=''; }
};

window.updateAllSoilTypes = async () => {
  if(!DB.fields.length){ toast('Güncellenecek tarla yok.', true); return; }
  toast('Toprak tipleri güncelleniyor...', false);
  let updated=0, failed=0;
  for(const field of DB.fields){
    try{
      const newSoil=await window.fetchSoilTypeFromCoords(field.lat,field.lon);
      if(newSoil&&newSoil!==field.soilType){
        field.soilType=newSoil;
        if(window.tempSoilComposition){ field.soilComposition=window.tempSoilComposition; delete window.tempSoilComposition; }
        await saveFieldToDB(field); updated++; window.invSoil(field.id);
      }
    }catch(e){ console.warn(`${field.name} güncellenemedi:`, e); failed++; }
  }
  await window.renderAll();
  if(window.CUR) window.renderFieldPage(window.CUR);
  toast(`✅ ${updated} tarla güncellendi, ${failed} başarısız.`, failed>0);
};
