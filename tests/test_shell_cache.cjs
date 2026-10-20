const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const handlers = {}, saved = new Map();
let requests = 0;
const root = 'https://example.com/';
const cache = {match:async key=>saved.get(typeof key==='string'?key:key.url),put:async(key,value)=>saved.set(typeof key==='string'?key:key.url,value)};
vm.runInNewContext(fs.readFileSync('service-worker.js','utf8'),{
 URL, self:{registration:{scope:root},addEventListener:(name,fn)=>handlers[name]=fn},
 caches:{open:async()=>cache}, fetch:async()=>{requests++;throw new Error('offline');}
});
(async()=>{
 const good = {text:'previous good page'}; saved.set(root,good);
 const waits=[]; let answer;
 handlers.fetch({request:{method:'GET',url:root,mode:'navigate'},waitUntil:p=>waits.push(p),respondWith:p=>answer=p});
 assert.equal(await answer,good); await Promise.all(waits);
 assert.equal(saved.get(root),good);
 for(const url of [root+'data/catalogue.json','https://raw.githubusercontent.com/test/version.json']){
  handlers.fetch({request:{method:'GET',url,mode:'cors'},respondWith:()=>assert.fail('Live data must bypass shell cache')});
 }
 saved.set(root+'static/image.hash.jpg',good);
 handlers.fetch({request:{method:'GET',url:root+'static/image.hash.jpg'},waitUntil:p=>waits.push(p),respondWith:p=>answer=p});
 assert.equal(await answer,good); await Promise.all(waits); assert.equal(requests,1);
 console.log('Offline navigation, live data bypass and immutable cache tests passed');
})().catch(error=>{console.error(error);process.exitCode=1;});
