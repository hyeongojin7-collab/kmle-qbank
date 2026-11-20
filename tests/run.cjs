const {readdirSync} = require('node:fs');
const {join} = require('node:path');
const {spawnSync} = require('node:child_process');

const suites = readdirSync(__dirname)
  .filter(name => name.endsWith('.cjs') && name !== 'run.cjs')
  .sort();
for (const suite of suites) {
  const result = spawnSync(process.execPath, [join(__dirname, suite)], {stdio:'inherit'});
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
console.log(`PASS: ${suites.length} suites`);
