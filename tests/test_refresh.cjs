const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('app.js', 'utf8');
// Exercise the actual refresh function with controlled network responses.
const refreshCode = source.slice(source.indexOf('  let refreshing = false;'), source.indexOf('  try { initialize(window.SPOTLIGHT_DATA);'));
const ts = '2026-10-20T10:00:00+00:00';
const latest = {eventId:28, crawledAt:ts};
const history = {eventId:28, snapshots:[{ts}]};
let applied = 0, fail = false, mismatch = false;
const pill = {};
const context = vm.createContext({
  location:{protocol:'https:'}, state:{data:{crawledAt:'2026-10-19T00:00:00Z'}},
  AbortSignal, Date, Number, Promise, Error,
  $:()=>pill, updateFreshness:()=>{},
  initialize:bundle=>{applied++;context.state.data=bundle.latest;},
  fetch:async (url, options)=>{
    assert.equal(options.cache, 'no-store');
    if (fail) throw new Error('offline');
    return {ok:true,json:async()=>url.includes('latest') ? latest : mismatch ? {...history,snapshots:[]} : history};
  }
});
vm.runInContext(refreshCode, context);
(async()=>{
  await context.refreshSnapshot(); assert.equal(applied,1);
  await context.refreshSnapshot(); assert.equal(applied,1);
  fail=true; await context.refreshSnapshot(); assert.equal(applied,1);
  assert.match(pill.title,/offline/);
  fail=false; mismatch=true; await context.refreshSnapshot(); assert.equal(applied,1);
  assert.match(pill.title,/不一致/);
  context.location.protocol='file:'; await context.refreshSnapshot(); assert.equal(applied,1);
  console.log('Snapshot refresh / unchanged / offline / mismatched / local-file tests passed');
})().catch(error=>{console.error(error);process.exitCode=1;});
