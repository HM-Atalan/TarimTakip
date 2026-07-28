// ============================================================
// main.js – Başlangıç, setInterval'lar ve alias'lar
// ============================================================

// Alias
window.agrd = (crop) => { return CROP_AGR[crop] || CROP_AGR.default; };
window.importFieldFile = window.importFF;
window.deleteCurrentPh = window.delCurPh;

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
      if(fields?.length){ window.DB.fields=fields; saveLocalDB(); invSoilAll(); await renderSB(); await renderDash(); if(window.CUR){ const u=window.DB.fields.find(f=>f.id===window.CUR.id); if(u) window.CUR=u; } }
    }catch(e){}
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

// ─── BAŞLATMA ──────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded',()=>{
  const th=localStorage.getItem('tt_theme'); if(th==='dark') document.documentElement.setAttribute('dark','');
  loadSettings();
  setTimeout(()=>{ if(!window.FB_MODE) noFBNotice(); }, 1500);
  qs('#main')?.addEventListener('click',()=>{ if(window.innerWidth<=768) qs('#sb')?.classList.remove('open'); });
  document.addEventListener('keydown',e=>{ if(e.key==='Escape') closePhViewer(); });
  if(!window.FB_USER&&DB.fields.length) fetchAllSatellites().catch(e=>console.warn('Başlangıç uydu hatası:', e));
});