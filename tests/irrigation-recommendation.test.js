const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');

function load() {
  const ctx = { window: null, console: { log() {}, warn() {}, error() {} }, Date, Math, JSON,
    Number, Object, Array, Set, Map, Promise, document: { querySelector: () => null },
    localStorage: { getItem: () => null, setItem() {} }, SATC: {}, WXC: {}, WX_HISTORY: {},
    RZWB_CACHE: {}, FB_USER: null, FB_MODE: false, SC: {} };
  ctx.window = ctx;
  vm.createContext(ctx);
  for (const file of ['constants.js', 'cropData.js', 'utils.js', 'phenology.js', 'soilModel.js']) {
    if (file === 'utils.js') vm.runInContext('window.agrd = crop => CROP_AGR[crop] || CROP_AGR.default;', ctx);
    vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), ctx, { filename: file });
  }
  ctx.simWX = () => [];
  return ctx;
}

function futureDate(w, offset) {
  const d = new Date(); d.setDate(d.getDate() + offset); return w.dateKey(d);
}

test('FAZ 11: deep root-zone depletion can trigger irrigation even with a wet surface', () => {
  const w = load();
  const field = { id: 'f', crop: 'Buğday', category: 'tahil', soilType: 'tinli', lat: 39, lon: 32 };
  const p = w.getRZWBParams(field);
  w.WXC[field.id] = { days: [] };
  const s = {
    params: p, kc: 1, ETc: 4, et: 4, log: [],
    surface: { Dr: 0, moist: p.fcs, pct: 100, Ks: 1 },
    deep: { Dr: p.taw_d, moist: p.fcd - p.taw_d, pct: 40, Ks: 0 },
  };
  const result = w.calcIrrigationNeed(field, s);
  assert.equal(result.needsIrrigation, true);
  assert.ok(result.DrTotal > result.rawTotal);
  assert.ok(result.recommendedMm > 0);
});

test('FAZ 11: forecast uses effective rainfall and Kc-adjusted ET0', () => {
  const w = load();
  const field = { id: 'f', crop: 'Buğday', category: 'tahil', soilType: 'tinli', lat: 39, lon: 32 };
  const p = w.getRZWBParams(field);
  w.WXC[field.id] = { days: [
    { date: futureDate(w, 1), rain: 40, et0: 6, tmax: 30, tmin: 18 },
    { date: futureDate(w, 2), rain: 0, et0: 4, tmax: 28, tmin: 16 },
  ] };
  const s = {
    params: p, kc: 0.5, ETc: 5, et: 5, log: [],
    surface: { Dr: p.taw_s, moist: p.wps, pct: 20, Ks: 0.2 },
    deep: { Dr: p.taw_d, moist: p.wpd, pct: 20, Ks: 0.2 },
  };
  const result = w.calcIrrigationNeed(field, s);
  assert.equal(result.futRain7d, 40);
  assert.equal(result.futEffectiveRain7d, 28);
  assert.equal(result.futET7d, 5);
  assert.ok(result.recommendedMm >= 0 && result.recommendedMm <= result.deficitMm);
});

test('FAZ 11: extreme recorded irrigation is warned about but never truncated', () => {
  const w = load();
  assert.equal(w.parseIrrMm({ qty: 2000, unit: 'mm' }, 85), 2000);
  assert.equal(w.parseIrrMm({ qty: 500000, unit: 'lt' }, 85), 500);
  assert.equal(w.parseIrrMm({ qty: -10, unit: 'mm' }, 85), 0);
});
