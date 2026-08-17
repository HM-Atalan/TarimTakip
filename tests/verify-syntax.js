const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const files = fs.readdirSync(root).filter(name => name.endsWith('.js')).sort();
files.push(path.join('tools','dev-server.js'));
const failures = [];

for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', path.join(root, file)], { encoding: 'utf8' });
  if (result.status !== 0) failures.push(`${file}\n${result.stderr || result.stdout}`);
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log(`Syntax verification passed: ${files.length} production JavaScript files.`);
