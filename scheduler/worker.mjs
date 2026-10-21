const REPO = 'lcxFZAC/JGD-Ranking';
export function windowStart(now) {
  const offset=8*3600000, period=3*3600000;
  return Math.floor((now+offset)/period)*period-offset;
}
export async function tick(env, now=Date.now(), request=fetch) {
  if (!env.GITHUB_ACTIONS_TOKEN) throw new Error('Missing GITHUB_ACTIONS_TOKEN');
  const headers={Authorization:`Bearer ${env.GITHUB_ACTIONS_TOKEN}`,Accept:'application/vnd.github+json','User-Agent':'JGD-Ranking-Scheduler'};
  async function api(path,options={}) {
    const response=await request(`https://api.github.com/repos/${REPO}${path}`,{...options,headers:{...headers,...options.headers},signal:AbortSignal.timeout(20000)});
    if (!response.ok) throw new Error(`GitHub HTTP ${response.status}`);
    return response.status===204 ? null : response.json();
  }
  const response=await request(`https://raw.githubusercontent.com/${REPO}/main/data/version.json?t=${Math.floor(now/60000)}`,{signal:AbortSignal.timeout(20000)});
  if (!response.ok) throw new Error(`Snapshot HTTP ${response.status}`);
  const manifest=await response.json(), ended=Date.parse(manifest.version), started=Date.parse(manifest.startedAt);
  if (manifest.eventId!==28 || !Number.isFinite(ended) || ended>now) throw new Error('Invalid snapshot');
  if (Number.isFinite(started) && started>=windowStart(now) && started<=ended) return 'already-current';
  const runs=await api('/actions/workflows/update.yml/runs?per_page=30');
  if (runs.workflow_runs.some(r=>r.event!=='push' && r.status!=='completed')) return 'already-running';
  if (runs.workflow_runs.some(r=>r.event==='workflow_dispatch' && now-Date.parse(r.created_at)<5*60000)) return 'recent-dispatch';
  await api('/actions/workflows/update.yml/dispatches',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ref:'main',inputs:{refresh_data:true,only_if_due:true,full_discovery:false}})});
  return 'dispatched';
}
export default {
  async scheduled(event,env) { console.log(await tick(env,event.scheduledTime)); },
  fetch() { return new Response('Not found',{status:404}); }
};
