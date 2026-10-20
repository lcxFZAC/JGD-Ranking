const assert = require('node:assert/strict');
const recover = require('../scripts/recover.cjs');
(async () => {
  let runs = [], dispatches = [];
  const github = {rest:{
    actions:{
      listWorkflowRuns:async()=>({data:{workflow_runs:runs}}),
      createWorkflowDispatch:async args=>dispatches.push(args)
    },
    repos:{get:async()=>({data:{default_branch:'main'}})}
  }};
  const context = {repo:{owner:'test',repo:'test'}};
  await recover({github,context});
  assert.equal(dispatches.length,1);
  assert.equal(dispatches[0].inputs.refresh_data,'true');
  runs=[{event:'schedule',status:'in_progress',html_url:'run'}];
  await recover({github,context});
  assert.equal(dispatches.length,1);
  runs=[{event:'workflow_dispatch',status:'completed',created_at:new Date().toISOString()}];
  await recover({github,context});
  assert.equal(dispatches.length,1);
  runs=[{event:'push',status:'in_progress'}];
  await recover({github,context});
  assert.equal(dispatches.length,2);
  console.log('Recovery dispatch, active-run guard and cooldown tests passed');
})().catch(error=>{console.error(error);process.exitCode=1;});
