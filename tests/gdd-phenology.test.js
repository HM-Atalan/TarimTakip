const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');

function load(days = []) {
  const ctx = { window: null, console, Date, Math, JSON, Number, Object, Array, Set, Map, Promise,
    document: { querySelector: () => null }, localStorage: { getItem: () => null, setItem() {} } };
  ctx.window = ctx;
  vm.createContext(ctx);
  for (const file of ['cropData.js', 'utils.js', 'phenology.js']) {
    if (file === 'utils.js') vm.runInContext('window.agrd = crop => CROP_AGR[crop] || CROP_AGR.default;', ctx);
    vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), ctx, { filename: file });
  }
  ctx.getBestWXDays = () => days;
  return ctx;
}

test('FAZ 9: GDD respects base/upper thresholds, date bounds and duplicate days', () => {
  const days = [
    { date: '2026-04-01', tmax: 8, tmin: 2 },
    { date: '2026-04-02', tmax: 24, tmin: 10 },
    { date: '2026-04-02', tmax: 40, tmin: 20 },
    { date: '2026-04-03', tmax: 50, tmin: 40 },
    { date: '2026-04-04', tmax: 25, tmin: 15 },
  ];
  const w = load(days);
  const field = { crop: 'Buğday', plantDate: '2026-04-01' };
  const a = w.agrd(field.crop);
  const expected = Math.round(
    w.calcDailyGDD(a, days[0]) + w.calcDailyGDD(a, days[1]) + w.calcDailyGDD(a, days[3])
  );
  assert.equal(w.calcGDD(field, '2026-04-03'), expected);
});

test('FAZ 9: malformed temperatures are ignored and never produce NaN', () => {
  const w = load([
    { date: '2026-04-01', tmax: 20, tmin: 10 },
    { date: '2026-04-02', tmax: undefined, tmin: 10 },
    { date: '2026-04-03', tmax: 5, tmin: 15 },
  ]);
  const gdd = w.calcGDD({ crop: 'Buğday', plantDate: '2026-04-01' }, '2026-04-03');
  assert.ok(Number.isFinite(gdd));
  assert.ok(gdd >= 0);
});

test('FAZ 9: no planting date remains an explicit unknown', () => {
  const w = load([]);
  assert.equal(w.calcGDD({ crop: 'Buğday' }), null);
});
