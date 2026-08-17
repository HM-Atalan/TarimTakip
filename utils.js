// ============================================================
// utils.js – Genel yardımcı fonksiyonlar
// ============================================================

const qs = s => document.querySelector(s);
const gid = () => Date.now().toString(36) + Math.random().toString(36).slice(2,6);

window.esc = (value) => String(value ?? '')
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;').replaceAll("'", '&#39;');

// AI çıktısı önce tamamen kaçırılır; yalnız kontrollü kalın yazı ve satır
// sonları tekrar HTML'e çevrilir. Böylece model çıktısı kod çalıştıramaz.
window.safeAIHtml = (value) => window.esc(value)
  .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  .replace(/\r?\n/g, '<br>');

window.safeCssColor = (value, fallback = '#40916c') => {
  const color = String(value || '').trim();
  return /^(#[0-9a-f]{3,8}|rgba?\([\d.,%\s]+\)|hsla?\([\d.,%\s]+\))$/i.test(color) ? color : fallback;
};

window.safeHttpUrl = (value) => {
  try {
    const url = new URL(String(value || ''), window.location?.href || 'https://localhost/');
    return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
  } catch (_) { return ''; }
};

window.safePhotoUrl = (value) => {
  const raw = String(value || '');
  if(/^data:image\/(jpeg|png|webp);base64,[a-z0-9+/=]+$/i.test(raw)) return raw;
  return window.safeHttpUrl(raw);
};

window.dateKey = (date = new Date()) => {
  const d = new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

window.tstr = () => window.dateKey();

// FAO-56 Eq. 52 (Hargreaves) fallback for days where the primary
// Penman-Monteith ET0 value is genuinely unavailable. Ra is calculated in
// MJ m-2 day-1 and converted to equivalent evaporation (mm day-1).
window.calcFallbackET0 = (dayWx, latitude) => {
  const tmax = Number(dayWx?.tmax);
  const tmin = Number(dayWx?.tmin);
  const lat = Number(latitude);
  const date = new Date(`${dayWx?.date || ''}T12:00:00`);
  if (![tmax, tmin, lat].every(Number.isFinite) || Number.isNaN(date.getTime()) || tmax < tmin) return 0;

  const start = new Date(date.getFullYear(), 0, 0);
  const doy = Math.floor((date - start) / 86400000);
  const phi = Math.max(-90, Math.min(90, lat)) * Math.PI / 180;
  const dr = 1 + 0.033 * Math.cos((2 * Math.PI / 365) * doy);
  const delta = 0.409 * Math.sin((2 * Math.PI / 365) * doy - 1.39);
  const acosArg = Math.max(-1, Math.min(1, -Math.tan(phi) * Math.tan(delta)));
  const ws = Math.acos(acosArg);
  const raMJ = (24 * 60 / Math.PI) * 0.0820 * dr
    * (ws * Math.sin(phi) * Math.sin(delta) + Math.cos(phi) * Math.cos(delta) * Math.sin(ws));
  const raMm = Math.max(0, raMJ) * 0.408;
  const tmean = (tmax + tmin) / 2;
  return Math.max(0, 0.0023 * (tmean + 17.8) * Math.sqrt(Math.max(0, tmax - tmin)) * raMm);
};

window.resolveDailyET0 = (dayWx, field) => {
  if (Number.isFinite(dayWx?.et0) && dayWx.et0 >= 0) {
    return { value: dayWx.et0, source: 'fao56-penman-monteith' };
  }
  return {
    value: window.calcFallbackET0(dayWx, field?.lat),
    source: 'fao56-hargreaves-fallback',
  };
};

window.calcEffectiveRain = (rainValue) => {
  const rain = Math.max(0, Number(rainValue) || 0);
  const coefficient = rain > 30 ? 0.70 : rain > 15 ? 0.82 : rain > 5 ? 0.92 : 1.0;
  return rain * coefficient;
};

const fd = s => s ? new Date(s+'T12:00:00').toLocaleDateString('tr-TR',{day:'numeric',month:'short',year:'numeric'}) : '—';

window.toast = (msg, err=false) => {
  const t = qs('#toast'); if(!t) return;
  t.textContent = msg;
  t.style.borderLeftColor = err ? 'var(--red)' : 'var(--green2)';
  t.classList.add('on');
  setTimeout(() => t.classList.remove('on'), 2800);
};

window.togSB = () => { qs('#sb').classList.toggle('open'); };
window.clSBmob = () => { if(window.innerWidth<=768) qs('#sb')?.classList.remove('open'); };
window.togTheme = () => {
  const d = document.documentElement;
  d.toggleAttribute('dark');
  localStorage.setItem('tt_theme', d.hasAttribute('dark') ? 'dark' : 'light');
};

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
};

window.areaToDecare = (field) => {
  const area = Math.max(0, parseFloat(field?.area) || 0);
  const unit = field?.areaUnit || 'dönüm';
  if(unit === 'hektar') return area * 10;
  if(unit === 'm²' || unit === 'm2') return area / 1000;
  return area;
};

// ─── SULAMA MİKTARI → mm DÖNÜŞÜMÜ ──────────────────────────────
// KURAL: Event formundaki (index.html #e-unit) tüm birimler DÖNÜM
// BAŞINA girilir ("kg/da veya lt/da" vb. etiketlerle tutarlı).
// Büyüklüğe göre tahmin YAPILMAZ — her birim sabit, fiziksel bir
// katsayıyla mm'ye çevrilir. 1 dönüm = 1000 m² olduğundan:
//   1000 kg (=1000 lt su, yoğunluk≈1) / dönüm = 1mm
//   1 ton / dönüm = 1mm
// "toplam" seçeneği (Toplam (mm)) doğrudan mm derinliği ifade eder.
window.parseIrrMm = (evt, fcs, field = null) => {
  const qty = parseFloat(evt.qty) || 0;
  const u   = (evt.unit || '').toLowerCase().trim();
  const sm  = evt.extra?.['e-sm'] || '';
  const sd  = parseFloat(evt.extra?.['e-sd']) || 0;

  if(qty <= 0) return 0;

  let mm = 0;

  switch(u) {
    case 'mm':
    case 'toplam':          // "Toplam (mm)" — sulamada doğrudan mm derinliği
      mm = qty;
      break;
    case 'ton':              // ton / dönüm → 1 ton/da = 1mm
      mm = qty;
      break;
    case 'kg':                // kg / dönüm
    case 'lt':                  // litre / dönüm
    case 'dönüm':                // ₺/Dönüm seçilip miktar alanı da /da girilmişse
      mm = qty / 1000;           // 1000 kg veya lt / dönüm = 1mm
      break;
    case 'saat': {
      const debit = sm.includes('Damla')    ? 2.0
        : sm.includes('Yağmurlama')         ? 5.0
        : (sm.includes('Salma') || sm.includes('Karık')) ? 8.0
        : sm.includes('Mikro')              ? 1.5 : 3.0;
      const hours = sd > 0 ? sd : qty;
      mm = hours * debit;
      break;
    }
    case 'adet':
      console.warn('⚠️ Sulama "adet" birimiyle girilmiş; mm hesaplanamaz, 0 kabul edildi. Lütfen mm, saat, kg/da, lt/da veya ton/da girin.');
      mm = 0;
      break;
    default:
      // Bilinmeyen/boş birim: en güvenli varsayım doğrudan mm kabul etmektir,
      // büyüklüğe göre tahmin yapılmaz.
      mm = qty;
  }

  // Anormal values are reported but not silently changed. Mutating a recorded
  // event breaks both data integrity and the water ledger; validation belongs
  // in the UI, while the model must account for the entered amount.
  const maxSingleApp = Math.max(1, fcs) * 1.5;
  if(mm > maxSingleApp) {
    console.warn(`⚠️ Sulama girişi olağandışı yüksek (${mm.toFixed(1)}mm; uyarı eşiği ${maxSingleApp.toFixed(0)}mm). Değer değiştirilmeden muhasebeleştirildi.`, evt);
  }
  return Math.max(0, mm);
};

window.calcMoistureState = (fc, taw, Dr) => {
  const fcSafe = Math.max(1, Number(fc) || 1);
  const tawSafe = Math.max(1, Number(taw) || 1);
  const drSafe = Math.max(0, Math.min(tawSafe, Number(Dr) || 0));
  const moist = Math.max(0, Math.min(fcSafe, fcSafe - drSafe));
  return {
    Dr: +drSafe.toFixed(1),
    moist: Math.round(moist),
    pct: Math.max(0, Math.min(100, Math.round((moist / fcSafe) * 100))),
  };
};

window.normalizeRZWBRecord = (rec, params) => {
  if(!rec) return rec;
  const surf = window.calcMoistureState(params.fcs, params.taw_s, rec.Dr_s);
  const deep = window.calcMoistureState(params.fcd, params.taw_d, rec.Dr_d);
  return {
    ...rec,
    Dr_s: surf.Dr,
    Dr_d: deep.Dr,
    pct_s: surf.pct,
    pct_d: deep.pct,
    moist_s: surf.moist,
    moist_d: deep.moist,
  };
};

// ─── Kayıt eksiklik kontrolü ────────────────────────────────────
// percDeep (kök-altı drenaj) alanı da artık zorunlu; eski kayıtlarda
// bu alan yoksa "eksik" sayılıp otomatik onarım (repair) mekanizması
// tarafından yeniden hesaplanacak.
// 'surplus_s'/'surplus_d' kontrolü de eklendi: kademeli yerçekimi
// drenajı (bkz. soilModel.js rzwbStep) öncesi, eski formülle hesaplanmış
// kayıtları yakalayıp otomatik yeniden hesaplama tetikler — böylece
// mevcut kullanıcıların ledger'ı yeni fizik mantığına sorunsuz geçer.
window.isIncompleteRZWBRecord = (rec, expectedIrr) => {
  if(!rec) return true;
  // DÜZELTME (FAZ 3.1): Uydu "bootstrap anchor" kayıtları rzwbStep
  // tarafından ÜRETİLMEZ (kasıtlı — bkz. calcSoilRZWB Approach B),
  // bu yüzden ETc_s/ETc_d gibi alanlar bu kayıtlarda anlamlı biçimde
  // 0'dır. Aşağıdaki "eksik alan" sezgisi bunu YANLIŞLIKLA "bozuk
  // kayıt" sanmasın diye, açıkça işaretlenmiş anchor kayıtları erken
  // döner. BU KONTROL source ALANI OLMAYAN (tüm eski/normal) kayıtların
  // davranışını HİÇ DEĞİŞTİRMEZ — sadece source==='satellite-anchor'
  // olanları atlar (geriye dönük uyumlu, ek/opsiyonel alan).
  if (rec.source === 'satellite-anchor') return false;
  const fieldsMissing = ['Pe', 'ETc_s', 'ETc_d', 'Ks_s', 'Ks_d', 'percDeep', 'surplus_s', 'surplus_d']
    .some(k => rec[k] === undefined || rec[k] === null)
    || ((rec.ETc_s ?? 0) === 0 && (rec.ETc_d ?? 0) === 0);
  if(fieldsMissing) return true;
  if(expectedIrr !== undefined) {
    const recIrr = +(rec.irr ?? 0).toFixed(1);
    const expIrr = +(expectedIrr ?? 0).toFixed(1);
    if(Math.abs(recIrr - expIrr) > 0.1) return true;
  }
  return false;
};

window.setBadge = (barId, id, cls, lbl) => {
  const bar = qs('#'+barId); if(!bar) return;
  let el = qs('#wb-'+barId+'-'+id);
  if(!el){ el=document.createElement('span'); el.id='wb-'+barId+'-'+id; el.className='wxbadge'; bar.appendChild(el); }
  el.className = 'wxbadge '+cls;
  el.innerHTML = (cls==='load' ? '<span class="spin"></span>' : '') + lbl;
};

window.wicon = (c) => {
  if(c===undefined) return'🌤️';if(c<=1)return'☀️';if(c<=3)return'⛅';
  if(c<=49)return'🌫️';if(c<=67)return'🌧️';if(c<=77)return'❄️';if(c<=82)return'🌦️';return'⛈️';
};

// (diğer yardımcı fonksiyonlar buraya eklenebilir)

// ============================================================
// FAZ 4 — Ledger normalizasyonu: sıralama + tekilleştirme
// ============================================================
// ÖNCELİK 1-4 (FAZ 4 görev tanımı):
//   1) Ledger her zaman tarih sırasına göre normalize edilmeli.
//   2) Firebase veya localStorage kayıt sırasına güvenilmemeli.
//   3) En son kayıt, KRONOLOJİK olarak en son kayıt olmalı
//      (dizideki son eleman değil).
//   4) Duplicate date kayıtları kontrol edilmeli.
//
// Bu fonksiyon SAF'tır (DOM/ağ/Firebase'e dokunmaz) — bir ledger
// dizisini alır, temizlenmiş+sıralanmış+tekilleştirilmiş halini döner.
// calcSoilRZWB, ledger'ı HER YÜKLEDİĞİNDE ve HER DEĞİŞTİRDİĞİNDE bunu
// çağırır; böylece "lastRec = ledger[ledger.length-1]" ifadesi HER
// ZAMAN gerçekten kronolojik olarak en son kaydı verir — dizinin
// Firebase/localStorage'dan hangi SIRADA geldiğinden bağımsız olarak.
window.normalizeRZWBLedger = (ledger, fieldLabel) => {
  const removed = [];
  if (!Array.isArray(ledger)) return { ledger: [], removed };

  const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

  // (5) Bozuk/yapısal olarak geçersiz kayıtları tespit et: tarih alanı
  // yoksa veya geçerli YYYY-MM-DD formatında değilse, bu kayıt
  // sıralanamaz/karşılaştırılamaz — güvenle atılır (o tarih için gün
  // zaten eksik sayılıp normal simülasyon/repair akışıyla yeniden
  // üretilecektir, yeni bir mekanizma İCAT EDİLMEDİ).
  const valid = ledger.filter(rec => {
    const ok = rec && typeof rec.date === 'string' && DATE_RE.test(rec.date);
    if (!ok) removed.push({ reason: 'invalid-record', record: rec });
    return ok;
  });

  // (1)(2)(3) Tarihe göre KARARLI (stable) sırala. Array.prototype.sort
  // ES2019'dan beri stabildir — aynı tarihli kayıtlar arasında ORİJİNAL
  // (yükleme sırasındaki) göreli sırayı korur; bu, aşağıdaki tekilleştirme
  // adımında "sonraki = muhtemelen daha güncel yazılan" varsayımını
  // güvenle kullanmamızı sağlar.
  const sorted = [...valid].sort((a, b) => a.date.localeCompare(b.date));

  // (4) Aynı tarihte birden fazla kayıt (duplicate) varsa tekilleştir:
  //   - biri 'satellite-anchor' ise HER ZAMAN O tercih edilir (gözlemsel
  //     ground-truth, simüle edilmiş bir kayıttan daha güvenilir).
  //   - aksi halde, stable sort sayesinde SONRAKİ (daha yeni yazılmış
  //     olma ihtimali yüksek) kayıt tercih edilir.
  const byDate = new Map();
  for (const rec of sorted) {
    const existing = byDate.get(rec.date);
    if (!existing) { byDate.set(rec.date, rec); continue; }
    const preferNew = rec.source === 'satellite-anchor' || existing.source !== 'satellite-anchor';
    if (preferNew) {
      removed.push({ reason: 'duplicate-date', record: existing, keptDate: rec.date });
      byDate.set(rec.date, rec);
    } else {
      removed.push({ reason: 'duplicate-date', record: rec, keptDate: existing.date });
    }
  }

  const clean = Array.from(byDate.values()); // Map insertion sırası = tarih sırası (korunur)

  if (removed.length) {
    console.warn(
      `⚠️ RZWB ledger normalize [${fieldLabel || '?'}]: ${removed.length} kayıt temizlendi ` +
      `(geçersiz/duplicate).`,
      removed.map(r => ({ reason: r.reason, date: r.record?.date }))
    );
  }

  return { ledger: clean, removed };
};
