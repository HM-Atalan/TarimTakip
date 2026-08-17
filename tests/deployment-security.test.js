const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root,file),'utf8');

test('Spark AI uses the existing Remote Config GMINIK flow without a hardcoded Gemini key', () => {
  const firebase=read('firebase-config.js');
  assert.ok(firebase.includes("getValue(remoteConfig, 'GMINIK')"));
  assert.ok(firebase.includes('window.getGeminiKey'));
  assert.ok(read('ai.js').includes('await window.getGeminiKey()'));
  assert.ok(!firebase.includes('AIzaSy') || firebase.match(/AIzaSy/g).length===1); // Firebase web config is public.
});

test('AI output is escaped before rich rendering', () => {
  assert.ok(read('ai.js').includes('window.safeAIHtml'));
  assert.ok(read('photos.js').includes('window.safeAIHtml(text)'));
  assert.ok(!read('photos.js').includes('>${text}</div>'));
});

test('Firebase deployment is Spark-only and includes deny-by-default Firestore rules', () => {
  assert.ok(read('firestore.rules').includes('allow read, write: if false'));
  const config=JSON.parse(read('firebase.json'));
  assert.equal(config.firestore.rules,'firestore.rules');
  assert.equal(config.functions,undefined);
  assert.equal(config.storage,undefined);
});

test('PWA and accessible viewport are configured', () => {
  const html=read('index.html');
  assert.ok(html.includes('manifest.webmanifest'));
  assert.ok(!html.includes('user-scalable=no'));
  assert.ok(fs.existsSync(path.join(root,'service-worker.js')));
  assert.equal(JSON.parse(read('manifest.webmanifest')).name,'TarımTakip');
});

test('moisture maintenance is in settings and startup prepares the model before rendering', () => {
  const html=read('index.html');
  const dashboard=html.slice(html.indexOf('<!-- DASHBOARD -->'),html.indexOf('<!-- FIELD PAGE -->'));
  const settings=html.slice(html.indexOf('<!-- SETTINGS -->'));
  assert.ok(!dashboard.includes('reset-moisture-btn'));
  assert.ok(settings.includes('reset-moisture-btn'));
  const auth=read('auth.js');
  assert.ok(auth.indexOf('await window.prepareMoistureModels') < auth.indexOf('await renderAll()'));
  const sync=read('fieldCrud.js').slice(read('fieldCrud.js').indexOf('window.syncFromDB'));
  assert.ok(sync.indexOf('await window.prepareMoistureModels') < sync.indexOf('await renderAll()'));
});

test('startup moisture persistence prefers completed local ledger and avoids satellite refresh races', () => {
  const soil=read('soilModel.js');
  assert.ok(soil.includes('localLast>=cloudLast'));
  assert.ok(soil.includes('await window.fbSaveRZWB(uid, field.id, ledger)'));
  assert.ok(!read('auth.js').includes('fetchAllSatellites()'));
  assert.ok(!read('fieldCrud.js').includes('fetchAllSatellites()'));
  assert.ok(read('main.js').includes('await window.fetchStartupSoilAnchors(fields)'));
  assert.ok(read('main.js').includes('await window.rebuildAllMoistureModels(fields)'));
  assert.ok(read('satellite.js').includes("lats=targets.map(field=>Number(field.lat)).join(',')"));
  assert.ok(read('service-worker.js').includes("tarimtakip-v2"));
});

test('photos use local IndexedDB instead of Blaze-only Firebase Storage', () => {
  const photos=read('photos.js');
  assert.ok(photos.includes("indexedDB.open('tarimtakip-local'"));
  assert.ok(photos.includes('storeLocalPhoto'));
  assert.ok(!read('firebase-config.js').includes('firebase-storage.js'));
});
