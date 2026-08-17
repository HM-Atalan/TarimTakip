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

test('FAZ 8: all soil and root parameters satisfy structural invariants', () => {
  const w = load();
  const soil = vm.runInContext('RZWB_SOIL', w);
  const roots = vm.runInContext('ROOT_SPLIT', w);
  for (const [name, p] of Object.entries(soil)) {
    assert.ok(p.fcs > p.wps && p.fcd > p.wpd, `${name}: FC must exceed WP`);
    assert.ok(Object.values(p).every(Number.isFinite), `${name}: values must be finite`);
  }
  for (const [crop, split] of Object.entries(roots)) {
    assert.equal(split.length, 2, `${crop}: root split length`);
    assert.ok(split.every(v => v >= 0 && v <= 1), `${crop}: root fractions`);
    assert.ok(Math.abs(split[0] + split[1] - 1) < 1e-12, `${crop}: root fractions must sum to one`);
  }
});

test('FAZ 8: every crop parameter record is finite, ordered and internally aligned', () => {
  const w = load();
  const crops = vm.runInContext('CROP_AGR', w);
  for (const [name, a] of Object.entries(crops)) {
    for (const key of ['et', 'tb', 'to', 'tm', 'mn', 'td', 'fc', 'yieldMax', 'optRain']) {
      assert.ok(Number.isFinite(a[key]), `${name}.${key}`);
    }
    assert.ok(a.tb < a.tm, `${name}: base temperature must be below maximum`);
    assert.ok(Array.isArray(a.st) && a.st.length > 0, `${name}: stages`);
    assert.ok(Array.isArray(a.gd) && a.gd.length === a.st.length, `${name}: GDD/stage alignment`);
    assert.ok(a.gd.every((v, i) => Number.isFinite(v) && v > 0 && (i === 0 || v > a.gd[i - 1])), `${name}: GDD thresholds`);
    assert.ok(Array.isArray(a.kc) && [3, 4].includes(a.kc.length), `${name}: supported Kc shape`);
    assert.ok(a.kc.every(v => Number.isFinite(v) && v >= 0.1 && v <= 1.5), `${name}: plausible Kc values`);
  }
});

test('FAZ 8: three- and four-point Kc curves are continuous and use table endpoints', () => {
  const w = load();
  for (const values of [[0.4, 0.8, 0.9], [0.4, 0.7, 1.05, 0.85]]) {
    assert.equal(w.interpolateCropKc(values, 0), values[0]);
    assert.equal(w.interpolateCropKc(values, 0.1), values[0]);
    assert.ok(Math.abs(w.interpolateCropKc(values, 0.100001) - values[0]) < 0.00001);
    assert.equal(w.interpolateCropKc(values, 1), values.at(-1));
    for (let i = 0; i <= 100; i++) {
      const kc = w.interpolateCropKc(values, i / 100);
      assert.ok(Number.isFinite(kc) && kc >= Math.min(...values) && kc <= Math.max(...values));
    }
  }
});
