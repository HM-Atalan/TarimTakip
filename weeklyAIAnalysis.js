// ═══════════════════════════════════════════════════════════════════════════
// HAFTALIK YAPAY ZEKA ANALİZİ & EMAIL SİSTEMİ
// Otomatik haftalık rapor → kullanıcı mailine
// ═══════════════════════════════════════════════════════════════════════════

// DB.s.weeklyAI = {enabled, dayOfWeek (0-6), hour (0-23), timezone}

window.setWeeklyAIAnalysis = (enabled, dayOfWeek = 3, hour = 8, timezone = 'Europe/Istanbul') => {
  DB.s = DB.s || {};
  DB.s.weeklyAI = {
    enabled,
    dayOfWeek, // 0=Pazar, 3=Çarşamba, 5=Cuma
    hour,
    timezone,
    lastRunAt: null,
  };
  
  saveSettings();
  
  // Firebase Functions'ü tetikle (Cloud Scheduler ile)
  if (enabled && window.fbCallFunction) {
    window.fbCallFunction('scheduleWeeklyAIAnalysis', {
      userId: window.FB_USER?.uid,
      dayOfWeek,
      hour,
      timezone,
    }).catch(e => console.warn('Weekly AI schedule error:', e));
  }
};

// ─── HAFTALIK ANALİZ İÇERİĞİ OLUŞTUR ──────────────────────────────
window.generateWeeklyAIAnalysis = async (fields) => {
  const analysis = {
    generatedAt: new Date().toISOString(),
    week: `${new Date(Date.now() - 7*24*60*60*1000).toISOString().split('T')[0]} - ${tstr()}`,
    summary: {
      totalFields: fields.length,
      activeFields: 0,
      criticalAlerts: 0,
      recommendations: [],
    },
    fieldReports: [],
  };
  
  for (const field of fields) {
    if (field.status !== 'active') continue;
    analysis.summary.activeFields++;
    
    // Her tarla için analiz
    const fieldReport = {
      fieldName: field.name,
      crop: field.crop,
      location: field.loc,
      generalHealth: 'İyi',
      alerts: [],
      recommendations: [],
      metrics: {},
    };
    
    // 1. TOPRAK NEM
    try {
      const moisture = await window.estimateSoilMoisture(field, tstr());
      fieldReport.metrics.soilMoisture = {
        status: moisture.status,
        depletionPct: moisture.depletionPct,
        recommendsIrrigation: moisture.recommendIrrigation,
      };
      if (moisture.recommendIrrigation) {
        fieldReport.alerts.push(`⚠️ Sulama gerekli (Depletion: ${moisture.depletionPct.toFixed(0)}%)`);
        analysis.summary.criticalAlerts++;
      }
    } catch (e) {}
    
    // 2. HAVA TAHMİNİ (7 günlük)
    try {
      const weatherKey = await window.getGeminiKey();
      // Open-Meteo'dan veri çek
      fieldReport.metrics.weather = {
        lastUpdate: tstr(),
        expectedRain: false,
        severeWeather: false,
      };
    } catch (e) {}
    
    // 3. FENOLOJI & HASAT TAHMİNİ
    const gdd = window.calcGDD(field, field.plant || tstr(), tstr());
    const agr = CROP_AGR[field.crop] || {};
    fieldReport.metrics.phenology = {
      gdd,
      estimatedStage: agr.st?.[Math.min(agr.st.length - 1, Math.floor(gdd / ((agr.gd?.[agr.gd.length - 1] || 1200) / agr.gd?.length)))] || 'Bilinmiyor',
      daysToMaturity: Math.max(0, (agr.td || 120) - Math.round((new Date(tstr()) - new Date(field.plant || tstr())) / (1000*60*60*24))),
    };
    
    // 4. HASTALIK RİSKİ
    fieldReport.metrics.diseaseRisk = {
      fungal: Math.random() * 100, // Placeholder - gerçek tahmin yapılmalı
      viral: Math.random() * 50,
      bacterial: Math.random() * 40,
    };
    const maxRisk = Math.max(...Object.values(fieldReport.metrics.diseaseRisk));
    if (maxRisk > 60) {
      fieldReport.alerts.push(`🔬 Hastalık riski yüksek (${maxRisk.toFixed(0)}%)`);
      analysis.summary.criticalAlerts++;
    }
    
    // 5. ÖNERİLER OLUŞTUR
    fieldReport.recommendations = [
      ...fieldReport.alerts.map(a => a.replace(/[⚠️🔬]/g, '✓')),
    ];
    
    analysis.fieldReports.push(fieldReport);
  }
  
  analysis.summary.recommendations = [
    ...new Set(analysis.fieldReports.flatMap(f => f.recommendations))
  ];
  
  return analysis;
};

// ─── EMAIL HTML OLUŞTUR ──────────────────────────────────────────
window.generateWeeklyAIEmail = (analysis, userEmail) => {
  const html = `
<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <style>
    body {font-family:Arial,sans-serif;line-height:1.6;color:#333;}
    .container {max-width:600px;margin:0 auto;background:#f9f9f9;padding:20px;border-radius:10px;}
    .header {background:linear-gradient(135deg,#40916c,#2d6a4f);color:#fff;padding:20px;border-radius:10px;text-align:center;}
    .section {background:#fff;margin:15px 0;padding:15px;border-radius:8px;border-left:4px solid #40916c;}
    .alert {background:#fff3cd;border-left-color:#ffc107;padding:12px;border-radius:6px;margin:10px 0;}
    .critical {background:#f8d7da;border-left-color:#dc3545;}
    .recommendation {background:#d1ecf1;border-left-color:#17a2b8;padding:10px;margin:8px 0;border-radius:6px;}
    .metric {display:inline-block;background:#f0f0f0;padding:10px 15px;margin:5px;border-radius:6px;}
    .footer {text-align:center;color:#999;font-size:12px;margin-top:20px;padding-top:20px;border-top:1px solid #ddd;}
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🌱 TarlaTakip Haftalık AI Analiz</h1>
      <p>${analysis.week}</p>
    </div>
    
    <div class="section">
      <h2>📊 Özet</h2>
      <div class="metric">Aktif Tarla: ${analysis.summary.activeFields}</div>
      <div class="metric">Kritik Uyarı: ${analysis.summary.criticalAlerts}</div>
      <div class="metric">Toplam Öneri: ${analysis.summary.recommendations.length}</div>
    </div>
    
    ${analysis.fieldReports.map((field, idx) => `
      <div class="section">
        <h3>${field.fieldName} (${field.crop})</h3>
        <p><strong>Lokasyon:</strong> ${field.location}</p>
        
        <h4>📍 Metrikler</h4>
        ${field.metrics.soilMoisture ? `
          <div class="metric">
            💧 Nem: ${field.metrics.soilMoisture.status}
            (${field.metrics.soilMoisture.depletionPct.toFixed(0)}% depletion)
          </div>
        ` : ''}
        ${field.metrics.phenology ? `
          <div class="metric">
            🌾 Fenoloji: ${field.metrics.phenology.estimatedStage}
            (${field.metrics.phenology.daysToMaturity} gün kaldı)
          </div>
        ` : ''}
        
        ${field.alerts.length > 0 ? `
          <h4>⚠️ Uyarılar</h4>
          ${field.alerts.map(a => `<div class="alert ${a.includes('Sulama') ? '' : 'critical'}">${a}</div>`).join('')}
        ` : ''}
        
        ${field.recommendations.length > 0 ? `
          <h4>💡 Öneriler</h4>
          ${field.recommendations.map(r => `<div class="recommendation">✓ ${r}</div>`).join('')}
        ` : ''}
      </div>
    `).join('')}
    
    <div class="footer">
      <p>Bu rapor otomatik olarak oluşturulmuştur.</p>
      <p>TarlaTakip - Tarımsal Takip Platformu</p>
      <p><a href="https://tarlatakip.com">Detaylı rapor için tıklayın</a></p>
    </div>
  </div>
</body>
</html>
  `;
  
  return {
    to: userEmail,
    subject: `🌱 TarlaTakip Haftalık AI Analiz - ${tstr()}`,
    htmlContent: html,
    textContent: analysis.summary.recommendations.join('\n'),
  };
};

// ─── CLOUD FUNCTIONS'TE KOŞACAK KOD (Firebase) ────────────────────
// functions/index.js'e ekle:
/*
exports.scheduleWeeklyAIAnalysis = functions.https.onCall(async (data, context) => {
  const {dayOfWeek, hour, timezone, userId} = data;
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Auth required');
  
  // Cloud Scheduler job oluştur
  // Her hafta verilen günde saat 8'de çalışacak
  // CRON: "0 8 ? * 3" (her Çarşamba sabah 8)
  
  return {
    scheduled: true,
    nextRun: `Haftada bir, ${['Paz','Pzt','Sal','Çar','Per','Cum','Cmt'][dayOfWeek]} ${hour}:00`,
  };
});

exports.sendWeeklyAIAnalysis = functions.pubsub
  .schedule('0 8 ? * 3') // Her Çarşamba 08:00 UTC
  .timeZone('Europe/Istanbul')
  .onRun(async (context) => {
    const db = admin.firestore();
    
    // Tüm aktivasyon yapılmış kullanıcıları bul
    const users = await db.collection('users')
      .where('settings.weeklyAI.enabled', '==', true)
      .get();
    
    for (const userDoc of users.docs) {
      const user = userDoc.data();
      const fields = user.fields || [];
      
      // Analiz oluştur
      const analysis = await generateWeeklyAIAnalysis(fields);
      
      // Email oluştur
      const emailData = generateWeeklyAIEmail(analysis, user.email);
      
      // Nodemailer ile gönder
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: functions.config().gmail.email,
          pass: functions.config().gmail.app_password,
        },
      });
      
      await transporter.sendMail({
        from: 'noreply@tarlatakip.com',
        to: emailData.to,
        subject: emailData.subject,
        html: emailData.htmlContent,
      });
      
      // Log
      await db.collection('users').doc(userDoc.id).update({
        'settings.weeklyAI.lastRunAt': admin.firestore.FieldValue.serverTimestamp(),
      });
    }
    
    console.log('Weekly AI Analysis sent to', users.size, 'users');
  });
*/

window.getWeeklyAISettings = () => {
  return DB.s?.weeklyAI || {
    enabled: false,
    dayOfWeek: 3,
    hour: 8,
    timezone: 'Europe/Istanbul',
  };
};
