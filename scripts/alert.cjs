// One issue per incident type; notify once, keep subsequent details in its body.
module.exports = async ({github, context, core}, key, problem) => {
  const {owner, repo} = context.repo;
  const marker = `<!-- spotlight-health:${key} -->`;
  const issues = await github.paginate(github.rest.issues.listForRepo, {owner, repo, state:'open', per_page:100});
  const existing = issues.find(i => !i.pull_request && i.body?.includes(marker));
  if (problem) {
    const body = `${marker}\n@${owner} 聚光灯看板需要检查。\n\n${problem}\n\n[查看本次运行](${context.serverUrl}/${owner}/${repo}/actions/runs/${context.runId})\n\n同一故障只保留一个告警；恢复后自动关闭。邮件/推送由个人 GitHub Notifications 设置决定。`;
    if (existing) await github.rest.issues.update({owner,repo,issue_number:existing.number,body});
    else {
      const created = await github.rest.issues.create({owner,repo,title:`[看板告警] ${key}`,body,assignees:[owner]});
      core.warning(problem);
      return created.data.number;
    }
    core.warning(problem);
    return existing.number;
  } else if (existing) {
    await github.rest.issues.createComment({owner,repo,issue_number:existing.number,body:'已恢复：本次检查通过，自动关闭告警。'});
    await github.rest.issues.update({owner,repo,issue_number:existing.number,state:'closed'});
  }
};
