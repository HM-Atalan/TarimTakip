// ============================================================
// photos.js – Fotoğraf yönetimi ve analizi
// ============================================================

window.prevPhoto = async (e) => {
  const file=e.target.files[0]; if(!file) return;
  const si=qs('#p-size-info'); if(si) si.textContent='Sıkıştırılıyor...';
  pendPh=await compressImg(file,150,0.82);
  const kb=Math.round(pendPh.length*0.75/1024);
  qs('#p-prev').innerHTML=`<img src="${pendPh}" style="width:100%;max-height:140px;object-fit:cover;border-radius:var(--r);margin-top:6px;"/>`;
  if(si) si.textContent=`~${kb} KB (sıkıştırıldı)`;
  if(window.EXIF) {
    EXIF.getData(file, function() {
      const dateTime = EXIF.getTag(this, 'DateTimeOriginal');
      if(dateTime) {
        const parts = dateTime.split(' ')[0].split(':');
        if(parts.length === 3) {
          const exifDate = `${parts[0]}-${parts[1]}-${parts[2]}`;
          qs('#p-date').value = exifDate;
          toast(`Fotoğraf tarihi: ${exifDate}`, false);
        }
      }
    });
  }
};

window.openPhotoM = () => { pendPh=null; qs('#p-prev').innerHTML=''; qs('#p-ai').innerHTML=''; qs('#p-date').value=tstr(); qs('#p-note').value=''; if(qs('#p-size-info'))qs('#p-size-info').textContent=''; qs('#p-file').value=''; qs('#m-photo').classList.add('on'); };

window.savePhoto = async () => {
  if(!pendPh){ toast('Fotoğraf seçin',true); return; } if(!CUR) return;
  CUR.photos=CUR.photos||[];
  const aiText=qs('#p-ai')?.innerText||'';
  CUR.photos.push({id:gid(),date:qs('#p-date').value||tstr(),type:qs('#p-type').value,note:qs('#p-note').value,data:pendPh,ai:aiText.length>10?aiText:''});
  const fi=DB.fields.findIndex(f=>f.id===CUR.id); if(fi>=0) DB.fields[fi]=CUR;
  await saveFieldToDB(CUR);
  closeM('photo'); pendPh=null; renderPhTab(CUR); toast('Fotoğraf kaydedildi');
};

window.renderPhTab = (field) => {
  const grid=qs('#ph-grid'); if(!grid) return;
  if(!field.photos?.length){ grid.innerHTML='<div style="grid-column:1/-1;"><div class="empty">📷<br/>Fotoğraf yok</div></div>'; return; }
  grid.innerHTML=field.photos.map((p,idx)=>`
    <div style="aspect-ratio:1;border-radius:var(--r);overflow:hidden;background:var(--bg3);border:1px solid var(--bdr);position:relative;cursor:pointer;" onclick="openPhV(${idx})">
      <img src="${p.data}" alt="${p.type}" loading="lazy" style="width:100%;height:100%;object-fit:cover;"/>
      <div class="ph-thumb-ov">
        <button class="btn btns" onclick="event.stopPropagation();openPhV(${idx})">🔍</button>
        <button class="btn btns btnd" onclick="event.stopPropagation();delPhoto(${idx})">🗑️</button>
      </div>
      <div style="position:absolute;bottom:0;left:0;right:0;background:rgba(0,0,0,.55);color:#fff;font-size:9px;padding:3px 5px;">${fd(p.date)} · ${p.type}</div>
    </div>`).join('');
};

window.openPhV = (idx) => {
  if(!CUR?.photos?.[idx]) return;
  curPhIdx=idx; const p=CUR.photos[idx];
  qs('#ph-viewer-img').src=p.data;
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
    const apiKey = await window.getGeminiKey();
    if(!apiKey) throw new Error('API anahtarı alınamadı');
    const url=`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({contents:[{role:'user',parts}],generationConfig:{maxOutputTokens:2000}})});
    if(!r.ok){ const e=await r.json(); throw new Error(e.error?.message||r.status); }
    const d=await r.json();
    const text=d.candidates?.[0]?.content?.parts?.[0]?.text||'Analiz yapılamadı';
    el.innerHTML=`<div class="bubble bb" style="white-space:pre-line;margin-top:7px;">${text}</div>`;
  }catch(e){ el.innerHTML=`<div style="color:var(--red);font-size:12px;margin-top:6px;">Hata: ${e.message}</div>`; }
};