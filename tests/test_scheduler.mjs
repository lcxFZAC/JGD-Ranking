import assert from 'node:assert/strict';
import {tick,windowStart} from '../scheduler/worker.mjs';
const now=Date.parse('2026-10-21T07:30:00Z');
assert.equal(windowStart(Date.parse('2026-10-21T08:30:00Z')),Date.parse('2026-10-21T08:00:00Z'));
assert.equal(windowStart(now),Date.parse('2026-10-21T07:00:00Z'));
assert.equal(windowStart(Date.parse('2026-10-20T16:30:00Z')),Date.parse('2026-10-20T16:00:00Z'));
async function check(startedAt,version,runs,expected){
 const calls=[];
 const fetcher=async(url,options={})=>{calls.push({url,options});return {ok:true,status:options.method==='POST'?204:200,json:async()=>url.includes('version.json')?{eventId:28,startedAt,version}:{workflow_runs:runs}};};
 assert.equal(await tick({GITHUB_ACTIONS_TOKEN:'test'},now,fetcher),expected);
 const posts=calls.filter(x=>x.options.method==='POST');
 assert.equal(posts.length,expected==='dispatched'?1:0);
 assert.equal(calls[0].options.headers,undefined);
 if(posts.length) assert.equal(JSON.parse(posts[0].options.body).inputs.only_if_due,true);
}
await check('2026-10-21T07:00:00Z','2026-10-21T07:03:00Z',[],'already-current');
await check('2026-10-21T06:00:00Z','2026-10-21T06:03:00Z',[],'dispatched');
await check('2026-10-21T04:00:00Z','2026-10-21T04:03:00Z',[],'dispatched');
await check('2026-10-21T06:59:00Z','2026-10-21T07:03:00Z',[],'dispatched');
await check(null,'2026-10-21T04:03:00Z',[{event:'schedule',status:'in_progress'}],'already-running');
await check(null,'2026-10-21T04:03:00Z',[{event:'workflow_dispatch',status:'completed',created_at:'2026-10-21T07:28:00Z'}],'recent-dispatch');
await assert.rejects(tick({},now),/Missing/);
await assert.rejects(tick({GITHUB_ACTIONS_TOKEN:'test'},now,async()=>({ok:false,status:503})),/503/);
console.log('Half-hour scheduler timezone, race protection and dispatch tests passed');
