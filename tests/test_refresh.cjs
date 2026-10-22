const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const {DataClient} = require('../data-client.js');
const ts = '2026-10-20T10:00:00Z';
const latest = {eventId:28, crawledAt:ts, summary:{total:1},games:[{id:'1',name:'test',heat:2,followers:3}]};
let version = {eventId:28,version:ts,catalogueHash:'a'.repeat(64),historyHash:'b'.repeat(64)};
let data = latest, failHistory = false;
const calls = [], saved = new Map();
const storage = {getItem:key=>saved.get(key),setItem:(key,value)=>saved.set(key,value)};
const fetcher = async url => {
  calls.push(url);
  if (url.includes('history') && failHistory) throw new Error('history offline');
  return {ok:true,json:async()=>url.includes('version') ? version : url.includes('history') ? {eventId:28,snapshots:[{ts:data.crawledAt,games:{}}]} : data};
};
const initial = {...latest,partial:true};
(async()=>{
  const client = new DataClient({fetcher,storage,initial});
  assert.equal(client.catalogue.partial,true);
  await client.check(); assert.equal(calls.length,2);
  assert.ok(calls[0].endsWith('catalogue.json'));
  assert.ok(calls[1].endsWith('version.json'));
  assert.ok(!calls.some(url=>url.includes('history')));
  await client.check(); assert.equal(calls.length,3,'Unchanged version only downloads manifest');
  const returning = new DataClient({fetcher,storage,initial});
  assert.equal(returning.catalogue.partial,undefined,'Cached catalogue available before requests');
  await returning.check(); assert.equal(calls.length,4);
  await client.loadHistory(); await client.loadHistory();
  assert.equal(calls.filter(url=>url.includes('history')).length,1);
  version = {...version,version:'2026-10-20T13:00:00Z',catalogueHash:'c'.repeat(64),historyHash:'d'.repeat(64)};
  await assert.rejects(client.check(),/尚未同步/);
  assert.equal(client.catalogue.crawledAt,ts);
  data = {...latest,crawledAt:version.version}; failHistory = true;
  await client.check(); assert.equal(client.catalogue.crawledAt,version.version,'History outage never blocks latest');
  await assert.rejects(client.loadHistory(),/offline/);
  failHistory = false; await client.loadHistory();
  version = {...version,version:ts};
  assert.equal((await client.check()).crawledAt,data.crawledAt,'No rollback on stale manifest');
  for (const badStorage of [{getItem:()=>'{broken'},{getItem:()=>{throw Error('blocked');},setItem:()=>{throw Error('quota');}}]) {
    const fallback = new DataClient({fetcher,storage:badStorage,initial});
    await fallback.localFallback(); assert.equal(fallback.catalogue.games.length,1);
  }
  const concurrent = new DataClient({fetcher,storage:null,initial});
  version = {...version,version:data.crawledAt}; const before = calls.length;
  await Promise.all([concurrent.check(),concurrent.check()]); assert.equal(calls.length-before,2);
  // Hold the manifest open: the catalogue must already be in flight.
  let releaseManifest;
  const coldCalls = [];
  const coldClient = new DataClient({storage:null,initial,fetcher:async url=>{
    coldCalls.push(url);
    if(url.endsWith('version.json')) await new Promise(resolve=>{releaseManifest=resolve;});
    return {ok:true,json:async()=>url.endsWith('version.json')?version:data};
  }});
  const coldCheck = coldClient.check();
  assert.equal(coldCalls.length,2,'Cold catalogue does not wait for manifest round trip');
  releaseManifest(); await coldCheck;
  const staleClient = new DataClient({storage:null,initial,fetcher:async url=>({ok:true,json:async()=>
    url.endsWith('version.json') ? version : url.includes('?v=') ? data : latest})});
  assert.equal((await staleClient.check()).crawledAt,version.version,'Stale speculative response retries versioned URL');
  // Both branch URLs (including the hash query) can remain stuck on an old file.
  const sha='e'.repeat(40), recoveryCalls=[];
  const recovered = new DataClient({storage:null,initial,fetcher:async url=>{
    recoveryCalls.push(url);
    const body=url.includes('/commits?') ? [{sha}] : url.includes('version.json') ? version :
      url.includes('history.json') ? {eventId:28,snapshots:[{ts:data.crawledAt}]} :
      url.includes('/'+sha+'/') ? data : latest;
    return {ok:true,json:async()=>body};
  }});
  assert.equal((await recovered.check()).crawledAt,version.version,'Pinned commit recovers stale branch catalogue');
  await recovered.loadHistory();
  assert.ok(recoveryCalls.some(url=>url.includes('/'+sha+'/data/history.json')),'History stays on the same immutable commit');
  recoveryCalls.length=0;
  await recovered.check(true);
  assert.ok(recoveryCalls[0].includes('/commits?'),'Explicit refresh bypasses stale branch manifest as well as catalogue');
  const mirror=new DataClient({storage:null,initial,fetcher:async url=>{
    if(url.startsWith('https://raw.githubusercontent.com/')) throw Error('network unavailable');
    return {ok:true,json:async()=>url.includes('version.json')?version:data};
  }});
  assert.equal((await mirror.check()).crawledAt,version.version,'CDN fallback works without Cloudflare requests');
  const source = fs.readFileSync('app.js','utf8');
  const schedulingCode = source.slice(source.indexOf('  function scheduleRefresh()'),source.indexOf("  document.addEventListener('visibilitychange'"));
  for (const [date,expected] of [['2026-10-20T04:59:32Z',28000],['2026-10-20T05:00:00Z',300000]]) {
    let delay;
    vm.runInNewContext(schedulingCode,{Date:{now:()=>Date.parse(date)},setTimeout:(_callback,ms)=>{delay=ms;},refreshSnapshot:async()=>{}});
    assert.equal(delay,expected);
  }
  console.log('Version-only checks, cache, lazy history, independent failures, CDN race, deduplication and clock tests passed');
})().catch(error=>{console.error(error);process.exitCode=1;});

