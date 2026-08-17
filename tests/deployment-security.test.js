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

test('application is online-only and accessible viewport is configured', () => {
  const html=read('index.html');
  assert.ok(!html.includes('manifest.webmanifest'));
  assert.ok(!html.includes('user-scalable=no'));
  assert.ok(!fs.existsSync(path.join(root,'service-worker.js')));
  assert.ok(read('main.js').includes('getRegistrations()'));
});

test('moisture maintenance is in settings and startup prepares the model before rendering', () => {
  const html=read('index.html');
  const dashboard=html.slice(html.indexOf('<!-- DASHBOARD -->'),html.indexOf('<!-- FIELD PAGE -->'));
  const settings=html.slice(html.indexOf('<!-- SETTINGS -->'));
  assert.ok(!dashboard.includes('reset-moisture-btn'));
  assert.ok(settings.includes('reset-moisture-btn'));
  const sync=read('fieldCrud.js').slice(read('fieldCrud.js').indexOf('window.syncFromDB'));
  assert.ok(sync.indexOf('await window.prepareMoistureModels') < sync.indexOf('await renderAll()'));
});

test('startup moisture persistence prefers completed local ledger and avoids satellite refresh races', () => {
  const soil=read('soilModel.js');
  assert.ok(soil.includes('localLast>=cloudLast'));
  assert.ok(soil.includes('await window.fbSaveRZWB(uid, field.id, ledger)'));
  assert.ok(!read('auth.js').includes('fetchAllSatellites()'));
  assert.ok(!read('fieldCrud.js').includes('fetchAllSatellites()'));
  assert.ok(read('main.js').includes('await window.fetchStartupSoilAnchors(migrationTargets)'));
  assert.ok(read('main.js').includes('await window.rebuildAllMoistureModels(anchored)'));
  assert.ok(read('main.js').includes("localStorage.getItem('tt_rzwb_version_'+field.id)!==window.MOISTURE_MODEL_VERSION"));
  assert.ok(read('satellite.js').includes("lats=targets.map(field=>Number(field.lat)).join(',')"));
});

test('photos use Google Drive metadata and no local binary storage', () => {
  const photos=read('photos.js');
  assert.ok(photos.includes('pendingDrivePhoto'));
  assert.ok(read('googleDrive.js').includes('google.picker.PickerBuilder'));
  assert.ok(read('googleDrive.js').includes("scope:'https://www.googleapis.com/auth/drive.file'"));
  assert.ok(!photos.includes('storeLocalPhoto'));
  assert.ok(!read('firebase-config.js').includes('firebase-storage.js'));
});

test('dashboard market prices use an official anonymous open-data endpoint', () => {
  assert.ok(read('index.html').includes('market-prices'));
  const market=read('market.js');
  assert.ok(market.includes('https://openapi.izmir.bel.tr/api/ibb/halfiyatlari/sebzemeyve/'));
  assert.ok(market.includes('https://www.hal.gov.tr/Sayfalar/FiyatDetaylari.aspx'));
});
