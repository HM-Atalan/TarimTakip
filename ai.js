// ============================================================
// ai.js – Yapay zeka analizleri ve sohbet
// ============================================================

window.callGemini = async (contents, generationConfig = {}) => {
  const apiKey=await window.getGeminiKey();
  if(!apiKey) throw new Error('Gemini API anahtarı Remote Config üzerinden alınamadı.');
  const response=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`,{
    method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({contents,generationConfig})
  });
  if(!response.ok){ const body=await response.json().catch(()=>({})); throw new Error(body?.error?.message||`AI servisi: ${response.status}`); }
  const body=await response.json();
  const text=body?.candidates?.[0]?.content?.parts?.map(part=>part.text||'').join('').trim();
  if(!text) throw new Error('AI servisinden yanıt alınamadı.');
  return text;
};

window.getAIMemory = (fieldId) => {
  const key = 'tt_aimem_' + fieldId;
  try {
    const stored = localStorage.getItem(key);
    if(stored) {
      const parsed = JSON.parse(stored);
      const cutoff = new Date(); cutoff.setDate(cutoff.getDate()-30);
      const cutoffStr = cutoff.toISOString().slice(0,10);
      return parsed.filter(m => m.date >= cutoffStr);
    }
  } catch(e) {}
  return [];
};

window.saveAIMemory = (fieldId, messages) => {
  const key = 'tt_aimem_' + fieldId;
  try {
    const trimmed = messages.slice(-50);
    localStorage.setItem(key, JSON.stringify(trimmed));
  } catch(e) {}
};

window.buildFieldContext = async (field) => {
  const s = await calcSoil(field);
  const sc = scl(s.surface.pct);
  const wxDays = window.getBestWXDays(field);
  const today = tstr();
  const pastWx = wxDays.filter(d=>d.date<today).slice(-7)
    .map(d=>`${d.date.slice(5)}: ${d.tmax}°/${d.tmin}° yağış:${d.rain}mm ET₀:${d.et0||'—'}mm`).join('\n');
  const futWxArr = (WXC[field.id]?.days||simWX(field.lat,field.lon)).filter(d=>d.date>today).slice(0,7);
  const futWx = futWxArr.map(d=>`${d.date.slice(5)}: ${d.tmax}°/${d.tmin}° yağış:${d.rain}mm ET₀:${d.et0||'—'}mm`).join('\n');
  const futR = futWxArr.reduce((t,d)=>t+d.rain,0);
  const futET = futWxArr.reduce((t,d)=>t+(d.et0||s.et),0);
  const ph = calcPheno(field);
  const he = calcHarvest(field);
  const sh = calcSolar(field);
  const a = window.agrd(field.crop);
  const lastIrr = (field.events||[]).filter(e=>e.type==='sulama'&&!e.planned).sort((a,b)=>b.date.localeCompare(a.date))[0];
  const lastFert = (field.events||[]).filter(e=>e.type==='gübre'&&!e.planned).sort((a,b)=>b.date.localeCompare(a.date))[0];
  const lastSpray = (field.events||[]).filter(e=>e.type==='ilaç'&&!e.planned).sort((a,b)=>b.date.localeCompare(a.date))[0];
  const evLog = (field.events||[]).map(e=>{
    const ex=e.extra?Object.entries(e.extra).filter(([,v])=>v).map(([,v])=>v).join(', '):'';
    return`  ${e.date} | ${e.type}${ex?' ['+ex+']':''}${e.notes?' — '+e.notes:''} | ${e.qty?e.qty+(e.unit||''):''}${e.cost?' | '+e.cost+'₺':''} ${e.planned?'[PLANLI]':''}${e.revenue?` | Gelir: ${e.revenue}₺`:''}`;
  }).join('\n');
  const costMap={};let totalCost=0;
  (field.events||[]).filter(e=>e.cost>0).forEach(e=>{ const t=e.total||(e.cost*(e.qty||1)); costMap[e.type]=(costMap[e.type]||0)+t; totalCost+=t; });
  const costStr = Object.entries(costMap).map(([k,v])=>`${k}: ${Math.round(v)}₺`).join(' · ');
  const totalRevenue = (field.events||[]).reduce((s,e)=>s+(e.revenue||0),0);
  const historyLen = wxDays.filter(d=>d.date<=today).length;
  const drainLog = (s.log||[]).reduce((t,r)=>t+(r.percDeep||0),0);
  const pendingSurplus_s = s.surface.surplus ?? 0;
  const pendingSurplus_d = s.deep.surplus ?? 0;

  return `═══ TARLA BİLGİSİ ═══
Tarla: ${field.name} | Ürün: ${field.crop||'?'} (${field.category||''}) | Alan: ${field.area} ${field.areaUnit||'dönüm'} | Toprak: ${field.soilType}
Konum: ${field.location||''} (${field.lat.toFixed(4)}°N, ${field.lon.toFixed(4)}°E)
Ekim: ${field.plantDate||'girilmemiş'} | Hasat Plan: ${field.harvestDate||'girilmemiş'}
${field.plantingAge?'Dikim Yaşı: '+field.plantingAge+' yıl (çok yıllık)':''}
Sulama sistemi: ${field.irrigation||'belirtilmemiş'} | Su kaynağı: ${field.waterSource||'belirtilmemiş'} | Çit/Çevre: ${field.fencing||'belirtilmemiş'}
Not: ${field.notes||'—'}

═══ FENOLOJİ (${historyLen} günlük geçmiş verisi) ═══
${ph?`Dönem: ${ph.stage} — toplam %${ph.totPct} (${ph.days} gün, ${ph.gdd} GDD)\nGDD Güvenilirlik: ${historyLen>=60?'Yüksek (6 ay veri)':historyLen>=14?'Orta':' Düşük'}\nTüm dönemler: ${a.st.join(' → ')}\nGübre tavsiyesi: ${a.fert}`:'Ekim tarihi girilmemiş'}

═══ HASAT TAHMİNİ ═══
${he?`${he.already?'🟢 HASAT ZAMANI':he.daysLeft+' gün kaldı'} | ${fd(he.estDate)} | GDD: ${he.gddAcc}/${he.gddTarget} (%${he.gddPct}) | Güvenilirlik: ${he.conf}`:'Hesaplanamadı'}

═══ TOPRAK NEM — FAO-56 RZWB ═══
Model: FAO-56 Kök Bölgesi Su Dengesi — 90 günlük saf fiziksel simülasyon (hava verisi + sulama kayıtları). Uydu SADECE ilk kurulumda başlangıç seviyesini belirlemek için kullanılır, günlük düzeltme yapılmaz.
Başlangıç seviyesi: ${s.satCalibrated ? '📡 Uydu ile kalibre edildi (ilk kurulumda, tek seferlik)' : '⚠️ Model varsayımıyla tahmin edildi'}
Yüzey (0-10cm): %${s.surface.pct} | Nem=${s.surface.moist}mm | Dr=${s.surface.Dr?.toFixed(1)??'—'}mm | Ks=${s.surface.Ks?.toFixed(2)??'1.00'}
Derin (10-30cm): %${s.deep.pct} | Nem=${s.deep.moist}mm | Dr=${s.deep.Dr?.toFixed(1)??'—'}mm | Ks=${s.deep.Ks?.toFixed(2)??'1.00'}
Parametreler: FC=${s.params?.fcs??'—'}/${s.params?.fcd??'—'}mm · TAW=${s.params?.taw_s?.toFixed(0)??'—'}/${s.params?.taw_d?.toFixed(0)??'—'}mm · RAW=${s.params?.raw_s?.toFixed(0)??'—'}/${s.params?.raw_d?.toFixed(0)??'—'}mm · MAD=%${s.params?Math.round(s.params.mad*100):'—'}
Bugünkü Kc=${s.kc?.toFixed(3)??'—'} | ETc=${s.ETc??'—'}mm/g
Son 7g kök-altı drenaj (kök bölgesinin altına sızan/kaybolan su): ${drainLog.toFixed(1)}mm
${(pendingSurplus_s>0||pendingSurplus_d>0)?`Bekleyen fazla su (henüz süzülmemiş, gravite ile kademeli drene oluyor): Yüzey=${pendingSurplus_s.toFixed(1)}mm, Derin=${pendingSurplus_d.toFixed(1)}mm`:''}
Sulama durumu: ${(()=>{const irr=window.calcIrrigationNeed(field,s);return `${irr.label} | Açık=${irr.deficitMm}mm | Öneri=${irr.recommendedMm}mm | Kritik'e ${irr.daysUntilCritical}g`;})()}
7g net su dengesi: +${Math.round(futR)}mm yağış − ${Math.round(futET)}mm ET = ${Math.round(futR-futET)}mm
Son sulama: ${lastIrr?lastIrr.date+' ('+Math.round((Date.now()-new Date(lastIrr.date))/(864e5))+' gün önce)':'kayıt yok'}

═══ HAVA (SON 7 GÜN) ═══
${pastWx||'Veri yok'}

═══ HAVA (ÖNÜMÜZDEKİ 7 GÜN) ═══
${futWx||'Veri yok'}

═══ UYDU VERİLERİ ═══
${satCtxStr(field)}

═══ OLAY KAYITLARI ═══
${evLog||'Kayıt yok'}
Son gübre: ${lastFert?lastFert.date+' — '+(lastFert.extra?.['e-ft']||''):'yok'}
Son ilaç: ${lastSpray?lastSpray.date+' — '+(lastSpray.extra?.['e-pt']||lastSpray.extra?.['e-pn']||''):'yok'}

═══ MALİYET / KAR ═══
${costStr||'Kayıt yok'} | Toplam: ${Math.round(totalCost).toLocaleString()}₺ | Gelir: ${Math.round(totalRevenue).toLocaleString()}₺ | Kar: ${Math.round(totalRevenue-totalCost).toLocaleString()}₺`;
};

window.runAI = async () => {
  if(!CUR) return;
  if(!WXC[CUR.id]){ addB('sys','⏳ Hava verisi alınıyor...'); await fetchWX(CUR); }
  if(!SATC[CUR.id]||(Date.now()-SATC[CUR.id].at>3600000)){ addB('sys','🛰️ Uydu verisi alınıyor...'); await fetchSat(CUR); }
  goTab('ai');
  const chat=qs('#ai-chat'); if(chat) chat.innerHTML='';
  const photoCount=(CUR.photos||[]).filter(p=>p.localPhotoId||p.data).length;
  const memoryLen = window.getAIMemory(CUR.id).length;
  addB('sys',`🔬 Tüm veriler + uydu + ${photoCount} fotoğraf + ${memoryLen} önceki konuşma işleniyor...`);
  addB('load','');

  try{
    const fieldCtx = await window.buildFieldContext(CUR);
    const memory = window.getAIMemory(CUR.id);
    
    const photoDesc=(CUR.photos||[]).map((p,i)=>`  Fotoğraf ${i+1}: ${p.date} [${p.type}]${p.note?' — '+p.note:''}${p.ai&&p.ai.length>10?' | Önceki analiz: '+p.ai.slice(0,120):''}`).join('\n');

    const prompt=`SEN DENEYİMLİ BİR TÜRK TARIM DANIŞMANISIN.

${fieldCtx}

═══ TARLA FOTOĞRAFLARI (${(CUR.photos||[]).length} adet — görseller ekli) ═══
${photoDesc||'Fotoğraf yok'}

${memory.length > 0 ? `═══ ÖNCEKİ ANALİZ GEÇMİŞİ (SON ${Math.min(memory.length,5)} KONUŞMA) ═══
${memory.slice(-5).map(m=>`[${m.date}] ${m.role==='assistant'?'Danışman':'Sen'}: ${m.content.slice(0,200)}`).join('\n')}
` : ''}

═══════════════════════════════════════════════════════════
UZMANSAL YORUM TALEBİ:

Yukarıdaki tüm verileri, fotoğrafları${memory.length>0?' ve önceki konuşma geçmişini':''} birlikte değerlendirerek BİR UZMAN TARIMCI GİBİ BÜTÜNsel yorum yaz.

KURALLAR:
• Başlık başlık liste YOK — sadece akıcı paragraflar
• Çift katman toprak nemi analizini (yüzey + derin + kök altı drenaj) yoruma entegre et
• Hava + nem + uydu + fenoloji + geçmiş uygulamalar tek analize entegre
• ${memory.length>0?'Önceki analizlerle tutarlılık sağla, değişimleri vurgula':''}
• Somut tarih ve miktar belirterek aksiyon ver
• Türk tarım koşullarına özgü, teknik ama anlaşılır
• Maksimum 5-6 paragraf: durum → risk → eylem`;

    const parts=[{text:prompt}];
    for(const [i,p] of (CUR.photos||[]).entries()){
      const photoData=p.localPhotoId?await window.getLocalPhoto(p.localPhotoId):p.data;
      if(photoData&&photoData.startsWith('data:')){
        try{
          const b64=photoData.split(',')[1];
          const mime=photoData.split(';')[0].split(':')[1]||'image/jpeg';
          parts.push({inline_data:{mime_type:mime,data:b64}});
          parts.push({text:`[Fotoğraf ${i+1}: ${p.date}, tür:${p.type}${p.note?', not:'+p.note:''}]`});
        }catch(e){}
      }
    }
    
    const text=await window.callGemini([{role:'user',parts}],{temperature:0.62,maxOutputTokens:8192});

    rmLoad();
    const rendered=text
      .split('\n\n').filter(p=>p.trim())
      .map(p=>`<p style="margin-bottom:10px;">${window.safeAIHtml(p)}</p>`)
      .join('');
    const el=document.createElement('div');
    el.className='bubble bb'; el.style.lineHeight='1.78'; el.style.fontSize='13px';
    el.innerHTML=rendered;
    qs('#ai-chat')?.appendChild(el);
    qs('#ai-chat').scrollTop=qs('#ai-chat').scrollHeight;

    const today = tstr();
    const mem = window.getAIMemory(CUR.id);
    mem.push({role:'user', content:'[BÜTÜNSEL ANALİZ İSTEĞİ]', date:today});
    mem.push({role:'assistant', content:text, date:today});
    window.saveAIMemory(CUR.id, mem);
    aiHist = [...aiHist, {role:'user', content:'[Bütünsel Analiz]'}, {role:'assistant', content:text}];

    CUR.aiRecs=[{date:today,text}];
    const fi=DB.fields.findIndex(f=>f.id===CUR.id); if(fi>=0) DB.fields[fi]=CUR;
    await saveFieldToDB(CUR);
    renderRecTab(CUR);
    toast('✓ Bütünsel AI analizi tamamlandı');
  }catch(e){ rmLoad(); addB('bot','❌ '+e.message); }
};

window.sendChat = async () => {
  const inp=qs('#ai-inp'); const msg=inp.value.trim(); if(!msg) return;
  inp.value=''; addB('user',msg); addB('load','');
  
  aiHist.push({role:'user',content:msg});
  if(aiHist.length>20) aiHist=aiHist.slice(-20);
  
  const fieldCtx = CUR ? await window.buildFieldContext(CUR) : null;
  const memory = CUR ? window.getAIMemory(CUR.id) : [];
  
  const contents = [];
  
  if(fieldCtx) {
    contents.push({role:'user', parts:[{text:`[TARLA BAĞLAMI — GÜNCEL VERİLER]\n${fieldCtx}\n\nBu bağlamı dikkate alarak aşağıdaki soruları yanıtla. Kısa, pratik, Türkçe.`}]});
    contents.push({role:'model', parts:[{text:`Anladım. ${CUR?.name} tarlası için ${CUR?.crop||'ürün'} verilerini dikkate alıyorum. Sorunuzu alıyorum.`}]});
  }
  
  if(memory.length > 0) {
    const recentMem = memory.slice(-6);
    recentMem.forEach(m => {
      contents.push({role: m.role==='assistant'?'model':'user', parts:[{text:m.content}]});
    });
  }
  
  aiHist.slice(-10,-1).forEach(m => {
    contents.push({role:m.role==='assistant'?'model':'user', parts:[{text:m.content}]});
  });
  
  contents.push({role:'user', parts:[{text:msg}]});
  
  try{
    const text=await window.callGemini(contents,{temperature:0.72,maxOutputTokens:4096});
    rmLoad(); addB('bot',text);
    aiHist.push({role:'assistant',content:text});
    
    if(CUR) {
      const mem = window.getAIMemory(CUR.id);
      mem.push({role:'user', content:msg, date:tstr()});
      mem.push({role:'assistant', content:text, date:tstr()});
      window.saveAIMemory(CUR.id, mem);
    }
  }catch(e){ rmLoad(); addB('bot','❌ '+e.message); }
};

window.addB = (role, text) => {
  const chat=qs('#ai-chat'); if(!chat) return;
  if(role==='load'){
    const el=document.createElement('div'); el.id='ai-load'; el.className='bubble bb';
    el.innerHTML='<div style="display:inline-flex;gap:3px;"><span style="width:5px;height:5px;border-radius:50%;background:currentColor;opacity:.3;animation:dl 1.2s infinite;"></span><span style="width:5px;height:5px;border-radius:50%;background:currentColor;opacity:.3;animation:dl 1.2s .2s infinite;"></span><span style="width:5px;height:5px;border-radius:50%;background:currentColor;opacity:.3;animation:dl 1.2s .4s infinite;"></span></div>';
    chat.appendChild(el);
  }else{
    const el=document.createElement('div');
    el.className=`bubble ${role==='user'?'bu':role==='sys'?'bs':'bb'}`;
    el.style.whiteSpace='pre-line';
    el.textContent=(role==='user'?'Siz: ':'')+text;
    chat.appendChild(el);
  }
  chat.scrollTop=chat.scrollHeight;
};

window.rmLoad = () => { const el=qs('#ai-load'); if(el) el.remove(); };

window.clrChat = () => {
  const c=qs('#ai-chat'); if(c) c.innerHTML=''; aiHist=[];
  if(CUR) {
    const memLen = window.getAIMemory(CUR.id).length;
    if(memLen > 0) {
      addB('sys', `🧠 ${memLen} mesajlık konuşma hafızası aktif. Geçmiş analizler dikkate alınacak.`);
    }
  }
};

window.clearAIMemory = () => {
  if(!CUR) return;
  if(!confirm('Bu tarlaya ait tüm AI konuşma geçmişi silinecek. Emin misiniz?')) return;
  localStorage.removeItem('tt_aimem_' + CUR.id);
  aiHist = [];
  const c=qs('#ai-chat'); if(c) c.innerHTML='';
  toast('AI konuşma hafızası temizlendi');
};

window.aiPestAnalysis = async (fieldId) => {
  const field = DB.fields.find(f=>f.id===fieldId);
  if(!field) return;
  const el = qs('#rec-pest-ai');
  if(!el) return;
  el.innerHTML = '<div class="bubble bs">AI hastalık riski analiz ediliyor...</div>';
  try {
    const wx = WXC[field.id]?.days || simWX(field.lat, field.lon);
    const today = tstr();
    const futWx = wx.filter(d=>d.date>today).slice(0,7).map(d=>`${d.date.slice(5)}: ${d.tmax}°/${d.tmin}°C yağış:${d.rain}mm`).join(', ');
    const pastWx = wx.filter(d=>d.date<=today).slice(-5).map(d=>`${d.date.slice(5)}: ${d.tmax}°/${d.tmin}°C yağış:${d.rain}mm`).join(', ');
    const satStr = SATC[field.id]?.data ? satCtxStr(field) : 'Uydu verisi yok';
    const lastSpray = (field.events||[]).filter(e=>e.type==='ilaç'&&!e.planned).sort((a,b)=>b.date.localeCompare(a.date))[0];
    const ph = calcPheno(field);
    const pests = (PEST_DATA[field.crop]||PEST_DATA.default).join(', ');
    const s = await calcSoil(field);
    const prompt = `Sen bir Türk fitopatoloji ve entomoloji uzmanısın.
    
TARLA: ${field.name} | ÜRÜN: ${field.crop||'?'} | DÖNEM: ${ph?.stage||'bilinmiyor'} | Alan: ${field.area} ${field.areaUnit||'dönüm'}
TOPRAK: ${field.soilType} | Yüzey: %${s.surface.pct} (Dr=${s.surface.Dr?.toFixed(1)??'—'}mm, Ks=${s.surface.Ks?.toFixed(2)??'1.00'}) | Derin: %${s.deep.pct}
SON 5 GÜN: ${pastWx}
ÖNÜMÜZDEKİ 7 GÜN: ${futWx}
UYDU: ${satStr}
BİLİNEN ZARARLILAR: ${pests}
SON İLAÇLAMA: ${lastSpray?lastSpray.date+' ('+Math.round((Date.now()-new Date(lastSpray.date))/(864e5))+' gün önce)':'kayıt yok'}

Türkçe, kısa, uygulanabilir. Maksimum 4-5 madde.`;
    const text = await window.callGemini([{role:'user',parts:[{text:prompt}]}],{temperature:0.55,maxOutputTokens:1500});
    const rendered = window.safeAIHtml(text);
    el.innerHTML=`<div class="bubble bb" style="font-size:12px;line-height:1.6;margin-top:4px;">${rendered}</div>`;
  }catch(e){ el.innerHTML=`<div style="color:var(--red);font-size:12px;">AI Hata: ${window.esc(e.message)}</div>`; }
};
