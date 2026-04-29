// ═══════════════════════════════════════════════════════════════════════════
// ÇOKLU ÜRÜN YÖNETİMİ SİSTEMİ
// Bir tarlada birden fazla ürün yetiştirilebilir → Tüm sistem optimize
// ═══════════════════════════════════════════════════════════════════════════

window.DB = window.DB || {};

// Tarla oluşturulduğunda subCrops array'i
// field.subCrops = [{id, cropName, areaValue, areaUnit, plantDate, harvestDate, color, notes}]

window.addSubCrop = (fieldId, cropName, areaValue, areaUnit = 'dönüm') => {
  const field = DB.fields.find(f => f.id === fieldId);
  if (!field) return;
  
  if (!field.subCrops) field.subCrops = [];
  
  const subCrop = {
    id: gid(),
    cropName,
    areaValue: parseFloat(areaValue),
    areaUnit,
    areaInHa: window.convertToHectares(areaValue, areaUnit),
    plantDate: tstr(),
    harvestDate: '',
    color: '#40916c',
    status: 'active',
    notes: '',
  };
  
  field.subCrops.push(subCrop);
  saveFieldToDB(field);
  return subCrop;
};

window.updateSubCrop = (fieldId, subCropId, updates) => {
  const field = DB.fields.find(f => f.id === fieldId);
  if (!field || !field.subCrops) return;
  
  const subCrop = field.subCrops.find(sc => sc.id === subCropId);
  if (subCrop) {
    Object.assign(subCrop, updates);
    saveFieldToDB(field);
  }
};

window.removeSubCrop = (fieldId, subCropId) => {
  const field = DB.fields.find(f => f.id === fieldId);
  if (!field || !field.subCrops) return;
  
  field.subCrops = field.subCrops.filter(sc => sc.id !== subCropId);
  saveFieldToDB(field);
};

// ─── ALAN DAĞILIMININ YÜZDESİ ───────────────────────────────────────
window.getSubCropAreaDistribution = (fieldId) => {
  const field = DB.fields.find(f => f.id === fieldId);
  if (!field || !field.subCrops || !field.area) return [];
  
  const totalArea = window.convertToHectares(field.area, field.aunit || 'dönüm');
  
  return field.subCrops.map(sc => {
    const pct = (sc.areaInHa / totalArea) * 100;
    return {
      ...sc,
      percentOfField: pct.toFixed(1),
      absoluteArea: sc.areaInHa.toFixed(2),
    };
  });
};

// ─── TOPLU OLAYLARI ÇOKLU ÜRÜNE DAĞIT ──────────────────────────────
// Tarla-bazlı sulama → her alt ürüne dağıt
window.distributeEventToSubCrops = (fieldId, eventType, baseAmount) => {
  const distribution = window.getSubCropAreaDistribution(fieldId);
  return distribution.map(sc => {
    const proportionalAmount = baseAmount * (parseFloat(sc.percentOfField) / 100);
    return {
      subCropId: sc.id,
      cropName: sc.cropName,
      eventType,
      basedOnPercentage: sc.percentOfField,
      allocatedAmount: proportionalAmount.toFixed(2),
    };
  });
};

// ─── ÇOKLU ÜRÜN NEM TAHMİNİ ──────────────────────────────────────────
window.getMoistureForMultipleCrops = async (fieldId, date) => {
  const field = DB.fields.find(f => f.id === fieldId);
  if (!field || !field.subCrops) return null;
  
  const moistureResults = {};
  
  for (const sc of field.subCrops) {
    // Her ürünün kendi Kc, MAD değerleri
    const kc = window.getKcForDate(sc.cropName, date) || 0.8;
    const mad = CROP_DEPLETION_FACTOR[sc.cropName] || 0.50;
    
    const soilMoist = await window.estimateSoilMoisture(field, date);
    
    moistureResults[sc.id] = {
      cropName: sc.cropName,
      kc,
      mad,
      needsIrrigation: soilMoist.depletionPct > (mad * 100),
      recommendedWater: soilMoist.recommendIrrigation ? soilMoist.remainingAW : 0,
    };
  }
  
  return moistureResults;
};

// ─── ÇOKLU ÜRÜN FENOLOJI & HASAT ──────────────────────────────────
window.getMultiCropPhenology = (fieldId) => {
  const field = DB.fields.find(f => f.id === fieldId);
  if (!field || !field.subCrops) return [];
  
  return field.subCrops.map(sc => {
    const agr = CROP_AGR[sc.cropName] || {};
    const gdd = window.calcGDD(field, sc.plantDate, tstr());
    const phenoIdx = Math.max(0, Math.min(agr.gd?.length - 1 || 5, 
      Math.floor(gdd / ((agr.gd?.[agr.gd.length - 1] || 1200) / agr.gd?.length))));
    
    return {
      subCropId: sc.id,
      cropName: sc.cropName,
      plantDate: sc.plantDate,
      harvestDate: sc.harvestDate,
      daysElapsed: Math.round((new Date(tstr()) - new Date(sc.plantDate)) / (1000*60*60*24)),
      gddAccumulated: gdd,
      phenologicStage: agr.st?.[phenoIdx] || 'Bilinmiyor',
      daysToMaturity: Math.max(0, agr.td - Math.round((new Date(tstr()) - new Date(sc.plantDate)) / (1000*60*60*24))),
      estimatedHarvestDate: new Date(new Date(sc.plantDate).getTime() + (agr.td || 120) * 24*60*60*1000).toISOString().split('T')[0],
    };
  });
};

// ─── ÇOKLU ÜRÜN MALİYET DÖKÜMÜ ────────────────────────────────────
window.getMultiCropCostBreakdown = (fieldId) => {
  const field = DB.fields.find(f => f.id === fieldId);
  if (!field || !field.subCrops) return null;
  
  const distribution = window.getSubCropAreaDistribution(fieldId);
  const costBreakdown = {};
  
  distribution.forEach(sc => {
    costBreakdown[sc.id] = {
      cropName: sc.cropName,
      areaHa: sc.absoluteArea,
      areaPercentage: sc.percentOfField,
      estimatedCosts: {
        totalCost: 0,
        byType: {},
      },
    };
  });
  
  // Tarla tüm olaylarını çoklu ürünlere dağıt
  if (DB.events) {
    DB.events.filter(e => e.fieldId === fieldId).forEach(event => {
      if (event.type !== 'diğer' && event.cost) {
        distribution.forEach(sc => {
          const allocatedCost = event.cost * (parseFloat(sc.percentOfField) / 100);
          
          if (!costBreakdown[sc.id].estimatedCosts.byType[event.type]) {
            costBreakdown[sc.id].estimatedCosts.byType[event.type] = 0;
          }
          costBreakdown[sc.id].estimatedCosts.byType[event.type] += allocatedCost;
          costBreakdown[sc.id].estimatedCosts.totalCost += allocatedCost;
        });
      }
    });
  }
  
  return costBreakdown;
};

// ─── ÇOKLU ÜRÜN VERIM TAHMİNİ ──────────────────────────────────────
window.getMultiCropYieldEstimate = (fieldId) => {
  const field = DB.fields.find(f => f.id === fieldId);
  if (!field || !field.subCrops) return [];
  
  return field.subCrops.map(sc => {
    const agr = CROP_AGR[sc.cropName] || {};
    const yieldMax = agr.yieldMax || 1000;
    
    // Yildirim basit → 70% optimal yield varsayarak
    const estimatedYield = yieldMax * 0.70;
    const totalProduction = estimatedYield * sc.areaInHa;
    
    return {
      subCropId: sc.id,
      cropName: sc.cropName,
      areaHa: sc.areaInHa.toFixed(2),
      maxYieldPerHa: yieldMax,
      estimatedYieldPerHa: estimatedYield.toFixed(1),
      totalEstimatedProduction: totalProduction.toFixed(1),
      unit: 'kg', // Varsayılan
    };
  });
};

// ─── DASHBOARD: ÇOKLU ÜRÜN GÖRÜNÜMÜ ────────────────────────────────
window.renderMultiCropDashboard = (fieldId) => {
  const crops = window.getMultiCropPhenology(fieldId);
  const costs = window.getMultiCropCostBreakdown(fieldId);
  const yields = window.getMultiCropYieldEstimate(fieldId);
  
  let html = `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:10px;">`;
  
  crops.forEach(crop => {
    const costInfo = costs?.[crop.subCropId] || {};
    const yieldInfo = yields.find(y => y.subCropId === crop.subCropId);
    
    html += `
      <div style="background:var(--glt);border:1px solid var(--gbg);border-radius:8px;padding:10px;">
        <div style="font-weight:700;color:var(--green2);margin-bottom:3px;">${crop.cropName}</div>
        <div style="font-size:11px;color:var(--text2);margin-bottom:6px;">
          Gün: <strong>${crop.daysElapsed}</strong> / GDD: <strong>${crop.gddAccumulated}</strong>
        </div>
        <div style="font-size:10px;color:var(--text3);margin-bottom:3px;">
          Fenoloji: ${crop.phenologicStage}
        </div>
        <div style="font-size:10px;color:var(--text2);">
          Tahmini Hasat: <strong>${crop.estimatedHarvestDate}</strong>
        </div>
        <div style="font-size:9px;color:var(--amber);margin-top:4px;">
          Tahmini Maliyet: ₺${costInfo.estimatedCosts?.totalCost?.toFixed(0) || '—'}
        </div>
        <div style="font-size:9px;color:var(--green2);margin-top:2px;">
          Tahmini Verim: ${yieldInfo?.estimatedYieldPerHa || '—'} kg/ha
        </div>
      </div>
    `;
  });
  
  html += `</div>`;
  return html;
};

window.convertToHectares = (value, unit) => {
  const val = parseFloat(value);
  switch(unit) {
    case 'dönüm': return val * 0.09362;
    case 'hektar': return val;
    case 'm²': return val / 10000;
    case 'acre': return val * 0.40469;
    default: return val;
  }
};
