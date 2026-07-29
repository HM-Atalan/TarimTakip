// ============================================================
// soilModel.js – FAO‑56 RZWB çift katman toprak nem modeli
//
// DÜZELTME NOTLARI:
// 1) Uydu verisi ARTIK SADECE ledger boşken (ilk kurulum / bootstrap)
//    başlangıç Dr_s / Dr_d seviyesini tahmin etmek için kullanılıyor.
//    Önceki "softCalibrateRZWB" — her uydu yenilemesinde bugünün
//    değerini uyduya doğru çeken günlük drift-correction — TAMAMEN
//    KALDIRILDI. Sebep: uydu, tarla ölçeğinden çok daha geniş/kaba
//    çözünürlüklü bir toprak nemi veriyor; bunu günlük "gerçek"
//    referans gibi kullanmak fiziksel simülasyonu bozan, keyfi bir
//    dış müdahaleydi. Artık 90 günlük pencere boyunca model sadece
//    hava verisi + sulama olaylarıyla kendi başına, tutarlı şekilde
//    ilerliyor.
// 2) rzwbStep içinde derin katman artık kendi tarla kapasitesini
//    aştığında bu fazlayı "percDeep" (kök bölgesi altına drenaj/kayıp)
//    olarak günlük hesaplayıp raporluyor — önceden bu su sessizce
//    clamp ile yok oluyordu.
// ============================================================

window.getRZWBParams = (field) => {
  if (!field) {
    console.warn("Hesaplama yapılacak tarla (field) seçili değil veya bulunamadı.");
    return null;
  }
  const soil = RZWB_SOIL[field.soilType] || RZWB_SOIL.tinli;
  let fcs = soil.fcs, wps = soil.wps, fcd = soil.fcd*2, wpd = soil.wpd*2;
  if(field.soilComposition) {
    const { clay: cl, sand: sa, silt: si } = field.soilComposition;
    const fc_calc  = (0.299 - 0.251*sa/100 + 0.195*cl/100) * 100;
    const wp_calc  = (0.026 + 0.5*cl/100 - 0.013*sa/100) * 100;
    if(fc_calc>20 && fc_calc<180){ fcs=Math.round(fc_calc); fcd=Math.round(fc_calc*1.1)*2; }
    if(wp_calc>5  && wp_calc<80) { wps=Math.round(wp_calc); wpd=Math.round(wp_calc*1.1)*2; }
  }
  const mad  = MAD_TABLE[field.category] ?? 0.50;
  const taw_s = Math.max(1, fcs - wps);
  const taw_d = Math.max(1, fcd - wpd);
  const raw_s = taw_s * mad;
  const raw_d = taw_d * mad;
  return { fcs, wps, fcd, wpd, taw_s, taw_d, raw_s, raw_d, mad };
};

window.rzwbStep = (prev, dayWx, irrMm, params, field) => {
  const { fcs, fcd, taw_s, taw_d, raw_s, raw_d } = params;
  const a = window.agrd(field.crop);

  const [rootS, rootD] = ROOT_SPLIT[field.crop] || [0.35, 0.65];

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

  const ks_s = prev.Dr_s <= raw_s ? 1.0
    : Math.max(0, (taw_s - prev.Dr_s) / Math.max(1, taw_s - raw_s));
  const ks_d = prev.Dr_d <= raw_d ? 1.0
    : Math.max(0, (taw_d - prev.Dr_d) / Math.max(1, taw_d - raw_d));

  const et0 = dayWx.et0 > 0 ? dayWx.et0
    : a.et * (dayWx.tmax > 38 ? 1.45 : dayWx.tmax > 33 ? 1.2 : 1.0);

  const isFallow = field.status === 'fallow';
  const ETc_s = isFallow ? et0 * 0.20 : et0 * kc * rootS * ks_s;
  const ETc_d = isFallow ? et0 * 0.03 : et0 * kc * rootD * ks_d;

  const rain = dayWx.rain || 0;
  const eff  = rain > 30 ? 0.70 : rain > 15 ? 0.82 : rain > 5 ? 0.92 : 1.0;
  const Pe   = +(rain * eff).toFixed(1);

  const Dr_s_before = +prev.Dr_s.toFixed(1);
  const Dr_d_before = +prev.Dr_d.toFixed(1);

  const percCoeff = PERC_COEFF[field.soilType] || 0.60;

  // ── YÜZEY KATMANI (0-10cm) ──
  const rawDr_s = prev.Dr_s - Pe - irrMm + ETc_s;
  // Yüzey tarla kapasitesini aşan fazla su, katsayıya göre derine sızar
  const percToDeep = rawDr_s < 0 ? Math.min(-rawDr_s * percCoeff, taw_d) : 0;
  const Dr_s = Math.max(0, Math.min(taw_s, rawDr_s));

  // ── DERİN KATMAN (10-30cm) — yüzeyden gelen sızmayı alır ──
  const rawDr_d = prev.Dr_d - percToDeep + ETc_d;
  // Derin katman da kendi tarla kapasitesini aşarsa, fazlası kök
  // bölgesinin altına drene olur (gerçek fiziksel kayıp / percDeep)
  const percBelowRoot = rawDr_d < 0 ? +(-rawDr_d).toFixed(1) : 0;
  const Dr_d = Math.max(0, Math.min(taw_d, rawDr_d));

  const surfState = window.calcMoistureState(fcs, taw_s, Dr_s);
  const deepState = window.calcMoistureState(fcd, taw_d, Dr_d);

  return {
    Dr_s: surfState.Dr, Dr_d: deepState.Dr,
    kc:   +kc.toFixed(3),
    Ks_s: +ks_s.toFixed(3), Ks_d: +ks_d.toFixed(3),
    ETc_s: +ETc_s.toFixed(1), ETc_d: +ETc_d.toFixed(1),
    et0: +et0.toFixed(1), rain: +rain.toFixed(1),
    Pe, irr: +irrMm.toFixed(1),
    perc: +percToDeep.toFixed(1),     // yüzey → derin katman sızması
    percDeep: percBelowRoot,          // derin katman → kök altı drenaj (kalıcı kayıp)
    netIn: +(Pe + irrMm).toFixed(1),
    pct_s: surfState.pct, pct_d: deepState.pct,
    moist_s: surfState.moist, moist_d: deepState.moist,
    Dr_s_before, Dr_d_before,
    rootS, rootD, percCoeff,
  };
};

window.calcSoilRZWB = async (field, force = false) => {
  const params  = window.getRZWBParams(field);
  const { fcs, fcd, taw_s, taw_d } = params;
  const today   = tstr();
  const uid     = window.FB_USER?.uid;
  const fbKey   = 'tt_rzwb_' + field.id;

  let ledger = [];

  if(uid && window.FB_MODE) {
    let cached = window.RZWB_CACHE[field.id];
    if(!cached || force) {
      const raw = await window.fbLoadRZWB(uid, field.id);
      if(raw?.records?.length) {
        cached = raw;
        window.RZWB_CACHE[field.id] = { records: raw.records, loadedAt: Date.now() };
      }
    }
    if(cached?.records?.length) ledger = cached.records;
  }

  if(!ledger.length) {
    try {
      const raw = localStorage.getItem(fbKey);
      if(raw) ledger = JSON.parse(raw);
    } catch(e) {}
  }

  const cutoff90 = new Date(); cutoff90.setDate(cutoff90.getDate() - 90);
  const cutoff90str = window.dateKey(cutoff90);
  ledger = ledger.filter(r => r.date >= cutoff90str && r.date <= today);

  const irrMap = {};
  (field.events || [])
    .filter(e => e.type === 'sulama' && !e.planned && e.date <= today)
    .forEach(e => {
      const mm = window.parseIrrMm(e, fcs, field);
      irrMap[e.date] = (irrMap[e.date] || 0) + mm;
    });

  const lastRec  = ledger.length ? ledger[ledger.length - 1] : null;
  const isBootstrap = !lastRec;

  let simStart, initDr_s, initDr_d, satCalibrated = false;

  if(isBootstrap) {
    // ── BAŞLANGIÇ SEVİYESİ TAHMİNİ ──
    // Uydu verisi SADECE burada, ledger hiç yokken, ilk gün için bir
    // başlangıç nemi tahmini olarak kullanılır. Bu tarih sonrasında
    // model artık uyduya bakmaz; tamamen hava + sulama fiziğiyle ilerler.
    const agroMid  = SATC[field.id]?.data?.soilM3;
    const agroDeep = SATC[field.id]?.data?.soilMDeep;
    const satDate  = SATC[field.id]?.at;
    const satFresh = agroMid > 0.01 && satDate && (Date.now() - satDate) < 43200000;

    if(satFresh) {
      const sat_moist_s = Math.min(fcs, agroMid * fcs * 1.15);
      const sat_moist_d = Math.min(fcd, (agroDeep || agroMid * 0.88) * fcd);
      initDr_s = Math.max(0, fcs - sat_moist_s);
      initDr_d = Math.max(0, fcd - sat_moist_d);
      initDr_s = Math.min(initDr_s, taw_s);
      initDr_d = Math.min(initDr_d, taw_d);
      satCalibrated = true;
      console.log(`🛰️ Başlangıç (uydu): Dr_s=${initDr_s.toFixed(1)} Dr_d=${initDr_d.toFixed(1)}`);
    } else {
      initDr_s = Math.min(taw_s * 0.55, taw_s);
      initDr_d = Math.min(taw_d * 0.50, taw_d);
      console.log(`⚠️ Başlangıç (varsayılan): Dr_s=${initDr_s.toFixed(1)} Dr_d=${initDr_d.toFixed(1)}`);
    }

    await window.fetchWXHistory(field);
    simStart = cutoff90str;
  } else {
    initDr_s = lastRec.Dr_s;
    initDr_d = lastRec.Dr_d;
    const nextDay = new Date(lastRec.date + 'T12:00:00');
    nextDay.setDate(nextDay.getDate() + 1);
    simStart = window.dateKey(nextDay);
    // NOT: simStart her zaman "son kayıt + 1 gün" olarak hesaplanır. Eğer
    // bu, bugünün tarihinden ilerideyse (simStart > today), aşağıdaki
    // simDays filtresi (d.date >= simStart && d.date <= today) hiçbir
    // günü seçemez — yani HİÇBİR gelecek tarih simüle EDİLMEZ. Bu durumda
    // log mesajını "zaten güncel" olarak yazdırıyoruz ki yanıltıcı
    // görünmesin (önceden simStart bugünden ileri olsa bile "→ simStart"
    // yazdırılıyordu, sanki yarın hesaplanacakmış gibi okunuyordu).
    if (simStart > today) {
      console.log(`📖 Ledger güncel: ${field.name} — son kayıt zaten bugüne (${lastRec.date}) ait, yeni gün hesaplanmayacak. Dr_s=${initDr_s} Dr_d=${initDr_d}`);
    } else {
      console.log(`📖 Ledger devam: ${field.name} — ${lastRec.date} → ${simStart} arası hesaplanacak. Dr_s=${initDr_s} Dr_d=${initDr_d}`);
    }
  }

  const wxAll = window.getBestWXDays(field);
  const existingDates = new Set(ledger.map(r => r.date));

  const simDays = wxAll.filter(d =>
    d.date >= simStart &&
    d.date <= today &&
    !existingDates.has(d.date)
  );

  let prev = { Dr_s: initDr_s, Dr_d: initDr_d };
  const newRecords = [];

  for(const dayWx of simDays) {
    const irrMm = irrMap[dayWx.date] || 0;
    const step  = window.rzwbStep(prev, dayWx, irrMm, params, field);
    newRecords.push({ date: dayWx.date, ...step });
    prev = { Dr_s: step.Dr_s, Dr_d: step.Dr_d };
  }

  if(newRecords.length) {
    ledger = [...ledger, ...newRecords]
      .sort((a, b) => a.date.localeCompare(b.date))
      .filter(r => r.date >= cutoff90str && r.date <= today);

    try { localStorage.setItem(fbKey, JSON.stringify(ledger)); } catch(e) {}

    if(uid && window.FB_MODE) {
      window.fbSaveRZWB(uid, field.id, ledger)
        .then(() => {
          window.RZWB_CACHE[field.id] = { records: ledger, loadedAt: Date.now() };
        })
        .catch(e => console.warn('RZWB Firebase yazma:', e.message));
    }
  }

  let repaired = false;
  const wxByDate = Object.fromEntries(wxAll.map(d => [d.date, d]));
  ledger = ledger.sort((a, b) => a.date.localeCompare(b.date));
  const repairFrom = ledger.findIndex(rec =>
    wxByDate[rec.date] && window.isIncompleteRZWBRecord(rec, irrMap[rec.date] || 0)
  );
  if(repairFrom >= 0) {
    const repairedLedger = ledger.slice(0, repairFrom);
    let repairPrev = repairFrom > 0
      ? { Dr_s: ledger[repairFrom - 1].Dr_s, Dr_d: ledger[repairFrom - 1].Dr_d }
      : { Dr_s: ledger[repairFrom].Dr_s, Dr_d: ledger[repairFrom].Dr_d };

    for(let i = repairFrom; i < ledger.length; i++) {
      const rec = ledger[i];
      const dayWx = wxByDate[rec.date];
      if(!dayWx) {
        repairedLedger.push(rec);
        repairPrev = { Dr_s: rec.Dr_s, Dr_d: rec.Dr_d };
        continue;
      }
      const step = window.rzwbStep(
        repairPrev,
        dayWx,
        irrMap[rec.date] || 0,
        params,
        field
      );
      repairedLedger.push({ ...rec, ...step });
      repairPrev = { Dr_s: step.Dr_s, Dr_d: step.Dr_d };
    }

    ledger = repairedLedger;
    repaired = true;
  }

  if(repaired) {
    try { localStorage.setItem(fbKey, JSON.stringify(ledger)); } catch(e) {}
    if(uid && window.FB_MODE) {
      window.fbSaveRZWB(uid, field.id, ledger)
        .then(() => { window.RZWB_CACHE[field.id] = { records: ledger, loadedAt: Date.now() }; })
        .catch(e => console.warn('RZWB Firebase onarım yazma:', e.message));
    }
  }

  ledger = ledger.map(r => window.normalizeRZWBRecord(r, params));

  let todayRec = ledger.find(r => r.date === today);
  if(todayRec) {
    todayRec = window.normalizeRZWBRecord(todayRec, params);
  }

  if(!todayRec && prev.Dr_s !== undefined) {
    const surfState = window.calcMoistureState(fcs, taw_s, prev.Dr_s);
    const deepState = window.calcMoistureState(fcd, taw_d, prev.Dr_d);
    todayRec = {
      Dr_s: surfState.Dr, Dr_d: deepState.Dr,
      pct_s: surfState.pct, pct_d: deepState.pct,
      moist_s: surfState.moist, moist_d: deepState.moist,
      kc: 0.7, Ks_s: 1, Ks_d: 1, ETc_s: 0, ETc_d: 0,
      et0: 0, rain: 0, irr: 0, perc: 0, percDeep: 0, netIn: 0, date: today,
    };
  }

  if(!todayRec) {
    const mid_s   = Math.round(taw_s * 0.45);
    const mid_d   = Math.round(taw_d * 0.50);
    const surfState = window.calcMoistureState(fcs, taw_s, mid_s);
    const deepState = window.calcMoistureState(fcd, taw_d, mid_d);
    todayRec = {
      Dr_s: surfState.Dr, Dr_d: deepState.Dr,
      pct_s: surfState.pct, pct_d: deepState.pct,
      moist_s: surfState.moist, moist_d: deepState.moist,
      kc: 0.7, Ks_s: 1, Ks_d: 1, ETc_s: 0, ETc_d: 0,
      et0: 0, rain: 0, irr: 0, perc: 0, percDeep: 0, netIn: 0, date: today,
    };
  }

  const pct_s_out   = Math.max(0, Math.min(100, todayRec.pct_s ?? 0));
  const pct_d_out   = Math.max(0, Math.min(100, todayRec.pct_d ?? 0));
  const moist_s_out = Math.max(0, todayRec.moist_s ?? 0);
  const moist_d_out = Math.max(0, todayRec.moist_d ?? 0);

  const result = {
    surface: {
      pct:   pct_s_out,
      moist: moist_s_out,
      fc:    fcs,
      Dr:    todayRec.Dr_s,
      taw:   taw_s,
      raw:   params.raw_s,
      Ks:    todayRec.Ks_s ?? 1,
    },
    deep: {
      pct:   pct_d_out,
      moist: moist_d_out,
      fc:    fcd,
      Dr:    todayRec.Dr_d,
      taw:   taw_d,
      raw:   params.raw_d,
      Ks:    todayRec.Ks_d ?? 1,
    },
    et:           window.agrd(field.crop).et,
    kc:           todayRec.kc ?? 0.7,
    Ks:           Math.min(todayRec.Ks_s ?? 1, todayRec.Ks_d ?? 1),
    ETc:          +((todayRec.ETc_s ?? 0) + (todayRec.ETc_d ?? 0)).toFixed(1),
    log:          ledger.slice(-7),
    params,
    satCalibrated,   // sadece bootstrap gününde true olabilir; sürekli kalibrasyon YOK
    isBootstrap,
    pct:   pct_s_out,
    moist: moist_s_out,
    fc:    fcs,
  };

  return result;
};

window.calcSoil = (field) => window.calcSoilRZWB(field);

window.debugSoilModel = async (field = window.CUR) => {
  if(!field) {
    console.warn('Önce bir tarla seçin, sonra await debugSoilModel() çalıştırın.');
    return null;
  }
  const s = await window.calcSoilRZWB(field, true);
  const main = {
    tarla: field.name,
    yuzey_pct: s.surface.pct,
    yuzey_moist_mm: s.surface.moist,
    yuzey_fc_mm: s.surface.fc,
    yuzey_Dr_mm: s.surface.Dr,
    yuzey_TAW_mm: s.surface.taw,
    yuzey_RAW_mm: s.surface.raw,
    yuzey_Ks: s.surface.Ks,
    derin_pct: s.deep.pct,
    derin_moist_mm: s.deep.moist,
    derin_fc_mm: s.deep.fc,
    derin_Dr_mm: s.deep.Dr,
    derin_TAW_mm: s.deep.taw,
    derin_RAW_mm: s.deep.raw,
    derin_Ks: s.deep.Ks,
    Kc: s.kc,
    ETc_toplam_mm: s.ETc,
  };
  const check = {
    yuzey_pct_ok: Math.abs(s.surface.pct - Math.round(s.surface.moist / s.surface.fc * 100)) <= 1,
    derin_pct_ok: Math.abs(s.deep.pct - Math.round(s.deep.moist / s.deep.fc * 100)) <= 1,
    yuzey_moist_ok: s.surface.moist === Math.round(s.surface.fc - s.surface.Dr),
    derin_moist_ok: s.deep.moist === Math.round(s.deep.fc - s.deep.Dr),
  };
  const log = (s.log || []).map(r => ({
    tarih: r.date,
    Pe_mm: r.Pe,
    sulama_mm: r.irr,
    ETc_yuzey_mm: r.ETc_s,
    ETc_derin_mm: r.ETc_d,
    sizma_yuzeyden_derine_mm: r.perc,
    kok_alti_drenaj_mm: r.percDeep,
    Dr_yuzey_mm: r.Dr_s,
    Dr_derin_mm: r.Dr_d,
    nem_yuzey_pct: r.pct_s,
    nem_derin_pct: r.pct_d,
    nem_yuzey_mm: r.moist_s,
    nem_derin_mm: r.moist_d,
    Kc: r.kc,
    Ks_yuzey: r.Ks_s,
    Ks_derin: r.Ks_d,
  }));
  console.table(main);
  console.table(check);
  console.table(log);
  return { main, check, log, raw: s };
};

window.computeAllSoils = async (force = false) => {
  const now = Date.now();
  if (!force && window.SOIL_CACHE.data && (now - window.SOIL_CACHE.lastUpdated < 300000)) {
    return window.SOIL_CACHE.data;
  }
  if(force) window.RZWB_CACHE = {};
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

window.invSoil = (fid) => { Object.keys(SC).filter(k=>k.startsWith(fid+'_')).forEach(k=>delete SC[k]); };
window.invSoilAll = () => { Object.keys(SC).forEach(k=>delete SC[k]); };

window.scl = (pct) => {
  if(pct>78) return {l:'Islak',  tag:'tb', color:'var(--blue)',   bg:'var(--bbg)'};
  if(pct>58) return {l:'Nemli',  tag:'tg', color:'var(--green2)', bg:'var(--glt)'};
  if(pct>38) return {l:'Yeterli',tag:'tgr',color:'var(--text2)',  bg:'var(--bg3)'};
  if(pct>20) return {l:'Kuru',   tag:'ta', color:'var(--amber)',  bg:'var(--abg)'};
  return            {l:'Kurak',  tag:'tr', color:'var(--red)',    bg:'var(--rbg)'};
};

window.calcIrrigationNeed = (field, s) => {
  const p = s.params || window.getRZWBParams(field);
  const { fcs, taw_s, raw_s, mad } = p;
  const Dr_s       = s.surface.Dr ?? Math.max(0, fcs - s.surface.moist);
  const Ks         = s.surface.Ks ?? 1;
  const triggerPct = Math.max(0, Math.min(100, Math.round(((fcs - raw_s) / Math.max(1, fcs)) * 100)));
  const targetMoist = fcs * 0.90;
  const deficitMm   = Math.round(Math.max(0, targetMoist - s.surface.moist));
  const wx      = WXC[field.id]?.days || simWX(field.lat, field.lon);
  const today   = tstr();
  const futWx   = wx.filter(d => d.date > today).slice(0, 7);
  const futR    = futWx.reduce((t, d) => t + d.rain, 0);
  const futET   = futWx.reduce((t, d) => t + (d.et0 || s.et || window.agrd(field.crop).et), 0);
  const netBalance = futR - futET;
  const effRain    = Math.min(deficitMm, futR * 0.7);
  const recommendedMm = Math.round(Math.max(0, deficitMm - effRain));
  const lastLog     = s.log?.[s.log.length - 1];
  const dailyUse    = lastLog
    ? Math.max(0.5, (lastLog.ETc_s ?? lastLog.et_surf ?? s.et * 0.35))
    : Math.max(0.5, (s.ETc ?? s.et) * 0.35);
  const criticalMoist     = (p.wps ?? 15) + 10;
  const daysUntilCritical = s.surface.moist > criticalMoist
    ? Math.round((s.surface.moist - criticalMoist) / dailyUse) : 0;
  const stressLabel = Ks < 0.5 ? 'Ağır stres' : Ks < 0.8 ? 'Orta stres'
    : Ks < 1 ? 'Hafif stres' : 'Stres yok';
  const belowRaw   = Dr_s > raw_s;
  const critical   = s.surface.moist <= criticalMoist;
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

window.calcFieldCapacity = (soilType, cl, sa, si, layer='surface') => {
  const p = window.getRZWBParams({ soilType, soilComposition: cl!=null?{clay:cl,sand:sa,silt:si}:null });
  return layer === 'deep' ? p.fcd : p.fcs;
};

// ─── Firebase RZWB yardımcıları ──────────────────────────────
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

window.invalidateRZWBFrom = async (fieldId, fromDate) => {
  if(!fieldId || !fromDate) return;
  const fbKey = 'tt_rzwb_' + fieldId;

  let ledger = [];
  try {
    const raw = localStorage.getItem(fbKey);
    if(raw) ledger = JSON.parse(raw);
  } catch(e) {}

  const before = ledger.length;
  ledger = ledger.filter(r => r.date < fromDate);
  const removed = before - ledger.length;

  if(removed > 0) {
    console.log(`🔄 RZWB invalidate: ${fieldId} → ${fromDate} tarihinden itibaren ${removed} kayıt silindi, yeniden hesaplanacak`);
  }

  try { localStorage.setItem(fbKey, JSON.stringify(ledger)); } catch(e) {}

  delete window.RZWB_CACHE[fieldId];

  const uid = window.FB_USER?.uid;
  if(uid && window.FB_MODE) {
    try {
      await window.fbSaveRZWB(uid, fieldId, ledger);
      window.RZWB_CACHE[fieldId] = { records: ledger, loadedAt: Date.now() };
    } catch(e) {
      console.warn('RZWB invalidate Firebase yazma hatası:', e.message);
    }
  }

  if(typeof window.invSoil === 'function') window.invSoil(fieldId);
};
