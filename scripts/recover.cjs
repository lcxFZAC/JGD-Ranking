// Recover missed schedules without queuing duplicate data writers.
module.exports = async ({github, context}) => {
  const args = {...context.repo, workflow_id:'update.yml'};
  const {data} = await github.rest.actions.listWorkflowRuns({...args, per_page:100});
  const active = data.workflow_runs.find(run => run.event !== 'push' && run.status !== 'completed');
  if (active) return `采集已在排队或运行：${active.html_url}`;
  const recent = data.workflow_runs.find(run => run.event === 'workflow_dispatch' &&
    Date.now() - Date.parse(run.created_at) < 30 * 60000);
  if (recent) return '最近 30 分钟已补触发，等待下次健康检查后再重试';
  const {data: repo} = await github.rest.repos.get(context.repo);
  await github.rest.actions.createWorkflowDispatch({...args, ref:repo.default_branch,
    inputs:{refresh_data:'true',full_discovery:'false'}});
  return '已自动补触发采集；快照发布后下次健康检查确认恢复';
};
