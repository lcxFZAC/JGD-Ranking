const assert = require('node:assert/strict');
const alert = require('../scripts/alert.cjs');
(async () => {
  const items = []; let created=0, comments=0;
  const api = {
    listForRepo:()=>{},
    create:async p=>{items.push({...p,number:1,state:'open'});created++;},
    update:async p=>Object.assign(items.find(i=>i.number===p.issue_number),p),
    createComment:async()=>{comments++;}
  };
  const ctx={github:{rest:{issues:api},paginate:async()=>items.filter(i=>i.state==='open')},context:{repo:{owner:'owner',repo:'test'},serverUrl:'https://github.com',runId:1},core:{warning:()=>{}}};
  await alert(ctx,'test','failed');
  assert.equal(created,1); assert.ok(items[0].body.includes('@owner'));
  await alert(ctx,'test','failed again');
  assert.equal(created,1); assert.ok(items[0].body.includes('failed again'));
  await alert(ctx,'test',null);
  assert.equal(items[0].state,'closed'); assert.equal(comments,1);
  await alert(ctx,'test',null); assert.equal(comments,1);
  console.log('Alert create / deduplicate / recover tests passed');
})().catch(error=>{console.error(error);process.exitCode=1;});
