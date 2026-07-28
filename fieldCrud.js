// ============================================================
// fieldCrud.js – Tarla ekleme, düzenleme, silme, içe/dışa aktarma
// ============================================================

window.fillCrops = () => {
  const cat=qs('#f-cat').value; const list=CROPS[cat]||[];
  const sel=qs('#f-crop');
  sel.innerHTML=list.length?list.map(c=>`<option value="${c}">${c}</option>`).join(''):'<option>Kategori seçin</option>';
  const lbl=qs('#f-qty-lbl'); if(!lbl) return;
  if(['meyve','narenciye','zeytin'].includes(cat)) lbl.textContent='Ağaç / Bitki Adedi';
  else if(['tahil','baklagil','endustri','yembitki'].includes(cat)) lbl.textContent='Tohum Miktarı (kg/da)';
  else lbl.textContent='Miktar';
  const ageSection = qs('#f-age-section');
  if(ageSection) {
    const isPerennial = ['meyve','narenciye','zeytin'].includes(cat);
    ageSection.style.display = isPerennial ? 'block' : 'none';
  }
};

window.openFM = (editId) => {
  qs('#f-eid').value = editId || '';
  qs('#fm-title').textContent = editId ? 'Tarla Düzenle' : 'Yeni Tarla Ekle';
  const preview = qs('#f-import-preview');
  if(preview) preview.style.display = 'none';
  const soilBadge = qs('#soil-auto-badge');
  if(soilBadge) soilBadge.style.display = 'none';
  delete window.pendingSoilComp;

  if(editId) {
    const f = window.DB.fields.find(x => x.id === editId);
    if(!f) return;
    qs('#f-lat').value = f.lat || '';
    qs('#f-lon').value = f.lon || '';
    qs('#f-name').value = f.name || '';
    qs('#f-loc').value = f.location || '';
    qs('#f-area').value = f.area || '';
    qs('#f-aunit').value = f.areaUnit || 'dönüm';
    qs('#f-soil').value = f.soilType || 'killiTin';
    qs('#f-status').value = f.status || 'active';
    qs('#f-cat').value = f.category || '';
    fillCrops();
    if(f.crop) qs('#f-crop').value = f.crop;
    qs('#f-qty').value = f.qty || '';
    qs('#f-qunit').value = f.qunit || 'adet';
    qs('#f-color').value = f.color || '#40916c';
    qs('#f-plant').value = f.plantDate || '';
    qs('#f-harvest').value = f.harvestDate || '';
    qs('#f-notes').value = f.notes || '';
    if(qs('#f-irrigation')) qs('#f-irrigation').value = f.irrigation || '';
    if(qs('#f-fencing')) qs('#f-fencing').value = f.fencing || '';
    if(qs('#f-water-source')) qs('#f-water-source').value = f.waterSource || '';
    if(qs('#f-planting-age')) qs('#f-planting-age').value = f.plantingAge || '';
    if(qs('#f-polygon')) qs('#f-polygon').value = f.polygon ? JSON.stringify(f.polygon) : '';
  } else {
    ['f-lat','f-lon','f-name','f-loc','f-area','f-qty','f-notes','f-plant','f-harvest'].forEach(id => {
      const el = qs('#' + id); if(el) el.value = '';
    });
    if(qs('#f-irrigation')) qs('#f-irrigation').value = '';
    if(qs('#f-fencing')) qs('#f-fencing').value = '';
    if(qs('#f-water-source')) qs('#f-water-source').value = '';
    if(qs('#f-planting-age')) qs('#f-planting-age').value = '';
    if(qs('#f-polygon')) qs('#f-polygon').value = '';
    qs('#f-color').value = '#40916c';
    qs('#f-cat').value = '';
    qs('#f-aunit').value = 'dönüm';
    qs('#f-status').value = 'active';
    const file = qs('#f-file');
    if(file) file.value = '';
    fillCrops();
  }
  const latEl=qs('#f-lat'), lonEl=qs('#f-lon');
  const triggerSoilFetch = () => {
    const lt=parseFloat(latEl?.value), ln=parseFloat(lonEl?.value);
    if(!isNaN(lt)&&!isNaN(ln)&&lt!==0&&ln!==0) window.autoFillSoilFromCoords();
  };
  if(latEl && !latEl._soilBound){
    latEl._soilBound=true;
    latEl.addEventListener('change', triggerSoilFetch);
    lonEl.addEventListener('change', triggerSoilFetch);
  }
  qs('#m-field').classList.add('on');
};

window.saveField = async () => {
  const name=qs('#f-name').value.trim(); if(!name){ toast('Tarla adı zorunlu',true); return; }
  const eid=qs('#f-eid').value; const ex=eid?DB.fields.find(f=>f.id===eid):null;
  const lat=parseFloat(qs('#f-lat')?.value), lon=parseFloat(qs('#f-lon')?.value);
  if(!window.pendingSoilComp&&!isNaN(lat)&&!isNaN(lon)&&(!ex||ex.lat!==lat||ex.lon!==lon)) {
    try { await window.autoFillSoilFromCoords(); } catch(e) {}
  }
  
  let polygon = ex?.polygon || null;
  const polyInput = qs('#f-polygon')?.value?.trim();
  if(polyInput) {
    try { polygon = JSON.parse(polyInput); } catch(e) { polygon = null; }
  }
  
  const f={
    id:ex?ex.id:gid(), name,
    lat:parseFloat(qs('#f-lat').value)||36.8, lon:parseFloat(qs('#f-lon').value)||30.7,
    area:parseFloat(qs('#f-area').value)||0, areaUnit:qs('#f-aunit').value||'dönüm',
    location:qs('#f-loc').value,
    category:qs('#f-cat').value, crop:qs('#f-crop').value,
    qty:parseFloat(qs('#f-qty').value)||0, qunit:qs('#f-qunit').value,
    soilType:qs('#f-soil').value, plantDate:qs('#f-plant').value, harvestDate:qs('#f-harvest').value,
    color:qs('#f-color').value||'#40916c', notes:qs('#f-notes').value,
    status: qs('#f-status').value,
    irrigation: qs('#f-irrigation')?.value || '',
    fencing: qs('#f-fencing')?.value || '',
    waterSource: qs('#f-water-source')?.value || '',
    plantingAge: parseFloat(qs('#f-planting-age')?.value) || 0,
    polygon,
    events:ex?ex.events:[], photos:ex?ex.photos:[], aiRecs:ex?ex.aiRecs:[],
    soilComposition: window.pendingSoilComp || ex?.soilComposition || null
  };
  if(window.pendingSoilComp) delete window.pendingSoilComp;
  if(ex){ DB.fields[DB.fields.indexOf(ex)]=f; }else DB.fields.push(f);
  await saveFieldToDB(f);
  WXC[f.id]=null; invSoil(f.id);
  closeM('field'); await renderAll(); showField(f.id);
  toast(ex?'Tarla güncellendi':'Tarla eklendi');
  await window.computeAllSoils(true);
};

window.delField = async (id) => {
  if(!id||!confirm('Bu tarla ve tüm verileri silinecek. Emin misiniz?')) return;
  DB.fields=DB.fields.filter(f=>f.id!==id);
  await deleteFieldFromDB(id);
  delete WXC[id]; delete SATC[id]; invSoil(id);
  if(CUR?.id===id){ CUR=null; goPage('dash'); }
  await renderAll();
  await window.computeAllSoils(true);
};

window.importFF = async (e) => {
  const file=e.target.files[0]; if(!file) return;
  const name=file.name.toLowerCase();
  const reader=new FileReader();
  reader.onload=ev=>{
    let R={};
    if(name.endsWith('.kml')) R=parseKML(ev.target.result);
    else{ try{ R=parseGeoJSON(JSON.parse(ev.target.result)); }catch(err){ toast('Dosya hatası: '+err.message,true); return; } }
    if(R.lat) qs('#f-lat').value=R.lat.toFixed(5);
    if(R.lon) qs('#f-lon').value=R.lon.toFixed(5);
    if(R.name&&!qs('#f-name').value) qs('#f-name').value=R.name;
    if(R.area){ qs('#f-area').value=R.area.toFixed(4); if(R.areaUnit) qs('#f-aunit').value=R.areaUnit; }
    if(R.description) qs('#f-notes').value=(qs('#f-notes').value?qs('#f-notes').value+'\n':'')+R.description;
    if(R.location) qs('#f-loc').value=R.location;
    if(R.polygon && qs('#f-polygon')) qs('#f-polygon').value=JSON.stringify(R.polygon);
    const prev=qs('#f-import-preview');
    if(prev){ prev.style.display='block'; prev.innerHTML=`✅ <strong>Dosyadan:</strong> ${R.name||'İsimsiz'} · ${R.lat?.toFixed(4)}, ${R.lon?.toFixed(4)}${R.area?' · Alan: '+R.area.toFixed(1)+' '+(R.areaUnit||'m²'):''}${R.polygon?' · <span style="color:var(--green2);">'+R.polygon.length+' köşeli poligon</span>':''}`; }
    toast('Dosya verisi yüklendi ✓');
  };
  reader.readAsText(file);
};

window.parseGeoJSON = (d) => {
  const R={}; let geom=null, props={};
  if(d.type==='FeatureCollection'&&d.features?.length){ geom=d.features[0].geometry; props=d.features[0].properties||{}; }
  else if(d.type==='Feature'){ geom=d.geometry; props=d.properties||{}; }
  else if(['Point','Polygon','MultiPolygon'].includes(d.type)) geom=d;
  else if(d.lat&&d.lon){ R.lat=d.lat; R.lon=d.lon; }
  if(geom){
    if(geom.type==='Point'){ R.lon=geom.coordinates[0]; R.lat=geom.coordinates[1]; }
    else if(geom.type==='Polygon'){
      const ring=geom.coordinates[0];
      R.lat=ring.reduce((s,p)=>s+p[1],0)/ring.length;
      R.lon=ring.reduce((s,p)=>s+p[0],0)/ring.length;
      R.area=calcPolyArea(ring); R.areaUnit='m²';
      R.polygon=ring.map(p=>[p[1],p[0]]);
    }
    else if(geom.type==='MultiPolygon'){
      const ring=geom.coordinates[0][0];
      R.lat=ring.reduce((s,p)=>s+p[1],0)/ring.length;
      R.lon=ring.reduce((s,p)=>s+p[0],0)/ring.length;
      R.area=calcPolyArea(ring); R.areaUnit='m²';
      R.polygon=ring.map(p=>[p[1],p[0]]);
    }
  }
  R.name=props.name||props.Name||props.isim||props.ad||'';
  R.description=props.description||props.aciklama||props.note||'';
  R.location=props.location||props.konum||props.mahalle||'';
  if(props.area||props.alan) R.area=parseFloat(props.area||props.alan)||R.area;
  if(props.areaUnit||props.birim) R.areaUnit=props.areaUnit||props.birim||R.areaUnit;
  return R;
};

window.parseKML = (kmlText) => {
  const parser=new DOMParser(); const doc=parser.parseFromString(kmlText,'text/xml');
  const R={};
  const nameEl=doc.querySelector('Placemark > name, Document > name'); if(nameEl) R.name=nameEl.textContent.trim();
  const descEl=doc.querySelector('description'); if(descEl) R.description=descEl.textContent.replace(/<[^>]+>/g,'').trim().slice(0,200);
  const coordEl=doc.querySelector('coordinates');
  if(coordEl){
    const pairs=coordEl.textContent.trim().split(/\s+/).filter(Boolean).map(p=>p.split(',').map(Number));
    if(pairs.length===1){ R.lon=pairs[0][0]; R.lat=pairs[0][1]; }
    else if(pairs.length>1){
      R.lat=pairs.reduce((s,p)=>s+p[1],0)/pairs.length;
      R.lon=pairs.reduce((s,p)=>s+p[0],0)/pairs.length;
      R.area=calcPolyArea(pairs.map(p=>[p[0],p[1]])); R.areaUnit='m²';
      R.polygon=pairs.map(p=>[p[1],p[0]]);
    }
  }
  doc.querySelectorAll('SimpleData').forEach(sd=>{
    const n=(sd.getAttribute('name')||'').toLowerCase(); const v=sd.textContent.trim();
    if(n.includes('alan')||n.includes('area')) R.area=parseFloat(v)||R.area;
    if(n.includes('birim')||n.includes('unit')) R.areaUnit=v;
    if(n.includes('konum')||n.includes('location')) R.location=v;
  });
  return R;
};

window.calcPolyArea = (ring) => {
  if(!ring||ring.length<3) return 0;
  const Rm=6371000; let area=0;
  for(let i=0;i<ring.length-1;i++){
    const [lo1,la1]=ring[i]; const [lo2,la2]=ring[i+1];
    area+=(lo2-lo1)*Math.PI/180*(2+Math.sin(la1*Math.PI/180)+Math.sin(la2*Math.PI/180));
  }
  return Math.abs(area*Rm*Rm/2);
};

window.saveFieldToDB = async (field) => {
  const clean=JSON.parse(JSON.stringify(field));
  delete clean._soilCache;
  const uid=window.FB_USER?.uid;
  if(uid&&window.FB_MODE){ try{ await window.fbSaveField(uid,clean); }catch(e){ toast('DB kayıt hatası: '+e.message,true); } }
  saveLocalDB();
};

window.deleteFieldFromDB = async (fieldId) => {
  const uid=window.FB_USER?.uid;
  if(uid&&window.FB_MODE){ try{ await window.fbDeleteField(uid,fieldId); }catch(e){ toast('DB silme hatası: '+e.message,true); } }
  saveLocalDB();
};

window.syncFromDB = async () => {
  const uid = window.FB_USER?.uid;
  if(!uid || !window.FB_MODE) return;
  try {
    const fields = await window.fbLoadFields(uid);
    DB.fields = fields || [];
    saveLocalDB();
    invSoilAll();
    DB.fields.forEach(f => { if(!WXC[f.id]) fetchWX(f); });
    await renderAll();
    if(CUR) {
      const u = DB.fields.find(f=>f.id===CUR.id);
      if(u) { CUR=u; if(qs('#page-field.on')) renderFieldPage(CUR); }
      else { CUR=null; goPage('dash'); }
    }
    toast('Veriler güncellendi ✓');
    fetchAllSatellites().catch(e=>console.warn('Uydu çekim hatası:', e));
  } catch(e) { toast('Senkronizasyon hatası: '+e.message, true); }
  await window.computeAllSoils(true);
};

window.saveLocalDB = () => { try{ localStorage.setItem('tt_fields',JSON.stringify(DB.fields)); }catch(e){} };
window.loadLocalDB = () => { try{ const d=localStorage.getItem('tt_fields'); if(d) DB.fields=JSON.parse(d)||[]; }catch(e){} };

window.saveSettings = () => { DB.s.acuKey=qs('#acu-key')?.value||''; localStorage.setItem('tt_s',JSON.stringify(DB.s)); toast('Kaydedildi'); };
window.loadSettings = () => {
  try{ const s=localStorage.getItem('tt_s'); if(s){ const p=JSON.parse(s); DB.s={...DB.s,...p}; } }catch(e){}
  if(qs('#acu-key')) qs('#acu-key').value=DB.s.acuKey||'';
};

window.expData = () => { const a=document.createElement('a'); a.href='data:application/json;charset=utf-8,'+encodeURIComponent(JSON.stringify({fields:DB.fields},null,2)); a.download='tarim_'+tstr()+'.json'; a.click(); };
window.impData = (e) => { const f=e.target.files[0]; if(!f) return; const r=new FileReader(); r.onload=ev=>{ try{ const d=JSON.parse(ev.target.result); if(d.fields){ DB.fields=d.fields; saveLocalDB(); renderAll(); toast('İçe aktarıldı'); } }catch{ toast('Geçersiz JSON',true); } }; r.readAsText(f); };

window.exportToCSV = () => {
  if(!DB.fields.length){ toast('Aktarılacak veri yok', true); return; }
  const rows = [['Tarla','Tarih','Tür','Detay','Miktar','Birim','Birim Maliyet (₺)','Toplam Maliyet (₺)','Gelir (₺)','Notlar']];
  DB.fields.forEach(f => {
    (f.events||[]).forEach(e => {
      const extraStr = e.extra ? Object.entries(e.extra).filter(([k])=>['e-ft','e-pn','e-sm','e-ft2','e-fbrand'].includes(k)).map(([,v])=>v).join('; ') : '';
      rows.push([f.name,e.date,e.type,extraStr,e.qty||'',e.unit||'',e.cost||'',e.total||'',e.revenue||'',e.notes||'']);
    });
  });
  const csvContent = rows.map(row=>row.map(cell=>`"${String(cell).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob(["\uFEFF"+csvContent],{type:'text/csv;charset=utf-8;'});
  const link = document.createElement('a'); const url = URL.createObjectURL(blob);
  link.href=url; link.setAttribute('download',`tarim_raporu_${tstr()}.csv`);
  document.body.appendChild(link); link.click(); document.body.removeChild(link);
  URL.revokeObjectURL(url); toast('CSV dışa aktarıldı');
};

window.showField = async (id) => {
  CUR = DB.fields.find(f=>f.id===id);
  if(!CUR) return;
  aiHist = [];
  curTab = 'map';
  goPage('field');
  await renderSB();
  renderFieldPage(CUR);
  if(!WXC[CUR.id]) fetchWX(CUR);
  if(!SATC[CUR.id]||(Date.now()-SATC[CUR.id].at>3600000)) setTimeout(()=>fetchSat(CUR), 500);
  if(!WX_HISTORY[CUR.id]?.days?.length) {
    setTimeout(() => fetchWXHistory(CUR).catch(()=>{}), 1200);
  }
};

window.renderFieldPage = (field) => {
  CUR=field;
  qs('#fp-name').textContent=field.name;
  renderFKPIs(field);
  goTab('map');
};