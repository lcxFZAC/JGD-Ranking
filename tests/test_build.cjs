const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const crypto = require('node:crypto');
require('node:child_process').execFileSync(process.execPath,['scripts/build.js'],{stdio:'inherit'});
const bootstrap = fs.readFileSync('dist/data/bootstrap.js','utf8'), context = {window:{}};
vm.runInNewContext(bootstrap,context);
assert.equal(context.window.SPOTLIGHT_DATA.latest.games.length,30);
assert.equal(context.window.SPOTLIGHT_DATA.history,undefined);
assert.ok(Buffer.byteLength(bootstrap) < 20000,'Keep the first screen data below 20 KB');
const catalogue = JSON.parse(fs.readFileSync('data/catalogue.json','utf8'));
const source = JSON.parse(fs.readFileSync('data/latest.json','utf8'));
assert.equal(catalogue.games.length,source.games.length);
assert.deepEqual(catalogue.summary,source.summary);
const version = JSON.parse(fs.readFileSync('data/version.json','utf8'));
assert.equal(version.version,catalogue.crawledAt);
for (const [file,key] of [['catalogue','catalogueHash'],['history','historyHash']]) {
  const data = JSON.stringify(JSON.parse(fs.readFileSync(`data/${file}.json`,'utf8')));
  assert.equal(version[key],crypto.createHash('sha256').update(data).digest('hex'));
}
const html = fs.readFileSync('dist/index.html','utf8');
assert.ok(!html.includes('src="./data/dashboard.js"'),'Full offline bundle must not block online startup');
assert.ok(html.includes('defer src="./data/bootstrap.js"'));
assert.ok(fs.statSync('data/version.json').size < 512);
console.log('First-screen budget, complete catalogue and publication manifest tests passed');
