const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');

function load() {
  const ctx = {
    window: null, console: { log() {}, warn() {}, error() {} }, Date, Math, JSON,
    Number, Object, Array, Set, Map, Promise,
    document: { querySelector: () => null },
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    SATC: {}, WXC: {}, WX_HISTORY: {}, RZWB_CACHE: {}, FB_USER: null, FB_MODE: false,
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  for (const file of ['constants.js', 'cropData.js', 'utils.js', 'phenology.js', 'soilModel.js']) {
    if (file === 'utils.js') vm.runInContext('window.agrd = crop => CROP_AGR[crop] || CROP_AGR.default;', ctx);
    vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), ctx, { filename: file });
  }
  return ctx;
}

test('FAZ 7: a legitimate zero Penman-Monteith ET0 is preserved', () => {
  const w = load();
  const resolved = w.resolveDailyET0({ date: '2026-01-15', tmax: 3, tmin: -2, et0: 0 }, { lat: 39 });
  assert.equal(resolved.value, 0);
  assert.equal(resolved.source, 'fao56-penman-monteith');

  const field = { crop: 'default', category: 'sebze', soilType: 'tinli', status: 'fallow', lat: 39 };
  const params = w.getRZWBParams(field);
  const step = w.rzwbStep({ Dr_s: 10, Dr_d: 20, surplus_s: 0, surplus_d: 0 },
    { date: '2026-01-15', tmax: 3, tmin: -2, rain: 0, et0: 0 }, 0, params, field);
  assert.equal(step.et0, 0);
  assert.equal(step.ETc_s, 0);
  assert.equal(step.ETc_d, 0);
});

test('FAZ 7: missing ET0 uses bounded FAO-56 Hargreaves Eq. 52 fallback', () => {
  const w = load();
  const wx = { date: '2026-07-15', tmax: 32, tmin: 18 };
  const value = w.calcFallbackET0(wx, 39);
  assert.ok(value > 3 && value < 10, `unexpected ET0=${value}`);
  const resolved = w.resolveDailyET0(wx, { lat: 39 });
  assert.equal(resolved.value, value);
  assert.equal(resolved.source, 'fao56-hargreaves-fallback');
});

test('FAZ 7: invalid temperature input fails safe without NaN or negative ET0', () => {
  const w = load();
  for (const wx of [
    { date: 'bad', tmax: 30, tmin: 20 },
    { date: '2026-07-15', tmax: 10, tmin: 20 },
    { date: '2026-07-15', tmax: undefined, tmin: 20 },
  ]) {
    const value = w.calcFallbackET0(wx, 39);
    assert.equal(value, 0);
    assert.ok(Number.isFinite(value));
  }
});
