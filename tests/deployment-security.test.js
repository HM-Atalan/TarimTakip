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

test('photos use local IndexedDB instead of Blaze-only Firebase Storage', () => {
  const photos=read('photos.js');
  assert.ok(photos.includes("indexedDB.open('tarimtakip-local'"));
  assert.ok(photos.includes('storeLocalPhoto'));
  assert.ok(!read('firebase-config.js').includes('firebase-storage.js'));
});
