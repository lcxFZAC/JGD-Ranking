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

GitHub Actions → Update Spotlight dashboard 每 3 小时更新一次。北京时间计划为 02:05、05:05、08:05、11:05、14:05、17:05、20:05、23:05，GitHub 可能延迟执行。08:05 额外补查目录。抓取成功后提交 data/*.json，Cloudflare 监听该提交并发布。普通代码提交也会触发部署。

免费版当前每月 500 次构建；每天 8 次，31 天约 248 次，给手动更新和开发留出空间。同账号其他项目也要考虑额度。半小时一次发布会达到每月约 1440 次，因此本项目改为每 3 小时。

手动更新：Actions → Update Spotlight dashboard → Run workflow → 勾选 refresh_data。要补查名单再勾选 full_discovery。两个选项均关闭时仅校验，不产生数据提交。

工作流使用内置 GITHUB_TOKEN，不需要个人 Token。GitHub 工作流已移除 GitHub Pages 发布任务。

## 四、验证整条链路

1. 免费网址打开正常，搜索筛选和造物锅广告跳转正常。
2. 手动运行 refresh_data，等待成功。
3. main 出现 chore(data): refresh Spotlight snapshot 提交。
4. Cloudflare Deployments 出现对应提交的生产部署且成功。
5. 刷新网页，统计时间更新。

只有完成这些检查，才算验证自动更新成功。

## 五、故障处理

- 看不到仓库：检查 Cloudflare GitHub App 的仓库授权。
- 构建失败：检查 Node 22、构建命令和 dist；本地 npm run build 验证。
- 数据提交 403：检查 Actions 写入权限、组织策略和 main 分支保护。不要扩大其他仓库权限。
- TapTap 抓取失败：保留旧数据，检查日志；GitHub 节点可能被限流，可重试或调整抓取环境。不将错误填成零。
- 新提交未部署：检查 main 自动部署开关、Git 集成和构建额度。
- 网页数据旧：确认成功部署的提交，再硬刷新并核对统计时间。
- 定时更新暂停：检查 Actions 是否启用，公共仓库长期不活跃时计划任务可能暂停。
- 旧 GitHub Pages 工作流报错：看最新提交的运行记录，新版本已删除该发布步骤。不再使用旧站时可到 GitHub Settings → Pages 取消发布。

## 本地运行

需要 Node.js 20+，抓取/测试还需 Python 3.10+。

```sh
git clone https://github.com/lcxFZAC/JGD-Ranking.git
cd JGD-Ranking
npm run build
npm run dev
```

访问 http://127.0.0.1:4173 。无第三方运行依赖。

官方文档：[Git 集成](https://developers.cloudflare.com/pages/get-started/git-integration/)、[免费额度](https://developers.cloudflare.com/pages/platform/limits/)。
