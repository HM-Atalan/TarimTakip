// ═══════════════════════════════════════════════════════════════════════════
// KAPSAMLI RAPOR & PDF EXPORT SİSTEMİ
// ═══════════════════════════════════════════════════════════════════════════

// Tüm rapor fonksiyonları burada

window.generateFieldReport = (fieldId) => {
  const field = DB.fields.find(f => f.id === fieldId);
  if (!field) return null;
  
  const events = (DB.events || []).filter(e => e.fieldId === fieldId);
  const subCropDist = window.getSubCropAreaDistribution(fieldId);
  const costBreakdown = window.getMultiCropCostBreakdown(fieldId);
  const yieldEst = window.getMultiCropYieldEstimate(fieldId);
  
  // ─── 1. TARLA BİLGİSİ ──────────────────────────────────────────
  const fieldInfo = {
    name: field.name,
    location: field.loc,
    coordinates: `${field.lat}, ${field.lon}`,
    area: field.area,
    areaUnit: field.aunit,
    soilType: field.soil,
    status: field.status,
    crop: field.crop,
    plantDate: field.plant,
    expectedHarvestDate: field.harvest,
  };
  
  // ─── 2. MALİYET DÖKÜMÜ ─────────────────────────────────────────
  const costAnalysis = {
    byType: {},
    total: 0,
  };
  
  events.forEach(e => {
    if (e.type && e.cost) {
      if (!costAnalysis.byType[e.type]) {
        costAnalysis.byType[e.type] = 0;
      }
      costAnalysis.byType[e.type] += e.cost;
      costAnalysis.total += e.cost;
    }
  });
  
  const costPerHa = field.area > 0 ? costAnalysis.total / window.convertToHectares(field.area, field.aunit) : 0;
  
  // ─── 3. İŞÇİLİK ANALİZİ ─────────────────────────────────────────
  const laborAnalysis = {
    events: events.filter(e => e.type === 'işçilik'),
    totalHours: 0,
    totalCost: 0,
    costPerHour: 0,
  };
  
  laborAnalysis.events.forEach(e => {
    laborAnalysis.totalHours += e.qty || 0;
    laborAnalysis.totalCost += e.cost || 0;
  });
  
  if (laborAnalysis.totalHours > 0) {
    laborAnalysis.costPerHour = (laborAnalysis.totalCost / laborAnalysis.totalHours).toFixed(2);
  }
  
  // ─── 4. GELİR TAHMİNİ ──────────────────────────────────────────
  const incomeAnalysis = {
    totalProduction: 0,
    estimatedPrice: 0,
    estimatedRevenue: 0,
    profitEstimate: 0,
    marginPercent: 0,
  };
  
  yieldEst.forEach(y => {
    incomeAnalysis.totalProduction += parseFloat(y.totalEstimatedProduction);
  });
  
  // Fiyat tahmini (ürüne göre düzenle)
  const priceGuess = {
    'Buğday': 8,
    'Domates': 5,
    'Biber (dolmalık)': 8,
    'Patates': 4,
    'default': 5,
  };
  
  incomeAnalysis.estimatedPrice = priceGuess[field.crop] || priceGuess.default;
  incomeAnalysis.estimatedRevenue = incomeAnalysis.totalProduction * incomeAnalysis.estimatedPrice;
  incomeAnalysis.profitEstimate = incomeAnalysis.estimatedRevenue - costAnalysis.total;
  incomeAnalysis.marginPercent = incomeAnalysis.estimatedRevenue > 0 ? 
    ((incomeAnalysis.profitEstimate / incomeAnalysis.estimatedRevenue) * 100).toFixed(1) : 0;
  
  // ─── 5. TARÎMSAL GİRDİ ANALİZİ ────────────────────────────────
  const inputAnalysis = {
    fertilizer: {
      total: 0,
      cost: 0,
      types: {},
    },
    pesticides: {
      total: 0,
      cost: 0,
      types: {},
    },
    irrigation: {
      totalMm: 0,
      cost: 0,
    },
  };
  
  events.forEach(e => {
    if (e.type === 'gübre') {
      inputAnalysis.fertilizer.total += e.qty || 0;
      inputAnalysis.fertilizer.cost += e.cost || 0;
      inputAnalysis.fertilizer.types[e.notes] = (inputAnalysis.fertilizer.types[e.notes] || 0) + e.qty;
    }
    if (e.type === 'ilaç') {
      inputAnalysis.pesticides.total += e.qty || 0;
      inputAnalysis.pesticides.cost += e.cost || 0;
      inputAnalysis.pesticides.types[e.notes] = (inputAnalysis.pesticides.types[e.notes] || 0) + e.qty;
    }
    if (e.type === 'sulama') {
      inputAnalysis.irrigation.totalMm += e.qty || 0;
      inputAnalysis.irrigation.cost += e.cost || 0;
    }
  });
  
  // ─── 6. EKİPMAN KULLANIMI ──────────────────────────────────────
  const equipmentAnalysis = window.getFieldEquipmentCosts(fieldId);
  
  // ─── 7. FENOLOJI & VERİMLİLİK ─────────────────────────────────
  const phenologyAnalysis = window.getMultiCropPhenology(fieldId);
  
  return {
    generatedAt: new Date().toISOString(),
    fieldInfo,
    costAnalysis,
    costPerHa: costPerHa.toFixed(2),
    laborAnalysis,
    incomeAnalysis,
    inputAnalysis,
    equipmentAnalysis,
    phenologyAnalysis,
    eventHistory: events,
  };
};

// ─── HTML RAPOR OLUŞTUR ────────────────────────────────────────────
window.generateReportHTML = (report) => {
  if (!report) return '';
  
  const f = report.fieldInfo;
  
  const html = `
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body {font-family:Arial,sans-serif;margin:0;padding:20px;background:#f9f9f9;}
    .container {max-width:900px;margin:0 auto;background:#fff;padding:30px;border-radius:10px;box-shadow:0 0 10px rgba(0,0,0,0.1);}
    .header {border-bottom:3px solid #40916c;padding-bottom:15px;margin-bottom:20px;}
    .header h1 {margin:0;color:#2d6a4f;font-size:24px;}
    .header p {margin:3px 0;color:#666;font-size:12px;}
    .section {margin-bottom:25px;}
    .section h2 {background:#f0faf2;padding:10px 15px;border-left:4px solid #40916c;margin:0 0 15px 0;font-size:14px;font-weight:700;}
    .row {display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:15px;}
    .metric {background:#f9f9f9;padding:12px;border-radius:6px;border-left:3px solid #40916c;}
    .metric-label {font-size:11px;color:#999;text-transform:uppercase;}
    .metric-value {font-size:16px;font-weight:700;color:#333;margin-top:3px;}
    .metric-unit {font-size:10px;color:#999;}
    table {width:100%;border-collapse:collapse;margin-top:10px;}
    th {background:#f0faf2;padding:8px;text-align:left;font-size:11px;font-weight:700;border-bottom:2px solid #40916c;}
    td {padding:8px;border-bottom:1px solid #eee;font-size:12px;}
    tr:hover td {background:#f9f9f9;}
    .total {font-weight:700;background:#f0faf2;}
    .positive {color:#40916c;}
    .negative {color:#dc3545;}
    .footer {margin-top:30px;padding-top:15px;border-top:1px solid #eee;font-size:10px;color:#999;text-align:center;}
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📊 Tarla Raporu: ${f.name}</h1>
      <p>Rapor Tarihi: ${new Date(report.generatedAt).toLocaleDateString('tr-TR')}</p>
      <p>Lokasyon: ${f.location} (${f.coordinates})</p>
    </div>
    
    <!-- TARLA BİLGİSİ -->
    <div class="section">
      <h2>ℹ️ Tarla Bilgileri</h2>
      <div class="row">
        <div class="metric">
          <div class="metric-label">Alan</div>
          <div class="metric-value">${f.area} <span class="metric-unit">${f.areaUnit}</span></div>
        </div>
        <div class="metric">
          <div class="metric-label">Toprak Türü</div>
          <div class="metric-value">${f.soilType}</div>
        </div>
      </div>
      <div class="row">
        <div class="metric">
          <div class="metric-label">Ürün</div>
          <div class="metric-value">${f.crop}</div>
        </div>
        <div class="metric">
          <div class="metric-label">Durum</div>
          <div class="metric-value">${f.status}</div>
        </div>
      </div>
      <div class="row">
        <div class="metric">
          <div class="metric-label">Ekim/Dikim Tarihi</div>
          <div class="metric-value">${f.plantDate || '—'}</div>
        </div>
        <div class="metric">
          <div class="metric-label">Tahmini Hasat</div>
          <div class="metric-value">${f.expectedHarvestDate || '—'}</div>
        </div>
      </div>
    </div>
    
    <!-- MALİYET DÖKÜMÜ -->
    <div class="section">
      <h2>💰 Maliyet Dökümü</h2>
      <table>
        <tr>
          <th>İşlem Türü</th>
          <th style="text-align:right;">Maliyet (₺)</th>
          <th style="text-align:right;">% Oranı</th>
        </tr>
        ${Object.entries(report.costAnalysis.byType).map(([type, cost]) => `
          <tr>
            <td>${type}</td>
            <td style="text-align:right;">₺${cost.toFixed(2)}</td>
            <td style="text-align:right;">${((cost / report.costAnalysis.total) * 100).toFixed(1)}%</td>
          </tr>
        `).join('')}
        <tr class="total">
          <td>TOPLAM MALİYET</td>
          <td style="text-align:right;">₺${report.costAnalysis.total.toFixed(2)}</td>
          <td style="text-align:right;">100%</td>
        </tr>
      </table>
      <div class="metric" style="margin-top:10px;">
        <div class="metric-label">Maliyet / Hektar</div>
        <div class="metric-value">₺${report.costPerHa}</div>
      </div>
    </div>
    
    <!-- İŞÇİLİK ANALİZİ -->
    <div class="section">
      <h2>👷 İşçilik Analizi</h2>
      <div class="row">
        <div class="metric">
          <div class="metric-label">Toplam Saat</div>
          <div class="metric-value">${report.laborAnalysis.totalHours.toFixed(1)} <span class="metric-unit">saat</span></div>
        </div>
        <div class="metric">
          <div class="metric-label">Toplam Maliyet</div>
          <div class="metric-value">₺${report.laborAnalysis.totalCost.toFixed(2)}</div>
        </div>
        <div class="metric">
          <div class="metric-label">Saatlik Ücret</div>
          <div class="metric-value">₺${report.laborAnalysis.costPerHour} <span class="metric-unit">/saat</span></div>
        </div>
      </div>
    </div>
    
    <!-- GELİR TAHMİNİ -->
    <div class="section">
      <h2>📈 Gelir Tahmini</h2>
      <div class="row">
        <div class="metric">
          <div class="metric-label">Tahmini Üretim</div>
          <div class="metric-value">${report.incomeAnalysis.totalProduction.toFixed(0)} <span class="metric-unit">kg</span></div>
        </div>
        <div class="metric">
          <div class="metric-label">Birim Fiyat</div>
          <div class="metric-value">₺${report.incomeAnalysis.estimatedPrice} <span class="metric-unit">/kg</span></div>
        </div>
        <div class="metric">
          <div class="metric-label">Tahmini Gelir</div>
          <div class="metric-value positive">₺${report.incomeAnalysis.estimatedRevenue.toFixed(2)}</div>
        </div>
        <div class="metric">
          <div class="metric-label">Tahmini Kâr</div>
          <div class="metric-value ${report.incomeAnalysis.profitEstimate >= 0 ? 'positive' : 'negative'}">₺${report.incomeAnalysis.profitEstimate.toFixed(2)}</div>
        </div>
      </div>
      <div class="metric" style="margin-top:10px;">
        <div class="metric-label">Kâr Marjı</div>
        <div class="metric-value ${report.incomeAnalysis.marginPercent >= 0 ? 'positive' : 'negative'}">${report.incomeAnalysis.marginPercent}%</div>
      </div>
    </div>
    
    <!-- TARÎMSAL GİRDİ -->
    <div class="section">
      <h2>🌾 Tarımsal Girdi Analizi</h2>
      <h3 style="font-size:12px;color:#666;margin:10px 0 5px 0;">Gübreler</h3>
      <div class="row">
        <div class="metric">
          <div class="metric-label">Toplam Miktar</div>
          <div class="metric-value">${report.inputAnalysis.fertilizer.total.toFixed(1)} <span class="metric-unit">kg</span></div>
        </div>
        <div class="metric">
          <div class="metric-label">Maliyet</div>
          <div class="metric-value">₺${report.inputAnalysis.fertilizer.cost.toFixed(2)}</div>
        </div>
      </div>
      
      <h3 style="font-size:12px;color:#666;margin:10px 0 5px 0;">İlaçlar / Zararlı Kontrol</h3>
      <div class="row">
        <div class="metric">
          <div class="metric-label">Toplam Miktar</div>
          <div class="metric-value">${report.inputAnalysis.pesticides.total.toFixed(1)} <span class="metric-unit">L/kg</span></div>
        </div>
        <div class="metric">
          <div class="metric-label">Maliyet</div>
          <div class="metric-value">₺${report.inputAnalysis.pesticides.cost.toFixed(2)}</div>
        </div>
      </div>
      
      <h3 style="font-size:12px;color:#666;margin:10px 0 5px 0;">Sulama</h3>
      <div class="row">
        <div class="metric">
          <div class="metric-label">Toplam Su</div>
          <div class="metric-value">${report.inputAnalysis.irrigation.totalMm.toFixed(0)} <span class="metric-unit">mm</span></div>
        </div>
        <div class="metric">
          <div class="metric-label">Maliyet</div>
          <div class="metric-value">₺${report.inputAnalysis.irrigation.cost.toFixed(2)}</div>
        </div>
      </div>
    </div>
    
    <div class="footer">
      <p>🌱 TarlaTakip - Tarımsal Takip Platformu</p>
      <p>Bu rapor otomatik olarak oluşturulmuştur | ${new Date().toLocaleString('tr-TR')}</p>
    </div>
  </div>
</body>
</html>
  `;
  
  return html;
};

// ─── PDF'YE AKTAR (html2pdf.js kütüphanesi) ────────────────────
window.exportReportToPDF = async (fieldId) => {
  const report = window.generateFieldReport(fieldId);
  const html = window.generateReportHTML(report);
  
  const element = document.createElement('div');
  element.innerHTML = html;
  
  const opt = {
    margin: 10,
    filename: `tarla-raporu-${fieldId}-${tstr()}.pdf`,
    image: {type: 'jpeg', quality: 0.98},
    html2canvas: {scale: 2},
    jsPDF: {orientation: 'portrait', unit: 'mm', format: 'a4'},
  };
  
  try {
    await html2pdf().set(opt).from(element).save();
    toast('PDF başarıyla indirildi');
  } catch (e) {
    toast('PDF oluşturma hatası: ' + e.message, true);
  }
};

// ─── CSV'YE AKTAR ───────────────────────────────────────────────
window.exportFieldReportToCSV = (fieldId) => {
  const field = DB.fields.find(f => f.id === fieldId);
  const report = window.generateFieldReport(fieldId);
  
  let csv = 'Tarla Raporu\n';
  csv += `Tarla Adı,${field.name}\n`;
  csv += `Lokasyon,${field.loc}\n`;
  csv += `Ürün,${field.crop}\n`;
  csv += `Alan,${field.area} ${field.aunit}\n\n`;
  
  csv += 'Maliyet Dökümü\n';
  csv += 'İşlem Türü,Maliyet (₺)\n';
  Object.entries(report.costAnalysis.byType).forEach(([type, cost]) => {
    csv += `${type},${cost.toFixed(2)}\n`;
  });
  csv += `TOPLAM,${report.costAnalysis.total.toFixed(2)}\n\n`;
  
  csv += 'Gelir Tahmini\n';
  csv += `Tahmini Üretim,${report.incomeAnalysis.totalProduction.toFixed(0)} kg\n`;
  csv += `Birim Fiyat,₺${report.incomeAnalysis.estimatedPrice}/kg\n`;
  csv += `Tahmini Gelir,₺${report.incomeAnalysis.estimatedRevenue.toFixed(2)}\n`;
  csv += `Tahmini Kâr,₺${report.incomeAnalysis.profitEstimate.toFixed(2)}\n`;
  csv += `Kâr Marjı,${report.incomeAnalysis.marginPercent}%\n`;
  
  const blob = new Blob([csv], {type: 'text/csv;charset=utf-8;'});
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `tarla-raporu-${fieldId}-${tstr()}.csv`;
  link.click();
};
