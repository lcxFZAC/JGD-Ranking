# 可复制给 AI 的部署提示词

复制下面的内容，把域名和接入状态填好：

```text
请帮我将聚光灯看板部署为 GitHub Pages + Cloudflare 自定义域名代理。

仓库：https://github.com/lcxFZAC/JGD-Ranking
生产分支：main
我的域名：【填写，例如 jgd.example.com】
域名是否已接入 Cloudflare：【是 / 否】

请先阅读仓库 DEPLOY.md、README.md 和 .github/workflows/update.yml。
这是纯静态网站，node scripts/build.js 生成 dist/，没有 npm 依赖安装步骤。
Python 仅负责抓取数据，GitHub Actions 每半小时更新指标，每天北京时间 08:05 补查目录。
部署目标是 GitHub Pages 托管、Cloudflare DNS 和代理，不创建 Cloudflare Pages 项目，不租服务器。

请引导我逐步完成：
1. 确认 main 的代码已在远程，GitHub Pages Source 选择 GitHub Actions。
2. 首次 Run workflow 不勾选 refresh_data/full_discovery，发布现有快照；验证部署任务成功和默认网址。
3. 验证我自己的域名，绑定仓库 Custom domain；Cloudflare 子域 CNAME 指向 lcxfzac.github.io，不含仓库路径，先灰云。
4. 等 GitHub 证书有效，启用 Enforce HTTPS 并验证自定义域名。
5. 使用 Cloudflare Full (strict)，开启该记录橙云；缓存规则仅匹配看板主机名并绕过缓存，避免旧快照。
6. 验证首页、统计时间、搜索筛选、图标、造物锅广告跳转与 HTTPS；报告实际访问地址和部署状态。

若需要登录，请打开 GitHub/Cloudflare 官方登录页面让我自行完成，然后继续。不要求我把密码、验证码或 Token 发到聊天里。域名缺失时先完成默认网址部署再问我。不要修改其他网站或邮箱 DNS，不凭空填写域名，也不要把未验证的上线结果说成成功。抓取失败保留现有数据，不伪造统计。
```
