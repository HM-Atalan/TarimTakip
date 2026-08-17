const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');

function loadUtils() {
  const ctx = { window: null, console, Date, Math, JSON, Number, Object, Array, Set, Map,
    Promise, URL, location: { href: 'https://example.test/' },
    document: { querySelector: () => null }, localStorage: { getItem: () => null, setItem() {} } };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(root, 'utils.js'), 'utf8'), ctx, { filename: 'utils.js' });
  return ctx;
}

test('FAZ 13: untrusted HTML is escaped', () => {
  const w = loadUtils();
  const input = `<img src=x onerror="alert('x')">&`;
  const output = w.esc(input);
  assert.equal(output, '&lt;img src=x onerror=&quot;alert(&#39;x&#39;)&quot;&gt;&amp;');
  assert.ok(!output.includes('<img'));
});

test('FAZ 13: unsafe profile URLs and CSS colors are rejected', () => {
  const w = loadUtils();
  assert.equal(w.safeHttpUrl('javascript:alert(1)'), '');
  assert.equal(w.safeHttpUrl('data:text/html,x'), '');
  assert.equal(w.safeHttpUrl('https://example.com/a'), 'https://example.com/a');
  assert.equal(w.safeCssColor('red; background:url(javascript:x)'), '#40916c');
  assert.equal(w.safeCssColor('#abc123'), '#abc123');
});

test('FAZ 13: dashboard no longer embeds field IDs into inline JavaScript', () => {
  const source = fs.readFileSync(path.join(root, 'ui.js'), 'utf8');
  assert.ok(!source.includes(`onclick="showField('\${f.id}')"`));
  assert.ok(source.includes('data-field-index'));
});
