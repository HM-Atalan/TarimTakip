// ============================================================
// main.js – Başlangıç, setInterval'lar ve alias'lar
// ============================================================

// Alias
window.agrd = (crop) => { return CROP_AGR[crop] || CROP_AGR.default; };
window.importFieldFile = window.importFF;
window.deleteCurrentPh = window.delCurPh;
window.MOISTURE_MODEL_VERSION = 'rzwb-startup-anchor-v4';
window.MOISTURE_PREPARE_PROMISE = null;

// İlk ekran çizilmeden önce yerel hava geçmişini yükler ve nem defterini
// zorla doğrular. Eksik/bozuk kısa defterler otomatik yeniden oluşturulur.
window.prepareMoistureModels = async (fields = window.DB?.fields || []) => {
  // Firebase oturum açılışı ve ekran çizimi aynı anda bu fonksiyona
  // ulaşabilir. Aynı defteri iki ayrı akışta silip yeniden kurmak, açılışta
  // kısa süreli %100/yanlış sonucun kalıcılaşmasına neden oluyordu.
  if(window.MOISTURE_PREPARE_PROMISE) return window.MOISTURE_PREPARE_PROMISE;
  window.MOISTURE_PREPARE_PROMISE = (async () => {
  if(!fields.length) return [];
  fields.forEach(field=>{
    if(WX_HISTORY[field.id]?.days?.length) return;
    const stored=window.loadWXHistoryLocal(field.id);
    if(stored?.length) WX_HISTORY[field.id]={days:stored,updatedAt:Date.now()};
  });
  const migrationTargets=fields.filter(field=>localStorage.getItem('tt_rzwb_version_'+field.id)!==window.MOISTURE_MODEL_VERSION);
  if(migrationTargets.length){
    try {
      await window.fetchStartupSoilAnchors(migrationTargets);
      const anchored=migrationTargets.filter(field=>SATC[field.id]?.data?.indexSource==='open-meteo-startup-anchor');
      if(anchored.length){
        const summary=await window.rebuildAllMoistureModels(anchored);
        summary.results.forEach((result,index)=>{
          if(result.status==='fulfilled') localStorage.setItem('tt_rzwb_version_'+anchored[index].id,window.MOISTURE_MODEL_VERSION);
        });
        if(summary.failed) console.warn(`${summary.failed} tarla için tek seferlik nem onarımı tamamlanamadı.`);
      }
    } catch(error) {
      // Ağ yoksa mevcut defteri silme; sonraki açılışta migrasyonu tekrar dene.
      console.warn('Tek seferlik açılış nem onarımı ertelendi:',error.message);
    }
  }
    return window.computeAllSoils(true);
  })();
  try {
    return await window.MOISTURE_PREPARE_PROMISE;
  } finally {
    window.MOISTURE_PREPARE_PROMISE = null;
  }
};

window.resetMoistureModels = async () => {
  const fields = window.DB?.fields || [];
  if (!fields.length) { window.toast('Resetlenecek kayıtlı tarla yok.', true); return; }
  if (!window.confirm(
    `${fields.length} tarla için türetilmiş nem modeli silinip olay kayıtları ve hava geçmişinden sıfırdan hesaplanacak. Devam edilsin mi?`
  )) return;

  const button = qs('#reset-moisture-btn');
  const originalLabel = button?.textContent;
  if (button) { button.disabled = true; button.textContent = '⏳ Nem modeli hesaplanıyor…'; }
  try {
    const summary = await window.rebuildAllMoistureModels(fields);
    summary.results.forEach((result,index)=>{
      if(result.status==='fulfilled') localStorage.setItem('tt_rzwb_version_'+fields[index].id,window.MOISTURE_MODEL_VERSION);
    });
    // Reuse the freshly rebuilt results so renderers do not trigger a second
    // model run. Failed fields are retried by the normal rendering path.
    if (summary.failed === 0) {
      window.SOIL_CACHE = {
        data: fields.map((f, i) => {
          const s = summary.results[i].value;
          return { f, s, sc: scl(s.surface.pct), ph: calcPheno(f), he: calcHarvest(f) };
        }),
        lastUpdated: Date.now(),
      };
    }
    await window.renderAll();
    if (window.CUR) {
      const current = fields.find(field => field.id === window.CUR.id);
      if (current) { window.CUR = current; await window.renderFKPIs(current); }
    }
    if (summary.failed) {
      window.toast(`${summary.rebuilt}/${summary.total} tarla hesaplandı; ${summary.failed} tarla başarısız.`, true);
    } else {
      const weatherNote = summary.weatherFailed ? ` (${summary.weatherFailed} hava geçmişi uyarısı)` : '';
      window.toast(`✅ ${summary.rebuilt} tarla için nem modeli sıfırdan hesaplandı${weatherNote}.`);
    }
  } catch (error) {
    console.error('Nem modeli reset hatası:', error);
    window.toast('Nem modeli resetlenemedi: ' + error.message, true);
  } finally {
    if (button) { button.disabled = false; button.textContent = originalLabel || '🔄 Nem Modelini Yeniden Hesapla'; }
  }
};

// ─── OTOMATİK YENİLEME ─────────────────────────────────────────
setInterval(async () => {
  invSoilAll();
  const toFetch = DB.fields.filter(f=>!WXC[f.id]||(Date.now()-WXC[f.id].at>1800000));
  await Promise.allSettled(toFetch.map(f=>fetchWX(f)));
  await renderSB(); await renderDash();
  if(CUR&&qs('#page-field.on')){
    await renderFKPIs(CUR);
    if(curTab==='soil') await renderSoil(CUR);
    if(curTab==='rec') await renderRecTab(CUR);
  }
}, 600000);

setInterval(async () => {
  if(window.FB_USER&&window.FB_MODE){
    try{
      const fields = await window.fbLoadFields(window.FB_USER.uid);
      window.DB.fields=window.mergeCloudFields(fields||[]); saveLocalDB(); invSoilAll(); await renderSB(); await renderDash(); if(window.CUR){ const u=window.DB.fields.find(f=>f.id===window.CUR.id); if(u) window.CUR=u; }
      const pending=window.DB.fields.filter(f=>f._syncStatus==='pending');
      await Promise.allSettled(pending.map(f=>window.saveFieldToDB(f)));
    }catch(e){ console.warn('Arka plan senkronizasyonu başarısız:',e.message); }
  }
}, 300000);

setInterval(() => {
  DB.fields.forEach(f => {
    const hasLedger = !!localStorage.getItem('tt_rzwb_' + f.id);
    if(!hasLedger || !WX_HISTORY[f.id]?.days?.length) {
      fetchWXHistory(f).catch(() => {});
    }
  });
}, 3600000);

// ─── SEKME (TAB) TIKLAMA BAĞLANTISI ─────────────────────────────
// DÜZELTME: index.html'deki .tab elemanlarının hiçbirinde onclick
// özelliği yoktu; data-t attribute'u sadece goTab() içeriden
// çağrıldığında hangi sekmenin aktif edileceğini bulmak için
// kullanılıyordu. Bu yüzden "Harita" sekmesi (kod içeriden
// otomatik açtığı için) çalışıyor gibi görünse de, kullanıcı
// "Hava / Toprak / Uydu / Olaylar / Öneriler / Foto / AI"
// sekmelerine TIKLADIĞINDA hiçbir şey tetiklenmiyordu — bu satır
// o eksik bağlantıyı event delegation ile kalıcı olarak kurar.
// Tab elemanları statik olduğu için (yeniden oluşturulmuyorlar),
// tek seferlik bir delegasyon yeterli ve her zaman çalışır.
function bindTabClicks() {
  document.querySelectorAll('.tab[data-t]').forEach(tab => {
    tab.setAttribute('role','tab'); tab.setAttribute('tabindex',tab.classList.contains('on')?'0':'-1');
  });
  document.addEventListener('click', (e) => {
    const tabEl = e.target.closest('.tab[data-t]');
    if(!tabEl) return;
    const t = tabEl.dataset.t;
    if(t) window.goTab(t);
  });
  document.addEventListener('keydown', (e) => {
    const tabEl=e.target.closest?.('.tab[data-t]');
    if(tabEl && (e.key==='Enter'||e.key===' ')){ e.preventDefault(); window.goTab(tabEl.dataset.t); }
  });
  document.addEventListener('click',e=>{
    const quick=e.target.closest?.('.ai-quick-question'); if(!quick) return;
    const input=qs('#ai-inp'); if(input) input.value=quick.dataset.question||'';
    window.sendChat();
  });
}

// ─── BAŞLATMA ──────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded',()=>{
  const th=localStorage.getItem('tt_theme'); if(th==='dark') document.documentElement.setAttribute('dark','');
  loadSettings();
  bindTabClicks();
  setTimeout(()=>{ if(!window.FB_MODE) noFBNotice(); }, 1500);
  qs('#main')?.addEventListener('click',()=>{ if(window.innerWidth<=768) qs('#sb')?.classList.remove('open'); });
  document.addEventListener('keydown',e=>{ if(e.key==='Escape') closePhViewer(); });
  if('serviceWorker' in navigator) navigator.serviceWorker.getRegistrations().then(items=>items.forEach(item=>item.unregister()));
  if('indexedDB' in window) indexedDB.deleteDatabase('tarimtakip-local');
});
