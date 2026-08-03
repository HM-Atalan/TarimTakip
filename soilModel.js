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
    et0: +et0.toFixed(1), rain: +rain.toFixed(1),
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
