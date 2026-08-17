// ============================================================
// globals.js – Tüm global değişkenler (window üzerinde)
// ============================================================

window.DB = { fields: [], s: { acuKey: '' } };
window.SOIL_CACHE = { data: null, lastUpdated: 0 };
window.CUR = null;
window.WXC = {};
window.SATC = {};
window.SC = {};
window.lmap = null;
window.aiHist = [];
window.AI_MEMORY = {};
window.pendPh = null;
window.curTab = 'map';
window.curPhIdx = null;
window.LOCAL = false;
window.WX_HISTORY = {};
window.RZWB_CACHE = {};
window.REP_FILTER = { period: 'all', year: new Date().getFullYear(), month: null };
