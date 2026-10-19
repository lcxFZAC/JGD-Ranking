# GitHub Pages + Cloudflare 部署流程

仓库：https://github.com/lcxFZAC/JGD-Ranking

架构：访客 → Cloudflare（自定义域名、HTTPS、代理）→ GitHub Pages（静态文件）。GitHub Actions 定时抓取 TapTap 并构建发布，不需要租服务器或启动常驻 Python/Node 服务，也不需要建立 Cloudflare Pages 项目。

## 1. 开通 GitHub Pages

1. 登录 GitHub，打开仓库的 **Settings → Pages**：https://github.com/lcxFZAC/JGD-Ranking/settings/pages 。
2. **Build and deployment → Source** 选择 **GitHub Actions**。
3. 打开 **Actions → Update Spotlight dashboard → Run workflow**，选择 `main`，首次保持 `refresh_data` 和 `full_discovery` 都不勾选，点击运行。这样直接发布已有真实快照，首次部署不依赖 TapTap 可用性。
4. 等 `update`、`deploy` 两个任务均成功。默认地址是 https://lcxFZAC.github.io/JGD-Ranking/ ，以部署任务显示的 URL 为准。
5. 检查看板、游戏图标、筛选和广告链接。未成功前暂不配置 Cloudflare 代理。

若 Settings 中无法选择 Pages，检查当前账号是否有仓库管理员权限以及仓库可见性/套餐是否支持 Pages。若第一次推送触发部署但提示 Pages 未配置，完成步骤 2 后重新手动运行即可。

## 2. 准备域名

建议使用独立子域名，例如 `jgd.example.com`，下文是示例，必须替换成你自己的域名。

域名需要已加入 Cloudflare，注册商的 Nameservers 使用 Cloudflare 为该域名分配的值，并且 Cloudflare 状态为 Active。已有网站、邮箱的 DNS 记录需要保留。没有域名时，可以先使用默认 github.io 地址；你无法给不属于自己的 github.io 域名开启 Cloudflare 代理。

推荐先在 GitHub 账号 Settings → Pages 验证自有域名，按照 GitHub 显示的 TXT 名称和值添加 DNS。域名所有权验证和仓库绑定是两个步骤。

## 3. 绑定域名并签发 HTTPS

1. 仓库 **Settings → Pages → Custom domain** 填 `jgd.example.com` 并保存，不要带协议或路径。
2. Cloudflare 对应域名 → **DNS → Records → Add record**：

| 字段 | 值 |
| --- | --- |
| Type | CNAME |
| Name | jgd |
| Target | lcxfzac.github.io |
| Proxy status | DNS only，先使用灰云 |
| TTL | Auto |

目标只有主机名，**不带 `/JGD-Ranking/`**。这份流程使用子域名；如果要用根域名，按 GitHub 官方文档另行设置根域记录。

3. 等 GitHub DNS 检查通过、HTTPS 证书就绪，再勾选 **Enforce HTTPS**。DNS 生效及证书签发可能需要等待，不要反复切换设置。
4. 确认 `https://jgd.example.com/` 能直接访问。绑定自定义域名后站点位于根路径，不需要再加仓库名。项目资源使用相对路径，两种地址都支持。

本项目通过 Actions 上传构建产物；自定义域名配置保存在 GitHub Pages 设置，不需要手工往仓库写 CNAME 文件。

## 4. 开启 Cloudflare 代理

1. Cloudflare → **SSL/TLS → Overview**：使用 **Full (strict)**，要求 GitHub 源站证书已有效。若同一域名区域有其他源站，先确认其证书也满足要求，或对本看板主机名单独配置适用规则。
2. 把第 3 节的 CNAME 从灰云改为 **Proxied（橙云）**。
3. 浏览器打开自定义域名，检查 HTTPS 与页面数据。不要使用 Flexible，避免与源站强制 HTTPS 产生重定向循环。
4. **Caching → Cache Rules** 为看板主机名添加规则，例如 `http.host eq "jgd.example.com"`，Cache eligibility 设为 **Bypass cache**。本看板文件小、数据更新频繁，先确保更新及时；不要设置 Cache Everything。浏览器缓存 TTL 保持 Respect Existing Headers，不要强制长缓存。修改前确认只匹配看板域名。

Cloudflare 代理不会消除 GitHub Pages 本身的服务限制。若后续出现证书续签/DNS 检查问题，可临时切回灰云确认 GitHub 证书状态，再恢复代理。

## 5. 日常更新与故障处理

- 推送 `main`：直接构建并发布仓库内快照。
- 每小时第 5、35 分钟：抓取指标、校验、提交 JSON、部署。计划按 UTC 解释，分钟与北京时间相同，实际运行可能延迟。
- 每天北京时间 08:05：额外补查公开目录，耗时更长。
- 手动更新：Run workflow 勾选 `refresh_data`；补查全量目录时勾选 `full_discovery`（同时会更新指标）。
- 更新失败：看 Actions 的失败步骤；线上保留上次成功版本。不要把 API 错误改成零值。GitHub 执行节点可能被 TapTap 限流，先重试/降低频率；需要时再安排国内运行环境抓取。
- 提交数据提示 403：检查 Actions 权限、组织策略及 main 分支保护；本工作流需要写入数据文件。不要随意取消整个仓库的保护，可调整为符合仓库策略的数据更新流程。
- 404：检查 Pages Source、deploy 是否成功、Custom domain 是否与 DNS 主机一致。
- 526：源站证书未就绪或失效。先灰云修复 GitHub HTTPS，再恢复 Full (strict)。
- 页面数据旧：检查页面统计时间及 Actions 最近成功记录，再检查 Cloudflare 缓存；已有长缓存可以仅清除此看板 URL 的缓存。
- 公共仓库长期没有活动时计划工作流可能暂停；在 Actions 中检查并恢复。

## 本地启动 / 回退

需要 Node.js 20+ 与 Python 3.10+，无第三方包依赖。

```sh
git clone https://github.com/lcxFZAC/JGD-Ranking.git
cd JGD-Ranking
npm run build
npm run dev
```

打开 http://127.0.0.1:4173 。构建结果在 `dist/`，也可直接打开 `dist/index.html`。恢复历史站点可将需要恢复的代码/快照提交到 main，再运行部署；不要强制推送覆盖历史。

## 官方参考

- [GitHub 自定义域名](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site)
- [Cloudflare Full (strict)](https://developers.cloudflare.com/ssl/origin-configuration/ssl-modes/full-strict/)
