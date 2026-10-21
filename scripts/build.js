'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = name => JSON.parse(fs.readFileSync(path.join(root, 'data', name), 'utf8'));
const latest = read('latest.json'), history = read('history.json');
if (!latest.games?.length || latest.eventId !== 28 || history.eventId !== 28) throw new Error('Invalid event snapshot');
if (latest.summary.total !== latest.games.length) throw new Error('Snapshot count mismatch');
const bundle = `window.SPOTLIGHT_DATA=${JSON.stringify({latest, history}).replace(/</g, '\\u003c')};\n`;
if (Buffer.byteLength(bundle) > 20 * 1024 * 1024) throw new Error('Data bundle exceeds 20 MiB publication budget');
fs.writeFileSync(path.join(root, 'data/dashboard.js'), bundle);
// Keep the full source snapshot for auditing; ship only fields used by the UI.
const fields = ['id','name','developer','icon','method','platform','heat','followers','rank','url'];
const catalogue = {...latest, games: latest.games.map(game => Object.fromEntries(fields.map(key => [key, game[key]])))};
const encoded = JSON.stringify(catalogue);
const hash = value => require('node:crypto').createHash('sha256').update(value).digest('hex');
const manifest = {schemaVersion: 1, eventId: 28, version: latest.crawledAt, startedAt: latest.startedAt,
  catalogueHash: hash(encoded), historyHash: hash(JSON.stringify(history))};
fs.writeFileSync(path.join(root, 'data/catalogue.json'), encoded);
fs.writeFileSync(path.join(root, 'data/version.json'), JSON.stringify(manifest));
const bootstrap = {...catalogue, partial: true, summary: {...catalogue.summary, atLeast50: catalogue.games.filter(g => g.heat >= 50).length}, games: catalogue.games.slice(0, 30)};
fs.writeFileSync(path.join(root, 'data/bootstrap.js'),
  `window.SPOTLIGHT_DATA=${JSON.stringify({latest: bootstrap}).replace(/</g, '\\u003c')};\n`);
const dist = path.join(root, 'dist');
fs.mkdirSync(path.join(dist, 'data'), {recursive: true});
fs.cpSync(path.join(root,'assets'),path.join(dist,'assets'),{recursive:true});
fs.copyFileSync(path.join(root,'_headers'),path.join(dist,'_headers'));
for (const file of ['index.html','styles.css','spotlight.css','app.js','data-client.js']) fs.copyFileSync(path.join(root,file), path.join(dist,file));
for (const file of ['latest.json','history.json','dashboard.js','bootstrap.js','catalogue.json','version.json']) fs.copyFileSync(path.join(root,'data',file), path.join(dist,'data',file));
fs.writeFileSync(path.join(dist,'.nojekyll'), '');
// Render the first screen from one HTML response. A slow/failed CSS or JS
// connection must not leave an otherwise downloaded page unusable.
let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = ['styles.css','spotlight.css'].map(file => fs.readFileSync(path.join(root,file),'utf8')).join('\n');
html = html.replace(/  <link rel="stylesheet" href="\.\/(?:styles|spotlight)\.css">\r?\n/g, '');
html = html.replace('</head>', `<style>${css}</style>\n</head>`);
let scripts = ['data/bootstrap.js','data-client.js','app.js'].map(file => fs.readFileSync(path.join(root,file),'utf8')).join('\n;\n');
fs.mkdirSync(path.join(dist,'static'),{recursive:true});
for (const file of ['zaowuguo-icon.jpg','zaowuguo-cover.jpg']) {
  const bytes = fs.readFileSync(path.join(root,'assets',file));
  const target = `static/${path.basename(file,'.jpg')}.${hash(bytes).slice(0,16)}.jpg`;
  fs.writeFileSync(path.join(dist,target),bytes);
  html = html.replaceAll(`./assets/${file}`, `./${target}`);
  scripts = scripts.replaceAll(`./assets/${file}`, `./${target}`);
}
html = html.replace(/  <script defer src="\.\/(?:data\/bootstrap|data-client|app)\.js"><\/script>\r?\n/g, '');
// Escape closing tags in inline JavaScript without changing string values.
html = html.replace('</body>', `<script>${scripts.replace(/<\/script/gi,'<\\/script')}</script>\n</body>`);
const revision = hash(html).slice(0,16);
const worker = fs.readFileSync(path.join(root,'service-worker.js'),'utf8').replace('__REVISION__',revision);
fs.writeFileSync(path.join(dist,'service-worker.js'),worker);
fs.writeFileSync(path.join(dist,'index.html'),html);
console.log(`Built dist/: ${latest.games.length} verified games, ${history.snapshots.length} historical snapshots.`);
