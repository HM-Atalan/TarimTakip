// ═══════════════════════════════════════════════════════════════════════════
// GARAJ / EKIPMAN YÖNETİMİ SİSTEMİ
// Traktör, araç, harman, pompa, sprayer vb.
// ═══════════════════════════════════════════════════════════════════════════

window.EQUIPMENT_TYPES = {
  traktor: {
    label: '🚜 Traktör',
    fields: ['model', 'power', 'horsePower', 'workingHours', 'fuelType'],
  },
  arac: {
    label: '🚚 Araç',
    fields: ['model', 'capacity', 'capacityUnit', 'kilometers', 'tonnage'],
  },
  harman: {
    label: '⚙️ Harman Makinesi',
    fields: ['model', 'capacity', 'capacityUnit', 'workingHours', 'grainType'],
  },
  pompa: {
    label: '💧 Pompa',
    fields: ['model', 'debit', 'debitUnit', 'power', 'headHeight', 'workingHours'],
  },
  sprayer: {
    label: '💨 Sprayer',
    fields: ['model', 'capacity', 'nozzleType', 'pressureBar', 'workingHours'],
  },
  pulluk: {
    label: '⛏️ Pulluk',
    fields: ['model', 'depth', 'workingWidth', 'plowType'],
  },
  tiller: {
    label: '🌾 Tiller / Çapa',
    fields: ['model', 'workingWidth', 'workingHours'],
  },
};

// DB.garage = [
//   {id, type, name, model, purchasePrice, purchaseDate, workingHours, ...}
// ]

window.DB = window.DB || {};
window.DB.garage = window.DB.garage || [];

// ─── YENİ EKİPMAN EKLE ───────────────────────────────────────────
window.addEquipment = (equipmentType, data) => {
  const equipment = {
    id: gid(),
    type: equipmentType,
    name: data.name || '',
    model: data.model || '',
    purchasePrice: parseFloat(data.purchasePrice) || 0,
    purchaseDate: data.purchaseDate || tstr(),
    purchaseCurrency: 'TRY',
    workingHours: parseFloat(data.workingHours) || 0,
    ...data,
    costs: {
      maintenance: [],
      fuel: [],
      repair: [],
    },
  };
  
  DB.garage.push(equipment);
  saveLocalDB();
  return equipment;
};

// ─── EKİPMAN MALIYET KAYDETT ───────────────────────────────────────
window.addEquipmentCost = (equipmentId, costType, amount, date = tstr(), notes = '') => {
  // costType: 'fuel', 'maintenance', 'repair', 'tire', 'oil', etc.
  const equipment = DB.garage.find(e => e.id === equipmentId);
  if (!equipment) return;
  
  if (!equipment.costs) equipment.costs = {};
  if (!equipment.costs[costType]) equipment.costs[costType] = [];
  
  equipment.costs[costType].push({
    id: gid(),
    date,
    amount,
    notes,
  });
  
  saveLocalDB();
};

// ─── EKİPMAN ÇALIŞMA SAATİ GÜNCELLE ─────────────────────────────
window.updateEquipmentWorkingHours = (equipmentId, newHours) => {
  const equipment = DB.garage.find(e => e.id === equipmentId);
  if (equipment) {
    equipment.workingHours = parseFloat(newHours);
    saveLocalDB();
  }
};

// ─── EKİPMAN MALİYET ANALİZİ ──────────────────────────────────────
window.getEquipmentCostAnalysis = (equipmentId) => {
  const equipment = DB.garage.find(e => e.id === equipmentId);
  if (!equipment) return null;
  
  let totalCosts = {
    fuel: 0,
    maintenance: 0,
    repair: 0,
    other: 0,
  };
  
  Object.entries(equipment.costs || {}).forEach(([type, entries]) => {
    entries.forEach(entry => {
      if (totalCosts[type] !== undefined) {
        totalCosts[type] += entry.amount;
      } else {
        totalCosts[type] = entry.amount;
      }
    });
  });
  
  const totalSpent = Object.values(totalCosts).reduce((a, b) => a + b, 0);
  const costPerHour = equipment.workingHours > 0 ? (totalSpent / equipment.workingHours) : 0;
  const depreciationPerYear = equipment.purchasePrice > 0 ? (equipment.purchasePrice * 0.15) : 0; // 15% yıllık
  
  return {
    equipment: equipment.name,
    type: equipment.type,
    purchasePrice: equipment.purchasePrice,
    totalWorkingHours: equipment.workingHours,
    costBreakdown: totalCosts,
    totalSpent,
    costPerHour: costPerHour.toFixed(2),
    estimatedDepreciationPerYear: depreciationPerYear.toFixed(2),
    totalCostOfOwnership: (totalSpent + depreciationPerYear).toFixed(2),
  };
};

// ─── OLAY İÇİNDE EKİPMAN KAYDI ────────────────────────────────────
// event.equipment = {equipmentId, hours, fuelUsed}
window.recordEquipmentUsageInEvent = (eventId, equipmentId, hoursUsed, fuelLiters = 0) => {
  const event = DB.events?.find(e => e.id === eventId);
  if (!event) return;
  
  if (!event.equipment) event.equipment = [];
  
  event.equipment.push({
    equipmentId,
    hoursUsed: parseFloat(hoursUsed),
    fuelLiters: parseFloat(fuelLiters),
    recordedAt: tstr(),
  });
  
  // Ekipman çalışma saatini güncelle
  const equipment = DB.garage.find(e => e.id === equipmentId);
  if (equipment) {
    equipment.workingHours += parseFloat(hoursUsed);
  }
  
  saveLocalDB();
};

// ─── TARLA-BAZLI EKİPMAN MALİYETİ ──────────────────────────────────
window.getFieldEquipmentCosts = (fieldId) => {
  const fieldEvents = (DB.events || []).filter(e => e.fieldId === fieldId);
  const equipmentUsage = {};
  
  fieldEvents.forEach(event => {
    if (event.equipment && Array.isArray(event.equipment)) {
      event.equipment.forEach(use => {
        if (!equipmentUsage[use.equipmentId]) {
          equipmentUsage[use.equipmentId] = {
            equipment: DB.garage.find(e => e.id === use.equipmentId),
            totalHours: 0,
            totalFuel: 0,
            events: [],
          };
        }
        equipmentUsage[use.equipmentId].totalHours += use.hoursUsed;
        equipmentUsage[use.equipmentId].totalFuel += use.fuelLiters;
        equipmentUsage[use.equipmentId].events.push(event.date);
      });
    }
  });
  
  return Object.values(equipmentUsage).map(usage => {
    const analysis = window.getEquipmentCostAnalysis(usage.equipment.id);
    return {
      ...usage,
      costPerHourUsedOnThisField: (analysis.totalSpent / usage.totalHours).toFixed(2),
      estimatedCostForThisField: ((analysis.totalSpent / (analysis.totalWorkingHours || 1)) * usage.totalHours).toFixed(2),
    };
  });
};

// ─── EKİPMAN BAKIMI / PERIYODIK UYARI ──────────────────────────────
window.getEquipmentMaintenanceSchedule = (equipmentId) => {
  const equipment = DB.garage.find(e => e.id === equipmentId);
  if (!equipment) return [];
  
  const schedules = [
    {interval: 50, unit: 'saat', task: 'Yağ filtresi değişimi'},
    {interval: 100, unit: 'saat', task: 'Yağ değişimi'},
    {interval: 250, unit: 'saat', task: 'Hava filtresi değişimi'},
    {interval: 500, unit: 'saat', task: 'Kalpak/Tank temizliği'},
    {interval: 1000, unit: 'saat', task: 'Tam bakım, tüm sıvı değişimi'},
  ];
  
  return schedules.map(s => {
    const hoursSinceLastMaintenance = equipment.workingHours;
    const nextMaintenanceAt = s.interval;
    const isDue = hoursSinceLastMaintenance >= nextMaintenanceAt;
    
    return {
      ...s,
      hoursUntilDue: Math.max(0, nextMaintenanceAt - hoursSinceLastMaintenance),
      isDue,
      priority: isDue ? 'HIGH' : 'NORMAL',
    };
  });
};

// ─── GARAJ ÖZET RAPORU ─────────────────────────────────────────────
window.getGarageSummaryReport = () => {
  const report = {
    totalEquipment: DB.garage.length,
    totalInvestment: 0,
    totalMaintenanceCosts: 0,
    equipmentList: [],
  };
  
  DB.garage.forEach(eq => {
    const analysis = window.getEquipmentCostAnalysis(eq.id);
    report.totalInvestment += eq.purchasePrice;
    report.totalMaintenanceCosts += analysis.totalSpent;
    
    report.equipmentList.push({
      name: eq.name,
      type: eq.type,
      purchasePrice: eq.purchasePrice,
      workingHours: eq.workingHours,
      costAnalysis: analysis,
    });
  });
  
  return report;
};
