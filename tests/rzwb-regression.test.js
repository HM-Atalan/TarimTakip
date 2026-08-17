const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');

function loadModel() {
  const storage = new Map();
  const quietConsole = { log() {}, warn() {}, error() {} };
  const ctx = {
    console: quietConsole,
    Date,
    Math,
    JSON,
    Number,
    Object,
    Array,
    Set,
    Map,
    Promise,
    localStorage: {
      getItem: key => storage.has(key) ? storage.get(key) : null,
      setItem: (key, value) => storage.set(key, value),
      removeItem: key => storage.delete(key),
    },
    SATC: {},
    WXC: {},
    WX_HISTORY: {},
    RZWB_CACHE: {},
    SOIL_CACHE: { data: null, lastUpdated: 0 },
    FB_USER: null,
    FB_MODE: false,
    SC: {},
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  for (const file of ['constants.js', 'cropData.js', 'utils.js', 'phenology.js', 'soilModel.js']) {
    if (file === 'utils.js') {
      vm.runInContext('window.agrd = crop => CROP_AGR[crop] || CROP_AGR.default;', ctx);
    }
    vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), ctx, { filename: file });
  }
  return ctx;
}

function baseFixture() {
  const w = loadModel();
  const field = {
    id: 'test-field', name: 'Test', crop: 'default', category: 'sebze',
    soilType: 'tinli', status: 'fallow', events: [],
  };
  const params = w.getRZWBParams(field);
  return { w, field, params };
}

function days(count, rain = 0, et0 = 4) {
  return Array.from({ length: count }, (_, i) => ({
    date: `2026-01-${String(i + 1).padStart(2, '0')}`,
    rain: typeof rain === 'function' ? rain(i) : rain,
    et0, tmin: 15, tmax: 25,
  }));
}

function storage(state, p) {
  return (p.taw_s - state.Dr_s) + (p.taw_d - state.Dr_d)
    + (state.surplus_s || 0) + (state.surplus_d || 0);
}

function assertInvariants(records, p) {
  for (const r of records) {
    for (const key of ['Dr_s', 'Dr_d', 'surplus_s', 'surplus_d', 'ETc_s', 'ETc_d', 'Pe', 'irr', 'perc', 'percDeep']) {
      assert.ok(Number.isFinite(r[key]), `${r.date} ${key} must be finite`);
      assert.ok(r[key] >= 0, `${r.date} ${key} must be non-negative`);
    }
    assert.ok(r.Dr_s <= p.taw_s, `${r.date} Dr_s exceeds TAW`);
    assert.ok(r.Dr_d <= p.taw_d, `${r.date} Dr_d exceeds TAW`);
  }
}

function cumulativeResidual(initial, records, p) {
  const inputs = records.reduce((n, r) => n + r.Pe + r.irr, 0);
  const outputs = records.reduce((n, r) => n + r.ETc_s + r.ETc_d + r.percDeep, 0);
  const change = storage(records.at(-1), p) - storage(initial, p);
  return inputs - outputs - change;
}

test('FAZ 6: every next step receives the complete previous state', () => {
  const { w, field, params } = baseFixture();
  const seen = [];
  const actualStep = w.rzwbStep;
  w.rzwbStep = (...args) => {
    seen.push({ ...args[0] });
    return actualStep(...args);
  };
  const wx = days(4);
  const records = w.simulateRZWBForward(0, 0, wx[0].date, wx.at(-1).date, wx, { [wx[0].date]: 40 }, params, field);
  assert.ok(records[0].surplus_s > 0 || records[0].surplus_d > 0, 'fixture must create surplus');
  for (let i = 1; i < records.length; i++) {
    assert.equal(seen[i].Dr_s, records[i - 1].Dr_s);
    assert.equal(seen[i].Dr_d, records[i - 1].Dr_d);
    assert.equal(seen[i].surplus_s, records[i - 1].surplus_s);
    assert.equal(seen[i].surplus_d, records[i - 1].surplus_d);
  }
});

test('FAZ 6: the documented 40 mm multi-day loss is eliminated', () => {
  const { w, field, params } = baseFixture();
  const wx = days(3);
  const initial = { Dr_s: 0, Dr_d: 0, surplus_s: 0, surplus_d: 0 };
  const irrigation = { [wx[0].date]: 40 };
  const fixed = w.simulateRZWBForward(0, 0, wx[0].date, wx.at(-1).date, wx, irrigation, params, field, initial);

  let legacyPrev = { ...initial };
  const legacy = wx.map(dayWx => {
    const step = w.rzwbStep(legacyPrev, dayWx, irrigation[dayWx.date] || 0, params, field);
    legacyPrev = { Dr_s: step.Dr_s, Dr_d: step.Dr_d }; // documented pre-FAZ-6 defect
    return { date: dayWx.date, ...step };
  });

  const fixedError = cumulativeResidual(initial, fixed, params);
  const legacyError = cumulativeResidual(initial, legacy, params);
  assert.ok(Math.abs(fixedError) <= 0.5, `fixed residual=${fixedError}`);
  assert.ok(Math.abs(legacyError) > 20, `legacy defect was not reproduced: residual=${legacyError}`);
});

for (const irrigation of [0, 5, 20, 50, 100, 500, 1000, 2000]) {
  test(`FAZ 6: ${irrigation} mm irrigation conserves water over 7 days`, () => {
    const { w, field, params } = baseFixture();
    const wx = days(7);
    const initial = { Dr_s: 0, Dr_d: 0, surplus_s: 0, surplus_d: 0 };
    const records = w.simulateRZWBForward(0, 0, wx[0].date, wx.at(-1).date, wx, { [wx[0].date]: irrigation }, params, field, initial);
    assertInvariants(records, params);
    assert.ok(Math.abs(cumulativeResidual(initial, records, params)) <= 0.75, `residual=${cumulativeResidual(initial, records, params)}`);
  });
}

for (const rainfall of [50, 100, 300]) {
  test(`FAZ 6: ${rainfall} mm rainfall conserves effective water`, () => {
    const { w, field, params } = baseFixture();
    const wx = days(7, i => i === 0 ? rainfall : 0);
    const initial = { Dr_s: 0, Dr_d: 0, surplus_s: 0, surplus_d: 0 };
    const records = w.simulateRZWBForward(0, 0, wx[0].date, wx.at(-1).date, wx, {}, params, field, initial);
    assertInvariants(records, params);
    assert.ok(Math.abs(cumulativeResidual(initial, records, params)) <= 0.75, `residual=${cumulativeResidual(initial, records, params)}`);
  });
}

test('FAZ 6: mixed events and drought preserve balance and invariants', () => {
  const { w, field, params } = baseFixture();
  const wx = days(60, i => i === 1 ? 20 : 0);
  const irr = { '2026-01-01': 40, '2026-01-04': 30 };
  const initial = { Dr_s: 0, Dr_d: 0, surplus_s: 0, surplus_d: 0 };
  const records = w.simulateRZWBForward(0, 0, wx[0].date, wx.at(-1).date, wx, irr, params, field, initial);
  assertInvariants(records, params);
  assert.ok(Math.abs(cumulativeResidual(initial, records, params)) <= 3, `residual=${cumulativeResidual(initial, records, params)}`);
});

test('FAZ 6: existing-ledger surplus is accepted and legacy records default to zero', () => {
  const { w, field, params } = baseFixture();
  const wx = days(1);
  const state = { Dr_s: 4, Dr_d: 7, surplus_s: 8.25, surplus_d: 3.5 };
  let received;
  const actualStep = w.rzwbStep;
  w.rzwbStep = (...args) => { received = { ...args[0] }; return actualStep(...args); };
  w.simulateRZWBForward(state.Dr_s, state.Dr_d, wx[0].date, wx[0].date, wx, {}, params, field, state);
  assert.deepEqual(received, state);
  assert.deepEqual({ ...w.toRZWBState({ Dr_s: 4, Dr_d: 7 }) }, { Dr_s: 4, Dr_d: 7, surplus_s: 0, surplus_d: 0 });
});

test('FAZ 6: satellite anchor is complete and excluded from repair', () => {
  const { w, field, params } = baseFixture();
  field.id = 'sat-field';
  w.SATC[field.id] = { at: new Date('2026-01-01T12:00:00Z').getTime(), data: { soilM3: 0.5, soilMDeep: 0.45 } };
  const bs = w.resolveRZWBBootstrapState(field, params, '2026-01-03', '2025-12-01');
  assert.equal(bs.anchorRecord.source, 'satellite-anchor');
  assert.equal(bs.bootstrapSource, 'open-meteo-soil-model');
  assert.equal(bs.anchorRecord.sourceProvider, 'open-meteo-soil-model');
  assert.equal(bs.anchorRecord.surplus_s, 0);
  assert.equal(bs.anchorRecord.surplus_d, 0);
  assert.equal(w.isIncompleteRZWBRecord(bs.anchorRecord, 0), false);
});

function dateOffset(w, offset) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return w.dateKey(d);
}

test('FAZ 6: calcSoilRZWB repair uses and propagates the complete state contract', async () => {
  const { w, field, params } = baseFixture();
  const d1 = dateOffset(w, -2);
  const d2 = dateOffset(w, -1);
  const d3 = dateOffset(w, 0);
  const wx = [d1, d2, d3].map(date => ({ date, rain: 0, et0: 4, tmin: 15, tmax: 25 }));
  field.events = [{ type: 'sulama', planned: false, date: d1, qty: 40, unit: 'mm' }];
  const first = { date: d1, ...w.rzwbStep({ Dr_s: 0, Dr_d: 0, surplus_s: 0, surplus_d: 0 }, wx[0], 40, params, field) };
  assert.ok(first.surplus_s > 0 || first.surplus_d > 0, 'fixture must create carried water');
  const incomplete = { date: d2, Dr_s: first.Dr_s, Dr_d: first.Dr_d, irr: 0 };
  w.localStorage.setItem(`tt_rzwb_${field.id}`, JSON.stringify([first, incomplete]));
  w.getBestWXDays = () => wx;
  w.fetchWXHistory = async () => wx;

  const calls = [];
  const actualStep = w.rzwbStep;
  w.rzwbStep = (...args) => { calls.push({ date: args[1].date, prev: { ...args[0] } }); return actualStep(...args); };
  const result = await w.calcSoilRZWB(field, true);

  const repairDay2 = calls.find(c => c.date === d2);
  assert.ok(repairDay2, 'repair must recalculate the incomplete day');
  assert.equal(repairDay2.prev.surplus_s, first.surplus_s);
  assert.equal(repairDay2.prev.surplus_d, first.surplus_d);
  const saved = JSON.parse(w.localStorage.getItem(`tt_rzwb_${field.id}`));
  const repaired2 = saved.find(r => r.date === d2);
  const repaired3 = saved.find(r => r.date === d3);
  assert.ok(repaired2 && repaired3, 'repair must persist the rebuilt chain through today');
  assert.ok(Object.hasOwn(repaired2, 'surplus_s') && Object.hasOwn(repaired2, 'surplus_d'));
  assert.ok(Number.isFinite(result.surface.Dr) && Number.isFinite(result.deep.Dr));
});

test('FAZ 6: invalidation removes the requested suffix and clears cache', async () => {
  const { w, field } = baseFixture();
  const records = [
    { date: '2026-01-01', Dr_s: 1, Dr_d: 2, surplus_s: 3, surplus_d: 4 },
    { date: '2026-01-02', Dr_s: 2, Dr_d: 3, surplus_s: 4, surplus_d: 5 },
    { date: '2026-01-03', Dr_s: 3, Dr_d: 4, surplus_s: 5, surplus_d: 6 },
  ];
  w.localStorage.setItem(`tt_rzwb_${field.id}`, JSON.stringify(records));
  w.RZWB_CACHE[field.id] = { records };
  let soilInvalidated = false;
  w.invSoil = id => { soilInvalidated = id === field.id; };
  await w.invalidateRZWBFrom(field.id, '2026-01-02');
  const remaining = JSON.parse(w.localStorage.getItem(`tt_rzwb_${field.id}`));
  assert.deepEqual(remaining.map(r => r.date), ['2026-01-01']);
  assert.equal(w.RZWB_CACHE[field.id], undefined);
  assert.equal(soilInvalidated, true);
});

test('dashboard reset rebuilds every field from preserved events and weather history', async () => {
  const { w } = baseFixture();
  const fields = [
    { id: 'field-a', events: [{ type: 'sulama', date: '2026-01-02', qty: 20, unit: 'mm' }] },
    { id: 'field-b', events: [{ type: 'sulama', date: '2026-01-03', qty: 30, unit: 'mm' }] },
  ];
  w.DB = { fields };
  const originalEvents = fields.map(field => JSON.stringify(field.events));
  for (const field of fields) {
    w.localStorage.setItem(`tt_rzwb_${field.id}`, JSON.stringify([{ date: '2026-01-01' }]));
    w.RZWB_CACHE[field.id] = { records: [{ date: '2026-01-01' }] };
  }
  w.WX_HISTORY = {
    'field-a': { days: [{ date: '2026-01-01' }] },
    'field-b': { days: [{ date: '2026-01-01' }] },
  };
  const sequence = [];
  w.fetchWXHistory = async field => { sequence.push(`weather:${field.id}`); return w.WX_HISTORY[field.id].days; };
  w.calcSoilRZWB = async (field, force) => {
    sequence.push(`model:${field.id}`);
    assert.equal(force, true);
    assert.ok(w.WX_HISTORY[field.id].days.length > 0);
    assert.equal(w.localStorage.getItem(`tt_rzwb_${field.id}`), null);
    return { surface: { pct: 50 }, deep: { pct: 50 } };
  };
  w.invSoil = () => {};
  w.invSoilAll = () => {};

  const summary = await w.rebuildAllMoistureModels(fields);
  assert.equal(summary.total, 2);
  assert.equal(summary.rebuilt, 2);
  assert.equal(summary.failed, 0);
  assert.deepEqual(sequence.slice(0, 2), ['weather:field-a', 'weather:field-b']);
  assert.deepEqual(sequence.slice(2), ['model:field-a', 'model:field-b']);
  assert.deepEqual(fields.map(field => JSON.stringify(field.events)), originalEvents);
  assert.equal(w.RZWB_CACHE['field-a'], undefined);
  assert.equal(w.RZWB_CACHE['field-b'], undefined);
  assert.ok(w.WX_HISTORY['field-a'].days.length > 0);
});
