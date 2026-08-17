// ============================================================
// soilModel.js – FAO‑56 RZWB çift katman toprak nem modeli
// NOT: Bu, gerçek soilModel.js'in TAMAMI DEĞİLDİR.
// Sadece DOM/localStorage/Firebase bağımlılığı olmayan SAF
// fonksiyonlar (getRZWBParams, rzwbStep, scl) buraya BİREBİR,
// TEK SATIR DEĞİŞTİRİLMEDEN kopyalanmıştır. calcSoilRZWB,
// fbSaveRZWB/fbLoadRZWB, invalidateRZWBFrom, calcIrrigationNeed
// gibi fonksiyonlar bu harness'te ayrı bir bölümde "test
// edilemeyenler" olarak raporlanmıştır (bkz. rapor).
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

// A daily RZWB transition is not fully described by depletion alone: water
// held above field capacity must also survive until the next step.  Older
// ledgers do not contain the surplus fields, so missing values deliberately
// fall back to zero for backward compatibility.
window.toRZWBState = (record, fallbackDr_s = 0, fallbackDr_d = 0) => ({
  Dr_s: Number.isFinite(record?.Dr_s) ? record.Dr_s : fallbackDr_s,
  Dr_d: Number.isFinite(record?.Dr_d) ? record.Dr_d : fallbackDr_d,
  surplus_s: Number.isFinite(record?.surplus_s) ? Math.max(0, record.surplus_s) : 0,
  surplus_d: Number.isFinite(record?.surplus_d) ? Math.max(0, record.surplus_d) : 0,
});

window.interpolateCropKc = (kcValues, ratio) => {
  if (!Array.isArray(kcValues) || kcValues.length < 3 || !kcValues.every(Number.isFinite)) return 0.7;
  const r = Math.max(0, Math.min(1, Number(ratio) || 0));
  const lerp = (a, b, t) => a + (b - a) * Math.max(0, Math.min(1, t));
  if (r >= 1) return kcValues[Math.min(3, kcValues.length - 1)];
  if (r <= 0.1) return kcValues[0];

  if (kcValues.length === 3) {
    if (r < 0.5) return lerp(kcValues[0], kcValues[1], (r - 0.1) / 0.4);
    if (r <= 0.8) return kcValues[1];
    return lerp(kcValues[1], kcValues[2], (r - 0.8) / 0.2);
  }

  if (r < 0.5) return lerp(kcValues[0], kcValues[1], (r - 0.1) / 0.4);
  if (r < 0.8) return lerp(kcValues[1], kcValues[2], (r - 0.5) / 0.3);
  return lerp(kcValues[2], kcValues[3], (r - 0.8) / 0.2);
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
      kc = window.interpolateCropKc(a.kc, ratio);
    }
  }

  const ks_s = prev.Dr_s <= raw_s ? 1.0
    : Math.max(0, (taw_s - prev.Dr_s) / Math.max(1, taw_s - raw_s));
  const ks_d = prev.Dr_d <= raw_d ? 1.0
    : Math.max(0, (taw_d - prev.Dr_d) / Math.max(1, taw_d - raw_d));

  const et0Resolved = window.resolveDailyET0(dayWx, field);
  const et0 = et0Resolved.value;

  const isFallow = field.status === 'fallow';
  const ETc_s = isFallow ? et0 * 0.20 : et0 * kc * rootS * ks_s;
  const ETc_d = isFallow ? et0 * 0.03 : et0 * kc * rootD * ks_d;

  const rain = Math.max(0, Number(dayWx.rain) || 0);
  const Pe   = +window.calcEffectiveRain(rain).toFixed(1);

  const Dr_s_before = +prev.Dr_s.toFixed(1);
  const Dr_d_before = +prev.Dr_d.toFixed(1);

  const percCoeff = PERC_COEFF[field.soilType] || 0.60;
  const prevSurplus_s = prev.surplus_s || 0;
  const prevSurplus_d = prev.surplus_d || 0;

  const effPrevDr_s = prev.Dr_s - prevSurplus_s;
  const rawDr_s = effPrevDr_s - Pe - irrMm + ETc_s;

  let percToDeep = 0, Dr_s, surplus_s_out = 0;
  if (rawDr_s < 0) {
    const totalSurplus = -rawDr_s;
    const capSurplus   = taw_s;
    const fastBypass   = Math.max(0, totalSurplus - capSurplus);
    const slowPool     = Math.min(totalSurplus, capSurplus);
    const slowDrain    = slowPool * percCoeff;
    percToDeep     = fastBypass + slowDrain;
    surplus_s_out  = Math.max(0, slowPool - slowDrain);
    Dr_s = 0;
  } else {
    Dr_s = Math.min(taw_s, rawDr_s);
  }
  // DÜZELTME (su muhasebesi bug fix): Önceden burada
  // "percToDeep = Math.min(percToDeep, taw_d);" satırı vardı.
  // Bu satır, tek günde derin katmanın TAW'ını (taw_d) aşan
  // percToDeep miktarını HİÇBİR DEĞİŞKENE YAZMADAN siliyordu
  // (aşırı sulama/yağış testlerinde su kayboluyordu).
  // Artık percToDeep KIRPILMADAN aşağıdaki derin katman
  // hesabına aktarılıyor; derin katmanın KENDİ ZATEN VAR OLAN
  // taşma mekanizması (fastBypass + slowDrain → percBelowRoot)
  // taw_d'yi aşan her mm'yi otomatik olarak kök-altı kalıcı
  // drenaja (percDeep) yönlendiriyor. Yeni bir kayıp mekanizması
  // İCAT EDİLMEDİ — mevcut derin-katman taşma mantığı kullanıldı.

  const effPrevDr_d = prev.Dr_d - prevSurplus_d;
  const rawDr_d = effPrevDr_d - percToDeep + ETc_d;

  let percBelowRoot = 0, Dr_d, surplus_d_out = 0;
  if (rawDr_d < 0) {
    const totalSurplus = -rawDr_d;
    const capSurplus   = taw_d;
    const fastBypass   = Math.max(0, totalSurplus - capSurplus);
    const slowPool     = Math.min(totalSurplus, capSurplus);
    const slowDrain    = slowPool * percCoeff;
    percBelowRoot  = +(fastBypass + slowDrain).toFixed(1);
    surplus_d_out  = Math.max(0, slowPool - slowDrain);
    Dr_d = 0;
  } else {
    Dr_d = Math.min(taw_d, rawDr_d);
  }

  const surfState = window.calcMoistureState(fcs, taw_s, Dr_s);
  const deepState = window.calcMoistureState(fcd, taw_d, Dr_d);

  return {
    Dr_s: surfState.Dr, Dr_d: deepState.Dr,
    surplus_s: +surplus_s_out.toFixed(2),
    surplus_d: +surplus_d_out.toFixed(2),
    kc:   +kc.toFixed(3),
    Ks_s: +ks_s.toFixed(3), Ks_d: +ks_d.toFixed(3),
    ETc_s: +ETc_s.toFixed(1), ETc_d: +ETc_d.toFixed(1),
    et0: +et0.toFixed(1), et0Source: et0Resolved.source, rain: +rain.toFixed(1),
    Pe, irr: +irrMm.toFixed(1),
    perc: +percToDeep.toFixed(1),
    percDeep: percBelowRoot,
    netIn: +(Pe + irrMm).toFixed(1),
    pct_s: surfState.pct, pct_d: deepState.pct,
    moist_s: surfState.moist, moist_d: deepState.moist,
    Dr_s_before, Dr_d_before,
    rootS, rootD, percCoeff,
  };
};

window.scl = (pct) => {
  if(pct>78) return {l:'Islak',  tag:'tb'};
  if(pct>58) return {l:'Nemli',  tag:'tg'};
  if(pct>38) return {l:'Yeterli',tag:'tgr'};
  if(pct>20) return {l:'Kuru',   tag:'ta'};
  return            {l:'Kurak',  tag:'tr'};
};

// ============================================================
// SENARYO 4 yardımcısı: tarlanın "var olmaya başladığı" en erken
// makul tarih. Öncelik sırası:
//   1) field.plantDate (ekim/dikim tarihi) — varsa en güvenilir sinyal.
//   2) field.id içine gid() tarafından gömülü oluşturma zaman damgası
//      (gid = Date.now().toString(36) + 4 haneli rastgele sonek).
//      Bu, veri modeline YENİ BİR ALAN EKLEMEDEN mevcut id'den
//      okunabiliyor.
//   3) Hiçbiri çözülemezse null döner — çağıran taraf bu durumda
//      mevcut 90 günlük pencere sınırını (cutoff90) kullanmaya
//      devam eder (davranış bozulmaz, sadece daha güvenilir bir
//      sinyal varsa ona öncelik verilir).
// ============================================================
window.resolveFieldEarliestDate = (field) => {
  if (field?.plantDate) return field.plantDate;
  const id = field?.id || '';
  if (id.length > 4) {
    try {
      const tsPart = id.slice(0, -4); // gid() son 4 karakteri rastgele sonek
      const ms = parseInt(tsPart, 36);
      if (Number.isFinite(ms)) {
        const d = new Date(ms);
        const y = d.getFullYear();
        // Makul aralık kontrolü: eski/bozuk/manuel id formatlarına karşı savunma
        if (y >= 2020 && d.getTime() <= Date.now() + 86400000) {
          return window.dateKey(d);
        }
      }
    } catch (e) { /* id decode edilemedi — sessizce null'a düş */ }
  }
  return null;
};

// ============================================================
// FAZ 4 — Paylaşılan bootstrap/simülasyon yardımcıları
//
// Bu iki fonksiyon, FAZ 3.1'de calcSoilRZWB'nin isBootstrap bloğu
// içine gömülü olan mantığın SAF (yan etkisiz, tekrar kullanılabilir)
// halidir. Davranış BİREBİR AYNI kaldı — sadece kod, hem normal
// bootstrap akışında HEM DE aşağıdaki repairFrom===0 (ilk kayıt bozuk)
// onarım durumunda TEKRARSIZ şekilde kullanılabilsin diye ayrıştırıldı.
// (ÖNCELİK 6: "repairFrom=0 durumunda bozuk kaydı başlangıç state'i
// olarak kullanma → bootstrap mekanizmasını yeniden çalıştır" — bu,
// tam olarak aynı mekanizmanın YENİDEN ÇAĞRILMASIYLA sağlanıyor,
// yeni bir mekanizma icat edilmedi.)
// ============================================================

// Uydu/varsayılan başlangıç state'ini belirler (SAF — DOM/ağ yok,
// sadece SATC'yi okur). fetchWXHistory çağrısı bilerek dışarıda
// bırakıldı (yan etki, çağıran tarafın sorumluluğunda).
window.resolveRZWBBootstrapState = (field, params, today, cutoff90str) => {
  const { fcs, fcd, taw_s, taw_d } = params;

  const earliestFromField = window.resolveFieldEarliestDate(field);
  const earliestAllowed = (earliestFromField && earliestFromField > cutoff90str)
    ? earliestFromField
    : cutoff90str;
  const earliestClamped = earliestAllowed > today ? today : earliestAllowed;

  const agroMid   = SATC[field.id]?.data?.soilM3;
  const agroDeep  = SATC[field.id]?.data?.soilMDeep;
  const satAt     = SATC[field.id]?.at;
  const satDateStr = satAt ? window.dateKey(new Date(satAt)) : null;
  const satUsable = agroMid > 0.01 && satDateStr
    && satDateStr >= earliestClamped && satDateStr <= today;

  let bootstrapSource, bootstrapDate, initDr_s, initDr_d, anchorRecord = null, satCalibrated = false;

  if (satUsable) {
    const sat_moist_s = Math.min(fcs, agroMid * fcs * 1.15);
    const sat_moist_d = Math.min(fcd, (agroDeep || agroMid * 0.88) * fcd);
    initDr_s = Math.min(taw_s, Math.max(0, fcs - sat_moist_s));
    initDr_d = Math.min(taw_d, Math.max(0, fcd - sat_moist_d));
    bootstrapSource = 'open-meteo-soil-model';
    bootstrapDate   = satDateStr;
    satCalibrated   = true;

    // Approach B (FAZ 3.1): uydu değeri doğrudan bootstrapDate'in nihai
    // (gözlemsel) kaydı olarak kullanılır — rzwbStep bu gün için HİÇ
    // çağrılmaz (çift sayım riskini yapısal olarak ortadan kaldırır).
    const surfAnchor = window.calcMoistureState(fcs, taw_s, initDr_s);
    const deepAnchor = window.calcMoistureState(fcd, taw_d, initDr_d);
    anchorRecord = {
      date: bootstrapDate,
      source: 'satellite-anchor',
      sourceProvider: 'open-meteo-soil-model',
      Dr_s: surfAnchor.Dr, Dr_d: deepAnchor.Dr,
      pct_s: surfAnchor.pct, pct_d: deepAnchor.pct,
      moist_s: surfAnchor.moist, moist_d: deepAnchor.moist,
      surplus_s: 0, surplus_d: 0,
      kc: null, Ks_s: 1, Ks_d: 1,
      ETc_s: 0, ETc_d: 0, et0: null, rain: null, Pe: null, irr: null,
      perc: 0, percDeep: 0, netIn: null,
    };
  } else {
    // Default bootstrap: gerçek bir ölçüm anı değil, sabit bir tahmin —
    // Approach A (bootstrapDate'in kendisi de rzwbStep ile simüle edilir)
    // bilerek korunuyor (bkz. FAZ 3.1 analizi — çift sayım riski yok).
    initDr_s = Math.min(taw_s * 0.55, taw_s);
    initDr_d = Math.min(taw_d * 0.50, taw_d);
    bootstrapSource = 'default';
    bootstrapDate   = earliestClamped;
  }

  return { bootstrapSource, bootstrapDate, initDr_s, initDr_d, anchorRecord, satCalibrated, earliestClamped };
};

// Bir başlangıç durumundan (initDr_s/initDr_d) bugüne kadar, simStart
// tarihinden başlayarak her gün için rzwbStep'i sırayla çalıştırır.
// SAF — sadece verilen wxAll dizisini kullanır, hangi tarihlerin
// "zaten ledger'da var" olduğunu bilmez/umursamaz; bu filtrelemeyi
// (existingDates hariç tutma VEYA repair'de tam yeniden inşa) ÇAĞIRAN
// TARAF, wxAll'ı önceden filtreleyerek yapar.
window.simulateRZWBForward = (initDr_s, initDr_d, simStart, today, wxAll, irrMap, params, field, initialState = null) => {
  const simDays = wxAll.filter(d => d.date >= simStart && d.date <= today);
  let prev = window.toRZWBState(initialState, initDr_s, initDr_d);
  const records = [];
  for (const dayWx of simDays) {
    const irrMm = irrMap[dayWx.date] || 0;
    const step = window.rzwbStep(prev, dayWx, irrMm, params, field);
    records.push({ date: dayWx.date, ...step });
    prev = window.toRZWBState(step, step.Dr_s, step.Dr_d);
  }
  return records;
};

window.calcSoilRZWB = async (field, force = false) => {
  const params  = window.getRZWBParams(field);
  const { fcs, fcd, taw_s, taw_d } = params;
  const today   = tstr();
  const uid     = window.FB_USER?.uid;
  const fbKey   = 'tt_rzwb_' + field.id;

  let ledger = [], cloudLedger = [], localLedger = [], needsPersist = false;

  try {
    const raw = localStorage.getItem(fbKey);
    if(raw) localLedger = JSON.parse(raw);
  } catch(e) {}
  ({ ledger: localLedger } = window.normalizeRZWBLedger(localLedger, field.name || field.id));

  if(uid && window.FB_MODE) {
    let cached = window.RZWB_CACHE[field.id];
    if(!cached || force) {
      const raw = await window.fbLoadRZWB(uid, field.id);
      if(raw?.records?.length) {
        cached = raw;
        window.RZWB_CACHE[field.id] = { records: raw.records, loadedAt: Date.now() };
      }
    }
    if(cached?.records?.length) cloudLedger = cached.records;
  }
  ({ ledger: cloudLedger } = window.normalizeRZWBLedger(cloudLedger, field.name || field.id));

  // Aynı güne ait yerel model, bu cihazda en son tamamlanan hesaplamadır.
  // Eski bulut kaydının doğru yerel sonucu açılışta ezmesine izin verme.
  const localLast=localLedger.at(-1)?.date||'';
  const cloudLast=cloudLedger.at(-1)?.date||'';
  if(localLedger.length && localLast>=cloudLast) {
    ledger=localLedger;
    needsPersist=!!uid && JSON.stringify(localLedger)!==JSON.stringify(cloudLedger);
  } else {
    ledger=cloudLedger;
    if(cloudLedger.length) try { localStorage.setItem(fbKey,JSON.stringify(cloudLedger)); } catch(e) {}
  }

  // ══ FAZ 4 — Ledger NORMALİZASYONU (yüklendiği anda) ══
  // Firebase veya localStorage'ın kayıtları HANGİ SIRADA döndürdüğüne
  // (insertion order, eşzamanlı yazma çakışması, elle düzenleme, vb.)
  // GÜVENİLMEZ. Ledger kullanılmadan ÖNCE her zaman tarihe göre
  // normalize edilir: geçersiz tarihli kayıtlar atılır, tarihe göre
  // sıralanır, aynı tarihte birden fazla kayıt varsa tekilleştirilir.
  // Bu, aşağıdaki "lastRec = ledger[ledger.length-1]" satırının HER
  // ZAMAN kronolojik olarak GERÇEKTEN en son kaydı almasını garantiler.
  ({ ledger } = window.normalizeRZWBLedger(ledger, field.name || field.id));

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

  let simStart, initDr_s, initDr_d, initSurplus_s = 0, initSurplus_d = 0,
    satCalibrated = false, bootstrapInfo = null;

  if(isBootstrap) {
    // ══ FAZ 4: bootstrap çözümlemesi artık paylaşılan
    // resolveRZWBBootstrapState yardımcısından geliyor — davranış FAZ 3.1
    // ile BİREBİR AYNI, sadece kod aşağıdaki repairFrom===0 durumuyla
    // paylaşılabilsin diye ortak fonksiyona taşındı. ══
    const bs = window.resolveRZWBBootstrapState(field, params, today, cutoff90str);
    initDr_s = bs.initDr_s; initDr_d = bs.initDr_d;
    satCalibrated = bs.satCalibrated;

    await window.fetchWXHistory(field);

    if (bs.anchorRecord) {
      ledger = [bs.anchorRecord];
      const nextDay = new Date(bs.bootstrapDate + 'T12:00:00'); nextDay.setDate(nextDay.getDate() + 1);
      simStart = window.dateKey(nextDay);
    } else {
      simStart = bs.bootstrapDate;
    }

    if (bs.anchorRecord) {
      const irrOnAnchorDay = irrMap[bs.bootstrapDate] || 0;
      if (irrOnAnchorDay > 0) {
        console.warn(
          `⚠️ RZWB [${field.name || field.id}]: ${bs.bootstrapDate} tarihinde ` +
          `${irrOnAnchorDay.toFixed(1)}mm sulama kaydı var, ama bu tarih uydu ` +
          `ankraj günü olduğu için TOPRAK NEMİ MODELİNE uygulanmıyor (uydu ` +
          `ölçümü o günün nihai durumunu zaten yansıttığı varsayılıyor).`
        );
      }
    }

    bootstrapInfo = {
      bootstrapSource: bs.bootstrapSource, bootstrapDate: bs.bootstrapDate,
      bootstrapDr_s: +bs.initDr_s.toFixed(1), bootstrapDr_d: +bs.initDr_d.toFixed(1),
      simulationStart: simStart, simulationEnd: today,
      anchorApplied: !!bs.anchorRecord,
    };
    console.log(
      `🧭 RZWB bootstrap [${field.name || field.id}] source=${bs.bootstrapSource} ` +
      `bootstrapDate=${bs.bootstrapDate} Dr_s=${bootstrapInfo.bootstrapDr_s} ` +
      `Dr_d=${bootstrapInfo.bootstrapDr_d} sim=${simStart}→${today} ` +
      `anchorApplied=${bootstrapInfo.anchorApplied}`
    );
  } else {
    initDr_s = lastRec.Dr_s;
    initDr_d = lastRec.Dr_d;
    initSurplus_s = Number.isFinite(lastRec.surplus_s) ? Math.max(0, lastRec.surplus_s) : 0;
    initSurplus_d = Number.isFinite(lastRec.surplus_d) ? Math.max(0, lastRec.surplus_d) : 0;
    const nextDay = new Date(lastRec.date + 'T12:00:00');
    nextDay.setDate(nextDay.getDate() + 1);
    simStart = window.dateKey(nextDay);
    if (simStart > today) {
      console.log(`📖 Ledger güncel: ${field.name} — son kayıt zaten bugüne (${lastRec.date}) ait. Dr_s=${initDr_s} Dr_d=${initDr_d}`);
    } else {
      console.log(`📖 Ledger devam: ${field.name} — ${lastRec.date} → ${simStart} arası hesaplanacak. Dr_s=${initDr_s} Dr_d=${initDr_d}`);
    }
  }

  const wxAll = window.getBestWXDays(field);
  const existingDates = new Set(ledger.map(r => r.date));
  const wxForSim = wxAll.filter(d => !existingDates.has(d.date));

  const initialState = { Dr_s: initDr_s, Dr_d: initDr_d, surplus_s: initSurplus_s, surplus_d: initSurplus_d };
  const newRecords = window.simulateRZWBForward(
    initDr_s, initDr_d, simStart, today, wxForSim, irrMap, params, field, initialState
  );
  let prev = newRecords.length
    ? window.toRZWBState(newRecords[newRecords.length - 1])
    : initialState;

  if(newRecords.length) {
    const merged = [...ledger, ...newRecords].filter(r => r.date >= cutoff90str && r.date <= today);
    ({ ledger } = window.normalizeRZWBLedger(merged, field.name || field.id));

    needsPersist = true;
  }

  let repaired = false;
  const wxByDate = Object.fromEntries(wxAll.map(d => [d.date, d]));
  ({ ledger } = window.normalizeRZWBLedger(ledger, field.name || field.id));
  const repairFrom = ledger.findIndex(rec =>
    wxByDate[rec.date] && window.isIncompleteRZWBRecord(rec, irrMap[rec.date] || 0)
  );

  if(repairFrom > 0) {
    // ── ÖNCELİK 6 (repairFrom > 0): önceki GEÇERLİ kayıttan devam et ──
    // (davranış DEĞİŞMEDİ — bu dal zaten doğruydu)
    const repairedLedger = ledger.slice(0, repairFrom);
    let repairPrev = window.toRZWBState(ledger[repairFrom - 1]);

    for(let i = repairFrom; i < ledger.length; i++) {
      const rec = ledger[i];
      const dayWx = wxByDate[rec.date];
      if(!dayWx) {
        repairedLedger.push(rec);
        repairPrev = window.toRZWBState(rec);
        continue;
      }
      const step = window.rzwbStep(repairPrev, dayWx, irrMap[rec.date] || 0, params, field);
      repairedLedger.push({ ...rec, ...step });
      repairPrev = window.toRZWBState(step);
    }

    ledger = repairedLedger;
    repaired = true;

  } else if (repairFrom === 0) {
    // ══ FAZ 4 DÜZELTME (ÖNCELİK 6 — KRİTİK) ══
    // İLK KAYIT BOZUK: bu kaydın KENDİ Dr_s/Dr_d değerleri güvenilmez
    // (zaten bozuk olduğu için burada — eksik/tutarsız alanlar içerebilir).
    // Bu değerleri başlangıç state'i olarak KULLANMAK YERİNE, bootstrap
    // mekanizması (resolveRZWBBootstrapState) — isBootstrap===true
    // durumundaki İLE TAMAMEN AYNI fonksiyon — YENİDEN ÇALIŞTIRILIR ve
    // ledger, bootstrapDate'ten bugüne kadar SIFIRDAN yeniden inşa edilir.
    console.warn(
      `🔧 RZWB [${field.name || field.id}]: İLK KAYIT BOZUK (tarih=${ledger[0]?.date}) — ` +
      `bozuk kaydın kendi Dr_s/Dr_d değerleri başlangıç state'i olarak ` +
      `KULLANILMIYOR. Bootstrap mekanizması yeniden çalıştırılıyor.`
    );

    const bs = window.resolveRZWBBootstrapState(field, params, today, cutoff90str);
    let rebuildSimStart;
    if (bs.anchorRecord) {
      const nextDay = new Date(bs.bootstrapDate + 'T12:00:00'); nextDay.setDate(nextDay.getDate() + 1);
      rebuildSimStart = window.dateKey(nextDay);
    } else {
      rebuildSimStart = bs.bootstrapDate;
    }
    const rebuiltRecords = window.simulateRZWBForward(
      bs.initDr_s, bs.initDr_d, rebuildSimStart, today, wxAll, irrMap, params, field
    );
    const rebuilt = [...(bs.anchorRecord ? [bs.anchorRecord] : []), ...rebuiltRecords];
    ({ ledger } = window.normalizeRZWBLedger(rebuilt, field.name || field.id));
    repaired = true;

    console.warn(
      `🔧 RZWB [${field.name || field.id}]: yeniden-bootstrap tamamlandı — ` +
      `yeni bootstrapSource=${bs.bootstrapSource}, bootstrapDate=${bs.bootstrapDate}, ` +
      `ledger ${ledger.length} kayıtla yeniden inşa edildi.`
    );
  }

  if(repaired) {
    needsPersist = true;
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
    satCalibrated,
    isBootstrap,
    bootstrapInfo,   // YENİ: bootstrapSource/Date/Dr_s/Dr_d/simulationStart/End — test ve tanı için
    pct:   pct_s_out,
    moist: moist_s_out,
    fc:    fcs,
  };

  if(needsPersist) {
    try { localStorage.setItem(fbKey, JSON.stringify(ledger)); } catch(e) { console.warn('RZWB yerel kayıt hatası:',e.message); }
    if(uid && window.FB_MODE) {
      try {
        await window.fbSaveRZWB(uid, field.id, ledger);
        window.RZWB_CACHE[field.id] = { records: ledger, loadedAt: Date.now() };
      } catch(e) { console.warn('RZWB Firebase yazma:', e.message); }
    }
  }

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
  const { fcs, taw_s, taw_d, raw_s, raw_d, mad } = p;
  const Dr_s       = s.surface.Dr ?? Math.max(0, fcs - s.surface.moist);
  const Dr_d       = s.deep?.Dr ?? 0;
  const DrTotal    = Dr_s + Dr_d;
  const rawTotal   = raw_s + raw_d;
  const tawTotal   = taw_s + taw_d;
  const Ks         = Math.min(s.surface.Ks ?? 1, s.deep?.Ks ?? 1);
  const triggerPct = Math.max(0, Math.min(100, Math.round(((fcs - raw_s) / Math.max(1, fcs)) * 100)));
  const targetDepletion = tawTotal * 0.10;
  const deficitMm   = Math.round(Math.max(0, DrTotal - targetDepletion));
  const wx      = WXC[field.id]?.days || simWX(field.lat, field.lon);
  const today   = tstr();
  const futWx   = wx.filter(d => d.date > today).slice(0, 7);
  const futR    = futWx.reduce((t, d) => t + d.rain, 0);
  const futPe   = futWx.reduce((t, d) => t + window.calcEffectiveRain(d.rain), 0);
  const currentKc = Math.max(0, Number(s.kc) || 0.7);
  const futET   = futWx.reduce((t, d) => t + window.resolveDailyET0(d, field).value * currentKc, 0);
  const netBalance = futPe - futET;
  const effRain    = Math.min(deficitMm, futPe);
  const recommendedMm = Math.round(Math.max(0, deficitMm - effRain));
  const lastLog     = s.log?.[s.log.length - 1];
  const dailyUse    = lastLog
    ? Math.max(0.5, (lastLog.ETc_s ?? 0) + (lastLog.ETc_d ?? 0))
    : Math.max(0.5, s.ETc ?? s.et);
  const daysUntilCritical = Math.max(0, Math.round((rawTotal - DrTotal) / dailyUse));
  const stressLabel = Ks < 0.5 ? 'Ağır stres' : Ks < 0.8 ? 'Orta stres'
    : Ks < 1 ? 'Hafif stres' : 'Stres yok';
  const belowRaw   = DrTotal > rawTotal;
  const critical   = DrTotal >= tawTotal * 0.90;
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
    DrTotal: +DrTotal.toFixed(1), rawTotal: +rawTotal.toFixed(1), tawTotal: +tawTotal.toFixed(1),
    deficitMm, recommendedMm,
    netBalance7d: Math.round(netBalance), futRain7d: Math.round(futR),
    futEffectiveRain7d: Math.round(futPe), futET7d: Math.round(futET),
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
  const { doc, setDoc } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
  const ref = doc(window.FB_DB, 'users', uid, 'rzwb', fieldId);
  await setDoc(ref, { records, updatedAt: new Date().toISOString() });
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

// Clears only derived moisture-model state. Field definitions, event records
// and weather history remain intact and are used to rebuild every ledger.
window.rebuildAllMoistureModels = async (fields = window.DB?.fields || []) => {
  const targets = Array.isArray(fields) ? fields.filter(f => f?.id) : [];
  if (!targets.length) return { total: 0, rebuilt: 0, failed: 0, weatherFailed: 0, results: [] };

  // Weather must be available before any ledger is removed/rebuilt. A cached
  // history is accepted by fetchWXHistory; network failures retain its local
  // fallback and are reported in the summary.
  const weatherResults = await Promise.allSettled(
    targets.map(field => window.fetchWXHistory(field))
  );

  const uid = window.FB_USER?.uid;
  for (const field of targets) {
    try { localStorage.removeItem('tt_rzwb_' + field.id); } catch (_) {}
    delete window.RZWB_CACHE[field.id];
    if (typeof window.invSoil === 'function') window.invSoil(field.id);
  }

  if (uid && window.FB_MODE) {
    await Promise.allSettled(targets.map(field => window.fbSaveRZWB(uid, field.id, [])));
  }

  window.RZWB_CACHE = {};
  window.SOIL_CACHE = { data: null, lastUpdated: 0 };
  if (typeof window.invSoilAll === 'function') window.invSoilAll();

  const results = await Promise.allSettled(
    targets.map(field => window.calcSoilRZWB(field, true))
  );
  const rebuilt = results.filter(result => result.status === 'fulfilled').length;
  return {
    total: targets.length,
    rebuilt,
    failed: targets.length - rebuilt,
    weatherFailed: weatherResults.filter(result => result.status === 'rejected').length,
    results,
  };
};
