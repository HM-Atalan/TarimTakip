// ============================================================
// photos.js – Fotoğraf yönetimi ve analizi
// ============================================================

window.openPhotoM = () => { pendPh=null; window.pendingDrivePhoto=null; qs('#p-prev').innerHTML=''; qs('#p-ai').innerHTML=''; qs('#p-date').value=tstr(); qs('#p-note').value=''; if(qs('#p-size-info'))qs('#p-size-info').textContent='Yalnız seçtiğiniz fotoğrafa erişim izni istenir.'; qs('#m-photo').classList.add('on'); };

window.savePhoto = async () => {
  if(!window.pendingDrivePhoto){ toast('Google Drive’dan bir fotoğraf seçin',true); return; } if(!CUR) return;
  CUR.photos=CUR.photos||[];
  const aiText=qs('#p-ai')?.innerText||'';
  const photo={id:gid(),...window.pendingDrivePhoto,date:qs('#p-date').value||tstr(),type:qs('#p-type').value,note:qs('#p-note').value,ai:aiText.length>10?aiText:''};
  CUR.photos.push(photo);
  const fi=DB.fields.findIndex(f=>f.id===CUR.id); if(fi>=0) DB.fields[fi]=CUR;
  await saveFieldToDB(CUR);
  closeM('photo'); pendPh=null; window.pendingDrivePhoto=null; renderPhTab(CUR); toast('Drive fotoğrafı kaydedildi');
};

window.renderPhTab = (field) => {
  const grid=qs('#ph-grid'); if(!grid) return;
  if(!field.photos?.length){ grid.innerHTML='<div style="grid-column:1/-1;"><div class="empty">📷<br/>Fotoğraf yok</div></div>'; return; }
  grid.innerHTML=field.photos.map((p,idx)=>{
    return `
    <div style="aspect-ratio:1;border-radius:var(--r);overflow:hidden;background:var(--bg3);border:1px solid var(--bdr);position:relative;cursor:pointer;" onclick="openPhV(${idx})">
      <img data-drive-photo="${window.esc(p.driveFileId||'')}" src="icon.svg" alt="${window.esc(p.type||'Tarla fotoğrafı')}" loading="lazy" style="width:100%;height:100%;object-fit:cover;"/>
      <div class="ph-thumb-ov">
        <button class="btn btns" onclick="event.stopPropagation();openPhV(${idx})">🔍</button>
        <button class="btn btns btnd" onclick="event.stopPropagation();delPhoto(${idx})">🗑️</button>
      </div>
      <div style="position:absolute;bottom:0;left:0;right:0;background:rgba(0,0,0,.55);color:#fff;font-size:9px;padding:3px 5px;">${window.esc(fd(p.date))} · ${window.esc(p.type||'')}</div>
    </div>`;
  }).join('');
  grid.querySelectorAll('img[data-drive-photo]').forEach(async img=>{
    if(!img.dataset.drivePhoto) return;
    try{ const p=field.photos.find(photo=>photo.driveFileId===img.dataset.drivePhoto); if(window.DRIVE_STATE.token&&p) img.src=await window.getDrivePhotoData(p); }catch(e){ console.warn('Drive fotoğrafı okunamadı:',e.message); }
  });
};

window.openPhV = async (idx) => {
  if(!CUR?.photos?.[idx]) return;
  curPhIdx=idx; const p=CUR.photos[idx];
  try{ qs('#ph-viewer-img').src=await window.getDrivePhotoData(p); }
  catch(e){ toast('Fotoğraf için Google Drive bağlantısı gerekli: '+e.message,true); return; }
  qs('#ph-viewer-info').textContent=`${fd(p.date)} · ${p.type}${p.note?' · '+p.note:''}${p.ai&&p.ai.length>10?'\n🤖 '+p.ai.slice(0,150)+'...':''}`;
  qs('#ph-viewer').classList.add('on');
};

window.closePhViewer = () => { qs('#ph-viewer')?.classList.remove('on'); curPhIdx=null; };

window.editPhNote = () => {
  if(curPhIdx===null||!CUR?.photos?.[curPhIdx]) return;
  const p=CUR.photos[curPhIdx];
  const n=prompt('Notu düzenle:',p.note||''); if(n===null) return;
  p.note=n; saveFieldToDB(CUR);
  qs('#ph-viewer-info').textContent=`${fd(p.date)} · ${p.type}${p.note?' · '+p.note:''}`;
  renderPhTab(CUR); toast('Not güncellendi');
};

window.delCurPh = async () => {
  if(curPhIdx===null||!CUR?.photos) return;
  if(!confirm('Bu fotoğrafı silmek istediğinizden emin misiniz?')) return;
  CUR.photos.splice(curPhIdx,1);
  const fi=DB.fields.findIndex(f=>f.id===CUR.id); if(fi>=0) DB.fields[fi]=CUR;
  await saveFieldToDB(CUR); closePhViewer(); renderPhTab(CUR); toast('Silindi');
};

window.delPhoto = async (idx) => {
  if(!CUR?.photos||!confirm('Bu fotoğrafı silmek istediğinizden emin misiniz?')) return;
  CUR.photos.splice(idx,1);
  const fi=DB.fields.findIndex(f=>f.id===CUR.id); if(fi>=0) DB.fields[fi]=CUR;
  await saveFieldToDB(CUR); renderPhTab(CUR); toast('Silindi');
};

window.analyzePhoto = async () => {
  if(!pendPh){ toast('Fotoğraf seçin',true); return; }
  const el=qs('#p-ai');
  el.innerHTML='<div class="bubble bs">Görsel + tarla bağlamı analiz ediliyor...</div>';
  try{
    const b64=pendPh.split(',')[1]; const mime=pendPh.split(';')[0].split(':')[1]||'image/jpeg';
    const s= await CUR?calcSoil(CUR):null;
    const ph=CUR?calcPheno(CUR):null;
    const sat=SATC[CUR?.id]?.data;
    const wx=CUR?WXC[CUR.id]?.days||simWX(CUR.lat,CUR.lon):[];
    const todayWx=wx.find(d=>d.date===tstr());
    const photoDate=qs('#p-date')?.value||tstr();
    const parts=[
      {inline_data:{mime_type:mime,data:b64}},
      {text:`Bu tarla fotoğrafını (${photoDate}) şu bağlamla analiz et:
TARLA:${CUR?.name||'?'} | ÜRÜN:${CUR?.crop||'?'} | DÖNEM:${ph?.stage||'?'} (%${ph?.totPct||'?'} tamamlandı)
YÜZEY NEM:%${s?.surface?.pct||s?.pct||'?'} (${s?scl(s.surface?.pct||s.pct||50).l:'?'}) | DERİN NEM:%${s?.deep?.pct||'?'}
BUGÜN:${todayWx?todayWx.tmax+'°C, '+todayWx.rain+'mm yağış':'?'}
UYDU:${sat?'NDVI:'+sat.ndvi+' NDWI:'+sat.ndwi+' LST:'+sat.lst+'°C':'veri yok'}

Türkçe, uzman görüşü:
1. Bitki sağlığı ve gelişim uygunluğu (döneme göre)
2. Görsel hastalık/zararlı belirtileri (varsa)
3. Fenolojik dönem doğrulaması
4. Toprak/nem görünümü
5. Acil müdahale gerektiren durum (varsa)
6. Hasat olgunluğu değerlendirmesi`}
    ];
    const text=await window.callGemini([{role:'user',parts}],{maxOutputTokens:2000});
    el.innerHTML=`<div class="bubble bb" style="white-space:pre-line;margin-top:7px;">${window.safeAIHtml(text)}</div>`;
  }catch(e){ el.innerHTML=`<div style="color:var(--red);font-size:12px;margin-top:6px;">Hata: ${window.esc(e.message)}</div>`; }
};
