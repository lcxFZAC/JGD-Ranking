# Cloudflare Pages 免费域名部署

代码：https://github.com/lcxFZAC/JGD-Ranking 。GitHub Actions 更新数据并提交 main，Cloudflare Git 集成自动构建发布，提供免费 HTTPS pages.dev 地址。不需要服务器、自有域名或 Cloudflare API Token。

## 一、登录并连接仓库

1. 打开 https://dash.cloudflare.com/ ，自行完成登录或注册。
2. Workers & Pages → Create application → Pages → Connect to Git（界面也可能叫 Import an existing Git repository）。选择 Pages，不是 Workers。
3. 连接 GitHub，授权选择 Only select repositories，仅选择 lcxFZAC/JGD-Ranking。登录和授权由账号主人完成，不要在聊天中发送密码、验证码或 Token。
4. 选择 JGD-Ranking → Begin setup。

## 二、构建设置

| 配置 | 值 |
| --- | --- |
| Project name | jgd-ranking，若被占用则选其他名字 |
| Production branch | main |
| Framework preset | None |
| Build command | node scripts/build.js |
| Build output directory | dist |
| Root directory | 留空 |
| 环境变量 | NODE_VERSION = 22 |

点击 Save and Deploy。成功后使用 Cloudflare 实际给出的 https://项目名.pages.dev 地址，域名未分配前不能保证项目名可用。无需 DNS、CNAME 或自定义域名设置。若要求填写 Wrangler deploy command，返回选择 Pages 创建流程。

保留 main 自动生产部署；建议关闭其他分支的自动预览部署以节省额度。

## 三、自动更新

GitHub Actions 每小时整点抓取；对应 05 分在本周期没有成功快照时重试。GitHub 调度可能延迟。目录补查在数据发布后分批继续，不阻塞已发布的数据。

数据和目录提交使用 `[CF-Pages-Skip]` 前缀，Cloudflare 跳过部署。页面从 `https://raw.githubusercontent.com/lcxFZAC/JGD-Ranking/main/data/` 先读取 version.json，再按需读取 catalogue.json 与 history.json；不再将站点 `/data/latest.json` 当作实时数据源。站点内置数据是代码部署时的兜底快照，保持旧时间是正常现象。数据源无法读取时保留已有快照，并在状态提示中说明检查失败。

定时数据更新不消耗 Pages 构建额度，只在网站代码更新时构建网站。Cloudflare 免费 Worker 只做独立半点兜底检查，使用单独的最小权限 GitHub Token。GitHub Raw 有缓存与可用性限制，不承诺准点可见；定期健康检查分别检查网站可访问及 Raw 数据新鲜度。

手动更新：Actions → Update Spotlight dashboard → Run workflow → 勾选 refresh_data。要补查名单再勾选 full_discovery。两个选项均关闭时仅校验，不产生数据提交。

工作流使用内置 GITHUB_TOKEN，不需要个人 Token。GitHub 工作流已移除 GitHub Pages 发布任务。

## 四、验证整条链路

1. 免费网址打开正常，搜索筛选和造物锅广告跳转正常。
2. 手动运行 refresh_data，等待成功。
3. main 出现 chore(data): refresh Spotlight snapshot 提交。
4. 数据提交带 `[CF-Pages-Skip]`，不产生新的 Cloudflare 部署。
5. 刷新网页，统计时间更新。

只有完成这些检查，才算验证自动更新成功。

## 五、故障处理

- 看不到仓库：检查 Cloudflare GitHub App 的仓库授权。
- 构建失败：检查 Node 22、构建命令和 dist；本地 npm run build 验证。
- 数据提交 403：检查 Actions 写入权限、组织策略和 main 分支保护。不要扩大其他仓库权限。
- TapTap 抓取失败：保留旧数据，检查日志；GitHub 节点可能被限流，可重试或调整抓取环境。不将错误填成零。
- 代码提交未部署：检查 main 自动部署开关、Git 集成和构建额度；数据提交跳过部署是预期行为。
- 网页数据旧：核对 GitHub Raw 数据时间、网络可达性及页面状态提示。
- 定时更新暂停：检查 Actions 是否启用，公共仓库长期不活跃时计划任务可能暂停。
- 旧 GitHub Pages 工作流报错：看最新提交的运行记录，新版本已删除该发布步骤。不再使用旧站时可到 GitHub Settings → Pages 取消发布。

## 长期运行保护

- 每次成功抓取会清理超过 90 天的历史；最近 7 天保留全部快照，第 8–90 天每天保留最后一次。Git 旧提交仍保留，当前历史文件清理不会压缩 Git 仓库历史。
- 请求作品或上一期作品缺失超过 5%，以及同批作品总热度/关注数下降超过 20%，会阻止写入和发布。正常下架或统计口径变更也可能触发，需要人工核查，不自动放行。
- 抓取前写入检查与构建检查均设 20 MiB 数据包上限，超限停止发布并告警，保留线上旧版本；不会静默删掉 90 天以内的数据。
- 每日目录补查独立处理失败，30 分钟超时；失败继续按已保存名单抓取指标，并发出单独告警。
- 更新任务失败时，在本仓库创建并分配给仓库主人的 GitHub Issue，同时 @ 提及。重复失败更新同一个 Issue，成功恢复后评论并关闭。目录告警仅在下一次目录补查成功时关闭。
- 独立工作流 Watch Spotlight freshness 每小时第 32、57 分钟检查线上 JSON；超过 1.5 小时、HTTP 失败或无效快照会告警。GitHub 调度延迟也会影响检测时效；如果 GitHub Actions 整体停止，该平台内的监控也无法运行，不能保证永不中断。
- 通知接收：GitHub Settings → Notifications 启用参与/提及通知的 Email 或 Web；确认邮箱已验证。仓库 Issue 的分配/提及会走你的个人设置，代码无法保证邮件一定送达。Actions 失败邮件也可在个人通知设置开启。
- 可手动运行 Watch Spotlight freshness 并勾选 test_notification，发送明确标记的测试告警后自动关闭，验证 GitHub 通知通道。
- 诊断入口：仓库 Issues 看当前告警，Actions 看失败日志；不要把公开告警中贴入 Cookie、Token 等敏感信息。

## 本地运行命令

需要 Node.js 20+，抓取/测试还需 Python 3.10+。

```sh
git clone https://github.com/lcxFZAC/JGD-Ranking.git
cd JGD-Ranking
npm run build
npm run dev
```

访问 http://127.0.0.1:4173 。无第三方运行依赖。

官方文档：[Git 集成](https://developers.cloudflare.com/pages/get-started/git-integration/)、[免费额度](https://developers.cloudflare.com/pages/platform/limits/)。


### 定时采集补偿机制

GitHub 每小时 17、47 分尝试检查，同一北京时间一小时窗口有成功快照则跳过采集。独立健康检查在每小时 32、57 分运行；数据超过 1.5 小时时，通过 workflow_dispatch 自动补触发采集。有采集排队或运行则不重复触发，补触发间隔至少 30 分钟。过期告警保留到确认数据恢复。GitHub 调度可能延迟或丢弃，无法保证准点，也无法在 GitHub 整体不可用时自救。

Cloudflare Worker `jgd-ranking-scheduler` 在北京时间每小时 30 分检查本轮快照。只有本轮未更新、且没有进行中的采集时才触发 GitHub Actions；队列开始执行后还会再次检查，避免重复抓取。每天 24 次调度，不使用 KV、数据库或网站部署；公网与预览 URL 均关闭。两套触发器仍依赖 GitHub 执行及 TapTap 数据源，不能保证平台故障时也能更新。

Worker 的加密 Secret `GITHUB_ACTIONS_TOKEN` 使用仅授权 JGD-Ranking 的 Fine-grained Token，权限仅 Actions: read/write 和必需的 Metadata: read。Token 到期前需要在 Cloudflare 中替换；不要保存到仓库或聊天。Cloudflare Observability 可查看 `already-current`、`already-running`、`recent-dispatch` 或 `dispatched` 结果及异常。

Worker 源码或 Cron 修改时运行 `npx wrangler deploy --config scheduler/wrangler.json --keep-vars`；这只部署调度器，不部署 Pages 网站。数据更新不运行此命令。
