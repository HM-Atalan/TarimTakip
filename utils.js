// ============================================================
// utils.js – Genel yardımcı fonksiyonlar
// ============================================================

const qs = s => document.querySelector(s);
const gid = () => Date.now().toString(36) + Math.random().toString(36).slice(2,6);

window.dateKey = (date = new Date()) => {
  const d = new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

window.tstr = () => window.dateKey();

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

  // Fiziksel güvenlik sınırı: tek uygulamada yüzey tarla kapasitesinin
  // 1.5 katını aşan giriş, muhtemelen yanlış birim/yazım hatasıdır.
  const maxSingleApp = Math.max(1, fcs) * 1.5;
  if(mm > maxSingleApp) {
    console.warn(`⚠️ Sulama girişi mantık dışı yüksek (${mm.toFixed(1)}mm) → ${maxSingleApp.toFixed(0)}mm ile sınırlandırıldı.`, evt);
  }
  return Math.max(0, Math.min(mm, maxSingleApp));
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
