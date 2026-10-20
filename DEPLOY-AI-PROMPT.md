# 给 AI 的部署提示词

复制下面内容：

```text
请带我把 https://github.com/lcxFZAC/JGD-Ranking 部署到 Cloudflare Pages，使用免费的 pages.dev 域名。代码和数据保留在 GitHub main。
先阅读 DEPLOY.md、README.md 和 .github/workflows/update.yml。
创建 Pages 的 Git 集成项目，仅授权 JGD-Ranking 仓库。框架 None，构建命令 node scripts/build.js，输出 dist，根目录留空，NODE_VERSION=22。项目名优先 jgd-ranking，不可用再让我选。
保留 main 代码自动部署。GitHub Actions 每 3 小时抓取，失败后对应 05 分重试。数据与目录提交使用 [CF-Pages-Skip]，不得触发 Pages 构建。在线页面读取 GitHub Raw JSON，站点内置快照只作兜底。验证数据提交后页面自动读取新数据，且 Cloudflare 没有产生对应数据提交的部署。
登录和授权时打开官方页面让我完成，不要求我在聊天发送密码、验证码或 Token。无需租服务器、自定义域名或 Cloudflare API Token。
部署后验证网址、搜索筛选和广告链接；手动运行 refresh_data，核对 GitHub 数据提交、数据提交跳过部署以及网页统计时间，验证自动更新整条链路。抓取失败保留旧数据，没有实际成功证据不要宣称已上线。
```
