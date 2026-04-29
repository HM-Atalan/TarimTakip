// ═══════════════════════════════════════════════════════════════════════════
// TOPRAK NEM MODELİ - FAO STANDART (Allen vd. 1998, Doorenbos & Pruitt 1977)
// Bilimsel Kaynaklar:
// - FAO Irrigation and Drainage Paper No. 56 (Crop Water Requirements)
// - USDA Soil Conservation Service (SCS) Water Retention Curve
// - Van Genuchten Model for water retention
// ═══════════════════════════════════════════════════════════════════════════

// Toprak su tutma karakteristikleri (35 kPa ve 1500 kPa potansiyel)
const SOIL_WATER_RETENTION = {
  killiTin: {
    fc: 0.38,     // Field Capacity @ 33 kPa matric potential
    pwp: 0.22,    // Permanent Wilting Point @ 1500 kPa
    sat: 0.48,    // Saturation
    ks: 0.15,     // Saturated hydraulic conductivity (cm/day)
    lambda: 0.22, // Pore size distribution
  },
  tinli: {
    fc: 0.32,
    pwp: 0.16,
    sat: 0.43,
    ks: 0.25,
    lambda: 0.27,
  },
  killi: {
    fc: 0.42,
    pwp: 0.27,
    sat: 0.50,
    ks: 0.08,
    lambda: 0.18,
  },
  kumlu: {
    fc: 0.18,
    pwp: 0.06,
    sat: 0.35,
    ks: 2.0,
    lambda: 0.58,
  },
  humuslu: {
    fc: 0.44,
    pwp: 0.24,
    sat: 0.52,
    ks: 0.18,
    lambda: 0.20,
  },
  kalkerli: {
    fc: 0.35,
    pwp: 0.18,
    sat: 0.45,
    ks: 0.20,
    lambda: 0.25,
  },
};

// Bitki kütlü su tükenmesi (Management Allowed Depletion - MAD)
// Yüksek değer = çiftçi daha az sık sulama (toleranslı)
// Düşük değer = daha sık sulama (hassas ürün)
const CROP_DEPLETION_FACTOR = {
  'Buğday': 0.55,
  'Mısır': 0.50,
  'Domates': 0.35,
  'Biber (dolmalık)': 0.35,
  'Patlıcan': 0.35,
  'Salatalık': 0.40,
  'Patates': 0.40,
  'Soğan (kuru)': 0.60,
  'Elma': 0.50,
  'Portakal': 0.45,
  'Zeytin (Yağlık — Ayvalık)': 0.60,
  'Pamuk': 0.55,
  'Ayçiçeği': 0.60,
  'Şeker Pancarı': 0.60,
  'Üzüm': 0.55,
  'default': 0.50,
};

// ─── FAO56 PENMAN-MONTEITH REFERANS EVAPOTRANSPIRATION ───────────
// Çok hassas ancak sadece Kc ile çarpılır
// Formül: ETₒ = [0.408 × Δ × (Rₙ - G) + γ × (Cₙ/(T+273)) × uₛ × (eₛ - eₐ)]
//              / [Δ + γ × (1 + Cdₛ × uₛ)]
// NOT: Çoğu sistem Open-Meteo'nun günlük ET₀ → kullanıyoruz
//      Eksikse, buradan hesaplayabiliriz

window.calcET0_PM = (tmin, tmax, rn, g, rhmin, rhmax, u2, ea) => {
  // Simplified if Open-Meteo data not available
  // Hargreaves-Samani alternative: ET₀ = 0.0023 × (tmax - tmin)^0.5 × (tavg + 17.8) × Ra
  const tavg = (tmin + tmax) / 2;
  const dT = tmax - tmin;
  // Ra estimation needed (solar radiation)
  const etHargreaves = 0.0023 * Math.sqrt(dT) * (tavg + 17.8) * (rn || 15); // mm/day aprox
  return Math.max(etHargreaves, 0.5);
};

// ─── NEM DURUMUNUN TOPRAK SU POTANSİYELİNE DÖNÜŞTÜRÜLMESİ ────────────
// Van Genuchten Model
window.matricPotential = (theta, soilType) => {
  const prop = SOIL_WATER_RETENTION[soilType] || SOIL_WATER_RETENTION.default;
  if (theta >= prop.sat) return 0;
  if (theta <= prop.pwp) return -1500;
  
  const theta_s = prop.sat;
  const theta_r = prop.pwp;
  const Se = (theta - theta_r) / (theta_s - theta_r); // Effective saturation
  
  if (Se <= 0) return -1500;
  if (Se >= 1) return 0;
  
  // Van Genuchten: psi = -1/alpha * [Se^(-1/m) - 1]^(1/n)
  const m = 0.67; // m = 1 - 1/n, n typical 1.5-2.5
  const n = 3.0;
  const alpha = 0.02;
  
  const psi = (-1 / alpha) * Math.pow(Math.pow(Se, -1/m) - 1, 1/n);
  return Math.max(Math.min(psi, 0), -1500);
};

// ─── SULAMA İHTİYACI HESAPLAMASI (FAO56 Methodology) ──────────────
// Dönem: genellikle 1 gün
window.calcIrrigationRequirement = async (field, startDate, endDate) => {
  // field: {id, crop, soilType, area, lat, lon}
  // Veri kaynakları:
  // 1. Open-Meteo (ET₀ günlük)
  // 2. Yağış verileri
  // 3. Fenoloji aşaması → Kc (crop coefficient)
  
  const soilProp = SOIL_WATER_RETENTION[field.soilType] || SOIL_WATER_RETENTION.tinli;
  const awc = (soilProp.fc - soilProp.pwp) * 1000; // mm/m soil depth
  const rootDepth = CROP_AGR[field.crop]?.rootDepth || 0.8; // m
  const taw = awc * rootDepth * 100; // Total available water (mm)
  const mad = CROP_DEPLETION_FACTOR[field.crop] || 0.50;
  const rad = taw * mad; // Readily available water (mm)
  
  const start = new Date(startDate);
  const end = new Date(endDate);
  const daysDiff = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
  
  let totalET = 0, totalRain = 0, totalIrr = 0;
  let dailyData = [];
  
  for (let i = 0; i < daysDiff; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    const dateStr = d.toISOString().split('T')[0];
    
    // Open-Meteo API çağrısı (örnek)
    const et0 = 5.0; // mm/day (Open-Meteo'dan veya hesaplanmış)
    const rain = 0;  // mm (gerçek veriden)
    
    // Fenoloji → Kc
    const kcVal = window.getKcForDate(field.crop, dateStr) || 0.8;
    const etcVal = et0 * kcVal; // Crop ET (mm/day)
    
    totalET += etcVal;
    totalRain += rain;
    
    // Basit su dengesi (daha detayı için reservoir kullan)
    const netWater = etcVal - rain;
    totalIrr += Math.max(netWater, 0);
    
    dailyData.push({date: dateStr, et0, rain, etc: etcVal, irr: Math.max(netWater, 0)});
  }
  
  return {
    period: {start: startDate, end: endDate},
    totalET,
    totalRain,
    totalIrrigation: totalIrr,
    avgDailyET: totalET / daysDiff,
    avgDailyIrr: totalIrr / daysDiff,
    taw: taw,
    rad: rad,
    dailyBreakdown: dailyData,
  };
};

// ─── TOPRAK NEM TAHMİNİ (Günlük Water Balance) ────────────────────
window.estimateSoilMoisture = async (field, date) => {
  // En son ölçüm tarihinden bu tarihte kâhya ne kadar su kaldı?
  const soilProp = SOIL_WATER_RETENTION[field.soilType];
  const awc = (soilProp.fc - soilProp.pwp) * 1000; // mm/m
  const rd = CROP_AGR[field.crop]?.rootDepth || 0.8;
  const taw = awc * rd * 100; // mm
  const mad = CROP_DEPLETION_FACTOR[field.crop] || 0.50;
  const rad = taw * mad;
  
  // Open-Meteo: son 30 gün ET₀ + yağış
  let cumET = 0, cumRain = 0;
  for (let i = 29; i >= 0; i--) {
    const d = new Date(date);
    d.setDate(d.getDate() - i);
    // Gerçek verilerden çek
    cumET += 5.0; // placeholder
    cumRain += 0;
  }
  
  // Ölçülen son su kaynağı + (Rain - ET) = şimdiki tahmin
  let estimatedDepletion = cumET - cumRain; // mm
  
  // Sulama olaylarından çıkar
  // TODO: event.type === 'sulama' olanları bul, field log'tan
  
  const depletionPct = Math.min(100, Math.max(0, (estimatedDepletion / rad) * 100));
  const remainingAW = Math.max(0, rad - estimatedDepletion); // mm
  const estimatedTheta = (soilProp.pwp + (remainingAW / awc) * (soilProp.fc - soilProp.pwp));
  
  return {
    date,
    depletionPct,
    remainingAW,      // mm
    estimatedTheta,   // θ vol fraction
    matricPotential: window.matricPotential(estimatedTheta, field.soilType), // kPa
    status: depletionPct < 30 ? 'yüksek' : depletionPct < 60 ? 'orta' : 'düşük',
    recommendIrrigation: depletionPct > (mad * 100),
  };
};

// ─── SULAMA PLANLAMASI (Maksimum Verim için Optimal Su) ─────────────
window.optimumIrrigationSchedule = (field, startDate, endDate) => {
  // Tarla, ürün, toprak ve dönem veri → en iyi sulama planı
  const schedules = [];
  const soilProp = SOIL_WATER_RETENTION[field.soilType];
  const awc = (soilProp.fc - soilProp.pwp) * 1000;
  const rd = CROP_AGR[field.crop]?.rootDepth || 0.8;
  const taw = awc * rd * 100;
  const mad = CROP_DEPLETION_FACTOR[field.crop] || 0.50;
  
  let currentDate = new Date(startDate);
  let currentDepletion = 0;
  
  while (currentDate <= new Date(endDate)) {
    // Her gün ET₀ × Kc ekle
    const dateStr = currentDate.toISOString().split('T')[0];
    const kcVal = window.getKcForDate(field.crop, dateStr) || 0.8;
    const et0 = 5.0; // mm/day
    const dailyET = et0 * kcVal;
    
    currentDepletion += dailyET;
    
    // Eğer depletion MAD aştıysa, sulama öner
    if (currentDepletion > taw * mad) {
      schedules.push({
        date: dateStr,
        depletionAtIrrigation: currentDepletion,
        recommendedAmount: Math.round(currentDepletion * 100) / 100, // mm
        daysFromLastIrrigation: schedules.length > 0 ? 
          Math.ceil((new Date(dateStr) - new Date(schedules[schedules.length - 1].date)) / (1000*60*60*24)) : 0,
      });
      currentDepletion = 0; // Reset sonra sulama
    }
    
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  return {
    field: field.name,
    crop: field.crop,
    soilType: field.soilType,
    scheduleCount: schedules.length,
    totalIrrigationNeeded: schedules.reduce((s, x) => s + x.recommendedAmount, 0),
    schedule: schedules,
  };
};

// ─── TOPRAK NEMINI İYİ HALE GETIREN SULAMA (Ek Kanallı) ────────────
window.improveWaterRetention = (soilType, organicMatterIncreasePercent) => {
  const base = SOIL_WATER_RETENTION[soilType];
  // Her %1 organik madde → fc +0.009, pwp +0.006
  const fcNew = base.fc + (organicMatterIncreasePercent * 0.009);
  const pwpNew = base.pwp + (organicMatterIncreasePercent * 0.006);
  
  return {
    original: {fc: base.fc, pwp: base.pwp, awc: base.fc - base.pwp},
    improved: {fc: fcNew, pwp: pwpNew, awc: fcNew - pwpNew},
    organicMatterIncrease: organicMatterIncreasePercent,
    recommendation: `Toprak organik madde %${organicMatterIncreasePercent} arttırılırsa, kullanılabilir su tutma kapasitesi %${Math.round(((fcNew - pwpNew) / (base.fc - base.pwp) - 1) * 100)} artacaktır.`,
  };
};

window.SOIL_WATER_RETENTION = SOIL_WATER_RETENTION;
window.CROP_DEPLETION_FACTOR = CROP_DEPLETION_FACTOR;
