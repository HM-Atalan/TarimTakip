window.DB = { fields: [], s: { acuKey: '' } };
window.SOIL_CACHE = { data: null, lastUpdated: 0 };
window.CUR = null;
// ═══════════════════════════════════════════════════════════════════
// TarlaTakip — Ana Script v2.0
// Yenilikler: Çift Katman Nem Modeli (0-10cm / 10-30cm),
//   Gelişmiş Raporlama, AI Sohbet Geçmişi, Poligon Harita,
//   Tarla Ekipman Ayarları, Çok Yıllık Bitki Desteği,
//   6 Aylık Hava Geçmişi Önbelleği, GDD Tutarlılık Güçlendirme
// ═══════════════════════════════════════════════════════════════════

const PEST_DATA = {
  'Buğday':['Sarı pas (Puccinia striiformis)','Kahverengi pas (P. triticina)','Septorya yaprak yanıklığı','Fusarium başak yanıklığı','Süne (Eurygaster integriceps)','Kımıl (Aelia sp.)'],
  'Arpa':['Sarı pas','Ağ leke hastalığı (Pyrenophora teres)','Çizgili mozaik virüsü','Süne','Yaprak biti'],
  'Mısır':['Mısır kurdu (Ostrinia nubilalis)','Yaprak biti','Mısır isi (Ustilago maydis)','Kuzey yaprak yanıklığı (Turcicum)','Bozkurt (Agrotis)'],
  'Domates':['Domates güvesi (Tuta absoluta)','Yaprak piresi (Bemisia tabaci)','Kırmızı örümcek (Tetranychus urticae)','Erken yaprak yanıklığı (Alternaria solani)','Geç yanıklık (Phytophthora infestans)','Gri küf (Botrytis cinerea)','Kök ur nematodu (Meloidogyne)'],
  'Biber (dolmalık)':['Yaprak biti (Myzus persicae)','Thrips (Frankliniella occidentalis)','Kırmızı örümcek','Çökerten (Phytophthora capsici)','Kül hastalığı (Leveillula taurica)','Mozaik virüsleri (CMV, PVY)'],
  'Biber (sivri)':['Yaprak biti','Thrips','Kırmızı örümcek','Çökerten hastalığı','Kül hastalığı'],
  'Biber (kapya)':['Yaprak biti','Thrips','Kırmızı örümcek','Gri küf','Kül hastalığı'],
  'Patlıcan':['Kırmızı örümcek','Yaprak biti','Beyaz sinek','Fusarium solgunluk','Gri küf (Botrytis)'],
  'Salatalık':['Kırmızı örümcek','Beyaz sinek','Thrips','Külleme (Sphaerotheca)','Mildiyö (Pseudoperonospora)','Gri küf'],
  'Patates':['Mildiyö (Phytophthora infestans)','Alternaria yaprak yanıklığı','Colorado böceği (Leptinotarsa)','Kök ur nematodu','Rizoctonia'],
  'Pamuk':['Pembe kurdela (Pectinophora gossypiella)','Beyaz sinek (Bemisia tabaci)','Yaprak biti','Kırmızı örümcek','Fusarium ve Verticillium solgunluk'],
  'Zeytin (Yağlık — Ayvalık)':['Zeytin sineği (Bactrocera oleae)','Zeytin güvesi (Prays oleae)','Antraknoz (Colletotrichum acutatum)','Halkalı leke (Spilocaea oleagina)'],
  'Elma':['Elma içkurdu (Cydia pomonella)','Ateş yanıklığı (Erwinia amylovora)','Karaleke (Venturia inaequalis)','Külleme (Podosphaera leucotricha)','Elma yaprak biti (Aphis pomi)'],
  'Portakal':['Akdeniz meyve sineği (Ceratitis capitata)','Turunçgil yaprak piresi (Aphis citricola)','Unlu bit (Planococcus citri)','Gri küf (Botrytis)','Turunçgil uyuzu'],
  'default':['Yaprak bitleri (Aphididae)','Kırmızı örümcek (Tetranychus urticae)','Beyaz sinek (Trialeurodes/Bemisia)','Kök ve kök boğazı çürüklükleri','Kül hastalığı (Erysiphe spp.)','Gri küf (Botrytis cinerea)']
};

const SOIL_FC = {killiTin:105, tinli:85, killi:120, kumlu:48, humuslu:95, kalkerli:68};
// Derin katman (10-30cm) için FC genellikle yüzeyden %10-15 daha yüksektir
const SOIL_FC_DEEP = {killiTin:118, tinli:95, killi:135, kumlu:52, humuslu:105, kalkerli:75};
const EVI = {ekim:'🌱',dikim:'🪴',sulama:'💧',gübre:'🧪',ilaç:'🔬',çapa:'⛏️',hasat:'🌾',budama:'✂️',toprak:'🚜',analiz:'📊',yakıt:'⛽',işçilik:'👷',diğer:'📝'};
const EVC = {ekim:'#d8f3dc',dikim:'#d8f3dc',sulama:'#d6eaf8',gübre:'#fef3cd',ilaç:'#e8daef',çapa:'#f0ebe0',hasat:'#d8f3dc',budama:'#fde8d8',toprak:'#eee',analiz:'#fadbd8',yakıt:'#fff3cd',işçilik:'#e8f4fd',diğer:'#f0f0f0'};

// ─── DURUM DEĞİŞKENLERİ ───────────────────────────────────────────
window.DB = {fields:[], s:{acuKey:''}};
window.CUR = null;
window.WXC = {};
window.SATC = {};
window.SC = {};
window.lmap = null;
window.aiHist = [];
// AI Konuşma Hafızası - tarla bazlı uzun dönem konuşma geçmişi
window.AI_MEMORY = {}; // {fieldId: [{role, content, date}]}
window.pendPh = null;
window.curTab = 'map';
window.curPhIdx = null;
window.LOCAL = false;
// 6 Aylık hava geçmişi önbelleği
window.WX_HISTORY = {}; // {fieldId: {days: [...], updatedAt: timestamp}}

// ─── YARDIMCI FONKSİYONLAR ───────────────────────────────────────
const qs = s => document.querySelector(s);
const gid = () => Date.now().toString(36) + Math.random().toString(36).slice(2,6);
window.tstr = () => new Date().toISOString().slice(0,10);
const fd = s => s ? new Date(s+'T12:00:00').toLocaleDateString('tr-TR',{day:'numeric',month:'short',year:'numeric'}) : '—';
window.toast = (msg, err=false) => {
  const t = qs('#toast'); if(!t) return;
  t.textContent = msg;
  t.style.borderLeftColor = err ? 'var(--red)' : 'var(--green2)';
  t.classList.add('on');
  setTimeout(() => t.classList.remove('on'), 2800);
}
window.togSB = () => { qs('#sb').classList.toggle('open'); }
window.clSBmob = () => { if(window.innerWidth<=768) qs('#sb')?.classList.remove('open'); }
window.togTheme = () => {
  const d = document.documentElement;
  d.toggleAttribute('dark');
  localStorage.setItem('tt_theme', d.hasAttribute('dark') ? 'dark' : 'light');
}

// ─── FOTOĞRAF SIKIŞTIRMA ──────────────────────────────────────────
window.compressImg = (file, maxKB=150, q=0.82) => {
  return new Promise(resolve => {
    const r = new FileReader();
    r.onload = ev => {
      const img = new Image();
      img.onload = () => {
        const MAX = 1200; let w = img.width, h = img.height;
        if(w>MAX||h>MAX){ if(w>h){h=Math.round(h*MAX/w);w=MAX;}else{w=Math.round(w*MAX/h);h=MAX;} }
        const c = document.createElement('canvas'); c.width=w; c.height=h;
        c.getContext('2d').drawImage(img,0,0,w,h);
        let qq = q, d = c.toDataURL('image/jpeg', qq);
        while(d.length > maxKB*1024*1.37 && qq>0.3){ qq-=0.06; d=c.toDataURL('image/jpeg',qq); }
        resolve(d);
      };
      img.src = ev.target.result;
    };
    r.readAsDataURL(file);
  });
}

// ═══════════════════════════════════════════════════════════════════
// 6 AYLIK HAVA GEÇMİŞİ SİSTEMİ
// ═══════════════════════════════════════════════════════════════════
window.fetchWXHistory = async (field) => {
  const id = field.id;
  const now = Date.now();
  // 6 saatte bir güncelle
  if(WX_HISTORY[id] && (now - WX_HISTORY[id].updatedAt < 21600000)) return WX_HISTORY[id].days;
  
  // LocalStorage'dan yükle
  const stored = loadWXHistoryLocal(id);
  if(stored && stored.length > 100) {
    WX_HISTORY[id] = { days: stored, updatedAt: now - 18000000 }; // 5 saat eski say, yenile
  }
  
  try {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 6);
    const ed = endDate.toISOString().slice(0,10);
    const sd = startDate.toISOString().slice(0,10);
    
    const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${field.lat}&longitude=${field.lon}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,et0_fao_evapotranspiration,shortwave_radiation_sum&start_date=${sd}&end_date=${ed}&timezone=Europe%2FIstanbul&cell_selection=land`;
    const r = await fetch(url);
    if(!r.ok) throw new Error('HTTP '+r.status);
    const d = await r.json();
    
    const days = (d.daily?.time || []).map((t,i) => ({
      date: t,
      tmax: Math.round(d.daily.temperature_2m_max[i] ?? 25),
      tmin: Math.round(d.daily.temperature_2m_min[i] ?? 12),
      rain: +(d.daily.precipitation_sum[i] || 0).toFixed(1),
      et0: +(d.daily.et0_fao_evapotranspiration?.[i] || 0).toFixed(1),
      solar: +(d.daily.shortwave_radiation_sum?.[i] || 0).toFixed(1)
    }));
    
    // Mevcut önbelleği güncelle/birleştir
    const existingDays = WX_HISTORY[id]?.days || [];
    const existingDates = new Set(existingDays.map(d=>d.date));
    const newDays = [...existingDays, ...days.filter(d=>!existingDates.has(d.date))];
    newDays.sort((a,b)=>a.date.localeCompare(b.date));
    
    // 6 aydan eskiyi temizle
    const cutoff = new Date(); cutoff.setMonth(cutoff.getMonth()-6);
    const cutoffStr = cutoff.toISOString().slice(0,10);
    const trimmed = newDays.filter(d=>d.date >= cutoffStr);
    
    WX_HISTORY[id] = { days: trimmed, updatedAt: now };
    saveWXHistoryLocal(id, trimmed);
    console.log(`📅 ${field.name}: ${trimmed.length} günlük hava geçmişi güncellendi`);
    return trimmed;
  } catch(e) {
    console.warn('WX History hatası:', e.message);
    return WX_HISTORY[id]?.days || [];
  }
};

window.saveWXHistoryLocal = (fieldId, days) => {
  try {
    // Sıkıştır: sadece gerekli alanlar
    const compact = days.map(d => [d.date, d.tmax, d.tmin, +(d.rain).toFixed(1), +(d.et0).toFixed(1)]);
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

// GDD hesabı için en iyi hava veri kaynağını seç
window.getBestWXDays = (field) => {
  const hist = WX_HISTORY[field.id]?.days || [];
  const curr = WXC[field.id]?.days || [];
  if(!hist.length && !curr.length) return simWX(field.lat, field.lon);
  
  // Birleştir: geçmiş + güncel (güncel daha doğru kabul edilir)
  const combined = {};
  hist.forEach(d => { combined[d.date] = d; });
  curr.forEach(d => { combined[d.date] = { ...combined[d.date], ...d }; }); // güncel üzerine yazar
  return Object.values(combined).sort((a,b)=>a.date.localeCompare(b.date));
};

// ═══════════════════════════════════════════════════════════════════
// FAO-56 KÖK BÖLGESİ SU DENGESİ (Root Zone Water Balance — RZWB)
// ═══════════════════════════════════════════════════════════════════
// Referans: Allen et al. (1998) FAO Irrigation and Drainage Paper 56
//
// Temel kavramlar:
//   FC   = Field Capacity        (Tarla Kapasitesi, mm — üst limit)
//   WP   = Wilting Point         (Solma Noktası, mm — alt limit)
//   TAW  = Total Available Water = FC - WP  (Toplam Kullanılabilir Su)
//   RAW  = Readily Available Water = MAD × TAW  (Kolayca Alınabilir Su)
//   Dr   = Root Zone Depletion   (Güncel açık, mm) — 0→kuru, TAW→FC
//   Ks   = Stress coefficient    Dr≤RAW→Ks=1, Dr>RAW→Ks azalır (stres)
//   ETc  = ET₀ × Kc × Ks        (Gerçek bitki su tüketimi)
//
// Mimari:
//   • Firebase'de users/{uid}/rzwb/{fieldId} altında "ledger" (defter) tutulur:
//     {date, Dr_surf, Dr_deep, Kc, Ks_surf, Ks_deep, ETc, rain, irr, perc, ...}
//   • Her çağrıda: (a) son ledger kaydından başla, (b) eksik günleri simüle et,
//     (c) bugünkü Dr değerini üret, (d) yeni kayıtları Firebase'e yaz.
//   • Uydu kalibrasyonu (Open-Meteo Agro soilM3/soilMDeep) mevcutsa, ledger
//     başlangıcında Dr değerleri uyduya kilitlenir.
//
// İki zon:
//   Zone-S: 0-10cm yüzey  (sulama+yağış giriş noktası, hızlı değişir)
//   Zone-D: 10-30cm derin (perkolasyon beslenmeli, yavaş değişir)
// ═══════════════════════════════════════════════════════════════════

window.agrd = (crop) => { return CROP_AGR[crop] || CROP_AGR.default; };

// ─── RZWB PARAMETRELERİ ──────────────────────────────────────────
// Toprak tipi → [FC_surf(mm/10cm), WP_surf(mm/10cm)] tablosu
// Derin katman 20cm kalınlık (FC_deep = 2 × değer)
const RZWB_SOIL = {
  //            FC_surf  WP_surf  FC_deep  WP_deep
  killiTin: { fcs:105, wps:42, fcd:115, wpd:46 },
  tinli:    { fcs: 85, wps:32, fcd: 95, wpd:36 },
  killi:    { fcs:120, wps:52, fcd:130, wpd:57 },
  kumlu:    { fcs: 48, wps:12, fcd: 52, wpd:13 },
  humuslu:  { fcs: 95, wps:38, fcd:105, wpd:42 },
  kalkerli: { fcs: 68, wps:22, fcd: 75, wpd:24 },
};

// MAD (Management Allowable Depletion) — ürün grubuna göre sulama tetik eşiği
const MAD_TABLE = {
  sera:0.35, sebze:0.40, bostanlik:0.45, baklagil:0.50,
  narenciye:0.50, meyve:0.50, endustri:0.55, yembitki:0.55,
  tahil:0.55, zeytin:0.65,
};

// ─── RZWB YARDIMCI ───────────────────────────────────────────────
window.getRZWBParams = (field) => {
  const soil = RZWB_SOIL[field.soilType] || RZWB_SOIL.tinli;
  let fcs = soil.fcs, wps = soil.wps, fcd = soil.fcd*2, wpd = soil.wpd*2;

  // SoilGrids kil/kum/silt yüzdeleri varsa FC ve WP'yi ince ayarla (Saxton & Rawls 2006)
  if(field.soilComposition) {
    const { clay: cl, sand: sa, silt: si } = field.soilComposition;
    const fc_calc  = (0.299 - 0.251*sa/100 + 0.195*cl/100) * 100; // mm/10cm
    const wp_calc  = (0.026 + 0.5*cl/100 - 0.013*sa/100) * 100;
    if(fc_calc>20 && fc_calc<180){ fcs=Math.round(fc_calc); fcd=Math.round(fc_calc*1.1)*2; }
    if(wp_calc>5  && wp_calc<80) { wps=Math.round(wp_calc); wpd=Math.round(wp_calc*1.1)*2; }
  }

  const mad  = MAD_TABLE[field.category] ?? 0.50;
  const taw_s = Math.max(1, fcs - wps);  // Total Available Water, yüzey
  const taw_d = Math.max(1, fcd - wpd);  // Total Available Water, derin
  const raw_s = taw_s * mad;             // Readily Available Water, yüzey
  const raw_d = taw_d * mad;             // Readily Available Water, derin

  return { fcs, wps, fcd, wpd, taw_s, taw_d, raw_s, raw_d, mad };
};

// Sulama olayını net mm'ye çevir (farklı birimlerden)
window.parseIrrMm = (evt, fcs) => {
  const qty = parseFloat(evt.qty)||0, u = evt.unit||'';
  let mm = 25; // varsayılan
  if(u === 'mm' && qty > 0) mm = qty;
  else if(u === 'lt' && qty > 0) mm = qty / 100;       // lt/m² → mm
  else if(u === 'toplam' && qty > 100) mm = qty / 100;  // hacim → mm/m²
  else if(u === 'saat') {
    // Sulama süresi × sistem debisi tahmini
    const debit = evt.extra?.['e-sm'] === 'Damla sulama' ? 2.0
      : evt.extra?.['e-sm'] === 'Yağmurlama' ? 5.0 : 3.0; // mm/saat
    mm = qty * debit;
  }
  return Math.min(mm, fcs * 1.2); // FC'nin %120'sinden fazla olamaz
};

// ─── FIREBASE RZWB LEDGER ────────────────────────────────────────
window.fbSaveRZWB = async (uid, fieldId, records) => {
  if(!uid || !window.FB_MODE || !window.FB_DB) return;
  try {
    const { doc, setDoc } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
    const ref = doc(window.FB_DB, 'users', uid, 'rzwb', fieldId);
    await setDoc(ref, { records, updatedAt: new Date().toISOString() });
  } catch(e) { console.warn('RZWB Firebase kayıt hatası:', e.message); }
};

window.fbLoadRZWB = async (uid, fieldId) => {
  if(!uid || !window.FB_MODE || !window.FB_DB) return null;
  try {
    const { doc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
    const ref = doc(window.FB_DB, 'users', uid, 'rzwb', fieldId);
    const snap = await getDoc(ref);
    return snap.exists() ? snap.data() : null;
  } catch(e) { console.warn('RZWB Firebase yükleme hatası:', e.message); return null; }
};

// In-memory RZWB cache: { fieldId: { records:[...], loadedAt:ts } }
window.RZWB_CACHE = {};

// ─── FAO-56 GÜNLÜK ADIM ──────────────────────────────────────────
// Bir günün Dr (tükeniş) değerini önceki günden ilerletir.
// Dönüş: { Dr_s, Dr_d, Kc, Ks_s, Ks_d, ETc_s, ETc_d, perc, netIn }
window.rzwbStep = (prev, dayWx, irrMm, params, field) => {
  const { fcs, wps, fcd, wpd, taw_s, taw_d, raw_s, raw_d } = params;
  const a = window.agrd(field.crop);

  // Kc hesabı (fenolojiye bağlı)
  let kc = 0.7;
  if(field.status !== 'fallow' && field.plantDate && field.plantDate <= dayWx.date) {
    const gdd = window.calcGDD(field, dayWx.date);
    if(gdd !== null) {
      const gddTarget = a.gd[a.gd.length-1];
      const ratio = Math.min(1, gdd / gddTarget);
      if(a.kc?.length === 4) {
        if(ratio < 0.1)      kc = a.kc[0];
        else if(ratio < 0.5) kc = a.kc[0] + (a.kc[1]-a.kc[0])*(ratio/0.5);
        else if(ratio < 0.8) kc = a.kc[1] + (a.kc[2]-a.kc[1])*((ratio-0.5)/0.3);
        else                 kc = a.kc[2] + (a.kc[3]-a.kc[2])*Math.min(1,(ratio-0.8)/0.2);
      }
    }
  }

  // FAO-56 Ks (Water stress coefficient) — Dr > RAW olunca devreye girer
  const ks_s = prev.Dr_s <= raw_s ? 1.0
    : Math.max(0.0, (taw_s - prev.Dr_s) / Math.max(1, taw_s - raw_s));
  const ks_d = prev.Dr_d <= raw_d ? 1.0
    : Math.max(0.0, (taw_d - prev.Dr_d) / Math.max(1, taw_d - raw_d));

  const et0 = dayWx.et0 || a.et * (dayWx.tmax>38?1.45:dayWx.tmax>33?1.2:1.0);

  // ETc = ET₀ × Kc × Ks, katman paylaşımı: yüzey %35, derin %65
  const etcTotal = et0 * kc;
  const surfRatio = field.status === 'fallow' ? 0.90 : 0.35;
  const ETc_s = etcTotal * surfRatio * (field.status==='fallow' ? ks_s*0.25 : ks_s);
  const ETc_d = etcTotal * (1-surfRatio) * (field.status==='fallow' ? 0.05 : ks_d);

  // Yağış etkinliği (%70-100 arasında, şiddetli yağışta sızma kaybı daha fazla)
  const rain = dayWx.rain || 0;
  const eff  = rain>30 ? 0.70 : rain>15 ? 0.82 : rain>5 ? 0.92 : 1.0;
  const Pe   = rain * eff;                  // Effective precipitation

  // Net giriş yüzeye: sulama + etkili yağış
  const netIn = Pe + irrMm;

  // Yüzey Dr güncellemesi (Dr azalınca nem artar — FC'de Dr=0)
  let Dr_s = prev.Dr_s - netIn + ETc_s;
  Dr_s = Math.max(0, Math.min(taw_s, Dr_s));

  // Perkolasyon: yüzeyde Dr<0 (FC aşımı) olursa derin katmana sızar
  const perc = Math.max(0, -1 * (prev.Dr_s - netIn + ETc_s));

  // Derin Dr güncellemesi
  let Dr_d = prev.Dr_d - perc + ETc_d;
  Dr_d = Math.max(0, Math.min(taw_d, Dr_d));

  // Yüzey ve derin nem % (Dr=0 → FC=%100, Dr=TAW → WP=%0)
  const pct_s = Math.round((1 - Dr_s/taw_s) * 100);
  const pct_d = Math.round((1 - Dr_d/taw_d) * 100);
  const moist_s = Math.round(fcs - Dr_s);
  const moist_d = Math.round(fcd - Dr_d);

  return {
    Dr_s:+Dr_s.toFixed(1), Dr_d:+Dr_d.toFixed(1),
    kc:+kc.toFixed(3),
    Ks_s:+ks_s.toFixed(3), Ks_d:+ks_d.toFixed(3),
    ETc_s:+ETc_s.toFixed(1), ETc_d:+ETc_d.toFixed(1),
    et0:+et0.toFixed(1), rain:+rain.toFixed(1),
    Pe:+Pe.toFixed(1), irr:+irrMm.toFixed(1),
    perc:+perc.toFixed(1), netIn:+netIn.toFixed(1),
    pct_s, pct_d, moist_s, moist_d,
  };
};

// ─── ANA RZWB FONKSİYONU (calcSoil'in yerini alır) ──────────────
window.calcSoilRZWB = async (field, force = false) => {
  const params = window.getRZWBParams(field);
  const { fcs, wps, fcd, wpd, taw_s, taw_d, raw_s, raw_d } = params;
  const today = tstr();
  const uid = window.FB_USER?.uid;

  // 1. Adım: Ledger (Geçmiş kayıtlar) yüklemesi
  let ledger = null;
  if (uid && window.FB_DB) {
    try {
      const q = window.query(
        window.collection(window.FB_DB, `users/${uid}/fields/${field.id}/ledger`),
        window.where("date", "<=", today)
      );
      const snap = await window.getDocs(q);
      ledger = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (e) {
      console.warn("Ledger çekilemedi, local fallback:", e);
    }
  }
  if (!ledger) {
    const loc = localStorage.getItem(`tt_led_${field.id}`);
    ledger = loc ? JSON.parse(loc) : [];
  }

  // 2. Adım: Başlangıç parametrelerinin ve tarihin tespiti (Zaman Makinesi)
  let initDr_s = taw_s * 0.45;
  let initDr_d = taw_d * 0.40;
  let satCalibrated = false;
  let initDate = null;

  const agroMid = Number(field.agroMid) || 0;
  const agroDeep = Number(field.agroDeep) || 0;
  const satDate = field.satDate ? Number(field.satDate) : 0;

  // 🌍 GLOBAL DÜZELTME: Kayıtlar varsa en eski tarihe dönüp kronolojik simülasyon başlatıyoruz
  if (ledger && ledger.length > 0) {
    ledger.sort((a, b) => a.date.localeCompare(b.date));
    initDate = ledger[0].date;
    initDr_s = Math.max(0, Math.min(taw_s, ledger[0].Dr_s ?? (taw_s * 0.45)));
    initDr_d = Math.max(0, Math.min(taw_d, ledger[0].Dr_d ?? (taw_d * 0.40)));
    console.log(`📖 RZWB Küresel Başlangıç (En Eski Kayıt: ${initDate}) -> Dr_s=${initDr_s.toFixed(1)}, Dr_d=${initDr_d.toFixed(1)}`);
  } else if (agroMid > 0.01 && satDate && (Date.now() - satDate) < 43200000) {
    const sat_moist_s = Math.min(fcs, agroMid * fcs * 1.15);
    const sat_moist_d = Math.min(fcd, (agroDeep || agroMid * 0.88) * fcd);
    initDr_s = Math.max(0, Math.min(taw_s, fcs - sat_moist_s));
    initDr_d = Math.max(0, Math.min(taw_d, fcd - sat_moist_d));
    initDate = today;
    satCalibrated = true;
    console.log(`🛰️ RZWB Uydu Kalibrasyonu ile Başlangıç: Dr_s=${initDr_s.toFixed(1)} Dr_d=${initDr_d.toFixed(1)}`);
  } else {
    initDate = null;
    console.log(`⚠️ RZWB Varsayılan Başlangıç: Dr_s=${initDr_s.toFixed(1)} Dr_d=${initDr_d.toFixed(1)}`);
  }

  const simStart = initDate || window.g7d();
  const wxAll = window.getBestWXDays ? window.getBestWXDays(field) : [];

  if (!wxAll || wxAll.length === 0) {
    console.warn(`⚠️ ${field.name} için hava geçmişi hazır değil, güvenli varsayılan değerler dönülüyor.`);
    return {
      surface: { pct: 55, moist: Math.round(fcs * 0.55 * 100) / 100, fc: fcs, Dr: taw_s * 0.45, taw: taw_s, raw: raw_s, Ks: 1 },
      deep: { pct: 50, moist: Math.round(fcd * 0.50 * 100) / 100, fc: fcd, Dr: taw_d * 0.40, taw: taw_d, raw: raw_d, Ks: 1 },
      et: 4.0, kc: 0.65, Ks: 1, ETc: 0, log: [], params, satCalibrated: false, pct: 53
    };
  }

  // Simülasyon gün listesinin filtrelenmesi
  const simDays = wxAll.filter(d => d.date >= simStart && d.date <= today && d.date >= (field.plantDate || '1970-01-01'));
  simDays.sort((a, b) => a.date.localeCompare(b.date));

  let prev = { Dr_s: initDr_s, Dr_d: initDr_d, date: initDate || today };
  const newRecords = [];
  
  // Fonksiyonun en altında da erişilebilmesi için global/scope seviyesinde dinamik kc tanımı
  let lastEvaluatedKc = 0.70; 

  // 3. Adım: Küresel Çift Katman Taşmalı Hidrolojik Motor Döngüsü
  for (const day of simDays) {
    const ET0 = day.et0 || 0;
    const rain = day.rain || 0;

    const userLedger = ledger ? ledger.find(l => l.date === day.date) : null;
    const irr = userLedger ? (Number(userLedger.irrigation) || 0) : 0;

    // 🌍 KÜRESEL KC ÇÖZÜMÜ: app.js içindeki mevcut fenoloji/mahsul fonksiyonundan o günün kc'sini dinamik çekiyoruz
    const currentPheno = window.calcPheno ? window.calcPheno(field, day.date) : null;
    const currentKc = (currentPheno && currentPheno.kc !== undefined) ? currentPheno.kc : (field.kc || 0.70);
    lastEvaluatedKc = currentKc; // En güncel kc değerini dışarıya taşımak için saklıyoruz

    // Yüzey Katmanı (0-10cm) Net Su Girişi
    let pot_Dr_s = prev.Dr_s - rain - irr;
    let deep_percolation = 0;

    if (pot_Dr_s < 0) {
      // 🌊 SÜZÜLME/TAŞMA MANTIĞI: Üst katmanın ememediği fazlalık su derin katmana akıyor (Stok Koruma)
      deep_percolation = Math.abs(pot_Dr_s);
      prev.Dr_s = 0;
    } else {
      prev.Dr_s = Math.min(taw_s, pot_Dr_s);
    }

    // Derin Katman (10-30cm) Hesaplaması
    let pot_Dr_d = prev.Dr_d - deep_percolation;
    if (pot_Dr_d < 0) {
      // Derin katman da doyduysa su tarladan drene olur
      prev.Dr_d = 0;
    } else {
      prev.Dr_d = Math.min(taw_d, pot_Dr_d);
    }

    // Günlük ETc Tüketim Hesaplamaları
    const Ks_s = prev.Dr_s < raw_s ? 1 : Math.max(0, (taw_s - prev.Dr_s) / ((taw_s - raw_s) || 1));
    const ETc_s = ET0 * currentKc * 0.6 * Ks_s;
    prev.Dr_s = Math.min(taw_s, prev.Dr_s + ETc_s);

    const Ks_d = prev.Dr_d < raw_d ? 1 : Math.max(0, (taw_d - prev.Dr_d) / ((taw_d - raw_d) || 1));
    const ETc_d = ET0 * currentKc * 0.4 * Ks_d;
    prev.Dr_d = Math.min(taw_d, prev.Dr_d + ETc_d);

    newRecords.push({
      date: day.date,
      Dr_s: Math.round(prev.Dr_s * 10) / 10,
      Dr_d: Math.round(prev.Dr_d * 10) / 10,
      pct_s: Math.round((1 - prev.Dr_s / (taw_s || 1)) * 100),
      pct_d: Math.round((1 - prev.Dr_d / (taw_d || 1)) * 100),
      et0: ET0,
      rain,
      irrigation: irr
    });
  }

  // 4. Adım: Nihai yüzde hesaplamaları ve global return nesnesi
  const final_pct_s = Math.max(0, Math.min(100, Math.round((1 - prev.Dr_s / (taw_s || 1)) * 100)));
  const final_pct_d = Math.max(0, Math.min(100, Math.round((1 - prev.Dr_d / (taw_d || 1)) * 100)));

  const result = {
    surface: {
      pct: final_pct_s,
      moist: Math.round(fcs * (final_pct_s / 100) * 100) / 100,
      fc: fcs, Dr: prev.Dr_s, taw: taw_s, raw: raw_s, Ks: 1
    },
    deep: {
      pct: final_pct_d,
      moist: Math.round(fcd * (final_pct_d / 100) * 100) / 100,
      fc: fcd, Dr: prev.Dr_d, taw: taw_d, raw: raw_d, Ks: 1
    },
    et: window.agrd && window.agrd(field.crop) ? window.agrd(field.crop).et : 4.0,
    kc: lastEvaluatedKc, // 🌍 Döngüden sızdırılan dinamik ve güncel mahsul katsayısı
    Ks: 1,
    ETc: 0,
    log: newRecords,
    params,
    satCalibrated,
    pct: Math.round((final_pct_s + final_pct_d) / 2)
  };

  return result;
};

// Eski calcSoil çağrılarını RZWB'ye yönlendir (geriye dönük uyumluluk)
window.calcSoil = (field) => window.calcSoilRZWB(field);

window.computeAllSoils = async (force = false) => {
  const now = Date.now();
  if (!force && window.SOIL_CACHE.data && (now - window.SOIL_CACHE.lastUpdated < 300000)) {
    return window.SOIL_CACHE.data;
  }

  // Tarlalar dönülürken her birinin hava geçmişini önceden parallel olarak tetikleyelim
  await Promise.all(DB.fields.map(f => window.fetchWXHistory(f)));
  
  const soilData = await Promise.all(DB.fields.map(async f => {
    invSoil(f.id);
    const s = await calcSoil(f);
    const sc = scl(s.surface.pct);
    const ph = calcPheno(f);
    const he = calcHarvest(f);
    return { f, s, sc, ph, he };
  }));
  window.SOIL_CACHE = { data: soilData, lastUpdated: Date.now() };
  return soilData;
};

window.calcGDD = (field, untilDate = tstr()) => {
  const a = window.agrd(field.crop);
  if(!field.plantDate) return null;
  
  // Çok yıllık bitkilerde dikim yaşını dikkate al
  const plantDateEffective = field.plantDate;
  
  // Önce 6 aylık geçmiş, sonra mevcut önbellek
  const wxDays = window.getBestWXDays(field);
  
  let acc = 0;
  wxDays.filter(d => d.date >= plantDateEffective && d.date <= untilDate).forEach(d => {
    const tavg = (d.tmax + d.tmin) / 2;
    const tavgClamped = Math.min(tavg, a.tm); // Kritik sıcaklık üstünü kapat
    acc += Math.max(0, tavgClamped - a.tb);
  });
  return Math.round(acc);
};

// Tarla kapasitesi hesabı - katmana göre
window.calcFieldCapacity = (soilType, cl, sa, si, layer='surface') => {
  // Geriye dönük uyumluluk — yeni kod getRZWBParams kullanır
  const p = window.getRZWBParams({ soilType, soilComposition: cl!=null?{clay:cl,sand:sa,silt:si}:null });
  return layer === 'deep' ? p.fcd : p.fcs;
};

window.invSoil = (fid) => { Object.keys(SC).filter(k=>k.startsWith(fid+'_')).forEach(k=>delete SC[k]); };
window.invSoilAll = () => { Object.keys(SC).forEach(k=>delete SC[k]); };


window.scl = (pct) => {
  if(pct>78) return {l:'Islak',  tag:'tb', color:'var(--blue)',   bg:'var(--bbg)'};
  if(pct>58) return {l:'Nemli',  tag:'tg', color:'var(--green2)', bg:'var(--glt)'};
  if(pct>38) return {l:'Yeterli',tag:'tgr',color:'var(--text2)',  bg:'var(--bg3)'};
  if(pct>20) return {l:'Kuru',   tag:'ta', color:'var(--amber)',  bg:'var(--abg)'};
  return            {l:'Kurak',  tag:'tr', color:'var(--red)',    bg:'var(--rbg)'};
}

// ═══════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════
// SULAMA GEREKSİNİMİ — FAO-56 Dr/RAW/Ks tabanlı sorgulama
// ═══════════════════════════════════════════════════════════════════
// RZWB çıktısındaki Dr (tükeniş) ve RAW (kolayca alınabilir su)
// değerlerini kullanarak: sulama gerekli mi, kaç mm, ne kadar acil,
// kaç güne kadar kritik soruları somut cevap üretir.
window.calcIrrigationNeed = (field, s) => {
  const p = s.params || window.getRZWBParams(field);
  const { fcs, taw_s, raw_s, mad } = p;

  const Dr_s       = s.surface.Dr ?? Math.max(0, fcs - s.surface.moist);
  const Ks         = s.surface.Ks ?? 1;
  const triggerPct = Math.round((1 - mad) * 100);

  // Hedef: %90 FC (taşma/yüzey kaybını önle)
  const targetMoist = fcs * 0.90;
  const deficitMm   = Math.round(Math.max(0, targetMoist - s.surface.moist));

  // 7 günlük hava tahmini
  const wx      = WXC[field.id]?.days || simWX(field.lat, field.lon);
  const today   = tstr();
  const futWx   = wx.filter(d => d.date > today).slice(0, 7);
  const futR    = futWx.reduce((t, d) => t + d.rain, 0);
  const futET   = futWx.reduce((t, d) => t + (d.et0 || s.et || agrd(field.crop).et), 0);
  const netBalance = futR - futET;
  const effRain    = Math.min(deficitMm, futR * 0.7);
  const recommendedMm = Math.round(Math.max(0, deficitMm - effRain));

  // Kritik seviyeye (WP+10mm) kalan gün
  const lastLog     = s.log?.[s.log.length - 1];
  const dailyUse    = lastLog
    ? Math.max(0.5, (lastLog.ETc_s ?? lastLog.et_surf ?? s.et * 0.35))
    : Math.max(0.5, (s.ETc ?? s.et) * 0.35);
  const criticalMoist     = (p.wps ?? 15) + 10;
  const daysUntilCritical = s.surface.moist > criticalMoist
    ? Math.round((s.surface.moist - criticalMoist) / dailyUse) : 0;

  // Stres seviyesi (FAO-56 Ks)
  const stressLabel = Ks < 0.5 ? 'Ağır stres' : Ks < 0.8 ? 'Orta stres'
    : Ks < 1 ? 'Hafif stres' : 'Stres yok';

  const belowRaw   = Dr_s > raw_s;   // Dr > RAW → sulama eşiği aşıldı
  const critical   = s.surface.pct < 20;
  const stressed   = Ks < 0.8;

  let urgency, label;
  if (critical)                        { urgency = 'kritik'; label = 'ACİL — kök bölgesi kritik, hemen sulayın'; }
  else if (stressed)                   { urgency = 'stres';  label = `Bitki su stresi çekiyor (Ks=${Ks.toFixed(2)}) — sulama gerekli`; }
  else if (belowRaw && netBalance < 0) { urgency = 'öneri';  label = 'RAW eşiği aşıldı, yağış beklenmez — sulama planlanmalı'; }
  else if (belowRaw)                   { urgency = 'izle';   label = 'RAW eşiği aşıldı, yağış bekleniyor — izleyin'; }
  else                                 { urgency = 'yok';    label = 'Yeterli nem — sulamaya şu an gerek yok'; }

  return {
    needsIrrigation: belowRaw || critical || stressed,
    urgency, label, Ks, stressLabel,
    currentPct: s.surface.pct, triggerPct, madPct: Math.round(mad * 100),
    Dr_s: +Dr_s.toFixed(1), raw_s: +raw_s.toFixed(1), taw_s: +taw_s.toFixed(1),
    deficitMm, recommendedMm,
    netBalance7d: Math.round(netBalance), futRain7d: Math.round(futR), futET7d: Math.round(futET),
    daysUntilCritical,
  };
};

// ─── FENOLOJİ & HASAT TAHMİNİ ─────────────────────────────────────
window.calcPheno = (field) => {
  const a = window.agrd(field.crop);
  const gdd = window.calcGDD(field);
  if(gdd===null) return null;
  
  // Çok yıllık bitki: dikim yaşını dikkate al
  let plantDaysOffset = 0;
  if(field.plantingAge && field.plantingAge > 0) {
    // Dikim yaşı yıl cinsinden; GDD birikimi zaten yaşa göre normalize edilmiş
    plantDaysOffset = Math.round(field.plantingAge * 365);
  }
  
  const days = field.plantDate ? Math.round((Date.now()-new Date(field.plantDate+'T00:00:00'))/(864e5)) : 0;
  let si = a.st.length-1;
  for(let i=0; i<a.gd.length; i++){ if(gdd < a.gd[i]){si=i; break;} }
  const gs = si>0 ? a.gd[si-1] : 0;
  const ge = a.gd[si] || a.gd[a.gd.length-1];
  const stagePct = Math.min(100, Math.round((gdd-gs)/Math.max(1,ge-gs)*100));
  const totPct = Math.min(100, Math.round(gdd/(a.gd[a.gd.length-1]||1)*100));
  return {gdd, si, stage:a.st[si]||'Olgunluk', stagePct, totPct, days, a, plantingAge: field.plantingAge || 0};
}

window.calcHarvest = (field) => {
  const a = window.agrd(field.crop);
  const gdd = window.calcGDD(field);
  if(!field.plantDate){
    return field.harvestDate
      ? {estDate:field.harvestDate, daysLeft:Math.round((new Date(field.harvestDate)-Date.now())/(864e5)), conf:'manuel', gddPct:null}
      : null;
  }
  const gddTarget = a.gd[a.gd.length-1];
  const remain = Math.max(0, gddTarget - (gdd||0));
  
  // 6 aylık geçmiş ve anlık veriyi birleştir
  const wxAll = window.getBestWXDays(field);
  const fut = wxAll.filter(d=>d.date>tstr()).slice(0,14);
  const avgDGDD = fut.length>0
    ? fut.reduce((s,d)=>s+Math.max(0, Math.min((d.tmax+d.tmin)/2, a.tm)-a.tb),0)/fut.length
    : Math.max(1, a.to - a.tb)*0.55;
  const dGDD = avgDGDD>0 ? Math.round(remain/avgDGDD) : a.td;
  const dCal = Math.max(0, a.td - Math.round((Date.now()-new Date(field.plantDate+'T00:00:00'))/(864e5)));
  const blend = Math.round(dGDD*0.65 + dCal*0.35);
  const est = new Date(); est.setDate(est.getDate()+blend);
  const historyLen = window.getBestWXDays(field).filter(d=>d.date<=tstr()).length;
  const conf = historyLen >= 60 ? 'yüksek' : historyLen >= 14 ? 'orta' : 'düşük';
  const gddPct = Math.min(100, Math.round((gdd||0)/gddTarget*100));
  let dev = null;
  if(field.harvestDate) dev = blend - Math.round((new Date(field.harvestDate)-Date.now())/(864e5));
  return {estDate:est.toISOString().slice(0,10), daysLeft:blend, conf, gddAcc:gdd||0, gddTarget, gddPct, manDate:field.harvestDate||null, dev, already:blend<=0};
}

window.calcSolar = (field) => {
  const wxAll = window.getBestWXDays(field);
  const td = wxAll.find(d=>d.date===tstr()); if(!td) return null;
  const doy = Math.floor((Date.now()-new Date(new Date().getFullYear(),0,0))/(864e5));
  const decl = 23.45 * Math.sin((284+doy)*Math.PI/180);
  const maxSun = Math.min(16, Math.max(4, 12+4*Math.sin((field.lat-decl)*Math.PI/180)));
  const code = td.code||0;
  const cf = code<=1?1.0:code<=3?0.82:code<=49?0.5:code<=80?0.35:0.2;
  const sunH = Math.round(maxSun*cf*10)/10;
  const rad = Math.round(sunH*2.5*cf*10)/10;
  const a = window.agrd(field.crop);
  const hs = td.tmax>a.tm?'stres':td.tmax>a.to+6?'uyarı':td.tmax<a.mn+5?'soğuk':'normal';
  return {sunH, rad, cf, hs, topt:a.to, tmaxLim:a.tm, minT:a.mn, actMax:td.tmax};
}

// ─── HAVA DURUMU ─────────────────────────────────────────────────
window.wicon = (c) => {
  if(c===undefined) return'🌤️';if(c<=1)return'☀️';if(c<=3)return'⛅';
  if(c<=49)return'🌫️';if(c<=67)return'🌧️';if(c<=77)return'❄️';if(c<=82)return'🌦️';return'⛈️';
}

window.simWX = (lat, lon) => {
  const days=[]; const now=new Date();
  for(let i=-7;i<=7;i++){
    const d=new Date(now); d.setDate(now.getDate()+i);
    const sd=((lat*100+lon*50+d.getDate()*3+d.getMonth()*17)%97+97)%97;
    const base=16+Math.sin(d.getMonth()/2)*13+(lat>38?-3:3);
    const tmax=Math.round(base+sd%10-2);
    const rain=sd<18?+(sd*1.4).toFixed(1):sd<28?+((sd-18)*0.3).toFixed(1):0;
    days.push({date:d.toISOString().slice(0,10),tmax,tmin:tmax-Math.round(5+sd%7),rain,wind:Math.round(8+sd%22),code:rain>5?63:rain>0?80:sd>60?2:0,et0:+((tmax-5)*0.15).toFixed(1)});
  }
  return days;
}

window.setBadge = (barId, id, cls, lbl) => {
  const bar = qs('#'+barId); if(!bar) return;
  let el = qs('#wb-'+barId+'-'+id);
  if(!el){ el=document.createElement('span'); el.id='wb-'+barId+'-'+id; el.className='wxbadge'; bar.appendChild(el); }
  el.className = 'wxbadge '+cls;
  el.innerHTML = (cls==='load' ? '<span class="spin"></span>' : '') + lbl;
}

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
    
    // Hava geçmişini arka planda güncelle
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
}

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
  <div style="font-size:11px;color:var(--text3);margin-top:6px;">📅 GDD hesaplaması için ${histDays} günlük hava geçmişi kullanılıyor (son 6 ay)</div>`;
}

// ─── UYDU MOTORİ ─────────────────────────────────────────────────
window.ndviCls = (v) => {
  const n=parseFloat(v);
  if(n>0.7) return {l:'Çok İyi',   tag:'tg', color:'var(--green2)', bar:'#2d6a4f'};
  if(n>0.5) return {l:'İyi',       tag:'tg', color:'var(--green2)', bar:'#40916c'};
  if(n>0.3) return {l:'Orta',      tag:'tgr',color:'var(--text2)',  bar:'#888'};
  if(n>0.15)return {l:'Zayıf',     tag:'ta', color:'var(--amber)',  bar:'#e67e22'};
  return           {l:'Çok Zayıf', tag:'tr', color:'var(--red)',    bar:'#e74c3c'};
}

window.fetchSat = async (field) => {
  field = field||CUR; if(!field) return;
  const id=field.id, lat=field.lat, lon=field.lon;
  const sb=(sid,cls,lbl)=>setBadge('sat-src',sid,cls,lbl);
  sb('agro','load','Open-Meteo Agro…'); sb('nasa','load','NASA POWER…'); sb('s2','load','Sentinel-2…');
  const R={};

  // 1. Open-Meteo Agro — genişletilmiş katman verileri
  try{
    const url=`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=soil_temperature_0cm,soil_temperature_6cm,soil_moisture_0_to_1cm,soil_moisture_1_to_3cm,soil_moisture_3_to_9cm,soil_moisture_9_to_27cm,vapor_pressure_deficit,relative_humidity_2m&daily=et0_fao_evapotranspiration,shortwave_radiation_sum&past_days=7&forecast_days=3&timezone=Europe%2FIstanbul`;
    const r=await fetch(url);
    if(r.ok){
      const d=await r.json();
      const today=tstr(); const ti=d.daily?.time?.indexOf(today)??-1; const hi=new Date().getHours(); const hb=(ti>=0?ti:0)*24;
      R.soilT0=d.hourly?.soil_temperature_0cm?.[hb+hi]?.toFixed(1);
      R.soilT6=d.hourly?.soil_temperature_6cm?.[hb+hi]?.toFixed(1);
      R.soilM1=d.hourly?.soil_moisture_0_to_1cm?.[hb+hi];       // 0-1cm
      R.soilM3=d.hourly?.soil_moisture_3_to_9cm?.[hb+hi];       // 3-9cm (yüzey)
      R.soilMDeep=d.hourly?.soil_moisture_9_to_27cm?.[hb+hi];   // 9-27cm (derin)
      R.vpd=d.hourly?.vapor_pressure_deficit?.[hb+hi]?.toFixed(2);
      R.humidity = d.hourly?.relative_humidity_2m?.[hb+hi]?.toFixed(0);
      R.et0=ti>=0?d.daily?.et0_fao_evapotranspiration?.[ti]?.toFixed(1):null;
      R.solar=ti>=0?d.daily?.shortwave_radiation_sum?.[ti]?.toFixed(1):null;
      R.past7Solar=d.daily?.shortwave_radiation_sum?.slice(0,8)||[];
      R.past7Dates=d.daily?.time?.slice(0,8)||[];
      sb('agro','ok','Open-Meteo Agro ✓');
    }else sb('agro','err','Agro: '+r.status);
  }catch(e){ sb('agro','err','Agro: '+e.message); }

  // 2. NASA POWER
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

  // 3. Sentinel-2 STAC
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
  const a=agrd(field.crop);
  const cropf=Math.min(1,(a.to||22)/30);
  const ndvi=Math.max(0.05,Math.min(0.95,(sf*0.3+solf*0.25+rainf*0.25+tempf*0.2)*cropf));
  R.ndvi=ndvi.toFixed(3); R.evi=(ndvi*0.88).toFixed(3);
  const ndwiRaw=(rainf*0.6+(R.soilM3||0.2)*0.4)-0.1;
  R.ndwi=Math.max(-0.5,Math.min(0.8,ndwiRaw)).toFixed(3);
  R.lst=R.soilT0||R.soilT6||'—';
  R.isEst=!R.s2date;

  SATC[id]={data:R, at:Date.now()};
  invSoil(id);
  renderSat(field, R);
}

window.renderSat = (field, R) => {
  if(!R) return;
  const nc=ndviCls(R.ndvi);
  const bar=(v,max,color)=>`<div style="height:7px;border-radius:4px;background:var(--bg3);overflow:hidden;margin-top:5px;"><div style="height:100%;width:${Math.min(100,Math.max(0,(parseFloat(v)+0.5)/(max+0.5)*100))}%;background:${color};border-radius:4px;"></div></div>`;

  const nel=qs('#sat-ndvi');
  if(nel) nel.innerHTML=`<div style="text-align:center;padding:8px 0;"><div style="font-size:28px;font-weight:800;color:${nc.color};">${R.ndvi}</div><span class="tag ${nc.tag}" style="margin-top:4px;display:inline-flex;">${nc.l}</span></div>${bar(R.ndvi,0.95,nc.bar)}<div style="font-size:10px;color:var(--text3);margin-top:4px;">-1 (çıplak) ← 0 → +1 (yoğun bitki)</div><div class="tag ${R.isEst?'ta':'tg'}" style="font-size:9px;margin-top:5px;display:inline-flex;">${R.isEst?'⚠️ Model tahmini':'📡 S2: '+R.s2date}</div>`;

  const eel=qs('#sat-evi');
  if(eel) eel.innerHTML=`<div style="text-align:center;padding:8px 0;"><div style="font-size:28px;font-weight:800;color:var(--green2);">${R.evi}</div><span class="tag tg" style="margin-top:4px;display:inline-flex;">${parseFloat(R.evi)>0.4?'İyi Vejetasyon':'Gelişmekte'}</span></div>${bar(R.evi,0.9,'var(--green2)')}<div style="font-size:10px;color:var(--text3);margin-top:4px;">Atmosfer düzeltmeli (0–0.9)</div>`;

  const nwl=parseFloat(R.ndwi)>0.3?'Yüksek Su':parseFloat(R.ndwi)>0?'Orta':parseFloat(R.ndwi)>-0.2?'Düşük':'Kuru/Stres';
  const wel=qs('#sat-ndwi');
  if(wel) wel.innerHTML=`<div style="text-align:center;padding:8px 0;"><div style="font-size:28px;font-weight:800;color:var(--blue);">${R.ndwi}</div><span class="tag tb" style="margin-top:4px;display:inline-flex;">${nwl}</span></div>${bar((parseFloat(R.ndwi)+0.5),1.3,'var(--blue)')}<div style="font-size:10px;color:var(--text3);margin-top:4px;">Bitki su stresi göstergesi</div>`;

  // Çift katman toprak nemi gösterimi
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
    iel.innerHTML=`<div class="ritem" style="background:var(--glt);"><div class="rico" style="background:var(--gbg);color:var(--green2);font-size:16px;">🛰️</div><div class="rbody"><div class="rtitle" style="margin-bottom:5px;">Uydu Tabanlı Vejetasyon Değerlendirmesi</div><div class="rsub">${msg}${sm?'<br/>'+sm+vpdm:''}</div><div style="font-size:10px;color:var(--text3);margin-top:6px;">NDVI:${R.ndvi} · EVI:${R.evi} · NDWI:${R.ndwi} · LST:${R.lst}°C${R.solar?' · Solar:'+R.solar+'MJ/m²':''} · ${R.isEst?'Model tahmini':'Gerçek uydu verisi'}</div></div></div>`;
  }

  const lnkel=qs('#sat-links');
  if(lnkel){
    const bbox=`${(lon-0.02).toFixed(4)},${(lat-0.02).toFixed(4)},${(lon+0.02).toFixed(4)},${(lat+0.02).toFixed(4)}`;
    lnkel.innerHTML=[
      [`https://apps.sentinel-hub.com/sentinel-playground/?lat=${lat}&lng=${lon}&zoom=14`,'🛰️ Sentinel Playground (Gerçek Renkli / NDVI)'],
      [`https://apps.sentinel-hub.com/eo-browser/?lat=${lat}&lng=${lon}&zoom=14`,'🔬 EO Browser (Çok Bantlı Analiz)'],
      [`https://worldview.earthdata.nasa.gov/?l=HLS_L30_Nadir_BRDF_Adjusted_Reflectance,Reference_Features&t=${tstr()}&z=8&v=${bbox}`,'🌍 NASA Worldview (HLS/MODIS)'],
      [`https://power.larc.nasa.gov/data-access-viewer/?lat=${lat}&lng=${lon}`,'⚡ NASA POWER (İklim & Enerji Verisi)'],
      [`https://land.copernicus.eu/global/products/ndvi`,'📊 Copernicus Global NDVI']
    ].map(([u,l])=>`<a href="${u}" target="_blank" class="wxlink">${l}</a>`).join('');
  }
}

window.satCtxStr = (field) => {
  const R=SATC[field?.id]?.data;
  if(!R) return 'Uydu verisi henüz alınmadı (🛰️ Uydu sekmesinden güncelleyin).';
  const surfPct = R.soilM3 ? (parseFloat(R.soilM3)*100).toFixed(0)+'%' : '—';
  const deepPct = R.soilMDeep ? (parseFloat(R.soilMDeep)*100).toFixed(0)+'%' : '—';
  return `NDVI:${R.ndvi}(${ndviCls(R.ndvi).l}) EVI:${R.evi} NDWI:${R.ndwi} LST:${R.lst}°C ET₀:${R.et0||'—'}mm Solar:${R.solar||'—'}MJ/m² YüzeyNem(3-9cm):${surfPct} DerinNem(9-27cm):${deepPct} VPD:${R.vpd||'—'}kPa NASA30gYağış:${R.nasaRain30||'—'}mm S2geçiş:${R.s2count||0}(son:${R.s2date||'—'}) Kaynak:${R.isEst?'ModelTahmini':'GerçekUydu'}`;
}

// ─── FAO-56 RZWB TOPRAK NEM RENDER ───────────────────────────────
window.renderSoil = async (field) => {
  const s   = await calcSoil(field);
  const sc_surf = scl(s.surface.pct);
  const sc_deep = scl(s.deep.pct);
  const irr = calcIrrigationNeed(field, s);
  const p   = s.params || window.getRZWBParams(field);
  const lastIrr = (field.events||[]).filter(e=>e.type==='sulama'&&!e.planned)
    .sort((a,b)=>b.date.localeCompare(a.date))[0];
  const dsi = lastIrr ? Math.round((Date.now()-new Date(lastIrr.date))/(864e5)) : null;

  // ── 1. Nem Durumu ─────────────────────────────────────────────
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
      ? '<span class="tag tg" style="font-size:10px;">📡 Uydu kalibrasyonu</span>'
      : '<span class="tag ta" style="font-size:10px;">⚠️ Model tahmini</span>'}
  </div>`;

  // ── 2. Sulama Gereksinimi Kartı ───────────────────────────────
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

  // ── 3. FAO-56 Günlük Ledger Tablosu (son 7 gün) ──────────────
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
          <th>ETc-Yüz</th><th>ETc-Der</th><th>Sızma</th>
          <th>Dr (mm)</th><th>Yüzey %</th><th>Derin %</th><th>Kc</th><th>Ks</th>
        </tr></thead>
        <tbody>${logs.map(r => {
          const pct_s = r.pct_s ?? r.pct_surf ?? 50;
          const sc2 = scl(pct_s);
          const ksVal = r.Ks_s ?? 1;
          return `<tr>
            <td style="white-space:nowrap;">${fd(r.date)}</td>
            <td>${+(r.Pe ?? r.rain ?? 0).toFixed(1)}mm</td>
            <td>${r.irr > 0 ? r.irr + 'mm' : '—'}</td>
            <td>${+(r.ETc_s ?? r.et_surf ?? 0).toFixed(1)}mm</td>
            <td>${+(r.ETc_d ?? r.et_deep ?? 0).toFixed(1)}mm</td>
            <td>${+(r.perc ?? r.percolation ?? 0).toFixed(1)}mm</td>
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

// ─── HARİTA — POLİGON DESTEĞİ ───────────────────────────────────
window.initMap = (lat, lon, field) => {
  if(lmap){ lmap.remove(); lmap=null; }
  const el=qs('#lmap'); if(!el) return;
  const osm=L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap',maxZoom:19});
  const sat=L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{attribution:'© Esri World Imagery',maxZoom:18});
  const topo=L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',{attribution:'© OpenTopoMap',maxZoom:17});
  lmap=L.map('lmap',{zoomControl:true}).setView([lat,lon],14);
  osm.addTo(lmap);
  L.control.layers({'🗺️ Standart (OSM)':osm,'🛰️ Uydu (Esri)':sat,'🏔️ Topografik':topo},{}).addTo(lmap);
  
  DB.fields.forEach(f=>{
    const isActive = f.id === field?.id;
    const color = f.color || '#40916c';
    
    // Poligon varsa çiz, yoksa nokta
    if(f.polygon && f.polygon.length >= 3) {
      const poly = L.polygon(f.polygon, {
        color: color,
        fillColor: color,
        fillOpacity: isActive ? 0.35 : 0.18,
        weight: isActive ? 3 : 1.5
      });
      poly.bindPopup(`<b>${f.name}</b><br/>${f.crop||'—'} · ${f.area} ${f.areaUnit||'dönüm'}<br/>Alan: ${f.area} ${f.areaUnit||'dönüm'}`);
      poly.addTo(lmap);
      if(isActive) {
        setTimeout(()=>poly.openPopup(), 300);
        lmap.fitBounds(poly.getBounds(), {padding:[20,20]});
      }
    } else {
      // Nokta marker
      const c=L.circleMarker([f.lat,f.lon],{
        radius: isActive ? 11 : 7,
        color, fillColor: color,
        fillOpacity: 0.7,
        weight: isActive ? 3 : 1.5
      });
      c.bindPopup(`<b>${f.name}</b><br/>${f.crop||'—'} · ${f.area} ${f.areaUnit||'dönüm'}`);
      c.addTo(lmap);
      if(isActive) setTimeout(()=>c.openPopup(), 300);
    }
  });
}

window.renderLocInfo = (field) => {
  const el=qs('#fp-locinfo'); if(!el) return;
  const infraHTML = [];
  if(field.irrigation) infraHTML.push(`<span class="tag tg">💧 ${field.irrigation}</span>`);
  if(field.fencing) infraHTML.push(`<span class="tag ${field.fencing==='Yok'?'tr':'tgr'}">🔒 Çit: ${field.fencing}</span>`);
  if(field.waterSource) infraHTML.push(`<span class="tag tb">🚿 Su: ${field.waterSource}</span>`);
  if(field.plantingAge) infraHTML.push(`<span class="tag tp2">🌳 Dikim yaşı: ${field.plantingAge} yıl</span>`);
  
  el.innerHTML=`<table class="tbl">
    <tr><td style="color:var(--text3);">Enlem</td><td>${field.lat?.toFixed(5)}°N</td></tr>
    <tr><td style="color:var(--text3);">Boylam</td><td>${field.lon?.toFixed(5)}°E</td></tr>
    <tr><td style="color:var(--text3);">Mevki</td><td>${field.location||'—'}</td></tr>
    <tr><td style="color:var(--text3);">Alan</td><td>${field.area} ${field.areaUnit||'dönüm'}</td></tr>
    <tr><td style="color:var(--text3);">Ekim/Dikim</td><td>${fd(field.plantDate)}</td></tr>
    <tr><td style="color:var(--text3);">Hasat (Plan)</td><td>${fd(field.harvestDate)}</td></tr>
    ${field.notes?`<tr><td style="color:var(--text3);">Not</td><td style="font-size:11px;">${field.notes.slice(0,120)}</td></tr>`:''}
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
}

// ─── OLAYLAR ─────────────────────────────────────────────────────
window.updEF = () => {
  const type=qs('#e-type').value, df=qs('#e-dynfields');
  const ql=qs('#e-qlbl'), cl=qs('#e-clbl'), us=qs('#e-unit');
  if(type==='sulama'){
    df.innerHTML=`<div class="fr"><div class="fg"><label>Sulama Yöntemi</label><select id="e-sm"><option>Damla sulama</option><option>Yağmurlama</option><option>Salma sulama</option><option>Karık sulama</option><option>Yüzey sulama</option><option>Mikro yağmurlama</option><option>El ile sulama</option></select></div><div class="fg"><label>Süre (saat)</label><input type="number" id="e-sd" placeholder="2" min="0" step="0.5"/></div></div>`;
    if(ql)ql.textContent='Su Miktarı (mm)'; if(us)us.value='mm'; if(cl)cl.textContent='Birim Fiyat (₺/m³)';
  }else if(type==='gübre'){
    const fg={
      '── N GÜBRE (Azot) ──':['Üre (%46 N)','Amonyum Nitrat (%33 N)','CAN — Kalsiyum Amonyum Nitrat (%26 N)','Amonyum Sülfat (%21 N)','Amonyum Klorür (%25 N)'],
      '── P GÜBRE (Fosfor) ──':['TSP — Triple Süperfos (%46 P₂O₅)','SSP — Tek Süperfos (%20 P₂O₅)','MAP — Monoamonyum Fosfat (12-61-0)','DAP (18-46-0)','Rock Fosfat'],
      '── K GÜBRE (Potasyum) ──':['Potasyum Klorür MOP (%60 K₂O)','Potasyum Sülfat SOP (%50 K₂O)','Potasyum Nitrat (13-0-46)','Potasyum Magnezyum Sülfat'],
      '── NPK KOMPOZİT ──':['NPK 20-20-0','NPK 15-15-15','NPK 8-16-16','NPK 10-20-20','NPK 12-12-17','NPK 20-10-10','NPK 5-10-25','NPK 3-9-27+4MgO','NPK 15-5-30','NPK 13-13-21','NPK 20-0-0','NPK 11-52-0 (MAP)'],
      '── Ca & Mg ──':['Kalsiyum Nitrat (%15.5 N + %26 CaO)','Magnezyum Sülfat — Kiserit (%27 MgO)','Kalsiyum Klorür','Dolomit (CaMg)','Kireç — Kalsit'],
      '── MİKRO ELEMENT ──':['Çinko Sülfat ZnSO₄','Demir Sülfat FeSO₄','Mangan Sülfat','Bor — Sodyum Tetraborat','Bakır Sülfat','Molibden (Na Molibdat)','Şelatlı Demir EDTA-Fe','Şelatlı Çinko EDTA-Zn','Şelatlı Mangan EDTA-Mn','Şelatlı Bakır EDTA-Cu','Multimikro Karışım'],
      '── ORGANİK & BİOSTİMÜLANT ──':['Humik Asit (%85)','Humik+Fulvik Asit','Fulvik Asit Konsantre','Deniz Yosunu Ekstre (Ascophyllum)','Aminoasit Kompleks','Organik gübre (kompost)','Çiftlik gübresi','Leonardit','Vermikompost','Biyogübre Rhizobium','Mikoriza İnokulant (VAM)'],
      '── YAPRAK GÜBRE ──':['Yaprak gübresi NPK sıvı','Yaprak Ca+B','Yaprak Zn+Mn','Yaprak Fe+Mg','Yaprak Multimikro+İz Element'],
      '── ÖZEL ──':['Kükürt (%99 S granül)','Sodyum Molibdat','Silisyum Dioksit','Zeatin (Sitokinin)','Hümüs Toprağı']
    };
    let opt=''; for(const [g,items] of Object.entries(fg)){ opt+=`<optgroup label="${g}">${items.map(i=>`<option>${i}</option>`).join('')}</optgroup>`; }
    df.innerHTML=`<div class="fr"><div class="fg"><label>Gübre Türü / Ürün</label><select id="e-ft">${opt}</select></div><div class="fg"><label>Uygulama Yöntemi</label><select id="e-fa"><option>Topraktan serpme</option><option>Topraktan karıştırma</option><option>Bant uygulaması</option><option>Fertigasyon (damla ile)</option><option>Yapraktan ilaçlama</option><option>Toprak enjeksiyonu</option><option>Tohum ilaçlama</option></select></div></div><div class="fg"><label>Ticari Ürün / Marka (opsiyonel)</label><input type="text" id="e-fbrand" placeholder="Ürün adı, formülasyon..."/></div>`;
    if(ql)ql.textContent='Miktar (kg/da veya lt/da)'; if(us)us.value='kg'; if(cl)cl.textContent='Birim Fiyat (₺/kg)';
  }else if(type==='ilaç'){
    const pg={
      '── FUNGİSİT ──':['Bakır Sülfat — Bordo bulamacı','Bakır Hidroksit','Mankozeb','Metalaksil+Mankozeb','Tebukonazol','Trifloksistrobin','Azoksistrobin','Propikonazol','Iprodion','Boskalid','Fenheksamid','Kresoksim-metil','Difenokonazol','Penthiopyrad'],
      '── İNSEKTİSİT ──':['İmidakloprid','Tiyametoksam','Asetamiprit','Spirotetramat','Flonikamit','Klorpirfos','Deltametrin','Lambda-sihalotrin','Spinosad','Azadiraktin — Neem özü','Piretrin (doğal)'],
      '── AKARİSİT ──':['Abamektin','Bifenazat','Spiromesifen','Etoksazol','Fenproksimat','Heksitiazoks','Propargit'],
      '── HERBİSİT ──':['Glifosat','Pendimetalin','Metribuzin','İmazamoks','Bentazon','Fluroksipir','2,4-D Amin','Dikamba','Sülkotrion','Klomazon'],
      '── NEMATİSİT ──':['Oksamil','Etoprofos','Dazomet','Biyonematisit'],
      '── BİYOLOJİK ──':['Bacillus thuringiensis (Bt)','Bacillus subtilis','Beauveria bassiana','Metarhizium anisopliae','Trichoderma spp.','Chrysoperla carnea'],
      '── ORGANİK ──':['Sabunlu su','Kükürt tozu (%80 S)','Neem yağı (%100)','Piretrum','Kieselgur']
    };
    let opt=''; for(const [g,items] of Object.entries(pg)){ opt+=`<optgroup label="${g}">${items.map(i=>`<option>${i}</option>`).join('')}</optgroup>`; }
    df.innerHTML=`<div class="fr"><div class="fg"><label>Aktif Madde</label><select id="e-pt">${opt}</select></div><div class="fg"><label>Ticari Ürün / Marka</label><input type="text" id="e-pn" placeholder="Ürün adı..."/></div></div><div class="fr"><div class="fg"><label>Hedef</label><input type="text" id="e-ptarget" placeholder="Zararlı / hastalık..."/></div><div class="fg"><label>Ekipman</label><select id="e-papp"><option>Sırt pülverizatörü</option><option>Traktör pülverizatörü</option><option>Atomizör</option><option>Toprak uygulaması</option><option>Damla sulama ile</option></select></div></div>`;
    if(ql)ql.textContent='Toplam Miktar'; if(us)us.value='lt'; if(cl)cl.textContent='Birim Fiyat (₺/lt)';
  }else if(type==='yakıt'){
    df.innerHTML=`<div class="fr"><div class="fg"><label>Yakıt Türü</label><select id="e-ft2"><option>Motorin</option><option>Benzin</option><option>LPG</option><option>Elektrik (kWh)</option></select></div><div class="fg"><label>Araç / Ekipman</label><input type="text" id="e-fv" placeholder="Traktör, sulama motoru..."/></div></div>`;
    if(ql)ql.textContent='Miktar (lt veya kWh)'; if(us)us.value='lt'; if(cl)cl.textContent='Litre / kWh Fiyatı (₺)';
  }else if(type==='hasat'){
    df.innerHTML=`<div class="fr"><div class="fg"><label>Hasat Miktarı</label><input type="number" id="e-hq" placeholder="0" min="0"/></div><div class="fg"><label>Hasat Birimi</label><select id="e-hu"><option>kg</option><option>ton</option><option>adet</option><option>kasa</option><option>çuval</option><option>balya</option></select></div></div><div class="fr"><div class="fg"><label>Satış Fiyatı (₺/kg)</label><input type="number" id="e-hp" placeholder="0" step="0.01"/></div><div class="fg"><label>Alıcı / Satış Yeri</label><input type="text" id="e-hb" placeholder="Pazar, hal, kooperatif..."/></div></div>`;
    if(ql)ql.textContent='İşçilik Maliyeti'; if(us)us.value='toplam'; if(cl)cl.textContent='İşçilik (₺)';
  }else if(type==='işçilik'){
    df.innerHTML=`<div class="fr"><div class="fg"><label>İşçi Sayısı</label><input type="number" id="e-wc" placeholder="2" min="0"/></div><div class="fg"><label>Süre (gün)</label><input type="number" id="e-wd" placeholder="1" min="0" step="0.5"/></div></div>`;
    if(ql)ql.textContent='Gün sayısı'; if(us)us.value='saat'; if(cl)cl.textContent='Günlük Ücret (₺/kişi)';
  }else{
    df.innerHTML='';
    if(ql)ql.textContent='Miktar'; if(cl)cl.textContent='Birim Maliyet (₺)'; if(us)us.value='toplam';
  }
}

window.openEM = (editId) => {
  qs('#e-eid').value=editId||'';
  qs('#em-title').textContent=editId?'Olayı Düzenle':'Olay / Maliyet Kaydı';
  if(editId&&CUR){
    const ev=(CUR.events||[]).find(e=>e.id===editId); if(!ev) return;
    qs('#e-date').value=ev.date||tstr(); qs('#e-type').value=ev.type||'diğer';
    qs('#e-notes').value=ev.notes||''; qs('#e-cost').value=ev.cost||'';
    qs('#e-qty').value=ev.qty||''; qs('#e-unit').value=ev.unit||'toplam';
    qs('#e-status').value=ev.planned?'planned':'done';
    updEF();
    if(ev.extra){ Object.entries(ev.extra).forEach(([k,v])=>{ const el=qs('#'+k); if(el) el.value=v; }); }
  }else{
    qs('#e-date').value=tstr(); qs('#e-type').value='sulama';
    qs('#e-notes').value=''; qs('#e-cost').value=''; qs('#e-qty').value='';
    qs('#e-status').value='done';
    updEF();
  }
  qs('#m-event').classList.add('on');
}

window.saveEvent = async () => {
  const dt=qs('#e-date').value; if(!dt){ toast('Tarih zorunludur',true); return; }
  if(!CUR) return;
  const eid=qs('#e-eid').value;
  const qty=parseFloat(qs('#e-qty').value)||0;
  const cost=parseFloat(qs('#e-cost').value)||0;
  const extra={};
  ['e-sm','e-sd','e-ft','e-fa','e-fbrand','e-pn','e-pt','e-ptarget','e-papp','e-ft2','e-fv','e-hq','e-hu','e-hp','e-hb','e-wc','e-wd'].forEach(id=>{
    const el=qs('#'+id); if(el&&el.value) extra[id]=el.value;
  });
  let revenue = 0, profit = null;
  if(qs('#e-type').value === 'hasat') {
    const harvestQty = parseFloat(extra['e-hq']) || 0;
    const price = parseFloat(extra['e-hp']) || 0;
    revenue = harvestQty * price;
    profit = revenue - (cost * (qty||1));
  }
  const ev={id:eid||gid(),date:dt,type:qs('#e-type').value,notes:qs('#e-notes').value,cost,qty,unit:qs('#e-unit').value,planned:qs('#e-status').value==='planned',extra,total:+(cost*(qty||1)).toFixed(2), revenue, profit};
  if(eid){ const idx=(CUR.events||[]).findIndex(e=>e.id===eid); if(idx>=0) CUR.events[idx]=ev; else (CUR.events=CUR.events||[]).push(ev); }
  else (CUR.events=CUR.events||[]).push(ev);
  CUR.events.sort((a,b)=>b.date.localeCompare(a.date));
  invSoil(CUR.id);
  const fi=DB.fields.findIndex(f=>f.id===CUR.id); if(fi>=0) DB.fields[fi]=CUR;
  await saveFieldToDB(CUR);
  closeM('event'); await renderFieldPage(CUR); await renderSB(); await renderDash();
  toast(eid?'Güncellendi':'Kaydedildi');
  await window.computeAllSoils(true);
};

window.delEv = async (id) => {
  if(!CUR||!confirm('Bu kaydı silmek istediğinizden emin misiniz?')) return;
  CUR.events=(CUR.events||[]).filter(e=>e.id!==id);
  invSoil(CUR.id);
  const fi=DB.fields.findIndex(f=>f.id===CUR.id); if(fi>=0) DB.fields[fi]=CUR;
  await saveFieldToDB(CUR);
  renderEvTab(CUR); await renderDash(); toast('Silindi');
  await window.computeAllSoils(true);
}

window.renderEvTab = (field) => {
  const tb=qs('#ev-tbody'); if(!tb) return;
  const evs=field.events||[];
  if(!evs.length){ tb.innerHTML=`<tr><td colspan="8" style="text-align:center;padding:22px;color:var(--text3);">Kayıt yok.</td></tr>`; const cc=qs('#ev-cost'); if(cc) cc.innerHTML=''; return; }
  tb.innerHTML=evs.map(e=>{
    const total=e.total||(e.cost*(e.qty||1));
    const extra=e.extra?Object.entries(e.extra).filter(([k])=>['e-ft','e-pn','e-sm','e-ft2','e-fbrand'].includes(k)).map(([,v])=>v).join(' · '):'';
    return`<tr>
      <td style="white-space:nowrap;">${fd(e.date)}</td>
      <td><span>${EVI[e.type]||'📝'}</span> ${e.type}${e.planned?'<br/><span class="tag tb" style="font-size:9px;">Planlandı</span>':''}</td>
      <td style="max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${extra?`<small style="color:var(--text3);">${extra}</small><br/>`:''}${e.notes||'—'}</td>
      <td>${e.qty||'—'} ${e.unit||''}</td>
      <td>${e.cost?e.cost.toLocaleString('tr-TR')+'₺':'—'}</td>
      <td style="font-weight:600;">${total?Math.round(total).toLocaleString('tr-TR')+'₺':'—'}</td>
      <td>${e.revenue?Math.round(e.revenue).toLocaleString('tr-TR')+'₺':(e.type==='hasat'?'—':'')}</td>
      <td><div style="display:flex;gap:3px;"><button class="btn btnxs btna" onclick="openEM('${e.id}')">✏️</button><button class="btn btnxs btnd" onclick="delEv('${e.id}')">✕</button></div></td>
    </tr>`;
  }).join('');
  const cm={};let tot=0, totRev=0, totProfit=0;
  evs.filter(e=>e.cost>0).forEach(e=>{ const t=e.total||(e.cost*(e.qty||1)); cm[e.type]=(cm[e.type]||0)+t; tot+=t; });
  evs.filter(e=>e.revenue).forEach(e=>{ totRev+=e.revenue; });
  totProfit = totRev - tot;
  const cc=qs('#ev-cost');
  if(cc) cc.innerHTML=Object.keys(cm).length
    ? Object.entries(cm).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`<div class="pr"><span class="prl">${EVI[k]||'📝'} ${k}</span><div class="prt"><div class="prf" style="width:${tot?Math.round(v/tot*100):0}%;background:${EVC[k]||'var(--green2)'};"></div></div><span class="prv">${Math.round(v).toLocaleString()}₺</span></div>`).join('')+`
    <div style="display:flex;justify-content:space-between;font-weight:700;font-size:14px;padding-top:9px;margin-top:5px;border-top:1px solid var(--bdr);"><span>Toplam Maliyet</span><span>${Math.round(tot).toLocaleString('tr-TR')} ₺</span></div>
    <div style="display:flex;justify-content:space-between;font-size:14px;margin-top:6px;"><span>Toplam Gelir</span><span>${Math.round(totRev).toLocaleString('tr-TR')} ₺</span></div>
    <div style="display:flex;justify-content:space-between;font-weight:800;font-size:15px;margin-top:6px;color:${totProfit>=0?'var(--green2)':'var(--red)'}"><span>Net Kar</span><span>${Math.round(totProfit).toLocaleString('tr-TR')} ₺</span></div>`
    : 'Maliyet kaydı yok.';
}

// ─── ÖNERİLER ────────────────────────────────────────────────────
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
  const a=agrd(field.crop);

  // FAO-56 RZWB tabanlı sulama kararı
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
}

window.renderRecTab = async (field) => {
  const ph=calcPheno(field);
  const he=calcHarvest(field);
  const sh=calcSolar(field);
  const a=agrd(field.crop);
  const phen=qs('#rec-pheno');
  if(phen){
    let html='';
    if(ph){
      // Çok yıllık bitki bilgisi
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
    ? `<div class="bubble bb" style="white-space:pre-line;">${field.aiRecs[0].text}</div><div style="font-size:10px;color:var(--text3);margin-top:4px;">${fd(field.aiRecs[0].date)} tarihli analiz</div>`
    : '<div style="color:var(--text3);font-size:13px;">🤖 AI Analiz butonu ile tüm veriler harmanlanarak bütünsel uzman yorumu oluşturulur.</div>';
}

// ═══════════════════════════════════════════════════════════════════
// GELİŞMİŞ AI SİSTEMİ — Konuşma Hafızası + Bütünsel Bağlam
// ═══════════════════════════════════════════════════════════════════
window.getAIMemory = (fieldId) => {
  const key = 'tt_aimem_' + fieldId;
  try {
    const stored = localStorage.getItem(key);
    if(stored) {
      const parsed = JSON.parse(stored);
      // Son 30 günden eski mesajları filtrele
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
    // Maksimum 50 mesaj tut
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
  const a = agrd(field.crop);
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
Model: FAO-56 Kök Bölgesi Su Dengesi | ${s.satCalibrated ? '📡 Uydu kalibrasyonlu' : '⚠️ Model tahmini'}
Yüzey (0-10cm): %${s.surface.pct} | Nem=${s.surface.moist}mm | Dr=${s.surface.Dr?.toFixed(1)??'—'}mm | Ks=${s.surface.Ks?.toFixed(2)??'1.00'}
Derin (10-30cm): %${s.deep.pct} | Nem=${s.deep.moist}mm | Dr=${s.deep.Dr?.toFixed(1)??'—'}mm | Ks=${s.deep.Ks?.toFixed(2)??'1.00'}
Parametreler: FC=${s.params?.fcs??'—'}/${s.params?.fcd??'—'}mm · TAW=${s.params?.taw_s?.toFixed(0)??'—'}/${s.params?.taw_d?.toFixed(0)??'—'}mm · RAW=${s.params?.raw_s?.toFixed(0)??'—'}/${s.params?.raw_d?.toFixed(0)??'—'}mm · MAD=%${s.params?Math.round(s.params.mad*100):'—'}
Bugünkü Kc=${s.kc?.toFixed(3)??'—'} | ETc=${s.ETc??'—'}mm/g
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
  const photoCount=(CUR.photos||[]).filter(p=>p.data).length;
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
• Çift katman toprak nemi analizini (yüzey + derin) yoruma entegre et
• Hava + nem + uydu + fenoloji + geçmiş uygulamalar tek analize entegre
• ${memory.length>0?'Önceki analizlerle tutarlılık sağla, değişimleri vurgula':''}
• Somut tarih ve miktar belirterek aksiyon ver
• Türk tarım koşullarına özgü, teknik ama anlaşılır
• Maksimum 5-6 paragraf: durum → risk → eylem`;

    const parts=[{text:prompt}];
    (CUR.photos||[]).forEach((p,i)=>{
      if(p.data&&p.data.startsWith('data:')){
        try{
          const b64=p.data.split(',')[1];
          const mime=p.data.split(';')[0].split(':')[1]||'image/jpeg';
          parts.push({inline_data:{mime_type:mime,data:b64}});
          parts.push({text:`[Fotoğraf ${i+1}: ${p.date}, tür:${p.type}${p.note?', not:'+p.note:''}]`});
        }catch(e){}
      }
    });
    
    const apiKey = await window.getGeminiKey();
    if(!apiKey) { toast('Gemini API anahtarı alınamadı.', true); return; }
    const url=`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    const resp=await fetch(url,{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({contents:[{role:'user',parts}],generationConfig:{temperature:0.62,maxOutputTokens:8192}})
    });
    if(!resp.ok){ const err=await resp.json(); throw new Error(err.error?.message||'Gemini '+resp.status); }
    const data=await resp.json();
    const text=data.candidates?.[0]?.content?.parts?.[0]?.text||'Yanıt alınamadı';

    rmLoad();
    const rendered=text
      .replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>')
      .split('\n\n').filter(p=>p.trim())
      .map(p=>`<p style="margin-bottom:10px;">${p.replace(/\n/g,'<br/>')}</p>`)
      .join('');
    const el=document.createElement('div');
    el.className='bubble bb'; el.style.lineHeight='1.78'; el.style.fontSize='13px';
    el.innerHTML=rendered;
    qs('#ai-chat')?.appendChild(el);
    qs('#ai-chat').scrollTop=qs('#ai-chat').scrollHeight;

    // Hafızaya kaydet
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
}

window.sendChat = async () => {
  const inp=qs('#ai-inp'); const msg=inp.value.trim(); if(!msg) return;
  inp.value=''; addB('user',msg); addB('load','');
  
  // Hem anlık hem kalıcı hafıza
  aiHist.push({role:'user',content:msg});
  if(aiHist.length>20) aiHist=aiHist.slice(-20);
  
  const fieldCtx = CUR ? await window.buildFieldContext(CUR) : null;
  const memory = CUR ? window.getAIMemory(CUR.id) : [];
  
  // Konuşma geçmişini oluştur
  const contents = [];
  
  // Sistem bağlamını ilk mesaj olarak ekle
  if(fieldCtx) {
    contents.push({role:'user', parts:[{text:`[TARLA BAĞLAMI — GÜNCEL VERİLER]\n${fieldCtx}\n\nBu bağlamı dikkate alarak aşağıdaki soruları yanıtla. Kısa, pratik, Türkçe.`}]});
    contents.push({role:'model', parts:[{text:`Anladım. ${CUR?.name} tarlası için ${CUR?.crop||'ürün'} verilerini dikkate alıyorum. Sorunuzu alıyorum.`}]});
  }
  
  // Önceki kalıcı hafızadan son 5 mesajı ekle
  if(memory.length > 0) {
    const recentMem = memory.slice(-6);
    recentMem.forEach(m => {
      contents.push({role: m.role==='assistant'?'model':'user', parts:[{text:m.content}]});
    });
  }
  
  // Anlık konuşma geçmişi
  aiHist.slice(-10,-1).forEach(m => {
    contents.push({role:m.role==='assistant'?'model':'user', parts:[{text:m.content}]});
  });
  
  contents.push({role:'user', parts:[{text:msg}]});
  
  try{
    const apiKey = await window.getGeminiKey();
    if(!apiKey) { toast('API anahtarı alınamadı.', true); return; }
    const url=`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({contents,generationConfig:{temperature:0.72,maxOutputTokens:4096}})});
    if(!r.ok){ const e=await r.json(); throw new Error(e.error?.message||'Gemini '+r.status); }
    const d=await r.json();
    const text=d.candidates?.[0]?.content?.parts?.[0]?.text||'Yanıt alınamadı';
    rmLoad(); addB('bot',text);
    aiHist.push({role:'assistant',content:text});
    
    // Kalıcı hafızaya kaydet
    if(CUR) {
      const mem = window.getAIMemory(CUR.id);
      mem.push({role:'user', content:msg, date:tstr()});
      mem.push({role:'assistant', content:text, date:tstr()});
      window.saveAIMemory(CUR.id, mem);
    }
  }catch(e){ rmLoad(); addB('bot','❌ '+e.message); }
}

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
}
window.rmLoad = () => { const el=qs('#ai-load'); if(el) el.remove(); }
window.clrChat = () => {
  const c=qs('#ai-chat'); if(c) c.innerHTML=''; aiHist=[];
  if(CUR) {
    const memLen = window.getAIMemory(CUR.id).length;
    if(memLen > 0) {
      addB('sys', `🧠 ${memLen} mesajlık konuşma hafızası aktif. Geçmiş analizler dikkate alınacak.`);
    }
  }
}
window.clearAIMemory = () => {
  if(!CUR) return;
  if(!confirm('Bu tarlaya ait tüm AI konuşma geçmişi silinecek. Emin misiniz?')) return;
  localStorage.removeItem('tt_aimem_' + CUR.id);
  aiHist = [];
  const c=qs('#ai-chat'); if(c) c.innerHTML='';
  toast('AI konuşma hafızası temizlendi');
}

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
}

// ─── FOTOĞRAF YÖNETİMİ ─────────────────────────────────────────
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
}
window.openPhotoM = () => { pendPh=null; qs('#p-prev').innerHTML=''; qs('#p-ai').innerHTML=''; qs('#p-date').value=tstr(); qs('#p-note').value=''; if(qs('#p-size-info'))qs('#p-size-info').textContent=''; qs('#p-file').value=''; qs('#m-photo').classList.add('on'); }
window.savePhoto = async () => {
  if(!pendPh){ toast('Fotoğraf seçin',true); return; } if(!CUR) return;
  CUR.photos=CUR.photos||[];
  const aiText=qs('#p-ai')?.innerText||'';
  CUR.photos.push({id:gid(),date:qs('#p-date').value||tstr(),type:qs('#p-type').value,note:qs('#p-note').value,data:pendPh,ai:aiText.length>10?aiText:''});
  const fi=DB.fields.findIndex(f=>f.id===CUR.id); if(fi>=0) DB.fields[fi]=CUR;
  await saveFieldToDB(CUR);
  closeM('photo'); pendPh=null; renderPhTab(CUR); toast('Fotoğraf kaydedildi');
}
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
}
window.openPhV = (idx) => {
  if(!CUR?.photos?.[idx]) return;
  curPhIdx=idx; const p=CUR.photos[idx];
  qs('#ph-viewer-img').src=p.data;
  qs('#ph-viewer-info').textContent=`${fd(p.date)} · ${p.type}${p.note?' · '+p.note:''}${p.ai&&p.ai.length>10?'\n🤖 '+p.ai.slice(0,150)+'...':''}`;
  qs('#ph-viewer').classList.add('on');
}
window.closePhViewer = () => { qs('#ph-viewer')?.classList.remove('on'); curPhIdx=null; }
window.editPhNote = () => {
  if(curPhIdx===null||!CUR?.photos?.[curPhIdx]) return;
  const p=CUR.photos[curPhIdx];
  const n=prompt('Notu düzenle:',p.note||''); if(n===null) return;
  p.note=n; saveFieldToDB(CUR);
  qs('#ph-viewer-info').textContent=`${fd(p.date)} · ${p.type}${p.note?' · '+p.note:''}`;
  renderPhTab(CUR); toast('Not güncellendi');
}
window.delCurPh = async () => {
  if(curPhIdx===null||!CUR?.photos) return;
  if(!confirm('Bu fotoğrafı silmek istediğinizden emin misiniz?')) return;
  CUR.photos.splice(curPhIdx,1);
  const fi=DB.fields.findIndex(f=>f.id===CUR.id); if(fi>=0) DB.fields[fi]=CUR;
  await saveFieldToDB(CUR); closePhViewer(); renderPhTab(CUR); toast('Silindi');
}
window.delPhoto = async (idx) => {
  if(!CUR?.photos||!confirm('Bu fotoğrafı silmek istediğinizden emin misiniz?')) return;
  CUR.photos.splice(idx,1);
  const fi=DB.fields.findIndex(f=>f.id===CUR.id); if(fi>=0) DB.fields[fi]=CUR;
  await saveFieldToDB(CUR); renderPhTab(CUR); toast('Silindi');
}

// ─── TARLA CRUD ──────────────────────────────────────────────────
window.fillCrops = () => {
  const cat=qs('#f-cat').value; const list=CROPS[cat]||[];
  const sel=qs('#f-crop');
  sel.innerHTML=list.length?list.map(c=>`<option value="${c}">${c}</option>`).join(''):'<option>Kategori seçin</option>';
  const lbl=qs('#f-qty-lbl'); if(!lbl) return;
  if(['meyve','narenciye','zeytin'].includes(cat)) lbl.textContent='Ağaç / Bitki Adedi';
  else if(['tahil','baklagil','endustri','yembitki'].includes(cat)) lbl.textContent='Tohum Miktarı (kg/da)';
  else lbl.textContent='Miktar';
  
  // Çok yıllık bitki kategorileri için yaş alanını göster
  const ageSection = qs('#f-age-section');
  if(ageSection) {
    const isPerennial = ['meyve','narenciye','zeytin'].includes(cat);
    ageSection.style.display = isPerennial ? 'block' : 'none';
  }
}

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
    // Yeni alanlar
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
  
  // Poligon parse et
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
    // Yeni alanlar
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
}

// ─── DOSYA İMPORT ─────────────────────────────────────────────────
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
}

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
      // Poligon noktaları [lat, lon] formatına çevir
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
}

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
}

window.calcPolyArea = (ring) => {
  if(!ring||ring.length<3) return 0;
  const Rm=6371000; let area=0;
  for(let i=0;i<ring.length-1;i++){
    const [lo1,la1]=ring[i]; const [lo2,la2]=ring[i+1];
    area+=(lo2-lo1)*Math.PI/180*(2+Math.sin(la1*Math.PI/180)+Math.sin(la2*Math.PI/180));
  }
  return Math.abs(area*Rm*Rm/2);
}

// ─── FİREBASE / YEREL DEPOLAMA ─────────────────────────────────
window.saveFieldToDB = async (field) => {
  const clean=JSON.parse(JSON.stringify(field));
  delete clean._soilCache;
  const uid=window.FB_USER?.uid;
  if(uid&&window.FB_MODE){ try{ await window.fbSaveField(uid,clean); }catch(e){ toast('DB kayıt hatası: '+e.message,true); } }
  saveLocalDB();
}
window.deleteFieldFromDB = async (fieldId) => {
  const uid=window.FB_USER?.uid;
  if(uid&&window.FB_MODE){ try{ await window.fbDeleteField(uid,fieldId); }catch(e){ toast('DB silme hatası: '+e.message,true); } }
  saveLocalDB();
}

window.fetchAllSatellites = async () => {
  if(!DB.fields.length) return;
  const results = await Promise.allSettled(DB.fields.map(f => fetchSat(f)));
  const succeeded = results.filter(r=>r.status==='fulfilled').length;
  invSoilAll();
  await computeAllSoils(true);
  await renderAll();
  toast(`🛰️ ${succeeded} tarla için uydu verileri güncellendi.`, false);
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

window.saveLocalDB = () => { try{ localStorage.setItem('tt_fields',JSON.stringify(DB.fields)); }catch(e){} }
window.loadLocalDB = () => { try{ const d=localStorage.getItem('tt_fields'); if(d) DB.fields=JSON.parse(d)||[]; }catch(e){} }
window.saveSettings = () => { DB.s.acuKey=qs('#acu-key')?.value||''; localStorage.setItem('tt_s',JSON.stringify(DB.s)); toast('Kaydedildi'); }
window.loadSettings = () => {
  try{ const s=localStorage.getItem('tt_s'); if(s){ const p=JSON.parse(s); DB.s={...DB.s,...p}; } }catch(e){}
  if(qs('#acu-key')) qs('#acu-key').value=DB.s.acuKey||'';
}
window.expData = () => { const a=document.createElement('a'); a.href='data:application/json;charset=utf-8,'+encodeURIComponent(JSON.stringify({fields:DB.fields},null,2)); a.download='tarim_'+tstr()+'.json'; a.click(); }
window.impData = (e) => { const f=e.target.files[0]; if(!f) return; const r=new FileReader(); r.onload=ev=>{ try{ const d=JSON.parse(ev.target.result); if(d.fields){ DB.fields=d.fields; saveLocalDB(); renderAll(); toast('İçe aktarıldı'); } }catch{ toast('Geçersiz JSON',true); } }; r.readAsText(f); }

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

// ─── KULLANICI GİRİŞİ ───────────────────────────────────────────
window.swAuthTab = (tab, el) => {
  qs('#auth-screen .auth-pane.on')?.classList.remove('on');
  qs('#ap-'+tab)?.classList.add('on');
  qs('#auth-screen .auth-tab.on')?.classList.remove('on');
  el.classList.add('on');
}
window.signGoogle = async () => {
  if(!window.FB_MODE){ noFBNotice(); return; }
  try{ await window.fbSignInGoogle(); }catch(e){ showAErr('login',e.message); }
}
window.signEmail = async (mode) => {
  if(!window.FB_MODE){ noFBNotice(); return; }
  const em=qs(mode==='login'?'#login-email':'#reg-email')?.value;
  const pw=qs(mode==='login'?'#login-pass':'#reg-pass')?.value;
  try{
    if(mode==='login') await window.fbSignInEmail(em,pw);
    else await window.fbRegisterEmail(em,pw);
  }catch(e){ showAErr(mode,e.message); }
}
window.showAErr = (m,msg) => { const el=qs('#'+m+'-err'); if(el){ el.style.display='block'; el.textContent=msg; } }
window.noFBNotice = () => { qs('#no-fb-note').style.display='block'; qs('#auth-form-wrap').style.display='none'; }
window.enterLocalMode = () => {
  LOCAL=true; qs('#auth-screen').classList.add('hidden');
  loadLocalDB();
  DB.fields.forEach(f=>fetchWX(f));
  renderAll();
  fetchAllSatellites().catch(e=>console.warn('Uydu çekim hatası:', e));
  toast('Yerel modda çalışıyorsunuz');
}
window.doSignOut = async () => { if(window.FB_MODE&&window.FB_USER) await window.fbSignOut(); else{ LOCAL=false; DB.fields=[]; } qs('#auth-screen')?.classList.remove('hidden'); }

window.onAuthChange = async (user) => {
  if(user){
    qs('#auth-screen').classList.add('hidden');
    updateChip(user);
    await syncFromDB();
  }else{
    if(!LOCAL) qs('#auth-screen')?.classList.remove('hidden');
  }
};
window.updateChip = (user) => {
  if(!user) return;
  const av=qs('#user-avatar'); const nm=qs('#user-name');
  if(user.photoURL) av.innerHTML=`<img src="${user.photoURL}" style="width:22px;height:22px;border-radius:50%;"/>`;
  else av.textContent=(user.displayName||user.email||'?')[0].toUpperCase();
  if(nm) nm.textContent=user.displayName||user.email||'';
  const ai=qs('#account-info');
  if(ai) ai.innerHTML=`<div style="font-size:13px;"><strong>${user.displayName||''}</strong><br/>${user.email||''}</div>`;
}

// ─── RENDER FONKSİYONLARI ───────────────────────────────────────
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
    d.innerHTML = `<div class="fi-dot" style="background:${f.color||'#40916c'};"></div><div class="fi-info"><div class="fi-name">${f.name}</div><div class="fi-sub">${f.crop||'Ürün yok'} · <span class="tag ${sc.tag}" style="font-size:9px;">${sc.l} %${s.surface?.pct||s.pct}%</span></div></div>`;
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
    ${field.crop?`<span class="tag tg">${field.crop}</span>`:''}
    ${field.qty?`<span class="tag tgr">${field.qty} ${field.qunit}</span>`:''}
    <span class="tag tgr">${field.area} ${field.areaUnit||'dönüm'}</span>
    ${field.location?`<span class="tag tgr">📍 ${field.location}</span>`:''}
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
}

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
  df.innerHTML = fieldsWithSoil.map(({f,s,sc,ph,he})=>{
    return`<div class="evrow" style="cursor:pointer;" onclick="showField('${f.id}')">
      <div class="evico" style="background:${f.color||'#40916c'}22;font-size:14px;">🌿</div>
      <div class="evbody">
        <div class="evtitle">${f.name} ${f.status==='fallow'?'<span class="tag ta">Nadas</span>':f.status==='planned'?'<span class="tag tb">Planlanan</span>':''}</div>
        <div class="evsub">${f.crop||'Ürün yok'} · ${f.area}${f.areaUnit||'dön'} · ${f.location||'—'}</div>
        ${ph?`<div class="evsub" style="margin-top:2px;">📍 ${ph.stage}${he&&!he.already?' · Hasat ~'+he.daysLeft+'g':he?.already?' · 🟢 Hasat zamanı!':''}</div>`:''}
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:3px;">
        <span class="tag ${sc.tag}">${sc.l}</span>
        <span style="font-size:10px;color:var(--text3);">Yüzey %${s.surface.pct}</span>
        <span style="font-size:10px;color:var(--text3);">Derin %${s.deep.pct}</span>
      </div>
    </div>`;
  }).join('');
  const allEvs = [];
  DB.fields.forEach(f=>(f.events||[]).filter(e=>!e.planned).forEach(e=>allEvs.push({...e,fn:f.name})));
  allEvs.sort((a,b)=>b.date.localeCompare(a.date));
  qs('#devents').innerHTML = allEvs.slice(0,4).map(e=>`<div class="evrow"><div class="evico" style="background:${EVC[e.type]||'#eee'};font-size:12px;">${EVI[e.type]||'📝'}</div><div class="evbody"><div class="evtitle">${e.fn} — ${e.type}</div><div class="evsub">${fd(e.date)}${e.notes?' · '+e.notes.slice(0,40):''}</div></div>${e.total?`<span class="evcost">${Math.round(e.total).toLocaleString()}₺</span>`:''}</div>`).join('')||'<div style="color:var(--text3);font-size:13px;">Kayıt yok.</div>';
  const planned = [];
  DB.fields.forEach(f=>(f.events||[]).filter(e=>e.planned&&e.date>=tstr()).forEach(e=>planned.push({...e,fn:f.name,fc:f.color})));
  planned.sort((a,b)=>a.date.localeCompare(b.date));
  qs('#dplanned').innerHTML = planned.slice(0,4).map(e=>`<div class="evrow"><div class="evico" style="background:${e.fc||'#40916c'}22;font-size:13px;">${EVI[e.type]||'📝'}</div><div class="evbody"><div class="evtitle">${e.fn} — ${e.type}</div><div class="evsub">${fd(e.date)}</div></div></div>`).join('')||'<div style="color:var(--text3);font-size:13px;">Planlanan görev yok.</div>';
};

// ─── GELİŞMİŞ RAPORLAMA SİSTEMİ ────────────────────────────────
window.REP_FILTER = { period: 'all', year: new Date().getFullYear(), month: null };

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
  const f = REP_FILTER;
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
  
  // Filtre UI
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
  
  // Filtrelenmiş olaylar
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

  // Tarla bazlı
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
  
  // Aylık trend (seçilen yıl için)
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
  
  // Tekrar eden kayıtlar (aynı tip, benzer tarihler)
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
  
  // Aylık bar chart HTML
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
  <!-- KPI'lar -->
  <div class="krow" style="margin-bottom:14px;">
    <div class="kpi" style="border-left:3px solid var(--red);"><div class="kpi-l">💸 Toplam Maliyet</div><div class="kpi-v">${Math.round(totalCost).toLocaleString('tr-TR')}</div><div class="kpi-s">₺ · ${getRepLabel()}</div></div>
    <div class="kpi" style="border-left:3px solid var(--green2);"><div class="kpi-l">💰 Toplam Gelir</div><div class="kpi-v">${Math.round(totalRevenue).toLocaleString('tr-TR')}</div><div class="kpi-s">₺</div></div>
    <div class="kpi" style="border-left:3px solid ${totalProfit>=0?'var(--green2)':'var(--red)'};"><div class="kpi-l">📈 Net Kar/Zarar</div><div class="kpi-v" style="color:${totalProfit>=0?'var(--green2)':'var(--red)'};">${Math.round(totalProfit).toLocaleString('tr-TR')}</div><div class="kpi-s">₺${ta?' · '+(Math.round(totalProfit/ta).toLocaleString())+'₺/birim':''}</div></div>
    <div class="kpi"><div class="kpi-l">📋 Toplam Kayıt</div><div class="kpi-v">${allFilteredEvs.length}</div><div class="kpi-s">işlem</div></div>
  </div>
  
  <!-- Aylık Trend -->
  <div class="card">
    <div class="ct">📊 Aylık Maliyet & Gelir Trendi (${filter.year}) <span style="font-size:10px;color:var(--text3);margin-left:6px;">🟥 Maliyet 🟩 Gelir — rakam = işlem sayısı</span></div>
    <div style="display:flex;gap:2px;height:100px;align-items:flex-end;">${monthBars}</div>
  </div>
  
  <!-- Tarla + Kategori Breakdown -->
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
  
  <!-- Tekrar Eden Kayıtlar -->
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
  
  <!-- Özet Tablo -->
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
  // Hava geçmişini arka planda çek
  setTimeout(()=>fetchWXHistory(CUR), 1000);
};

window.renderFieldPage = (field) => {
  CUR=field;
  qs('#fp-name').textContent=field.name;
  renderFKPIs(field);
  goTab('map');
}

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
document.querySelectorAll('.tab').forEach(t=>t.addEventListener('click',()=>goTab(t.dataset.t)));

window.closeM = (id) => { qs('#m-'+id)?.classList.remove('on'); }

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
}

// ─── AI HASTALIK & ZARARLI ANALİZİ ─────────────────────────────
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
    const apiKey = await window.getGeminiKey();
    if(!apiKey){ el.innerHTML='<div style="color:var(--red);font-size:12px;">API anahtarı alınamadı.</div>'; return; }
    const url=`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    const resp = await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({contents:[{role:'user',parts:[{text:prompt}]}],generationConfig:{temperature:0.55,maxOutputTokens:1500}})});
    if(!resp.ok){ const err=await resp.json(); throw new Error(err.error?.message||resp.status); }
    const data = await resp.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text||'Yanıt alınamadı';
    const rendered = text.replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>').split('\n').map(l=>l.trim()?`<div style="margin-bottom:5px;">${l}</div>`:'').join('');
    el.innerHTML=`<div class="bubble bb" style="font-size:12px;line-height:1.6;margin-top:4px;">${rendered}</div>`;
  }catch(e){ el.innerHTML=`<div style="color:var(--red);font-size:12px;">AI Hata: ${e.message}</div>`; }
};

// ─── OTOMATİK YENİLEME ─────────────────────────────────────────
setInterval(async () => {
  invSoilAll();
  const toFetch = DB.fields.filter(f=>!WXC[f.id]||(Date.now()-WXC[f.id].at>1800000));
  await Promise.allSettled(toFetch.map(f=>fetchWX(f)));
  await renderSB(); await renderDash();
  if(CUR&&qs('#page-field.on')){
    await renderFKPIs(CUR);
    if(curTab==='soil') await renderSoil(CUR);
    if(curTab==='rec') await renderRecTab(CUR);
  }
}, 600000);

setInterval(async () => {
  if(window.FB_USER&&window.FB_MODE){
    try{
      const fields = await window.fbLoadFields(window.FB_USER.uid);
      if(fields?.length){ window.DB.fields=fields; saveLocalDB(); invSoilAll(); await renderSB(); await renderDash(); if(window.CUR){ const u=window.DB.fields.find(f=>f.id===window.CUR.id); if(u) window.CUR=u; } }
    }catch(e){}
  }
}, 300000);

// Her saat hava geçmişini güncelle
setInterval(() => {
  if(DB.fields.length) DB.fields.forEach(f=>fetchWXHistory(f).catch(()=>{}));
}, 3600000);

// Alias
window.importFieldFile = window.importFF;
window.deleteCurrentPh = window.delCurPh;

// ─── TOPRAK TİPİ TAHMİNİ (SoilGrids) ─────────────────────────
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

// ─── BAŞLATMA ──────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded',()=>{
  const th=localStorage.getItem('tt_theme'); if(th==='dark') document.documentElement.setAttribute('dark','');
  loadSettings();
  setTimeout(()=>{ if(!window.FB_MODE) noFBNotice(); }, 1500);
  qs('#main')?.addEventListener('click',()=>{ if(window.innerWidth<=768) qs('#sb')?.classList.remove('open'); });
  document.addEventListener('keydown',e=>{ if(e.key==='Escape') closePhViewer(); });
  if(!window.FB_USER&&DB.fields.length) fetchAllSatellites().catch(e=>console.warn('Başlangıç uydu hatası:', e));
});
