// ═══════════════════════════════════════════════════════════════════════════
// AKILLI TARÎMSAL ÖNERİLER SİSTEMİ
// Sulama, gübreleme, ilaçlama önerileri (çalışma zamanlamasına uyumlu)
// ═══════════════════════════════════════════════════════════════════════════

window.buildSmartRecommendations = async (fieldId) => {
  const field = DB.fields.find(f => f.id === fieldId);
  if (!field) return [];
  
  const recommendations = [];
  const agr = CROP_AGR[field.crop] || {};
  
  // ─── SULAMA ÖNERİSİ ───────────────────────────────────────────
  try {
    const moisture = await window.estimateSoilMoisture(field, tstr());
    if (moisture.recommendIrrigation) {
      const irrigationReq = await window.calcIrrigationRequirement(field, tstr(), 
        new Date(Date.now() + 7*24*60*60*1000).toISOString().split('T')[0]);
      
      // Sonraki çalışma gününe planla
      const nextWorkDay = window.getNextWorkDays(fieldId, tstr(), 1)[0]?.date || tstr();
      
      recommendations.push({
        id: gid(),
        type: 'sulama',
        priority: 'HIGH',
        title: '💧 Sulama Gerekli',
        description: `Toprak nem ${moisture.depletionPct.toFixed(0)}% tükenmiş. ${irrigationReq.totalIrrigation.toFixed(0)}mm su eklenmelidir.`,
        recommendedDate: nextWorkDay,
        estimatedCost: irrigationReq.totalIrrigation * field.area * 0.15, // ₺/mm/da
        action: 'Sulama başlat',
        status: 'pending',
      });
    }
  } catch (e) {}
  
  // ─── GÜBRELEME ÖNERİSİ ─────────────────────────────────────────
  if (agr.fert) {
    const gdd = window.calcGDD(field, field.plant || tstr(), tstr());
    const phenoIdx = Math.floor((gdd / (agr.gd?.[agr.gd.length-1] || 1200)) * agr.st?.length);
    
    if (phenoIdx >= 1 && phenoIdx <= 3) {
      const nextWorkDay = window.getNextWorkDays(fieldId, new Date(Date.now() + 1*24*60*60*1000).toISOString().split('T')[0], 1)[0]?.date;
      
      recommendations.push({
        id: gid(),
        type: 'gübre',
        priority: 'MEDIUM',
        title: '🧪 Gübreleme Zamanı',
        description: `Ürün ${agr.st?.[phenoIdx]} aşamasında. ${agr.fert}`,
        recommendedDate: nextWorkDay,
        estimatedCost: 300 * field.area,
        action: 'Gübre hazırla',
        status: 'pending',
      });
    }
  }
  
  // ─── İLAÇLAMA / ZARARLI RİSKİ ────────────────────────────────
  const diseaseRiskScore = Math.random() * 100; // Placeholder - gerçek model yapılmalı
  if (diseaseRiskScore > 60) {
    const nextWorkDay = window.getNextWorkDays(fieldId, tstr(), 1)[0]?.date || tstr();
    
    recommendations.push({
      id: gid(),
      type: 'ilaç',
      priority: 'HIGH',
      title: '🔬 İlaçlama Önerisi',
      description: `Hastalık/zararlı riski ${diseaseRiskScore.toFixed(0)}% seviyesinde. Koruyucu ilaçlama yapılmalıdır.`,
      recommendedDate: nextWorkDay,
      estimatedCost: 250 * field.area,
      action: 'İlaç seç ve uygula',
      status: 'pending',
    });
  }
  
  // ─── ÇAPALAMA ÖNERİSİ ──────────────────────────────────────────
  const lastWeedingEvent = (DB.events || [])
    .filter(e => e.fieldId === fieldId && e.type === 'çapa')
    .sort((a, b) => new Date(b.date) - new Date(a.date))[0];
  
  const daysSinceWeeding = lastWeedingEvent ? 
    Math.round((new Date(tstr()) - new Date(lastWeedingEvent.date)) / (1000*60*60*24)) : 999;
  
  if (daysSinceWeeding > 14) {
    const nextWorkDay = window.getNextWorkDays(fieldId, new Date(Date.now() + 2*24*60*60*1000).toISOString().split('T')[0], 1)[0]?.date;
    
    recommendations.push({
      id: gid(),
      type: 'çapa',
      priority: 'LOW',
      title: '⛏️ Çapalama Zamanı',
      description: `Son çapadan ${daysSinceWeeding} gün geçti. Ot nüfuzunun kontrolü için çapalama gereklidir.`,
      recommendedDate: nextWorkDay,
      estimatedCost: 150 * field.area,
      action: 'Çapala',
      status: 'pending',
    });
  }
  
  // ─── HASAT HAZIRLIĞI ────────────────────────────────────────
  const daysToHarvest = field.harvest ? 
    Math.round((new Date(field.harvest) - new Date(tstr())) / (1000*60*60*24)) : 999;
  
  if (daysToHarvest > 0 && daysToHarvest <= 5) {
    recommendations.push({
      id: gid(),
      type: 'hasat',
      priority: 'HIGH',
      title: '🌾 Hasat Hazırlığı',
      description: `Tahmini hasat tarihi ${field.harvest}. Hasat için hazırlık başlayın.`,
      recommendedDate: field.harvest,
      estimatedCost: 500 * field.area,
      action: 'Hasat planı yap',
      status: 'pending',
    });
  }
  
  // ─── İKLİM UYARISI ─────────────────────────────────────────
  try {
    // Open-Meteo'dan 7 günlük tahmin
    const weatherAlerts = [];
    // Şiddetli yağış, donma riski, vs.
    if (weatherAlerts.length > 0) {
      recommendations.push({
        id: gid(),
        type: 'hava',
        priority: 'HIGH',
        title: '⚠️ İklim Uyarısı',
        description: weatherAlerts.join('. '),
        recommendedDate: tstr(),
        estimatedCost: 0,
        action: 'Bilgilendir',
        status: 'alert',
      });
    }
  } catch (e) {}
  
  return recommendations;
};

// ─── ÖNERİLERİ OLAY OLARAK KAYDET ────────────────────────────────
window.acceptRecommendation = (fieldId, recommendationId) => {
  const rec = window.builtRecommendations?.find(r => r.id === recommendationId);
  if (!rec) return;
  
  // Olay oluştur
  const event = {
    id: gid(),
    fieldId,
    date: rec.recommendedDate,
    type: rec.type,
    planned: true,
    status: 'planned',
    notes: rec.description,
    cost: rec.estimatedCost,
    source: 'recommendation',
  };
  
  if (!DB.events) DB.events = [];
  DB.events.push(event);
  saveLocalDB();
  
  toast(`${rec.title} önerisi olay olarak kaydedildi.`);
};

// ─── ÖNERİLER DASHBOARDİ ─────────────────────────────────────────
window.renderRecommendations = async (fieldId) => {
  const field = DB.fields.find(f => f.id === fieldId);
  if (!field) return;
  
  window.builtRecommendations = await window.buildSmartRecommendations(fieldId);
  
  const priorityColors = {
    HIGH: '#dc3545',
    MEDIUM: '#ffc107',
    LOW: '#28a745',
  };
  
  let html = `<div style="display:grid;grid-template-columns:1fr;gap:10px;">`;
  
  window.builtRecommendations.forEach(rec => {
    const icons = {
      sulama: '💧',
      gübre: '🧪',
      ilaç: '🔬',
      çapa: '⛏️',
      hasat: '🌾',
      hava: '⚠️',
    };
    
    html += `
      <div style="background:var(--bg2);border-left:4px solid ${priorityColors[rec.priority]};padding:12px;border-radius:8px;">
        <div style="display:flex;justify-content:space-between;align-items:start;">
          <div>
            <div style="font-weight:700;margin-bottom:3px;">${icons[rec.type] || '•'} ${rec.title}</div>
            <div style="font-size:12px;color:var(--text2);margin-bottom:6px;">${rec.description}</div>
            <div style="font-size:11px;color:var(--text3);">
              📅 Önerilen: ${rec.recommendedDate} | 💰 Tahmini: ₺${rec.estimatedCost.toFixed(0)}
            </div>
          </div>
          <button class="btn btnp btns" onclick="window.acceptRecommendation('${fieldId}','${rec.id}')">
            Kabul
          </button>
        </div>
      </div>
    `;
  });
  
  html += `</div>`;
  return html;
};

// ─── UYARILAN RİSK SKORLAMASı ──────────────────────────────────────
window.calculateRiskScore = (field) => {
  let riskScore = 0;
  
  // Nem riski
  // GDD'nin ilerleme hızı
  // Hastalık riski
  // Hava koşulları
  
  return Math.min(100, Math.max(0, riskScore));
};
