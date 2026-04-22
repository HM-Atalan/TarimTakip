// TarlaTakip — Ana Script (Gelişmiş: ET₀+Kc, Nadas, Verim Tahmini)
// Güncellenme: Otomatik uydu/agro verisi çekimi eklendi, kod temizlendi.

window.DB = { fields: [], s: { acuKey: '' } };
window.SOIL_CACHE = { data: null, lastUpdated: 0 };
window.CUR = null;
window.WXC = {};
window.SATC = {};
window.SC = {};
window.lmap = null;
window.aiHist = [];
window.pendPh = null;
window.curTab = 'map';
window.curPhIdx = null;
window.LOCAL = false;

// ──────────────────────────────────────────────────────────────────
// Yardımcı fonksiyonlar
// ──────────────────────────────────────────────────────────────────
const qs = s => document.querySelector(s);
const gid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
window.tstr = () => new Date().toISOString().slice(0, 10);
const fd = s => s ? new Date(s + 'T12:00:00').toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

window.toast = (msg, err = false) => {
  const t = qs('#toast');
  if (!t) return;
  t.textContent = msg;
  t.style.borderLeftColor = err ? 'var(--red)' : 'var(--green2)';
  t.classList.add('on');
  setTimeout(() => t.classList.remove('on'), 2800);
};

window.togSB = () => qs('#sb')?.classList.toggle('open');
window.clSBmob = () => { if (window.innerWidth <= 768) qs('#sb')?.classList.remove('open'); };
window.togTheme = () => {
  const d = document.documentElement;
  d.toggleAttribute('dark');
  localStorage.setItem('tt_theme', d.hasAttribute('dark') ? 'dark' : 'light');
};

// ──────────────────────────────────────────────────────────────────
// Fotoğraf sıkıştırma
// ──────────────────────────────────────────────────────────────────
window.compressImg = (file, maxKB = 150, q = 0.82) => new Promise(resolve => {
  const r = new FileReader();
  r.onload = ev => {
    const img = new Image();
    img.onload = () => {
      const MAX = 1200;
      let w = img.width, h = img.height;
      if (w > MAX || h > MAX) {
        if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
        else { w = Math.round(w * MAX / h); h = MAX; }
      }
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      c.getContext('2d').drawImage(img, 0, 0, w, h);
      let qq = q;
      let d = c.toDataURL('image/jpeg', qq);
      while (d.length > maxKB * 1024 * 1.37 && qq > 0.3) {
        qq -= 0.06;
        d = c.toDataURL('image/jpeg', qq);
      }
      resolve(d);
    };
    img.src = ev.target.result;
  };
  r.readAsDataURL(file);
});

// ──────────────────────────────────────────────────────────────────
// Toprak nem modeli (ET₀+Kc, nadas desteği)
// ──────────────────────────────────────────────────────────────────
window.agrd = (crop) => CROP_AGR[crop] || CROP_AGR.default;

window.computeAllSoils = async (force = false) => {
  const now = Date.now();
  if (!force && window.SOIL_CACHE.data && (now - window.SOIL_CACHE.lastUpdated < 300000)) {
    return window.SOIL_CACHE.data;
  }
  const soilData = await Promise.all(DB.fields.map(async f => {
    window.invSoil(f.id);
    const s = await window.calcSoil(f);
    const sc = window.scl(s.pct);
    const ph = window.calcPheno(f);
    const he = window.calcHarvest(f);
    return { f, s, sc, ph, he };
  }));
  window.SOIL_CACHE = { data: soilData, lastUpdated: Date.now() };
  return soilData;
};

window.calcGDD = (field, untilDate = window.tstr()) => {
  const a = window.agrd(field.crop);
  if (!field.plantDate) return null;
  const wx = window.WXC[field.id]?.days || window.simWX(field.lat, field.lon);
  let acc = 0;
  wx.filter(d => d.date >= field.plantDate && d.date <= untilDate).forEach(d => {
    acc += Math.max(0, Math.min((d.tmax + d.tmin) / 2, a.tm) - a.tb);
  });
  return Math.round(acc);
};

window.calcFieldCapacity = (soilType, clayPct, sandPct, siltPct) => {
  let base = window.SOIL_FC?.[soilType] || 80;
  if (clayPct !== undefined && sandPct !== undefined) {
    let fcCalc = (0.2 * clayPct + 0.05 * siltPct + 0.01 * sandPct) * 2.5;
    fcCalc = Math.min(140, Math.max(40, fcCalc));
    if (!isNaN(fcCalc)) base = fcCalc;
  }
  return base;
};

window.calcSoil = async (field) => {
  const key = field.id + '_' + window.tstr();
  if (window.SC[key]) return window.SC[key];

  const a = window.agrd(field.crop);
  let fc = window.SOIL_FC?.[field.soilType] || a.fc || 80;
  if (field.soilComposition) {
    fc = window.calcFieldCapacity(field.soilType, field.soilComposition.clay, field.soilComposition.sand, field.soilComposition.silt);
  }

  const wx = window.WXC[field.id]?.days || window.simWX(field.lat, field.lon);
  const today = window.tstr();
  const irr = (field.events || []).filter(e => e.type === 'sulama' && !e.planned && e.date <= today).map(e => {
    const qty = parseFloat(e.qty) || 0;
    const u = e.unit || '';
    let mm = 25;
    if (u === 'mm' && qty) mm = qty;
    else if (u === 'lt' && qty) mm = qty / 100;
    else if (u === 'toplam' && qty > 100) mm = qty / 100;
    return { date: e.date, mm: Math.min(mm, fc) };
  });

  let moist;
  const agroSoil = window.SATC[field.id]?.data?.soilM3;
  if (agroSoil !== undefined && agroSoil > 0.01) {
    moist = agroSoil * fc;
  } else {
    const past7Days = wx.filter(d => d.date < today && d.date >= new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10));
    const last7Rain = past7Days.reduce((s, d) => s + d.rain, 0);
    if (last7Rain > 25) moist = fc * 0.80;
    else if (last7Rain > 10) moist = fc * 0.60;
    else if (last7Rain > 2) moist = fc * 0.40;
    else moist = fc * 0.25;
  }

  const log = [];
  wx.filter(d => d.date <= today).forEach(d => {
    let kc = 0.7;
    if (field.status !== 'fallow' && field.plantDate && field.plantDate <= d.date) {
      const gdd = window.calcGDD(field, d.date);
      if (gdd !== null) {
        const a2 = window.agrd(field.crop);
        const gddTarget = a2.gd[a2.gd.length - 1];
        const ratio = Math.min(1, gdd / gddTarget);
        if (a2.kc && a2.kc.length === 4) {
          if (ratio < 0.1) kc = a2.kc[0];
          else if (ratio < 0.5) kc = a2.kc[0] + (a2.kc[1] - a2.kc[0]) * (ratio / 0.5);
          else if (ratio < 0.8) kc = a2.kc[1] + (a2.kc[2] - a2.kc[1]) * ((ratio - 0.5) / 0.3);
          else kc = a2.kc[2] + (a2.kc[3] - a2.kc[2]) * Math.min(1, (ratio - 0.8) / 0.2);
        }
      }
    }
    let et = 0;
    if (field.status === 'fallow') {
      et = (d.et0 || 0) * 0.2;
    } else {
      et = (d.et0 || 0) * kc;
      if (et === 0) {
        const hf = d.tmax > 38 ? 1.45 : d.tmax > 33 ? 1.2 : d.tmax > 28 ? 1.05 : 1.0;
        et = a.et * hf * (d.tmax > a.tm ? 0.6 : 1.0);
      }
    }
    const irD = irr.filter(i => i.date === d.date).reduce((s, i) => s + i.mm, 0);
    const eff = d.rain > 30 ? 0.7 : d.rain > 15 ? 0.85 : 1.0;
    moist = Math.max(0, Math.min(fc, moist + d.rain * eff + irD - et));
    log.push({ date: d.date, rain: +(d.rain).toFixed(1), et: +et.toFixed(1), irr: +irD.toFixed(1), moist: +moist.toFixed(0) });
  });

  const result = { pct: Math.round(moist / fc * 100), moist: +moist.toFixed(0), fc, et: a.et, log };
  window.SC[key] = result;
  return result;
};

window.invSoil = (fid) => {
  Object.keys(window.SC).filter(k => k.startsWith(fid + '_')).forEach(k => delete window.SC[k]);
};
window.invSoilAll = () => { window.SC = {}; };

window.scl = (pct) => {
  if (pct > 78) return { l: 'Islak', tag: 'tb', color: 'var(--blue)', bg: 'var(--bbg)' };
  if (pct > 58) return { l: 'Nemli', tag: 'tg', color: 'var(--green2)', bg: 'var(--glt)' };
  if (pct > 38) return { l: 'Yeterli', tag: 'tgr', color: 'var(--text2)', bg: 'var(--bg3)' };
  if (pct > 20) return { l: 'Kuru', tag: 'ta', color: 'var(--amber)', bg: 'var(--abg)' };
  return { l: 'Kurak', tag: 'tr', color: 'var(--red)', bg: 'var(--rbg)' };
};

// ──────────────────────────────────────────────────────────────────
// Fenoloji & Hasat Tahmini
// ──────────────────────────────────────────────────────────────────
window.calcPheno = (field) => {
  const a = window.agrd(field.crop);
  const gdd = window.calcGDD(field);
  if (gdd === null) return null;
  const days = field.plantDate ? Math.round((Date.now() - new Date(field.plantDate + 'T00:00:00')) / 864e5) : 0;
  let si = a.st.length - 1;
  for (let i = 0; i < a.gd.length; i++) {
    if (gdd < a.gd[i]) { si = i; break; }
  }
  const gs = si > 0 ? a.gd[si - 1] : 0;
  const ge = a.gd[si] || a.gd[a.gd.length - 1];
  const stagePct = Math.min(100, Math.round((gdd - gs) / Math.max(1, ge - gs) * 100));
  const totPct = Math.min(100, Math.round(gdd / (a.gd[a.gd.length - 1] || 1) * 100));
  return { gdd, si, stage: a.st[si] || 'Olgunluk', stagePct, totPct, days, a };
};

window.calcHarvest = (field) => {
  const a = window.agrd(field.crop);
  const gdd = window.calcGDD(field);
  if (!field.plantDate) {
    return field.harvestDate
      ? { estDate: field.harvestDate, daysLeft: Math.round((new Date(field.harvestDate) - Date.now()) / 864e5), conf: 'manuel', gddPct: null }
      : null;
  }
  const gddTarget = a.gd[a.gd.length - 1];
  const remain = Math.max(0, gddTarget - (gdd || 0));
  const wx = window.WXC[field.id]?.days || window.simWX(field.lat, field.lon);
  const fut = wx.filter(d => d.date > window.tstr()).slice(0, 14);
  const avgDGDD = fut.length > 0
    ? fut.reduce((s, d) => s + Math.max(0, Math.min((d.tmax + d.tmin) / 2, a.tm) - a.tb), 0) / fut.length
    : Math.max(1, a.to - a.tb) * 0.55;
  const dGDD = avgDGDD > 0 ? Math.round(remain / avgDGDD) : a.td;
  const dCal = Math.max(0, a.td - Math.round((Date.now() - new Date(field.plantDate + 'T00:00:00')) / 864e5));
  const blend = Math.round(dGDD * 0.65 + dCal * 0.35);
  const est = new Date(); est.setDate(est.getDate() + blend);
  const conf = window.WXC[field.id] && fut.length >= 7 ? 'yüksek' : fut.length >= 3 ? 'orta' : 'düşük';
  const gddPct = Math.min(100, Math.round((gdd || 0) / gddTarget * 100));
  let dev = null;
  if (field.harvestDate) dev = blend - Math.round((new Date(field.harvestDate) - Date.now()) / 864e5);
  return { estDate: est.toISOString().slice(0, 10), daysLeft: blend, conf, gddAcc: gdd || 0, gddTarget, gddPct, manDate: field.harvestDate || null, dev, already: blend <= 0 };
};

// ──────────────────────────────────────────────────────────────────
// Hava Durumu (Open‑Meteo + AccuWeather)
// ──────────────────────────────────────────────────────────────────
window.wicon = (c) => {
  if (c === undefined) return '🌤️';
  if (c <= 1) return '☀️';
  if (c <= 3) return '⛅';
  if (c <= 49) return '🌫️';
  if (c <= 67) return '🌧️';
  if (c <= 77) return '❄️';
  if (c <= 82) return '🌦️';
  return '⛈️';
};

window.simWX = (lat, lon) => {
  const days = [];
  const now = new Date();
  for (let i = -7; i <= 7; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() + i);
    const sd = ((lat * 100 + lon * 50 + d.getDate() * 3 + d.getMonth() * 17) % 97 + 97) % 97;
    const base = 16 + Math.sin(d.getMonth() / 2) * 13 + (lat > 38 ? -3 : 3);
    const tmax = Math.round(base + sd % 10 - 2);
    const rain = sd < 18 ? +(sd * 1.4).toFixed(1) : sd < 28 ? +((sd - 18) * 0.3).toFixed(1) : 0;
    days.push({
      date: d.toISOString().slice(0, 10), tmax, tmin: tmax - Math.round(5 + sd % 7),
      rain, wind: Math.round(8 + sd % 22), code: rain > 5 ? 63 : rain > 0 ? 80 : sd > 60 ? 2 : 0,
      et0: +((tmax - 5) * 0.15).toFixed(1)
    });
  }
  return days;
};

window.setBadge = (barId, id, cls, lbl) => {
  const bar = qs('#' + barId);
  if (!bar) return;
  let el = qs('#wb-' + barId + '-' + id);
  if (!el) {
    el = document.createElement('span');
    el.id = 'wb-' + barId + '-' + id;
    el.className = 'wxbadge';
    bar.appendChild(el);
  }
  el.className = 'wxbadge ' + cls;
  el.innerHTML = (cls === 'load' ? '<span class="spin"></span>' : '') + lbl;
};

window.fetchWX = async (field) => {
  field = field || window.CUR;
  if (!field) return;
  const id = field.id, lat = field.lat, lon = field.lon;
  window.setBadge('wxsrc', 'om', 'load', 'Open‑Meteo…');
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,windspeed_10m_max,weathercode,et0_fao_evapotranspiration&past_days=7&forecast_days=8&timezone=Europe%2FIstanbul&cell_selection=land`;
    const r = await fetch(url);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const d = await r.json();
    const days = d.daily.time.map((t, i) => ({
      date: t, tmax: Math.round(d.daily.temperature_2m_max[i]), tmin: Math.round(d.daily.temperature_2m_min[i]),
      rain: +(d.daily.precipitation_sum[i] || 0).toFixed(1), wind: Math.round(d.daily.windspeed_10m_max[i]),
      code: d.daily.weathercode[i], et0: +(d.daily.et0_fao_evapotranspiration?.[i] || 0).toFixed(1)
    }));
    window.WXC[id] = { days, src: 'om', at: Date.now() };
    window.setBadge('wxsrc', 'om', 'ok', 'Open‑Meteo ✓');
    window.invSoil(id);
    window.renderWX(field);
    if (qs('#page-dash.on')) window.renderDash();
    if (qs('#page-field.on') && window.CUR?.id === id) window.renderFKPIs(field);
  } catch (e) {
    window.setBadge('wxsrc', 'om', 'err', 'Open‑Meteo: ' + e.message);
    if (!window.WXC[id]) window.WXC[id] = { days: window.simWX(lat, lon), src: 'sim', at: Date.now() };
    window.renderWX(field);
  }

  const ak = window.DB.s.acuKey;
  if (ak) {
    window.setBadge('wxsrc', 'acu', 'load', 'AccuWeather…');
    try {
      const lr = await fetch(`https://dataservice.accuweather.com/locations/v1/cities/geoposition/search?apikey=${ak}&q=${lat}%2C${lon}`);
      if (!lr.ok) throw new Error(lr.status);
      const loc = await lr.json();
      const fr = await fetch(`https://dataservice.accuweather.com/forecasts/v1/daily/5day/${loc.Key}?apikey=${ak}&language=tr-TR&details=true&metric=true`);
      if (!fr.ok) throw new Error(fr.status);
      const fc = await fr.json();
      fc.DailyForecasts.forEach(df => {
        const dt = df.Date.slice(0, 10);
        const ex = window.WXC[id]?.days?.find(d => d.date === dt);
        if (ex) {
          ex.acuMax = Math.round(df.Temperature.Maximum.Value);
          ex.acuMin = Math.round(df.Temperature.Minimum.Value);
          ex.acuRain = df.Day.Rain?.Value || 0;
        }
      });
      window.setBadge('wxsrc', 'acu', 'ok', 'AccuWeather ✓');
      window.invSoil(id);
      window.renderWX(field);
    } catch (e) {
      window.setBadge('wxsrc', 'acu', 'err', 'AccuWeather: ' + e.message);
    }
  }
};

window.renderWX = (field) => {
  const data = window.WXC[field.id];
  if (!data) return;
  const days = data.days, today = window.tstr();
  const past = days.filter(d => d.date < today), futD = days.filter(d => d.date > today), todayD = days.find(d => d.date === today);
  const fmt = d => new Date(d.date + 'T12:00:00').toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
  const cell = d => {
    const tm = d.acuMax ? Math.round((d.tmax + d.acuMax) / 2) : d.tmax;
    const tn = d.acuMin ? Math.round((d.tmin + d.acuMin) / 2) : d.tmin;
    const rn = d.acuRain != null ? +((d.rain + d.acuRain) / 2).toFixed(1) : d.rain;
    return `<div class="wxcell"><div class="wxdate">${fmt(d)}</div><div class="wxicon">${window.wicon(d.code)}</div><div class="wxtemp">${tm}°/${tn}°</div><div class="wxrain">${rn > 0 ? rn + 'mm' : ''}</div><div class="wxwind">${d.wind}km/h</div></div>`;
  };
  const pp = qs('#wx-past'); if (pp) pp.innerHTML = past.map(cell).join('');
  const fp = qs('#wx-fut'); if (fp) fp.innerHTML = futD.map(cell).join('');
  const te = qs('#wx-today');
  if (te && todayD) {
    const tm = todayD.acuMax ? Math.round((todayD.tmax + todayD.acuMax) / 2) : todayD.tmax;
    te.innerHTML = `<div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;padding:6px 0;">
      <div style="font-size:36px;">${window.wicon(todayD.code)}</div>
      <div><div style="font-size:22px;font-weight:800;">${tm}°C</div>
      <div style="color:var(--text2);font-size:13px;">Min: ${todayD.tmin}°C · Yağış: ${todayD.rain}mm · Rüzgar: ${todayD.wind}km/h${todayD.et0 ? ' · ET₀: ' + todayD.et0 + 'mm' : ''}</div></div>
      ${data.src === 'sim' ? '<span class="tag ta">⚠️ Simüle edilmiş veri</span>' : '<span class="tag tg">📡 Gerçek veri</span>'}
    </div>`;
  }
  const totalR = days.reduce((s, d) => s + d.rain, 0), avgT = Math.round(days.reduce((s, d) => s + d.tmax, 0) / days.length);
  const rD = days.filter(d => d.rain > 1).length, totalET = days.reduce((s, d) => s + (d.et0 || 0), 0);
  const se = qs('#wx-sum');
  if (se) se.innerHTML = `<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:9px;">
    <div class="kpi"><div class="kpi-l">14G Yağış</div><div class="kpi-v">${Math.round(totalR)}<small>mm</small></div></div>
    <div class="kpi"><div class="kpi-l">Ort. Maks.</div><div class="kpi-v">${avgT}<small>°C</small></div></div>
    <div class="kpi"><div class="kpi-l">Yağışlı Gün</div><div class="kpi-v">${rD}<small>/14</small></div></div>
    <div class="kpi"><div class="kpi-l">ET₀ Toplam</div><div class="kpi-v">${Math.round(totalET)}<small>mm</small></div></div>
  </div>`;
};

// ──────────────────────────────────────────────────────────────────
// Uydu Motoru (Open‑Meteo Agro, NASA POWER, Sentinel‑2)
// ──────────────────────────────────────────────────────────────────
window.ndviCls = (v) => {
  const n = parseFloat(v);
  if (n > 0.7) return { l: 'Çok İyi', tag: 'tg', color: 'var(--green2)', bar: '#2d6a4f' };
  if (n > 0.5) return { l: 'İyi', tag: 'tg', color: 'var(--green2)', bar: '#40916c' };
  if (n > 0.3) return { l: 'Orta', tag: 'tgr', color: 'var(--text2)', bar: '#888' };
  if (n > 0.15) return { l: 'Zayıf', tag: 'ta', color: 'var(--amber)', bar: '#e67e22' };
  return { l: 'Çok Zayıf', tag: 'tr', color: 'var(--red)', bar: '#e74c3c' };
};

window.fetchSat = async (field, suppressRender = false) => {
  field = field || window.CUR;
  if (!field) return;
  const id = field.id, lat = field.lat, lon = field.lon;
  const sb = (sid, cls, lbl) => window.setBadge('sat-src', sid, cls, lbl);
  if (!suppressRender) {
    sb('agro', 'load', 'Open‑Meteo Agro…');
    sb('nasa', 'load', 'NASA POWER…');
    sb('s2', 'load', 'Sentinel‑2…');
  }
  const R = {};

  // Open‑Meteo Agro
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=soil_temperature_0cm,soil_temperature_6cm,soil_moisture_0_to_1cm,soil_moisture_3_to_9cm,vapor_pressure_deficit,relative_humidity_2m&daily=et0_fao_evapotranspiration,shortwave_radiation_sum&past_days=7&forecast_days=3&timezone=Europe%2FIstanbul`;
    const r = await fetch(url);
    if (r.ok) {
      const d = await r.json();
      const today = window.tstr();
      const ti = d.daily?.time?.indexOf(today) ?? -1;
      const hi = new Date().getHours();
      const hb = (ti >= 0 ? ti : 0) * 24;
      R.soilT0 = d.hourly?.soil_temperature_0cm?.[hb + hi]?.toFixed(1);
      R.soilT6 = d.hourly?.soil_temperature_6cm?.[hb + hi]?.toFixed(1);
      R.soilM3 = d.hourly?.soil_moisture_3_to_9cm?.[hb + hi];
      R.vpd = d.hourly?.vapor_pressure_deficit?.[hb + hi]?.toFixed(2);
      R.humidity = d.hourly?.relative_humidity_2m?.[hb + hi]?.toFixed(0);
      R.et0 = ti >= 0 ? d.daily?.et0_fao_evapotranspiration?.[ti]?.toFixed(1) : null;
      R.solar = ti >= 0 ? d.daily?.shortwave_radiation_sum?.[ti]?.toFixed(1) : null;
      R.past7Solar = d.daily?.shortwave_radiation_sum?.slice(0, 8) || [];
      R.past7Dates = d.daily?.time?.slice(0, 8) || [];
      if (!suppressRender) sb('agro', 'ok', 'Open‑Meteo Agro ✓');
    } else if (!suppressRender) sb('agro', 'err', 'Agro: ' + r.status);
  } catch (e) { if (!suppressRender) sb('agro', 'err', 'Agro: ' + e.message); }

  // NASA POWER
  try {
    const ed = window.tstr().replace(/-/g, '');
    const sdt = new Date(); sdt.setDate(sdt.getDate() - 30);
    const sd = sdt.toISOString().slice(0, 10).replace(/-/g, '');
    const url = `https://power.larc.nasa.gov/api/temporal/daily/point?parameters=ALLSKY_SFC_SW_DWN,T2M_MAX,PRECTOTCORR&community=AG&longitude=${lon}&latitude=${lat}&start=${sd}&end=${ed}&format=JSON`;
    const r = await fetch(url);
    if (r.ok) {
      const d = await r.json();
      const props = d.properties?.parameter || {};
      const solar = props['ALLSKY_SFC_SW_DWN'] || {};
      const dates = Object.keys(solar).sort();
      const last14 = dates.slice(-14);
      R.nasaSolar14 = (last14.reduce((s, k) => s + (solar[k] > 0 ? solar[k] : 0), 0) / Math.max(last14.length, 1)).toFixed(1);
      R.nasaRain30 = Object.values(props['PRECTOTCORR'] || {}).slice(-30).reduce((s, v) => s + (v > 0 ? v : 0), 0).toFixed(1);
      R.nasaDates = last14;
      R.nasaSolarArr = last14.map(k => solar[k]);
      if (!suppressRender) sb('nasa', 'ok', 'NASA POWER ✓');
    } else if (!suppressRender) sb('nasa', 'err', 'NASA: ' + r.status);
  } catch (e) { if (!suppressRender) sb('nasa', 'err', 'NASA: ' + e.message); }

  // Sentinel‑2 STAC
  try {
    const bbox = [lon - 0.01, lat - 0.01, lon + 0.01, lat + 0.01];
    const edt = new Date();
    const sdt2 = new Date(); sdt2.setDate(edt.getDate() - 45);
    const body = {
      collections: ['sentinel-2-l2a'], bbox,
      datetime: sdt2.toISOString().slice(0, 10) + 'T00:00:00Z/' + edt.toISOString().slice(0, 10) + 'T23:59:59Z',
      query: { 'eo:cloud_cover': { lte: 35 } }, limit: 3
    };
    const r = await fetch('https://earth-search.aws.element84.com/v1/search', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (r.ok) {
      const d = await r.json();
      R.s2count = d.features?.length || 0;
      R.s2date = d.features?.[0]?.properties?.datetime?.slice(0, 10) || null;
      R.s2cloud = d.features?.[0]?.properties?.['eo:cloud_cover']?.toFixed(0) || null;
      if (!suppressRender) sb('s2', R.s2count > 0 ? 'ok' : 'err', R.s2count > 0 ? `Sentinel‑2 ✓ (${R.s2count} geçiş, son:${R.s2date})` : 'S2: Uygun görüntü yok');
    } else if (!suppressRender) sb('s2', 'err', 'S2 STAC: ' + r.status);
  } catch (e) { if (!suppressRender) sb('s2', 'err', 'Sentinel‑2: ' + e.message); }

  // NDVI / EVI / NDWI tahmini
  const month = new Date().getMonth() + 1;
  const sf = Math.sin((month - 3) * Math.PI / 6) * 0.2 + 0.7;
  const solf = R.nasaSolar14 ? Math.min(1, parseFloat(R.nasaSolar14) / 25) : 0.7;
  const rainf = R.nasaRain30 ? Math.min(1, parseFloat(R.nasaRain30) / 60) : 0.5;
  const tempf = R.soilT6 ? Math.max(0, Math.min(1, (parseFloat(R.soilT6) - 5) / 25)) : 0.6;
  const a = window.agrd(field.crop);
  const cropf = Math.min(1, (a.to || 22) / 30);
  const ndvi = Math.max(0.05, Math.min(0.95, (sf * 0.3 + solf * 0.25 + rainf * 0.25 + tempf * 0.2) * cropf));
  R.ndvi = ndvi.toFixed(3);
  R.evi = (ndvi * 0.88).toFixed(3);
  const ndwiRaw = (rainf * 0.6 + (R.soilM3 || 0.2) * 0.4) - 0.1;
  R.ndwi = Math.max(-0.5, Math.min(0.8, ndwiRaw)).toFixed(3);
  R.lst = R.soilT0 || R.soilT6 || '—';
  R.isEst = !R.s2date;

  window.SATC[id] = { data: R, at: Date.now() };
  if (!suppressRender) window.renderSat(field, R);
};

window.renderSat = (field, R) => {
  if (!R) return;
  const nc = window.ndviCls(R.ndvi);
  const bar = (v, max, color) => `<div style="height:7px;border-radius:4px;background:var(--bg3);overflow:hidden;margin-top:5px;"><div style="height:100%;width:${Math.min(100, Math.max(0, (parseFloat(v) + 0.5) / (max + 0.5) * 100))}%;background:${color};border-radius:4px;"></div></div>`;

  const nel = qs('#sat-ndvi');
  if (nel) nel.innerHTML = `<div style="text-align:center;padding:8px 0;"><div style="font-size:28px;font-weight:800;color:${nc.color};">${R.ndvi}</div><span class="tag ${nc.tag}" style="margin-top:4px;display:inline-flex;">${nc.l}</span></div>${bar(R.ndvi, 0.95, nc.bar)}<div style="font-size:10px;color:var(--text3);margin-top:4px;">-1 (çıplak) ← 0 → +1 (yoğun bitki)</div><div class="tag ${R.isEst ? 'ta' : 'tg'}" style="font-size:9px;margin-top:5px;display:inline-flex;">${R.isEst ? '⚠️ Model tahmini' : '📡 S2: ' + R.s2date}</div>`;

  const eel = qs('#sat-evi');
  if (eel) eel.innerHTML = `<div style="text-align:center;padding:8px 0;"><div style="font-size:28px;font-weight:800;color:var(--green2);">${R.evi}</div><span class="tag tg" style="margin-top:4px;display:inline-flex;">${parseFloat(R.evi) > 0.4 ? 'İyi Vejetasyon' : 'Gelişmekte'}</span></div>${bar(R.evi, 0.9, 'var(--green2)')}<div style="font-size:10px;color:var(--text3);margin-top:4px;">Atmosfer düzeltmeli (0–0.9)</div>`;

  const nwl = parseFloat(R.ndwi) > 0.3 ? 'Yüksek Su' : parseFloat(R.ndwi) > 0 ? 'Orta' : parseFloat(R.ndwi) > -0.2 ? 'Düşük' : 'Kuru/Stres';
  const wel = qs('#sat-ndwi');
  if (wel) wel.innerHTML = `<div style="text-align:center;padding:8px 0;"><div style="font-size:28px;font-weight:800;color:var(--blue);">${R.ndwi}</div><span class="tag tb" style="margin-top:4px;display:inline-flex;">${nwl}</span></div>${bar((parseFloat(R.ndwi) + 0.5), 1.3, 'var(--blue)')}<div style="font-size:10px;color:var(--text3);margin-top:4px;">Bitki su stresi göstergesi</div>`;

  const lv = parseFloat(R.lst) || 20;
  const lel = qs('#sat-lst');
  if (lel) lel.innerHTML = `<div style="text-align:center;padding:8px 0;"><div style="font-size:28px;font-weight:800;color:${lv > 35 ? 'var(--red)' : lv > 25 ? 'var(--amber)' : 'var(--green2)'};">${R.lst}°C</div><span class="tag ${lv > 35 ? 'tr' : lv > 25 ? 'ta' : 'tg'}" style="margin-top:4px;display:inline-flex;">${lv > 35 ? 'Yüksek Sıcaklık' : lv > 25 ? 'Ilık' : 'Normal'}</span></div><div style="font-size:11px;color:var(--text2);margin-top:5px;">Toprak 0cm: ${R.soilT0 || '—'}°C · 6cm: ${R.soilT6 || '—'}°C${R.vpd ? ' · VPD: ' + R.vpd + 'kPa' : ''}${R.humidity ? ' · Nem: ' + R.humidity + '%' : ''}</div>`;

  const tel = qs('#sat-trend');
  const arr = R.past7Solar?.length ? R.past7Solar : R.nasaSolarArr || [];
  const dts = R.past7Dates?.length ? R.past7Dates : R.nasaDates || [];
  if (tel && arr.length) {
    const mx = Math.max(...arr.filter(v => v > 0), 1);
    const bars = arr.map((v, i) => {
      const p = v > 0 ? Math.round(v / mx * 100) : 0;
      const col = p > 70 ? '#40916c' : p > 40 ? '#e67e22' : '#e74c3c';
      const dt = (dts[i] || '').slice(5);
      return `<div style="display:flex;flex-direction:column;align-items:center;flex:1;min-width:0;"><div style="width:100%;height:60px;background:var(--bg3);border-radius:3px;display:flex;align-items:flex-end;"><div style="width:100%;height:${p}%;background:${col};border-radius:2px;"></div></div><div style="font-size:8px;color:var(--text3);margin-top:2px;white-space:nowrap;">${dt}</div></div>`;
    }).join('');
    tel.innerHTML = `<div style="font-size:11px;color:var(--text2);margin-bottom:8px;">Solar Radyasyon (MJ/m²)${R.nasaRain30 ? ' · 30 günlük yağış: ' + R.nasaRain30 + 'mm' : ''}${R.et0 ? ' · ET₀ bugün: ' + R.et0 + 'mm' : ''}</div><div style="display:flex;gap:3px;height:80px;">${bars}</div><div style="font-size:10px;color:var(--text3);margin-top:5px;">Ort. Solar (14g): ${R.nasaSolar14 || '—'} MJ/m²/gün</div>`;
  }

  const iel = qs('#sat-interp');
  if (iel) {
    const nv = parseFloat(R.ndvi), nw = parseFloat(R.ndwi);
    let msg = '';
    if (nv > 0.6 && nw > 0.1) msg = '✅ Bitki örtüsü yoğun ve su dengesi iyi. Vejetasyon sağlıklı görünüyor.';
    else if (nv > 0.5 && nw < -0.1) msg = '⚠️ İyi NDVI ancak NDWI düşük → su stresi belirtisi. Sulama değerlendirin.';
    else if (nv < 0.3) msg = '🚨 Düşük NDVI → yetersiz bitki örtüsü veya erken gelişim dönemi. Fenoloji ile karşılaştırın.';
    else msg = '🌱 Normal gelişim seyri. Uydu indeksleri dönemle tutarlı.';
    const sm = R.soilM3 ? `Toprak nemi (3-9cm): ${(parseFloat(R.soilM3) * 100).toFixed(0)}%` : '';
    const vpdm = R.vpd ? (parseFloat(R.vpd) > 2.5 ? ' · ⚠️ VPD yüksek (transpirasyon stresi)' : ' · VPD normal') : '';
    iel.innerHTML = `<div class="ritem" style="background:var(--glt);"><div class="rico" style="background:var(--gbg);color:var(--green2);font-size:16px;">🛰️</div><div class="rbody"><div class="rtitle" style="margin-bottom:5px;">Uydu Tabanlı Vejetasyon Değerlendirmesi</div><div class="rsub">${msg}${sm ? '<br/>' + sm + vpdm : ''}</div><div style="font-size:10px;color:var(--text3);margin-top:6px;">NDVI:${R.ndvi} · EVI:${R.evi} · NDWI:${R.ndwi} · LST:${R.lst}°C${R.solar ? ' · Solar:' + R.solar + 'MJ/m²' : ''} · ${R.isEst ? 'Model tahmini' : 'Gerçek uydu verisi'}</div></div></div>`;
  }

  const lnkel = qs('#sat-links');
  if (lnkel) {
    const lat = field.lat, lon = field.lon;
    const bbox = `${(lon - 0.02).toFixed(4)},${(lat - 0.02).toFixed(4)},${(lon + 0.02).toFixed(4)},${(lat + 0.02).toFixed(4)}`;
    lnkel.innerHTML = [
      [`https://apps.sentinel-hub.com/sentinel-playground/?lat=${lat}&lng=${lon}&zoom=14`, '🛰️ Sentinel Playground (Gerçek Renkli / NDVI)'],
      [`https://apps.sentinel-hub.com/eo-browser/?lat=${lat}&lng=${lon}&zoom=14`, '🔬 EO Browser (Çok Bantlı Analiz)'],
      [`https://worldview.earthdata.nasa.gov/?l=HLS_L30_Nadir_BRDF_Adjusted_Reflectance,Reference_Features&t=${window.tstr()}&z=8&v=${bbox}`, '🌍 NASA Worldview (HLS/MODIS)'],
      [`https://power.larc.nasa.gov/data-access-viewer/?lat=${lat}&lng=${lon}`, '⚡ NASA POWER (İklim & Enerji Verisi)'],
      [`https://land.copernicus.eu/global/products/ndvi`, '📊 Copernicus Global NDVI']
    ].map(([u, l]) => `<a href="${u}" target="_blank" class="wxlink">${l}</a>`).join('');
  }
};

// ──────────────────────────────────────────────────────────────────
// Toprak render
// ──────────────────────────────────────────────────────────────────
window.renderSoil = async (field) => {
  const s = await window.calcSoil(field);
  const sc = window.scl(s.pct);
  const wx = window.WXC[field.id]?.days || window.simWX(field.lat, field.lon);
  const futR = wx.filter(d => d.date > window.tstr()).slice(0, 7).reduce((t, d) => t + d.rain, 0);
  const futET = wx.filter(d => d.date > window.tstr()).slice(0, 7).reduce((t, d) => t + (d.et0 || s.et), 0);
  const lastIrr = (field.events || []).filter(e => e.type === 'sulama' && !e.planned).sort((a, b) => b.date.localeCompare(a.date))[0];
  const dsi = lastIrr ? Math.round((Date.now() - new Date(lastIrr.date)) / 864e5) : null;
  const sg = qs('#sg');
  if (sg) sg.innerHTML = `<div style="text-align:center;padding:12px 0 8px;"><div style="font-size:44px;font-weight:800;line-height:1;color:${sc.color};">${s.pct}%</div><div style="margin:4px 0;"><span class="tag ${sc.tag}">${sc.l}</span></div><div style="height:10px;border-radius:5px;background:var(--bg3);overflow:hidden;margin:10px 0 3px;"><div style="height:100%;width:${s.pct}%;border-radius:5px;background:${sc.color};transition:width .6s;"></div></div><div style="display:flex;justify-content:space-between;font-size:10px;color:var(--text3);"><span>0%</span><span>Tarla Kap. ${s.fc}mm</span></div></div><div style="font-size:12px;color:var(--text2);text-align:center;margin-top:4px;">Mevcut: ${s.moist}mm / ${s.fc}mm · ET: ${s.et}mm/g<br/>${dsi !== null ? `Son sulama: ${dsi} gün önce` : 'Sulama kaydı yok'}</div>`;
  const net = futR - futET;
  const rec = s.pct < 20 ? `🚨 ACİL SULAMA! Nem kritik (%${s.pct}).` : s.pct < 35 && net < 0 ? `⚠️ Sulama planla. Nem %${s.pct}, 7g net: ${Math.round(net)}mm.` : s.pct > 78 ? `🌊 Toprak ıslak. Drenaj kontrol edin.` : `✅ Nem dengeli (%${s.pct}). 7g net: ${Math.round(net)}mm`;
  const sw = qs('#sw');
  if (sw) sw.innerHTML = `<div class="ritem" style="background:${sc.bg};"><div class="rico" style="background:${sc.bg};color:${sc.color};">💧</div><div class="rbody"><div class="rtitle">${rec}</div><div class="rsub">Toprak: ${field.soilType} · Ürün ET: ${s.et}mm/g · Beklenen ET₀: ${Math.round(futET)}mm</div></div></div>`;
  const st = qs('#st');
  if (st) {
    const last7 = s.log.slice(-7);
    st.innerHTML = `<div style="overflow-x:auto;"><table class="tbl"><thead><tr><th>Tarih</th><th>Yağış(mm)</th><th>ET(mm)</th><th>Sulama(mm)</th><th>Nem(mm)</th><th>%</th></tr></thead><tbody>${last7.map(d => { const p = Math.round(d.moist / s.fc * 100); const sc2 = window.scl(p); return `<tr><td>${fd(d.date)}</td><td>${d.rain}</td><td>${d.et}</td><td>${d.irr || '—'}</td><td>${d.moist}</td><td><span class="tag ${sc2.tag}">${p}%</span></td></tr>`; }).join('')}</tbody></table></div>`;
  }
};

// ──────────────────────────────────────────────────────────────────
// Harita
// ──────────────────────────────────────────────────────────────────
window.initMap = (lat, lon, field) => {
  if (window.lmap) { window.lmap.remove(); window.lmap = null; }
  const el = qs('#lmap');
  if (!el) return;
  const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap', maxZoom: 19 });
  const sat = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { attribution: '© Esri World Imagery', maxZoom: 18 });
  const topo = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', { attribution: '© OpenTopoMap', maxZoom: 17 });
  window.lmap = L.map('lmap', { zoomControl: true }).setView([lat, lon], 14);
  osm.addTo(window.lmap);
  L.control.layers({ '🗺️ Standart (OSM)': osm, '🛰️ Uydu (Esri)': sat, '🏔️ Topografik': topo }, {}).addTo(window.lmap);
  window.DB.fields.forEach(f => {
    const c = L.circleMarker([f.lat, f.lon], { radius: f.id === field?.id ? 11 : 7, color: f.color || '#40916c', fillColor: f.color || '#40916c', fillOpacity: 0.7, weight: f.id === field?.id ? 3 : 1.5 });
    c.bindPopup(`<b>${f.name}</b><br/>${f.crop || '—'} · ${f.area} ${f.areaUnit || 'dönüm'}`);
    c.addTo(window.lmap);
    if (f.id === field?.id) setTimeout(() => c.openPopup(), 300);
  });
};

window.renderLocInfo = (field) => {
  const el = qs('#fp-locinfo');
  if (!el) return;
  el.innerHTML = `<table class="tbl">
    <tr><td style="color:var(--text3);">Enlem</td><td>${field.lat?.toFixed(5)}°N</td></tr>
    <tr><td style="color:var(--text3);">Boylam</td><td>${field.lon?.toFixed(5)}°E</td></tr>
    <tr><td style="color:var(--text3);">Mevki</td><td>${field.location || '—'}</td></tr>
    <tr><td style="color:var(--text3);">Alan</td><td>${field.area} ${field.areaUnit || 'dönüm'}</td></tr>
    <tr><td style="color:var(--text3);">Ekim/Dikim</td><td>${fd(field.plantDate)}</td></tr>
    <tr><td style="color:var(--text3);">Hasat (Plan)</td><td>${fd(field.harvestDate)}</td></tr>
    ${field.notes ? `<tr><td style="color:var(--text3);">Not</td><td style="font-size:11px;">${field.notes.slice(0, 120)}</td></tr>` : ''}
  </table>`;
  const wl = qs('#fp-wxlinks');
  if (!wl) return;
  const lat = field.lat, lon = field.lon;
  wl.innerHTML = [
    [`https://www.windy.com/?${lat},${lon},13`, '🌬️ Windy.com — Canlı Rüzgar & Yağış'],
    [`https://www.meteoblue.com/tr/hava/week/${lat.toFixed(3)}N${Math.abs(lon).toFixed(3)}E`, '🌤️ Meteoblue — Tarımsal Tahmin'],
    [`https://www.mgm.gov.tr/tahmin/il-ve-ilceler.aspx`, '🇹🇷 MGM — Türkiye Meteorolojisi'],
    [`https://maps.google.com/?q=${lat},${lon}`, '📍 Google Maps\'te Tarla Konumu']
  ].map(([u, l]) => `<a href="${u}" target="_blank" class="wxlink">${l}</a>`).join('');
};

// ──────────────────────────────────────────────────────────────────
// Olaylar (Maliyet, Karlılık)
// ──────────────────────────────────────────────────────────────────
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
    let opt='';
    for(const [g,items] of Object.entries(fg)){
      opt+=`<optgroup label="${g}">${items.map(i=>`<option>${i}</option>`).join('')}</optgroup>`;
    }
    df.innerHTML=`<div class="fr"><div class="fg"><label>Gübre Türü / Ürün</label><select id="e-ft">${opt}</select></div><div class="fg"><label>Uygulama Yöntemi</label><select id="e-fa"><option>Topraktan serpme</option><option>Topraktan karıştırma</option><option>Bant uygulaması</option><option>Fertigasyon (damla ile)</option><option>Yapraktan ilaçlama</option><option>Toprak enjeksiyonu</option><option>Tohum ilaçlama</option></select></div></div><div class="fg"><label>Ticari Ürün / Marka (opsiyonel)</label><input type="text" id="e-fbrand" placeholder="Ürün adı, formülasyon..."/></div>`;
    if(ql)ql.textContent='Miktar (kg/da veya lt/da)'; if(us)us.value='kg'; if(cl)cl.textContent='Birim Fiyat (₺/kg)';
  }else if(type==='ilaç'){
    const pg={
      '── FUNGİSİT (Mantar Hastalıkları) ──':['Bakır Sülfat — Bordo bulamacı','Bakır Hidroksit','Mankozeb','Metalaksil+Mankozeb','Tebukonazol','Trifloksistrobin','Azoksistrobin','Propikonazol','Iprodion','Boskalid','Fenheksamid','Kresoksim-metil','Difenokonazol','Penthiopyrad'],
      '── İNSEKTİSİT (Böcek İlaçları) ──':['İmidakloprid','Tiyametoksam','Asetamiprit','Spirotetramat','Flonikamit','Klorpirfos','Deltametrin','Lambda-sihalotrin','Spinosad','Azadiraktin — Neem özü','Piretrin (doğal)'],
      '── AKARİSİT (Akar/Kene) ──':['Abamektin','Bifenazat','Spiromesifen','Etoksazol','Fenproksimat','Heksitiazoks','Propargit'],
      '── HERBİSİT (Yabancı Ot) ──':['Glifosat','Pendimetalin','Metribuzin','İmazamoks','Bentazon','Fluroksipir','2,4-D Amin','Dikamba','Sülkotrion','Klomazon'],
      '── NEMATİSİT (Nematod) ──':['Oksamil','Etoprofos','Dazomet','Biyonematisit (Bk nematisit)'],
      '── MOLUSKİSİT ──':['Demir Fosfat (organik)','Metaldehit'],
      '── BİYOLOJİK MÜCADELE ──':['Bacillus thuringiensis (Bt)','Bacillus subtilis','Beauveria bassiana','Metarhizium anisopliae','Trichoderma spp.','Steinernema (Entomopatojen nematod)','Chrysoperla carnea (Yeşil aslanağzı)','Phytoseiulus persimilis (Akar avcısı)','Trichogramma spp.'],
      '── ORGANİK & GELENEKSEL ──':['Sabunlu su (%2 sıvı sabun)','Göktaş — Kükürtlü kireç','Kükürt tozu (%80 S)','Kireç kaymağı','Sarımsak+biber karışımı','Neem yağı (%100)','Zeytinyağı+sabun emülsiyonu','Piretrum (doğal piretrin)','Kieselgur — Diyatome toprağı','Ahşap sirke (Pyroligneous acid)','Bakır kireç karışımı'],
      '── YAPIŞKAN & TUZAKLAR ──':['Sarı yapışkan tuzak','Mavi yapışkan tuzak','Feromon tuzak (ürüne özel)','Işık tuzağı (UV)','Kitlesel tuzaklama sistemi'],
      '── BÜYÜME DÜZENLEYİCİ ──':['Gibberellik asit (GA3)','Etefon','6-BAP (Benzilaminopürin)','Prohekzadion-Ca','Paklobutrazol','Sitokinin bazlı ürünler']
    };
    let opt='';
    for(const [g,items] of Object.entries(pg)){
      opt+=`<optgroup label="${g}">${items.map(i=>`<option>${i}</option>`).join('')}</optgroup>`;
    }
    df.innerHTML=`<div class="fr"><div class="fg"><label>Aktif Madde / Uygulama Türü</label><select id="e-pt">${opt}</select></div><div class="fg"><label>Ticari Ürün / Marka Adı</label><input type="text" id="e-pn" placeholder="Ürün adı..."/></div></div><div class="fr"><div class="fg"><label>Hedef Zararlı / Hastalık</label><input type="text" id="e-ptarget" placeholder="Zararlı / hastalık adı..."/></div><div class="fg"><label>Uygulama Ekipmanı</label><select id="e-papp"><option>Sırt pülverizatörü</option><option>Traktör pülverizatörü</option><option>Atomizör</option><option>Toprak uygulaması</option><option>Damla sulama ile</option></select></div></div>`;
    if(ql)ql.textContent='Toplam Miktar'; if(us)us.value='lt'; if(cl)cl.textContent='Birim Fiyat (₺/lt)';
  }else if(type==='yakıt'){
    df.innerHTML=`<div class="fr"><div class="fg"><label>Yakıt Türü</label><select id="e-ft2"><option>Motorin</option><option>Benzin</option><option>LPG</option><option>Elektrik (kWh)</option></select></div><div class="fg"><label>Araç / Ekipman</label><input type="text" id="e-fv" placeholder="Traktör, sulama motoru, jeneratör..."/></div></div>`;
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
 };
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
    // Hasat ise gelir alanlarını doldur
    if(ev.type==='hasat' && ev.revenue){
      qs('#e-hq').value = ev.extra?.['e-hq'] || '';
      qs('#e-hp').value = ev.extra?.['e-hp'] || '';
    }
  }else{
    qs('#e-date').value=tstr(); qs('#e-type').value='sulama';
    qs('#e-notes').value=''; qs('#e-cost').value=''; qs('#e-qty').value='';
    qs('#e-status').value='done';
    updEF();
  }
  qs('#m-event').classList.add('on');
 };
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
  let revenue = 0;
  let profit = null;
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
 };
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
    ? Object.entries(cm).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`<div class="pr"><span class="prl">${EVI[k]||'📝'} ${k}</span><div class="prt"><div class="prf" style="width:${tot?Math.round(v/tot*100):0}%;background:${EVC[k]||'var(--green2)'};"></div></div><span class="prv">${Math.round(v).toLocaleString()}₺</span></div>`).join('')+`<div style="display:flex;justify-content:space-between;font-weight:700;font-size:14px;padding-top:9px;margin-top:5px;border-top:1px solid var(--bdr);"><span>Toplam Maliyet</span><span>${Math.round(tot).toLocaleString('tr-TR')} ₺</span></div>
    <div style="display:flex;justify-content:space-between;font-size:14px;margin-top:6px;"><span>Toplam Gelir</span><span>${Math.round(totRev).toLocaleString('tr-TR')} ₺</span></div>
    <div style="display:flex;justify-content:space-between;font-weight:800;font-size:15px;margin-top:6px;color:${totProfit>=0?'var(--green2)':'var(--red)'}"><span>Net Kar</span><span>${Math.round(totProfit).toLocaleString('tr-TR')} ₺</span></div>`
    : 'Maliyet kaydı yok.';
 };

// ──────────────────────────────────────────────────────────────────
// Öneriler (Hastalık Riski)
// ──────────────────────────────────────────────────────────────────
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
  // Hastalık riski için nem ve sıcaklık değerlendirmesi
  let diseaseRisk = false;
  let consecutiveHumid = 0;
  for (let i=0; i<Math.min(futWx.length, 5); i++) {
    // Open-Meteo'nun günlük verisinde nem yok, saatlik var ama burada yok. Basitçe yağış ve sıcaklıkla risk
    if (futWx[i].rain > 2 && futWx[i].tmax > 15 && futWx[i].tmax < 28) consecutiveHumid++;
    else consecutiveHumid = 0;
    if (consecutiveHumid >= 3) diseaseRisk = true;
  }
  const evs=field.events||[];
  const dSince=type=>{ const e=evs.filter(x=>x.type===type&&!x.planned).sort((a,b)=>b.date.localeCompare(a.date))[0]; return e?Math.round((Date.now()-new Date(e.date))/(864e5)):999; };
  const a=agrd(field.crop);

  if(s.pct<20) recs.push({i:'🚨',bg:'var(--rbg)',c:'var(--red)',t:'ACİL Sulama!',s:`Toprak nemi kritik (%${s.pct}). Hemen sulama yapın. Beklenen yağış: ${Math.round(futR)}mm.`,pr:'YÜKSEK'});
  else if(s.pct<35&&(futR-futET)<0) recs.push({i:'⚠️',bg:'var(--abg)',c:'var(--amber)',t:'Sulama Planlanmalı',s:`Nem %${s.pct}, 7g su dengesi: ${Math.round(futR-futET)}mm açık. 2-3 gün içinde sulama önerilir.`,pr:'ORTA'});

  if(dSince('gübre')>45) recs.push({i:'🧪',bg:'var(--abg)',c:'var(--amber)',t:'Gübreleme Değerlendirin',s:`${dSince('gübre')<999?dSince('gübre')+' gündür':'Hiç'} gübreleme yapılmamış. ${a.fert?.slice(0,80)||'Dönemsel gübre planı yapın'}.`,pr:'ORTA'});

  if(diseaseRisk && dSince('ilaç')>21) recs.push({i:'🔬',bg:'var(--pbg)',c:'var(--purple)',t:'Fungal Hastalık Riski (Yüksek)',s:`Art arda yağışlı ve ılık hava → külleme/mildiyö riski. Koruyucu ilaçlama değerlendirin.`,pr:'YÜKSEK'});
  else if(rainyD>=3&&dSince('ilaç')>21) recs.push({i:'🔬',bg:'var(--pbg)',c:'var(--purple)',t:'Fungal Hastalık Riski',s:`${rainyD} günlük yağışlı hava bekleniyor. Yüksek nem → fungus/mildiyö riski. Koruyucu ilaçlama değerlendirin.`,pr:'ORTA'});

  if(maxT>a.tm) recs.push({i:'🌡️',bg:'var(--rbg)',c:'var(--red)',t:'Kritik Sıcaklık Stresi!',s:`${maxT}°C bekleniyor, ürün üst limiti ${a.tm}°C. Sabah erken sulama yapın.`,pr:'YÜKSEK'});
  else if(maxT>a.to+8) recs.push({i:'☀️',bg:'var(--abg)',c:'var(--amber)',t:'Yüksek Sıcaklık Uyarısı',s:`${maxT}°C bekleniyor. Optimum: ${a.to}°C. Sulama zamanlamasına dikkat edin.`,pr:'ORTA'});

  const he=calcHarvest(field);
  if(he&&!he.already&&he.daysLeft<=14&&he.daysLeft>=0) recs.push({i:'🌾',bg:'var(--gbg)',c:'var(--green2)',t:'Hasat Yaklaşıyor',s:`GDD tahmini: ${he.daysLeft} gün kaldı. GDD ilerlemesi: %${he.gddPct}. Hasat hazırlıklarını başlatın.`,pr:'BİLGİ'});
  if(he?.already) recs.push({i:'🟢',bg:'var(--gbg)',c:'var(--green2)',t:'Hasat Zamanı!',s:'Fenolojik hesaplama hasat olgunluğuna ulaşıldığını gösteriyor. Görsel kontrol yapın.',pr:'YÜKSEK'});

  return recs;
 };
window.renderRecTab = async (field) => { 
  // Fenoloji + Hasat Tahmini
  const ph=calcPheno(field);
  const he=calcHarvest(field);
  const sh=calcSolar(field);
  const a=agrd(field.crop);
  const phen=qs('#rec-pheno');
  if(phen){
    let html='';
    if(ph){
      html+=`<div style="margin-bottom:14px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
          <span style="font-size:12px;font-weight:700;">🌱 Gelişim Dönemi: <span style="color:var(--green2);">${ph.stage}</span></span>
          <span class="tag tgr">${ph.days} gün</span>
        </div>
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
          <span style="font-size:10px;color:var(--text3);min-width:80px;">Sezon İlerlemesi</span>
          <div style="flex:1;height:7px;border-radius:4px;background:var(--bg3);overflow:hidden;"><div style="height:100%;border-radius:4px;background:var(--green2);width:${ph.totPct}%;transition:width .6s;"></div></div>
          <span style="font-size:11px;font-weight:700;">%${ph.totPct}</span>
        </div>
        <div style="font-size:11px;color:var(--text2);">GDD: ${ph.gdd} · Sezon: ${a.td} gün</div>
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
        <div style="font-size:10px;color:var(--text3);margin-top:5px;">Güvenilirlik: <span style="font-weight:700;color:${cc[he.conf]||'var(--text)'};">${he.conf.toUpperCase()}</span>${he.manDate?` · Manuel: ${fd(he.manDate)}${he.dev!==null?` (${he.dev>0?'+':''}${he.dev}g sapma)`:''}`:''}${!WXC[field.id]?' · ⚠️ Gerçek hava bekleniyor':''}</div>
      </div>`;
    }else if(!field.plantDate){
      html+=`<div style="color:var(--text3);font-size:12px;padding:12px 0;">Ekim tarihi girildiğinde fenoloji ve hasat tahmini hesaplanır.</div>`;
    }
    phen.innerHTML=html;
  }

  // Akıllı uyarılar
  const recs= await buildAutoRecs(field);
  const ar=qs('#rec-auto');
  if(ar) ar.innerHTML=recs.length
    ? recs.map(r=>`<div class="ritem" style="background:${r.bg};"><div class="rico" style="background:${r.bg};color:${r.c};font-size:15px;">${r.i}</div><div class="rbody"><div class="rtitle">${r.t}<span class="rpri" style="background:${r.c}22;color:${r.c};">${r.pr}</span></div><div class="rsub">${r.s}</div></div></div>`).join('')
    : '<div style="color:var(--green2);font-size:13px;">✅ Kritik uyarı yok.</div>';

  // Gübre programı
  const fertH=(field.events||[]).filter(e=>e.type==='gübre').sort((a,b)=>b.date.localeCompare(a.date)).slice(0,3)
    .map(e=>`${fd(e.date)}: ${e.extra?.['e-ft']||''} (${e.qty||'?'}${e.unit||'kg'})`);
  const fr=qs('#rec-fert');
  if(fr) fr.innerHTML=`<div style="font-size:13px;font-weight:600;margin-bottom:8px;">${field.crop||'Ürün seçilmemiş'} — Gübre Programı</div><div style="font-size:13px;line-height:1.7;background:var(--bg3);padding:10px 12px;border-radius:var(--r);">${a.fert}</div>${fertH.length?`<div style="font-size:11px;color:var(--text3);margin-top:8px;">Son gübrelemeler: ${fertH.join(' · ')}</div>`:''}`;

  // Hastalık/zararlı riski (gelişmiş)
  const futWx=(WXC[field.id]?.days||simWX(field.lat,field.lon)).filter(d=>d.date>tstr()).slice(0,7);
  const avgR=futWx.reduce((s,d)=>s+d.rain,0)/Math.max(futWx.length,1);
  const avgT=futWx.reduce((s,d)=>s+d.tmax,0)/Math.max(futWx.length,1);
  let rl='DÜŞÜK';
  if (avgR>5 && avgT>18) rl='YÜKSEK';
  else if (avgR>2 || avgT>24) rl='ORTA';
  const rc={YÜKSEK:'var(--red)',ORTA:'var(--amber)',DÜŞÜK:'var(--green2)'}[rl];
  const pests=PEST_DATA[field.crop]||PEST_DATA.default;
  const pr=qs('#rec-pest');
  if(pr){
    const satStr = SATC[field.id]?.data ? satCtxStr(field) : null;
    pr.innerHTML=`<div style="display:flex;align-items:center;gap:8px;margin-bottom:9px;">
      <span style="font-size:13px;">7 günlük hava + uydu verilerine göre risk:</span>
      <span class="tag" style="background:${rc}22;color:${rc};">${rl}</span>
    </div>
    ${pests.map(p=>`<div class="ritem" style="background:var(--bg3);padding:7px 10px;margin-bottom:5px;"><div class="rico" style="background:var(--pbg);color:var(--purple);font-size:12px;">🔬</div><div class="rbody"><div class="rtitle" style="font-size:12px;">${p}</div></div></div>`).join('')}
    <div style="font-size:11px;color:var(--text3);margin-top:7px;">⚠️ İlaçlama öncesi zirai mühendis ve resmi etiket bilgilerine başvurun.</div>
    <button class="btn btns btnp" style="margin-top:10px;" onclick="aiPestAnalysis('${field.id}')">🤖 AI Hastalık & Zararlı Analizi</button>
    <div id="rec-pest-ai" style="margin-top:8px;"></div>`;
  }

  // Son AI analizi
  const ar2=qs('#rec-ai');
  if(ar2) ar2.innerHTML=field.aiRecs?.length
    ? `<div class="bubble bb" style="white-space:pre-line;">${field.aiRecs[0].text}</div><div style="font-size:10px;color:var(--text3);margin-top:4px;">${fd(field.aiRecs[0].date)} tarihli analiz</div>`
    : '<div style="color:var(--text3);font-size:13px;">🤖 AI Analiz butonu ile tüm veriler harmanlanarak bütünsel uzman yorumu oluşturulur.</div>';
 };

// ──────────────────────────────────────────────────────────────────
// Yapay Zeka (Gemini)
// ──────────────────────────────────────────────────────────────────
window.runAI = async () => { 
  if(!CUR) return;

  // Hava verisi yoksa önce çek
  if(!WXC[CUR.id]){
    addB('sys','⏳ Hava verisi alınıyor...');
    await fetchWX(CUR);
  }
  // Uydu verisi yoksa veya eskiyse çek
  if(!SATC[CUR.id]||(Date.now()-SATC[CUR.id].at>3600000)){
    addB('sys','🛰️ Uydu verisi alınıyor...');
    await fetchSat(CUR);
  }

  goTab('ai');
  const chat=qs('#ai-chat'); if(chat) chat.innerHTML='';
  const photoCount=(CUR.photos||[]).filter(p=>p.data).length;
  addB('sys',`🔬 Tüm veriler + uydu indeksleri + ${photoCount} fotoğraf işleniyor...`);
  addB('load','');

  try{
    const s= await calcSoil(CUR); const sc=scl(s.pct);
    const wx=WXC[CUR.id]?.days||simWX(CUR.lat,CUR.lon);
    const today=tstr();
    const pastWx=wx.filter(d=>d.date<today).slice(-7).map(d=>`${d.date.slice(5)}: ${d.tmax}°/${d.tmin}° yağış:${d.rain}mm rüzgar:${d.wind}km/h ET₀:${d.et0||'—'}mm`).join('\n');
    const futWx=wx.filter(d=>d.date>today).slice(0,7).map(d=>`${d.date.slice(5)}: ${d.tmax}°/${d.tmin}° yağış:${d.rain}mm ET₀:${d.et0||'—'}mm`).join('\n');
    const futR=wx.filter(d=>d.date>today).slice(0,7).reduce((t,d)=>t+d.rain,0);
    const futET=wx.filter(d=>d.date>today).slice(0,7).reduce((t,d)=>t+(d.et0||s.et),0);
    const ph=calcPheno(CUR);
    const he=calcHarvest(CUR);
    const sh=calcSolar(CUR);
    const a=agrd(CUR.crop);
    const lastIrr=(CUR.events||[]).filter(e=>e.type==='sulama'&&!e.planned).sort((a,b)=>b.date.localeCompare(a.date))[0];
    const lastFert=(CUR.events||[]).filter(e=>e.type==='gübre'&&!e.planned).sort((a,b)=>b.date.localeCompare(a.date))[0];
    const lastSpray=(CUR.events||[]).filter(e=>e.type==='ilaç'&&!e.planned).sort((a,b)=>b.date.localeCompare(a.date))[0];
    const evLog=(CUR.events||[]).map(e=>{
      const ex=e.extra?Object.entries(e.extra).filter(([,v])=>v).map(([,v])=>v).join(', '):'';
      return`  ${e.date} | ${e.type}${ex?' ['+ex+']':''}${e.notes?' — '+e.notes:''} | ${e.qty?e.qty+(e.unit||''):''}${e.cost?' | '+e.cost+'₺':''} ${e.planned?'[PLANLI]':''}${e.revenue?` | Gelir: ${e.revenue}₺` : ''}${e.profit!==undefined?` | Kar: ${e.profit}₺`:''}`;
    }).join('\n');
    const costMap={};let totalCost=0;
    (CUR.events||[]).filter(e=>e.cost>0).forEach(e=>{ const t=e.total||(e.cost*(e.qty||1)); costMap[e.type]=(costMap[e.type]||0)+t; totalCost+=t; });
    const costStr=Object.entries(costMap).map(([k,v])=>`${k}: ${Math.round(v)}₺`).join(' · ');
    const photoDesc=(CUR.photos||[]).map((p,i)=>`  Fotoğraf ${i+1}: ${p.date} [${p.type}]${p.note?' — '+p.note:''}${p.ai&&p.ai.length>10?' | Önceki analiz: '+p.ai.slice(0,120):''}`).join('\n');
    // Gelir ve kar hesapla
    const totalRevenue = (CUR.events||[]).reduce((s,e)=>s+(e.revenue||0),0);
    const totalProfit = totalRevenue - totalCost;

    const prompt=`SEN DENEYİMLİ BİR TÜRK TARIM DANIŞMANISIN.

Aşağıdaki tüm veri kaynaklarını zihninde harmanlayarak YALNIZCA BİR BÜTÜNSEL UZMANSAL PARAGRAF GRUBU yaz. Başlık başlık liste DEĞİL — akıcı, birbirine bağlı uzman paragrafları.

═══ TARLA BİLGİSİ ═══
Tarla: ${CUR.name} | Ürün: ${CUR.crop||'?'} (${CUR.category||''}) | Alan: ${CUR.area} ${CUR.areaUnit||'dönüm'} | Toprak: ${CUR.soilType}
Konum: ${CUR.location||''} (${CUR.lat.toFixed(4)}°N, ${CUR.lon.toFixed(4)}°E)
Ekim: ${CUR.plantDate||'girilmemiş'} | Planlanan Hasat: ${CUR.harvestDate||'girilmemiş'}
Tarla Notu: ${CUR.notes||'—'}

═══ FENOLOJİ ═══
${ph?`Dönem: ${ph.stage} — toplam %${ph.totPct} tamamlandı (${ph.days} gün, ${ph.gdd} GDD)\nTüm dönemler: ${a.st.join(' → ')}\nGübre tavsiyesi: ${a.fert}`:'Ekim tarihi girilmemiş (fenoloji hesaplanamıyor)'}

═══ HASAT TAHMİNİ ═══
${he?`Tahmini hasat: ${fd(he.estDate)} (${he.daysLeft>0?he.daysLeft+' gün kaldı':he.already?'HASAT ZAMANI':'—'})\nGDD ilerlemesi: ${he.gddAcc}/${he.gddTarget} (%${he.gddPct})\nGüvenilirlik: ${he.conf}${he.manDate?' | Manuel tarih: '+fd(he.manDate)+(he.dev!==null?' ('+he.dev+'g sapma)':''):''}` :'Ekim tarihi yok — hesaplanamadı'}

═══ GÜNEŞ & SICAKLIK ═══
${sh?`Güneşlenme: ${sh.sunH} sa/gün | Solar: ${sh.rad} MJ/m²\nSıcaklık durumu: ${sh.hs} | Bugün max: ${sh.actMax}°C\nOptimum: ${sh.topt}°C | Kritik maks: ${sh.tmaxLim}°C | Min sınır: ${sh.minT}°C`:'Veri yok'}

═══ TOPRAK SUYU ═══
Nem: %${s.pct} (${sc.l}) | Mevcut: ${s.moist}mm / ${s.fc}mm tarla kapasitesi | Günlük ET: ${s.et}mm/g
7 günlük net su dengesi: +${Math.round(futR)}mm yağış − ${Math.round(futET)}mm ET = ${Math.round(futR-futET)}mm
Son sulama: ${lastIrr?lastIrr.date+' ('+Math.round((Date.now()-new Date(lastIrr.date))/(864e5))+' gün önce, '+lastIrr.qty+'mm)':'kayıt yok'}

═══ HAVA DURUMU — SON 7 GÜN ═══
${pastWx||'Veri yok'}

═══ HAVA DURUMU — ÖNÜMÜZDEKİ 7 GÜN ═══
${futWx||'Veri yok'}

═══ TARLA UYDU VERİLERİ (Sentinel-2 / NASA / Open-Meteo Agro) ═══
${satCtxStr(CUR)}

═══ OLAY & İŞÇİLİK KAYITLARI ═══
${evLog||'Kayıt yok'}
Son gübreleme: ${lastFert?lastFert.date+' — '+(lastFert.extra?.['e-ft']||''):'kayıt yok'}
Son ilaçlama: ${lastSpray?lastSpray.date+' — '+(lastSpray.extra?.['e-pn']||lastSpray.extra?.['e-pt']||''):'kayıt yok'}

═══ MALİYET ANALİZİ ═══
${costStr||'Kayıt yok'} | TOPLAM MALİYET: ${Math.round(totalCost).toLocaleString('tr-TR')}₺${CUR.area>0?' | Dönüm başı maliyet: '+Math.round(totalCost/CUR.area).toLocaleString()+'₺':''}
TOPLAM GELİR: ${Math.round(totalRevenue).toLocaleString('tr-TR')}₺
NET KAR: ${Math.round(totalProfit).toLocaleString('tr-TR')}₺

═══ TARLA FOTOĞRAFLARI (${(CUR.photos||[]).length} adet — görseller ekli) ═══
${photoDesc||'Fotoğraf yok'}

═══════════════════════════════════════════════════════════
UZMANSAL YORUM TALEBİ:

Yukarıdaki tüm verileri ve eklenen fotoğrafların görsellerini birlikte değerlendirerek BİR UZMAN TARIMCI GİBİ BÜTÜNsel yorum yaz.

KURALLAR:
• Başlık başlık liste YOK — sadece akıcı, birbirine bağlı paragraflar
• Hava + toprak nemi + uydu indeksleri + fenoloji + geçmiş uygulamalar + fotoğraflar + maliyet/karlılık tek bir analize entegre olsun
• Veriler çelişiyorsa bunu belirt ve yorumla
• Somut tarih ve miktar belirterek aksiyon önerileri ver
• Türk tarım koşullarına özgü, teknik ama anlaşılır dil
• Maksimum 5-6 paragraf: durum → risk → eylem sıralamasıyla`;

    // Multimodal parts: text + all images
    const parts=[{text:prompt}];
    (CUR.photos||[]).forEach((p,i)=>{
      if(p.data&&p.data.startsWith('data:')){
        try{
          const b64=p.data.split(',')[1];
          const mime=p.data.split(';')[0].split(':')[1]||'image/jpeg';
          parts.push({inline_data:{mime_type:mime,data:b64}});
          parts.push({text:`[Fotoğraf ${i+1}: ${p.date}, tür:${p.type}${p.note?', not:'+p.note:''}]`});
        }catch(e){ console.warn('Photo error:',e); }
      }
    });
    const apiKey = await window.getGeminiKey();
if(!apiKey) { toast('Gemini API anahtarı alınamadı. Remote Config kontrol edin.', true); return; }
    const url=`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-preview:generateContent?key=${await window.getGeminiKey()}`;
    const resp=await fetch(url,{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({contents:[{role:'user',parts}],generationConfig:{temperature:0.62,maxOutputTokens:8192}})
    });
    if(!resp.ok){ const err=await resp.json(); throw new Error(err.error?.message||'Gemini '+resp.status); }
    const data=await resp.json();
    const text=data.candidates?.[0]?.content?.parts?.[0]?.text||'Yanıt alınamadı';

    rmLoad();
    // Paragraf tabanlı render (markdown bold destekli, başlık yok)
    const rendered=text
      .replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>')
      .split('\n\n').filter(p=>p.trim())
      .map(p=>`<p style="margin-bottom:10px;">${p.replace(/\n/g,'<br/>')}</p>`)
      .join('');
    const el=document.createElement('div');
    el.className='bubble bb';
    el.style.lineHeight='1.78';
    el.style.fontSize='13px';
    el.innerHTML=rendered;
    qs('#ai-chat')?.appendChild(el);
    qs('#ai-chat').scrollTop=qs('#ai-chat').scrollHeight;

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
  if(aiHist.length>14) aiHist=aiHist.slice(-14);
  const s= await CUR?calcSoil(CUR):null;
  const ph=CUR?calcPheno(CUR):null;
  const sat=SATC[CUR?.id]?.data;
  const sys=CUR
    ? `Tarım danışmanısın. Tarla:${CUR.name}, ürün:${CUR.crop||'?'}, ${ph?'dönem:'+ph.stage+', ':''}nem:%${s?.pct||'?'}(${s?scl(s.pct).l:'?'}), alan:${CUR.area}${CUR.areaUnit||'dön'}, toprak:${CUR.soilType}${sat?', NDVI:'+sat.ndvi:''}. Kısa, pratik, Türkçe.`
    : 'Tarım danışmanısın. Türkçe yanıt ver.';
  const contents=aiHist.slice(-12).map(m=>({role:m.role==='assistant'?'model':'user',parts:[{text:m.content}]}));
  contents.push({role:'user',parts:[{text:`[Sistem: ${sys}]\n\n${msg}`}]});
  try{
    const apiKey = await window.getGeminiKey();
if(!apiKey) { toast('Gemini API anahtarı alınamadı. Remote Config kontrol edin.', true); return; }
    const url=`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-preview:generateContent?key=${await window.getGeminiKey()}`;
    const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({contents,generationConfig:{temperature:0.72,maxOutputTokens:4096}})});
    if(!r.ok){ const e=await r.json(); throw new Error(e.error?.message||'Gemini '+r.status); }
    const d=await r.json();
    const text=d.candidates?.[0]?.content?.parts?.[0]?.text||'Yanıt alınamadı';
    rmLoad(); addB('bot',text); aiHist.push({role:'assistant',content:text});
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
window.clrChat = () => { const c=qs('#ai-chat'); if(c) c.innerHTML=''; aiHist=[]; };
window.analyzePhoto = async () => { 
  if(!pendPh){ toast('Fotoğraf seçin',true); return; }
  const el=qs('#p-ai');
  el.innerHTML='<div class="bubble bs"><span style="display:inline-flex;gap:3px;"><span style="width:5px;height:5px;border-radius:50%;background:currentColor;opacity:.3;animation:dl 1.2s infinite;"></span><span style="width:5px;height:5px;border-radius:50%;background:currentColor;opacity:.3;animation:dl 1.2s .2s infinite;"></span><span style="width:5px;height:5px;border-radius:50%;background:currentColor;opacity:.3;animation:dl 1.2s .4s infinite;"></span></span> Görsel + tarla bağlamı analiz ediliyor...</div>';
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
NEM:%${s?.pct||'?'} (${s?scl(s.pct).l:'?'}) | BUGÜN:${todayWx?todayWx.tmax+'°C, '+todayWx.rain+'mm yağış':'?'}
UYDU:${sat?'NDVI:'+sat.ndvi+' NDWI:'+sat.ndwi+' LST:'+sat.lst+'°C':'veri yok'}

Türkçe, uzman görüşü:
1. Bitki sağlığı ve gelişim uygunluğu (döneme göre)
2. Görsel hastalık/zararlı belirtileri (varsa)
3. Fenolojik dönem doğrulaması (görseldeki dönem tahminim)
4. Toprak/nem görünümü
5. Acil müdahale gerektiren durum (varsa)
6. Hasat olgunluğu değerlendirmesi`}
    ];
    const apiKey = await window.getGeminiKey();
if(!apiKey) { toast('Gemini API anahtarı alınamadı. Remote Config kontrol edin.', true); return; }
    const url=`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-preview:generateContent?key=${await window.getGeminiKey()}`;
    const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({contents:[{role:'user',parts}],generationConfig:{maxOutputTokens:2000}})});
    if(!r.ok){ const e=await r.json(); throw new Error(e.error?.message||r.status); }
    const d=await r.json();
    const text=d.candidates?.[0]?.content?.parts?.[0]?.text||'Analiz yapılamadı';
    el.innerHTML=`<div class="bubble bb" style="white-space:pre-line;margin-top:7px;">${text}</div>`;
  }catch(e){ el.innerHTML=`<div style="color:var(--red);font-size:12px;margin-top:6px;">Hata: ${e.message}</div>`; }
 };

// ──────────────────────────────────────────────────────────────────
// Fotoğraf Yönetimi
// ──────────────────────────────────────────────────────────────────
window.prevPhoto = async (e) => { 
  const file=e.target.files[0]; if(!file) return;
  const si=qs('#p-size-info'); if(si) si.textContent='Sıkıştırılıyor...';
  pendPh=await compressImg(file,150,0.82);
  const kb=Math.round(pendPh.length*0.75/1024);
  qs('#p-prev').innerHTML=`<img src="${pendPh}" style="width:100%;max-height:140px;object-fit:cover;border-radius:var(--r);margin-top:6px;"/>`;
  if(si) si.textContent=`~${kb} KB (sıkıştırıldı)`;
  // EXIF'ten tarih okuma
  if (window.EXIF) {
    EXIF.getData(file, function() {
      const dateTime = EXIF.getTag(this, 'DateTimeOriginal');
      if (dateTime) {
        // format: "YYYY:MM:DD HH:MM:SS"
        const parts = dateTime.split(' ')[0].split(':');
        if (parts.length === 3) {
          const exifDate = `${parts[0]}-${parts[1]}-${parts[2]}`;
          qs('#p-date').value = exifDate;
          toast(`Fotoğraf tarihi otomatik alındı: ${exifDate}`, false);
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

// ──────────────────────────────────────────────────────────────────
// Tarla CRUD
// ──────────────────────────────────────────────────────────────────
window.fillCrops = () => { 
  const cat=qs('#f-cat').value; const list=CROPS[cat]||[];
  const sel=qs('#f-crop');
  sel.innerHTML=list.length?list.map(c=>`<option value="${c}">${c}</option>`).join(''):'<option>Kategori seçin</option>';
  const lbl=qs('#f-qty-lbl'); if(!lbl) return;
  if(['meyve','narenciye','zeytin'].includes(cat)) lbl.textContent='Ağaç / Bitki Adedi';
  else if(['tahil','baklagil','endustri','yembitki'].includes(cat)) lbl.textContent='Tohum Miktarı (kg/da)';
  else lbl.textContent='Miktar';
 };
window.openFM = (editId) => { 
  qs('#f-eid').value = editId || '';
  qs('#fm-title').textContent = editId ? 'Tarla Düzenle' : 'Yeni Tarla Ekle';
  const preview = qs('#f-import-preview');
  if (preview) preview.style.display = 'none';
  const soilBadge = qs('#soil-auto-badge');
  if (soilBadge) soilBadge.style.display = 'none';
  delete window.pendingSoilComp;

  if (editId) {
    const f = window.DB.fields.find(x => x.id === editId);
    if (!f) return;
    qs('#f-lat').value = f.lat || '';
    qs('#f-lon').value = f.lon || '';
    qs('#f-name').value = f.name || '';
    qs('#f-loc').value = f.location || '';
    qs('#f-area').value = f.area || '';
    qs('#f-aunit').value = f.areaUnit || 'dönüm';
    qs('#f-soil').value = f.soilType || 'killiTin';
    qs('#f-status').value = f.status || 'active';   // YENİ
    qs('#f-cat').value = f.category || '';
    fillCrops();
    if (f.crop) qs('#f-crop').value = f.crop;
    qs('#f-qty').value = f.qty || '';
    qs('#f-qunit').value = f.qunit || 'adet';
    qs('#f-color').value = f.color || '#40916c';
    qs('#f-plant').value = f.plantDate || '';
    qs('#f-harvest').value = f.harvestDate || '';
    qs('#f-notes').value = f.notes || '';
  } else {
    ['f-lat','f-lon','f-name','f-loc','f-area','f-qty','f-notes','f-plant','f-harvest'].forEach(id => {
      const el = qs('#' + id);
      if (el) el.value = '';
    });
    qs('#f-color').value = '#40916c';
    qs('#f-cat').value = '';
    qs('#f-aunit').value = 'dönüm';
    qs('#f-status').value = 'active';   // YENİ
    const file = qs('#f-file');
    if (file) file.value = '';
    fillCrops();
  }
  const latEl=qs('#f-lat'), lonEl=qs('#f-lon');
  const triggerSoilFetch = () => {
    const lt=parseFloat(latEl?.value), ln=parseFloat(lonEl?.value);
    if(!isNaN(lt) && !isNaN(ln) && lt!==0 && ln!==0) window.autoFillSoilFromCoords();
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
  if(!window.pendingSoilComp && !isNaN(lat) && !isNaN(lon) && (!ex || ex.lat!==lat || ex.lon!==lon)) {
    try { await window.autoFillSoilFromCoords(); } catch(e) { console.warn('Auto soil fetch failed:', e); }
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
    status: qs('#f-status').value,   // YENİ
    events:ex?ex.events:[], photos:ex?ex.photos:[], aiRecs:ex?ex.aiRecs:[],
    soilComposition: window.pendingSoilComp || ex?.soilComposition || null
  };
  if (window.pendingSoilComp) delete window.pendingSoilComp;
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

// ──────────────────────────────────────────────────────────────────
// Dosya İçe Aktarma (JSON/GeoJSON/KML)
// ──────────────────────────────────────────────────────────────────
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
    const prev=qs('#f-import-preview');
    if(prev){ prev.style.display='block'; prev.innerHTML=`✅ <strong>Dosyadan:</strong> ${R.name||'İsimsiz'} · ${R.lat?.toFixed(4)}, ${R.lon?.toFixed(4)}${R.area?' · Alan: '+R.area.toFixed(1)+' '+(R.areaUnit||'m²'):''}${R.description?' · '+R.description.slice(0,80):''}`; }
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
    else if(geom.type==='Polygon'){ const ring=geom.coordinates[0]; R.lat=ring.reduce((s,p)=>s+p[1],0)/ring.length; R.lon=ring.reduce((s,p)=>s+p[0],0)/ring.length; R.area=calcPolyArea(ring); R.areaUnit='m²'; }
    else if(geom.type==='MultiPolygon'){ const ring=geom.coordinates[0][0]; R.lat=ring.reduce((s,p)=>s+p[1],0)/ring.length; R.lon=ring.reduce((s,p)=>s+p[0],0)/ring.length; R.area=calcPolyArea(ring); R.areaUnit='m²'; }
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
    else if(pairs.length>1){ R.lat=pairs.reduce((s,p)=>s+p[1],0)/pairs.length; R.lon=pairs.reduce((s,p)=>s+p[0],0)/pairs.length; R.area=calcPolyArea(pairs.map(p=>[p[0],p[1]])); R.areaUnit='m²'; }
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

// ──────────────────────────────────────────────────────────────────
// Firebase / Yerel Depolama
// ──────────────────────────────────────────────────────────────────
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
window.saveLocalDB = () => { try { localStorage.setItem('tt_fields', JSON.stringify(window.DB.fields)); } catch (e) { } };
window.loadLocalDB = () => { try { const d = localStorage.getItem('tt_fields'); if (d) window.DB.fields = JSON.parse(d) || []; } catch (e) { } };
window.saveSettings = () => { window.DB.s.acuKey = qs('#acu-key')?.value || ''; localStorage.setItem('tt_s', JSON.stringify(window.DB.s)); window.toast('Kaydedildi'); };
window.loadSettings = () => { try { const s = localStorage.getItem('tt_s'); if (s) { const p = JSON.parse(s); window.DB.s = { ...window.DB.s, ...p }; } } catch (e) { } if (qs('#acu-key')) qs('#acu-key').value = window.DB.s.acuKey || ''; };
window.expData = () => { const a = document.createElement('a'); a.href = 'data:application/json;charset=utf-8,' + encodeURIComponent(JSON.stringify({ fields: window.DB.fields }, null, 2)); a.download = 'tarim_' + window.tstr() + '.json'; a.click(); };
window.impData = (e) => { const f = e.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = ev => { try { const d = JSON.parse(ev.target.result); if (d.fields) { window.DB.fields = d.fields; window.saveLocalDB(); window.renderAll(); window.toast('İçe aktarıldı'); } } catch { window.toast('Geçersiz JSON', true); } }; r.readAsText(f); };
window.exportToCSV = () => { 
  if (!DB.fields.length) { toast('Aktarılacak veri yok', true); return; }
  const rows = [];
  rows.push(['Tarla', 'Tarih', 'Tür', 'Detay', 'Miktar', 'Birim', 'Birim Maliyet (₺)', 'Toplam Maliyet (₺)', 'Gelir (₺)', 'Notlar']);
  DB.fields.forEach(f => {
    (f.events || []).forEach(e => {
      const extraStr = e.extra ? Object.entries(e.extra).filter(([k]) => ['e-ft','e-pn','e-sm','e-ft2','e-fbrand'].includes(k)).map(([,v])=>v).join('; ') : '';
      rows.push([
        f.name,
        e.date,
        e.type,
        extraStr,
        e.qty || '',
        e.unit || '',
        e.cost || '',
        e.total || '',
        e.revenue || '',
        e.notes || ''
      ]);
    });
  });
  const csvContent = rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.href = url;
  link.setAttribute('download', `tarim_raporu_${tstr()}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  toast('CSV dışa aktarıldı');
 };

// ──────────────────────────────────────────────────────────────────
// Kullanıcı Girişi
// ──────────────────────────────────────────────────────────────────
window.swAuthTab = (tab, el) => { 
  qs('#auth-screen .auth-pane.on')?.classList.remove('on');
  qs('#ap-'+tab)?.classList.add('on');
  qs('#auth-screen .auth-tab.on')?.classList.remove('on');
  el.classList.add('on');
 };
window.signGoogle = async () => { 
  if(!window.FB_MODE){ noFBNotice(); return; }
  try{ await window.fbSignInGoogle(); }catch(e){ showAErr('login',e.message); }
 };
window.signEmail = async (mode) => { 
  if(!window.FB_MODE){ noFBNotice(); return; }
  const em=qs(mode==='login'?'#login-email':'#reg-email')?.value; const pw=qs(mode==='login'?'#login-pass':'#reg-pass')?.value;
  try{
    if(mode==='login') await window.fbSignInEmail(em,pw);
    else await window.fbRegisterEmail(em,pw);
  }catch(e){ showAErr(mode,e.message); }
 };
window.showAErr = (m, msg) => { const el=qs('#'+m+'-err'); if(el){ el.style.display='block'; el.textContent=msg; } };
window.noFBNotice = () => { qs('#no-fb-note').style.display='block'; qs('#auth-form-wrap').style.display='none'; };
window.enterLocalMode = () => {
  window.LOCAL = true;
  qs('#auth-screen').classList.add('hidden');
  window.loadLocalDB();
  window.DB.fields.forEach(f => window.fetchWX(f));
  window.renderAll();
  window.fetchAllSatellites().catch(e => console.warn('Uydu çekim hatası:', e));
  window.toast('Yerel modda çalışıyorsunuz');
};
window.doSignOut = async () => { if(window.FB_MODE&&window.FB_USER) await window.fbSignOut(); else{ LOCAL=false; DB.fields=[]; } qs('#auth-screen')?.classList.remove('hidden'); };
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
 };

// ──────────────────────────────────────────────────────────────────
// TÜM TARLALAR İÇİN UYDU VERİSİ ÇEKME (YENİ)
// ──────────────────────────────────────────────────────────────────
window.fetchAllSatellites = async () => {
  if (!window.DB.fields.length) return;
  console.log('🛰️ Tüm tarlalar için uydu/agro verileri çekiliyor...');
  const results = await Promise.allSettled(window.DB.fields.map(f => window.fetchSat(f, true))); // suppressRender = true
  const succeeded = results.filter(r => r.status === 'fulfilled').length;
  console.log(`✅ ${succeeded}/${window.DB.fields.length} tarla için veri alındı.`);
  window.invSoilAll();
  await window.computeAllSoils(true);
  await window.renderAll();
  window.toast(`🛰️ ${succeeded} tarla için uydu verileri güncellendi.`, false);
};

// ──────────────────────────────────────────────────────────────────
// Senkronizasyon (Firebase'den veri geldikten sonra uydu çekimi)
// ──────────────────────────────────────────────────────────────────
window.syncFromDB = async () => {
  const uid = window.FB_USER?.uid;
  if (!uid || !window.FB_MODE) return;
  try {
    const fields = await window.fbLoadFields(uid);
    window.DB.fields = fields || [];
    window.saveLocalDB();
    window.invSoilAll();
    window.DB.fields.forEach(f => { if (!window.WXC[f.id]) window.fetchWX(f); });
    await window.renderAll();
    if (window.CUR) {
      const u = window.DB.fields.find(f => f.id === window.CUR.id);
      if (u) {
        window.CUR = u;
        if (qs('#page-field.on')) window.renderFieldPage(window.CUR);
      } else {
        window.CUR = null;
        window.goPage('dash');
      }
    }
    window.toast('Veriler güncellendi ✓');
    window.fetchAllSatellites().catch(e => console.warn('Uydu çekim hatası:', e));
  } catch (e) {
    window.toast('Senkronizasyon hatası: ' + e.message, true);
  }
  await window.computeAllSoils(true);
};

// ──────────────────────────────────────────────────────────────────
// Render ve Sayfa Yönetimi
// ──────────────────────────────────────────────────────────────────
window.renderAll = async () => {
  await window.computeAllSoils();
  await Promise.all([window.renderSB(), window.renderDash()]);
  window.renderCal();
  await window.renderRep();
};

window.renderSB = async () => {
  const el = qs('#sb-list');
  if (!el) return;
  const allSoilData = await window.computeAllSoils();
  el.innerHTML = '';
  allSoilData.forEach(({ f, s, sc }) => {
    const d = document.createElement('div');
    d.className = 'fi' + (f.id === window.CUR?.id ? ' on' : '');
    d.onclick = () => { window.showField(f.id); window.clSBmob(); };
    d.innerHTML = `<div class="fi-dot" style="background:${f.color || '#40916c'};"></div><div class="fi-info"><div class="fi-name">${f.name}</div><div class="fi-sub">${f.crop || 'Ürün yok'} · <span class="tag ${sc.tag}" style="font-size:9px;">${sc.l} %${s.pct}</span></div></div>`;
    el.appendChild(d);
  });
};

window.renderFKPIs = async (field) => {
  window.invSoil(field.id);
  const s = await window.calcSoil(field);
  const sc = window.scl(s.pct);
  const tc = (field.events || []).reduce((t, e) => t + (e.total || (e.cost * (e.qty || 1))), 0);
  const ph = window.calcPheno(field);
  const he = window.calcHarvest(field);
  const el = qs('#fp-tags');
  if (el) el.innerHTML = `
    ${field.crop ? `<span class="tag tg">${field.crop}</span>` : ''}
    ${field.qty ? `<span class="tag tgr">${field.qty} ${field.qunit}</span>` : ''}
    <span class="tag tgr">${field.area} ${field.areaUnit || 'dönüm'}</span>
    ${field.location ? `<span class="tag tgr">📍 ${field.location}</span>` : ''}
    <span class="tag ${sc.tag}">${sc.l} %${s.pct}</span>`;
  const kp = qs('#fp-kpis');
  if (kp) kp.innerHTML = `
    <div class="kpi"><div class="kpi-l">Toprak Nemi</div><div class="kpi-v" style="color:${sc.color};">${s.pct}<small>%</small></div><div class="kpi-s">${sc.l}</div></div>
    <div class="kpi"><div class="kpi-l">Gelişim Dönemi</div><div class="kpi-v" style="font-size:12px;">${ph ? ph.stage : '—'}</div><div class="kpi-s">${ph ? '%' + ph.totPct + ' tamamlandı' : 'Ekim tarihi yok'}</div></div>
    <div class="kpi"><div class="kpi-l">Hasat Tahmini</div><div class="kpi-v" style="font-size:12px;color:${he?.already ? 'var(--green2)' : 'var(--text)'};">${he ? (he.already ? '🟢 Hazır!' : he.daysLeft + 'g') : '—'}</div><div class="kpi-s">${he && !he.already ? fd(he.estDate) : '—'}</div></div>
    <div class="kpi"><div class="kpi-l">Toplam Maliyet</div><div class="kpi-v">${Math.round(tc).toLocaleString('tr-TR')}<small>₺</small></div><div class="kpi-s">${(field.events || []).length} kayıt</div></div>`;
};

window.renderDash = async () => {
  const now = new Date();
  qs('#ddate').textContent = now.toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  
  // Önce özet KPI'lar (ta, tc, activeCount, fallowCount) hesaplanır (async gerektirmez)
  const ta = DB.fields.reduce((s, f) => s + (f.area || 0), 0);
  const tc = DB.fields.reduce((s, f) => s + (f.events || []).reduce((c, e) => c + (e.total || (e.cost * (e.qty || 1))), 0), 0);
  const activeCount = DB.fields.filter(f => f.status !== 'fallow').length;
  const fallowCount = DB.fields.filter(f => f.status === 'fallow').length;
  
  qs('#dkpis').innerHTML = `
  <div class="kpi"><div class="kpi-l">Tarla</div><div class="kpi-v">${DB.fields.length}</div></div>
  <div class="kpi"><div class="kpi-l">Toplam Alan</div><div class="kpi-v">${ta.toFixed(1)}</div></div>
  <div class="kpi"><div class="kpi-l">Toplam Maliyet</div><div class="kpi-v">${Math.round(tc).toLocaleString('tr-TR')}</div><div class="kpi-s">₺</div></div>
  <div class="kpi"><div class="kpi-l">Ekili Tarla</div><div class="kpi-v">${activeCount}<small>/${DB.fields.length}</small></div></div>
  <div class="kpi"><div class="kpi-l">Nadas</div><div class="kpi-v">${fallowCount}</div></div>`;
  
  const df = qs('#dfields');
  if (!DB.fields.length) {
    df.innerHTML = '<div class="empty">🌾<br/>Tarla yok.<br/>"+ Yeni Tarla" ile başlayın.</div>';
    qs('#devents').innerHTML = '';
    qs('#dplanned').innerHTML = '';
    return;
  }
  
  // Paylaşımlı önbellekten tüm tarla verilerini al
  const fieldsWithSoil = await window.computeAllSoils();
  
  df.innerHTML = fieldsWithSoil.map(({ f, s, sc, ph, he }) => {
    return `<div class="evrow" style="cursor:pointer;" onclick="showField('${f.id}')">
      <div class="evico" style="background:${f.color || '#40916c'}22;font-size:14px;">🌿</div>
      <div class="evbody">
        <div class="evtitle">${f.name} ${f.status === 'fallow' ? '<span class="tag ta">Nadas</span>' : f.status === 'planned' ? '<span class="tag tb">Planlanan</span>' : ''}</div>
        <div class="evsub">${f.crop || 'Ürün yok'} · ${f.area}${f.areaUnit || 'dön'} · ${f.location || '—'}</div>
        ${ph ? `<div class="evsub" style="margin-top:2px;">📍 ${ph.stage}${he && !he.already ? ' · Hasat ~' + he.daysLeft + 'g' : he?.already ? ' · 🟢 Hasat zamanı!' : ''}</div>` : ''}
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:3px;">
        <span class="tag ${sc.tag}">${sc.l}</span>
        <span style="font-size:11px;font-weight:700;color:${sc.color};">%${s.pct}</span>
      </div>
    </div>`;
  }).join('');
  
  // Olaylar ve planlanan görevler (aynı)
  const allEvs = [];
  DB.fields.forEach(f => (f.events || []).filter(e => !e.planned).forEach(e => allEvs.push({ ...e, fn: f.name })));
  allEvs.sort((a, b) => b.date.localeCompare(a.date));
  qs('#devents').innerHTML = allEvs.slice(0, 4).map(e => `<div class="evrow"><div class="evico" style="background:${EVC[e.type] || '#eee'};font-size:12px;">${EVI[e.type] || '📝'}</div><div class="evbody"><div class="evtitle">${e.fn} — ${e.type}</div><div class="evsub">${fd(e.date)}${e.notes ? ' · ' + e.notes.slice(0, 40) : ''}</div></div>${e.total ? `<span class="evcost">${Math.round(e.total).toLocaleString()}₺</span>` : ''}</div>`).join('') || '<div style="color:var(--text3);font-size:13px;">Kayıt yok.</div>';
  
  const planned = [];
  DB.fields.forEach(f => (f.events || []).filter(e => e.planned && e.date >= tstr()).forEach(e => planned.push({ ...e, fn: f.name, fc: f.color })));
  planned.sort((a, b) => a.date.localeCompare(b.date));
  qs('#dplanned').innerHTML = planned.slice(0, 4).map(e => `<div class="evrow"><div class="evico" style="background:${e.fc || '#40916c'}22;font-size:13px;">${EVI[e.type] || '📝'}</div><div class="evbody"><div class="evtitle">${e.fn} — ${e.type}</div><div class="evsub">${fd(e.date)}</div></div></div>`).join('') || '<div style="color:var(--text3);font-size:13px;">Planlanan görev yok.</div>';
};

window.showField = async (id) => {
  window.CUR = window.DB.fields.find(f => f.id === id);
  if (!window.CUR) return;
  window.aiHist = [];
  window.curTab = 'map';
  window.goPage('field');
  await window.renderSB();
  window.renderFieldPage(window.CUR);
  if (!window.WXC[window.CUR.id]) window.fetchWX(window.CUR);
  if (!window.SATC[window.CUR.id] || (Date.now() - window.SATC[window.CUR.id].at > 3600000)) {
    setTimeout(() => window.fetchSat(window.CUR), 500);
  }
};

window.renderFieldPage = (field) => {
  window.CUR = field;
  qs('#fp-name').textContent = field.name;
  window.renderFKPIs(field);
  window.goTab('map');
};

window.goTab = async (t) => {
  window.curTab = t;
  document.querySelectorAll('.tab').forEach(x => x.classList.remove('on'));
  document.querySelectorAll('.tp').forEach(x => x.classList.remove('on'));
  qs(`.tab[data-t="${t}"]`)?.classList.add('on');
  qs('#tp-' + t)?.classList.add('on');
  if (!window.CUR) return;
  if (t === 'map') {
    requestAnimationFrame(() => { setTimeout(() => { window.initMap(window.CUR.lat, window.CUR.lon, window.CUR); window.renderLocInfo(window.CUR); }, 80); });
  } else if (t === 'wx') {
    if (!window.WXC[window.CUR.id]) window.fetchWX(window.CUR); else window.renderWX(window.CUR);
  } else if (t === 'sat') {
    if (!window.SATC[window.CUR.id] || Date.now() - window.SATC[window.CUR.id].at > 3600000) window.fetchSat(window.CUR);
    else window.renderSat(window.CUR, window.SATC[window.CUR.id].data);
  } else if (t === 'soil') {
    await window.renderSoil(window.CUR);
  } else if (t === 'ev') {
    window.renderEvTab(window.CUR);
  } else if (t === 'rec') {
    await window.renderRecTab(window.CUR);
  } else if (t === 'ph') {
    window.renderPhTab(window.CUR);
  } else if (t === 'ai') {
    const chat = qs('#ai-chat');
    if (chat && !chat.children.length) chat.innerHTML = `<div class="bubble bs">👋 <strong>${window.CUR.name}</strong> tarlası için AI asistanı hazır.<br/>🤖 <strong>AI Analiz</strong> butonuna basın → Hava + toprak + uydu + fenoloji + olaylar + fotoğraflar tek bütünsel uzman yorumu.</div>`;
    const qq = qs('#qqbtns');
    if (qq) qq.innerHTML = ['Sulama planı', 'Gübre tavsiyesi', `${window.CUR.crop || 'ürün'} hastalık riskleri`, 'Bu hafta ne yapmalıyım?'].map(q => `<button style="padding:4px 9px;border-radius:7px;font-size:11px;border:1px solid var(--bdr2);background:transparent;color:var(--text2);cursor:pointer;" onmouseover="this.style.borderColor='var(--green2)';this.style.color='var(--green2)'" onmouseout="this.style.borderColor='var(--bdr2)';this.style.color='var(--text2)'" onclick="window.qs('#ai-inp').value='${q}';window.sendChat()">${q}</button>`).join('');
  }
};

window.closeM = (id) => { qs('#m-' + id)?.classList.remove('on'); };
window.goPage = async (p) => {
  document.querySelectorAll('.page').forEach(x => x.classList.remove('on'));
  qs('#page-' + p)?.classList.add('on');
  document.querySelectorAll('.tn').forEach(b => b.classList.remove('on'));
  const idx = { dash: 0, cal: 1, rep: 2, cfg: 3 }[p];
  if (idx !== undefined) document.querySelectorAll('.tn')[idx]?.classList.add('on');
  if (p === 'dash') { window.invSoilAll(); await window.renderDash(); }
  if (p === 'cal') window.renderCal();
  if (p === 'rep') { window.invSoilAll(); await window.renderRep(); }
  window.clSBmob();
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
window.renderRep = async () => { 
  const rc = qs('#rep-content'); if (!rc) return;
  if (!DB.fields.length) { rc.innerHTML = '<div class="empty">📊<br/>Tarla ekleyin.</div>'; return; }
  
  const totalCost = DB.fields.reduce((s, f) => s + (f.events || []).reduce((c, e) => c + (e.total || (e.cost * (e.qty || 1))), 0), 0);
  const totalRevenue = DB.fields.reduce((s, f) => s + (f.events || []).reduce((c, e) => c + (e.revenue || 0), 0), 0);
  const totalProfit = totalRevenue - totalCost;
  const ta = DB.fields.reduce((s, f) => s + (f.area || 0), 0);
  const byCat = {}; DB.fields.forEach(f => (f.events || []).filter(e => e.cost > 0).forEach(e => { const t = e.total || (e.cost * (e.qty || 1)); byCat[e.type] = (byCat[e.type] || 0) + t; }));
  
  // Tarla bazlı verileri paralel çek
  const fieldData = await Promise.all(DB.fields.map(async f => {
    const s = await calcSoil(f);
    const fc = (f.events || []).reduce((c, e) => c + (e.total || (e.cost * (e.qty || 1))), 0);
    const rev = (f.events || []).reduce((c, e) => c + (e.revenue || 0), 0);
    const profit = rev - fc;
    const ph = calcPheno(f);
    const he = calcHarvest(f);
    return { f, s, fc, rev, profit, ph, he };
  }));

  rc.innerHTML = `
    <div class="krow">
      <div class="kpi"><div class="kpi-l">Toplam Maliyet</div><div class="kpi-v">${Math.round(totalCost).toLocaleString('tr-TR')}</div><div class="kpi-s">₺</div></div>
      <div class="kpi"><div class="kpi-l">Toplam Gelir</div><div class="kpi-v">${Math.round(totalRevenue).toLocaleString('tr-TR')}</div><div class="kpi-s">₺</div></div>
      <div class="kpi"><div class="kpi-l">Net Kar</div><div class="kpi-v" style="color:${totalProfit>=0?'var(--green2)':'var(--red)'}">${Math.round(totalProfit).toLocaleString('tr-TR')}</div><div class="kpi-s">₺</div></div>
      <div class="kpi"><div class="kpi-l">Alan Başı Kar</div><div class="kpi-v">${ta?Math.round(totalProfit/ta).toLocaleString():0}</div><div class="kpi-s">₺/birim</div></div>
    </div>
    <div class="g2">
      <div class="card"><div class="ct">Tarla Bazlı Maliyet</div>
        ${DB.fields.map(f=>{const fc=(f.events||[]).reduce((s,e)=>s+(e.total||(e.cost*(e.qty||1))),0);return`<div class="pr"><span class="prl" style="display:flex;align-items:center;gap:4px;"><span style="width:8px;height:8px;border-radius:50%;background:${f.color};flex-shrink:0;"></span>${f.name}</span><div class="prt"><div class="prf" style="width:${totalCost?Math.round(fc/totalCost*100):0}%;background:${f.color};"></div></div><span class="prv">${Math.round(fc).toLocaleString()}₺</span></div>`;}).join('')}
        <div style="display:flex;justify-content:space-between;font-weight:700;font-size:14px;padding-top:9px;margin-top:5px;border-top:1px solid var(--bdr);"><span>Toplam Maliyet</span><span>${Math.round(totalCost).toLocaleString('tr-TR')} ₺</span></div>
      </div>
      <div class="card"><div class="ct">İşlem Bazlı Dağılım</div>
        ${Object.keys(byCat).length?Object.entries(byCat).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`<div class="pr"><span class="prl">${EVI[k]||'📝'} ${k}</span><div class="prt"><div class="prf" style="width:${totalCost?Math.round(v/totalCost*100):0}%;"></div></div><span class="prv">${Math.round(v).toLocaleString()}₺</span></div>`).join(''):'<div style="color:var(--text3);">Kayıt yok</div>'}
      </div>
    </div>
    <div class="card"><div class="ct">Tarla Özet Tablosu</div>
      <div style="overflow-x:auto;"><table class="tbl"><thead><tr><th>Tarla</th><th>Ürün</th><th>Alan</th><th>Dönem</th><th>Nem</th><th>Hasat</th><th>Maliyet</th><th>Gelir</th><th>Kar</th></tr></thead>
      <tbody>${fieldData.map(({f,s,fc,rev,profit,ph,he})=>{
        const sc=scl(s.pct);
        return`<tr>
          <td style="font-weight:600;white-space:nowrap;"><span style="width:8px;height:8px;border-radius:50%;background:${f.color};display:inline-block;margin-right:5px;"></span>${f.name}</td>
          <td>${f.crop||'—'}</td><td>${f.area} ${f.areaUnit||'dön'}</td>
          <td style="font-size:11px;">${ph?ph.stage:'—'}</td>
          <td><span class="tag ${sc.tag}">${sc.l} %${s.pct}</span></td>
          <td style="font-size:11px;">${he?(he.already?'🟢 Hazır!':he.daysLeft+'g'):'—'}</td>
          <td>${Math.round(fc).toLocaleString()}₺</td>
          <td>${Math.round(rev).toLocaleString()}₺</td>
          <td style="color:${profit>=0?'var(--green2)':'var(--red)'}">${Math.round(profit).toLocaleString()}₺</td>
        </tr>`;}).join('')}</tbody></table></div>
    </div>`;
 };
window.aiPestAnalysis = async (fieldId) => { 
  const field = DB.fields.find(f => f.id === fieldId);
  if (!field) return;
  const el = qs('#rec-pest-ai');
  if (!el) return;
  el.innerHTML = '<div class="bubble bs"><div style="display:inline-flex;gap:3px;"><span style="width:5px;height:5px;border-radius:50%;background:currentColor;opacity:.3;animation:dl 1.2s infinite;"></span><span style="width:5px;height:5px;border-radius:50%;background:currentColor;opacity:.3;animation:dl 1.2s .2s infinite;"></span><span style="width:5px;height:5px;border-radius:50%;background:currentColor;opacity:.3;animation:dl 1.2s .4s infinite;"></span></div> AI hastalık riski analiz ediliyor...</div>';
  try {
    const wx = WXC[field.id]?.days || simWX(field.lat, field.lon);
    const today = tstr();
    const futWx = wx.filter(d=>d.date>today).slice(0,7).map(d=>`${d.date.slice(5)}: ${d.tmax}°/${d.tmin}°C yağış:${d.rain}mm`).join(', ');
    const pastWx = wx.filter(d=>d.date<=today).slice(-5).map(d=>`${d.date.slice(5)}: ${d.tmax}°/${d.tmin}°C yağış:${d.rain}mm`).join(', ');
    const satStr = SATC[field.id]?.data ? satCtxStr(field) : 'Uydu verisi yok';
    const lastSpray = (field.events||[]).filter(e=>e.type==='ilaç'&&!e.planned).sort((a,b)=>b.date.localeCompare(a.date))[0];
    const ph = calcPheno(field);
    const pests = (PEST_DATA[field.crop] || PEST_DATA.default).join(', ');
    const s = await calcSoil(field);
    const prompt = `Sen bir Türk fitopatoloji ve entomoloji uzmanısın.
    
TARLA: ${field.name} | ÜRÜN: ${field.crop||'?'} | DÖNEM: ${ph?.stage||'bilinmiyor'} | Alan: ${field.area} ${field.areaUnit||'dönüm'}
TOPRAK: ${field.soilType} | Nem: %${s.pct}
SON 5 GÜN HAVA: ${pastWx}
ÖNÜMÜZDEKİ 7 GÜN: ${futWx}
UYDU VERİLERİ: ${satStr}
BİLİNEN ZARARLILAR: ${pests}
SON İLAÇLAMA: ${lastSpray ? lastSpray.date + ' (' + Math.round((Date.now()-new Date(lastSpray.date))/(864e5)) + ' gün önce, ' + (lastSpray.extra?.['e-pt']||'') + ')' : 'kayıt yok'}

Mevcut hava koşulları, uydu indeksleri (NDWI/NDVI/nem), toprak nemi ve fenolojik döneme göre:
1. Bu ürün için şu an en yüksek riskli hastalık ve zararlıları belirle
2. Her biri için risk seviyesi (Düşük/Orta/Yüksek/Kritik) ve neden
3. Somut önlem ve varsa ilaçlama önerisi (aktif madde, zamanlama)
4. Biyolojik/organik alternatif öneriler
Türkçe, kısa ve uygulanabilir. Maksimum 4-5 madde.`;
    
    const apiKey = await window.getGeminiKey();
    if (!apiKey) { el.innerHTML = '<div style="color:var(--red);font-size:12px;">API anahtarı alınamadı.</div>'; return; }
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-preview:generateContent?key=${apiKey}`;
    const resp = await fetch(url, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({contents:[{role:'user',parts:[{text:prompt}]}], generationConfig:{temperature:0.55, maxOutputTokens:1500}})
    });
    if (!resp.ok) { const err = await resp.json(); throw new Error(err.error?.message||resp.status); }
    const data = await resp.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Yanıt alınamadı';
    const rendered = text
      .replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>')
      .split('\n').map(l => l.trim() ? `<div style="margin-bottom:5px;">${l}</div>` : '').join('');
    el.innerHTML = `<div class="bubble bb" style="font-size:12px;line-height:1.6;margin-top:4px;">${rendered}</div>`;
  } catch(e) {
    el.innerHTML = `<div style="color:var(--red);font-size:12px;">AI Hata: ${e.message}</div>`;
  }
 };

// ──────────────────────────────────────────────────────────────────
// Koordinatlardan Toprak Tipi Tahmini (ISRIC SoilGrids)
// ──────────────────────────────────────────────────────────────────
window.fetchSoilTypeFromCoords = async (lat, lon) => { 
  // USDA texture sınıflandırması (kod -> isim)
  const textureMap = {
    1:'Sand',2:'Loamy Sand',3:'Sandy Loam',4:'Silt Loam',5:'Silt',
    6:'Loam',7:'Sandy Clay Loam',8:'Silty Clay Loam',9:'Clay Loam',
    10:'Sandy Clay',11:'Silty Clay',12:'Clay'
  };
  const soilMap = {
    'Clay':'killi','Silty Clay':'killi','Sandy Clay':'killi',
    'Clay Loam':'killiTin','Silty Clay Loam':'killiTin','Sandy Clay Loam':'killiTin',
    'Loam':'tinli','Silt Loam':'tinli','Silt':'tinli',
    'Sandy Loam':'kumlu','Loamy Sand':'kumlu','Sand':'kumlu'
  };
  // Türkçe toprak tipi isimleri (gösterim için)
  const soilNameTR = {
    killi:'Killi',killiTin:'Killi-Tın',tinli:'Tınlı',kumlu:'Kumlu',humuslu:'Humuslu',kalkerli:'Kalkerli'
  };
  try {
    // 1. Önce texture_class sorgula (hızlı)
    const txUrl = `https://rest.isric.org/soilgrids/v2.0/properties/query?lon=${lon}&lat=${lat}&property=texture_class&depth=0-5cm&value=mean`;
    const txRes = await fetch(txUrl);
    let soilType = 'tinli';
    if (txRes.ok) {
      const txData = await txRes.json();
      const txCode = txData?.properties?.layers?.[0]?.depths?.[0]?.values?.mean;
      if (txCode != null) {
        const txName = textureMap[Math.round(txCode)] || 'Loam';
        soilType = soilMap[txName] || 'tinli';
      }
    }
    // 2. Kil/kum/silt yüzdelerini ayrı sorgula (hassas FC hesabı için)
    const compUrl = `https://rest.isric.org/soilgrids/v2.0/properties/query?lon=${lon}&lat=${lat}&property=clay&property=sand&property=silt&depth=0-5cm&value=mean`;
    const compRes = await fetch(compUrl);
    if (compRes.ok) {
      const compData = await compRes.json();
      const layers = compData?.properties?.layers || [];
      const getVal = name => {
        const layer = layers.find(l => l.name === name);
        const raw = layer?.depths?.[0]?.values?.mean;
        return raw != null ? raw / 10 : null; // g/kg -> %
      };
      const clay = getVal('clay'), sand = getVal('sand'), silt = getVal('silt');
      if (clay != null && sand != null && silt != null) {
        window.tempSoilComposition = { clay, sand, silt };
        // Bileşen oranlarına göre soilType'ı yeniden belirle (daha hassas)
        if (clay >= 40) soilType = 'killi';
        else if (clay >= 25 && silt >= 15) soilType = 'killiTin';
        else if (sand >= 70) soilType = 'kumlu';
        else if (silt >= 50) soilType = 'tinli';
        else soilType = 'tinli';
      }
    }
    return soilType;
  } catch(e) {
    console.warn('SoilGrids hatası:', e);
    return null;
  }
 };
window.autoFillSoilFromCoords = async () => { 
  const lat = parseFloat(qs('#f-lat')?.value);
  const lon = parseFloat(qs('#f-lon')?.value);
  if (isNaN(lat) || isNaN(lon)) return;
  
  const soilSelect = qs('#f-soil');
  if (!soilSelect) return;
  
  soilSelect.disabled = true;
  soilSelect.style.opacity = '0.6';
  
  try {
    const soilType = await window.fetchSoilTypeFromCoords(lat, lon);
    if (soilType && soilSelect.querySelector(`option[value="${soilType}"]`)) {
      soilSelect.value = soilType;
      // Toprak bileşenlerini de tarla nesnesine eklemek için global değişkende tut
      if (window.tempSoilComposition) {
        window.pendingSoilComp = window.tempSoilComposition;
        delete window.tempSoilComposition;
      }
      const badge = qs('#soil-auto-badge');
      if(badge) badge.style.display = 'inline';
      window.toast(`🌱 Toprak tipi "${soilType === 'killi' ? 'Killi' : soilType === 'killiTin' ? 'Killi-Tın' : soilType === 'tinli' ? 'Tınlı' : soilType === 'kumlu' ? 'Kumlu' : soilType}" olarak belirlendi (SoilGrids)`, false);
    } else if (soilType) {
      window.toast(`Tahmin edilen toprak tipi (${soilType}) listede yok, manuel seçin.`, true);
    } else {
      window.toast('Toprak tipi otomatik alınamadı, manuel seçiniz.', true);
    }
  } catch(e) {
    console.error(e);
    window.toast('Toprak tahmini sırasında hata oluştu.', true);
  } finally {
    soilSelect.disabled = false;
    soilSelect.style.opacity = '';
  }
 };
window.updateAllSoilTypes = async () => { 
  if (!DB.fields.length) {
    toast('Güncellenecek tarla yok.', true);
    return;
  }
  
  toast('Toprak tipleri güncelleniyor, lütfen bekleyin...', false);
  let updated = 0;
  let failed = 0;
  
  for (const field of DB.fields) {
    try {
      const newSoil = await window.fetchSoilTypeFromCoords(field.lat, field.lon);
      if (newSoil && newSoil !== field.soilType) {
        field.soilType = newSoil;
        if (window.tempSoilComposition) {
          field.soilComposition = window.tempSoilComposition;
          delete window.tempSoilComposition;
        }
        await saveFieldToDB(field);
        updated++;
        window.invSoil(field.id);
      }
    } catch(e) {
      console.warn(`${field.name} güncellenemedi:`, e);
      failed++;
    }
  }
  
  await window.renderAll();
  if (window.CUR) window.renderFieldPage(window.CUR);
  
  toast(`✅ Güncelleme tamamlandı: ${updated} tarla güncellendi, ${failed} başarısız.`, failed > 0);
 };

// ──────────────────────────────────────────────────────────────────
// Başlatma
// ──────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const th = localStorage.getItem('tt_theme');
  if (th === 'dark') document.documentElement.setAttribute('dark', '');
  window.loadSettings();
  setTimeout(() => { if (!window.FB_MODE) window.noFBNotice(); }, 1500);
  qs('#main')?.addEventListener('click', () => { if (window.innerWidth <= 768) qs('#sb')?.classList.remove('open'); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') window.closePhViewer(); });
  if (!window.FB_USER && window.DB.fields.length) {
    window.fetchAllSatellites().catch(e => console.warn('Başlangıç uydu çekim hatası:', e));
  }
});
