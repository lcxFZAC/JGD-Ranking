# 聚光灯 · 2026 GameJam 数据看板

2026 TapTap 聚光灯「21 天游戏创作挑战」公开作品看板，主题为「涌现」。原始样式来自 [金海豚看板](https://github.com/lcxFZAC/jinhaitun-ranking)，参考版本 `e9671d03204fa09e2712a9cb8c947096286133e8`。推荐位链接到 [造物锅](https://www.taptap.cn/app/961322?os=android)。

## 本地运行

需要 Node.js 20+、Python 3.10+。无第三方运行依赖。

```sh
npm run build
npm run dev
```

访问 `http://127.0.0.1:4173`，或直接打开构建后的 `dist/index.html`。快照数据已打包，直接打开文件也可使用搜索、筛选、分页、主题切换和走势功能。游戏图片和 TapTap 跳转需要网络。

## 数据更新

```sh
# 更新已核实作品，并从赛事列表发现新增作品
npm run update

# 全量核对其他公开目录，补齐赛事列表展示上限之外的作品
npm run discover
npm run update

# 检查统计计算
npm test
```

全部请求只访问 TapTap 公开只读接口，不需要账户或 Cookie。作品名单与[官方活动页面](https://www.taptap.cn/poster/NIKiDS1YShdA)一致：完整分页读取 `activity/game-jam/v2/search-participants?id=3&category=0&view=all`。活动报名 ID `3` 与赛事详情 ID `28` 属于不同接口，不能混用。旧赛事列表每种排序最多 500 款，详情缺少赛事徽标也不能证明作品未报名。

采集逐页校验官方总数、重复 ID、提前截断与作品类型；名单或指标失败时保留旧快照。`data/participants.json` 保留本次官方名单及时间；`coverage.officialTotal` 为官方报名总数，`summary.total` 为成功读取指标的作品数，无法读取的 ID 单独列出。只有在完整官方报名名单中消失的作品才从当前榜单移除；历史快照保留原始观察。

2026-10-25 完整对账：线上 11:33（北京时间）快照为 2,054 款，官方本次实抓 2,300 款，遗漏 246 款，其中 240 款从未在保存的历史中出现、6 款曾收录后遗漏。全部 2,300 款指标均成功读取。差异作品可查看 `reports/coverage-diff.html`，结构化明细为 `data/reconciliation.json`，原线上基线为 `data/audit/before-20261025.json`。用户观察的 2,299 与本次 2,300 来自不同时间，未保存 2,299 时点名单，不能指认其后具体新增的一款。

复现差异报告：

```sh
python scripts/reconcile.py --before data/audit/before-20261025.json --after data/latest.json --roster data/participants.json --history data/history.json
```

## 统计口径

- 游戏按 TapTap app ID 去重，以官方活动报名 ID `3` 的完整名单核实归属；不是笼统抓取所有年度的“聚光灯GameJam”标签。
- 热度使用批量作品详情的 `stat.hits_total`，关注数使用 `stat.fans_count`。赛事列表返回的占位零值不参与统计。
- TapTap 制造依据官方 `TapTap制造` 标签识别；其他作品归入“其他方式开发”，不推断实际引擎或 AI 使用情况。
- PC 与 Android/iOS 同时存在记为双端；仅移动和仅 PC 互斥，未标明单列。分类比例分母为已收录作品数。
- 中位数按全体已收录作品计算；热度破万为 `> 10000`；零热度要求详情明确返回 `0`。
- 走势仅使用真实抓取快照。排名同热度按游戏 ID 排序。最近七天保留全部快照，第 8–90 天按 UTC 日期保留每天最后一个真实快照，超过 90 天从当前历史文件移除；Git 提交中的旧版本不自动删除。
- 作品名单在增长时，历史排名的比较对象也会变化。抓取并非同一秒完成，页面说明中可查看时间范围。

## 文件

- `index.html`、`app.js`：页面结构与无框架交互。
- `styles.css`：保留金海豚仓库原有视觉基础；`spotlight.css`：聚光灯模块及移动端适配。
- `scripts/taptap.py`：公共 API 读取、超时、重试和分页域名验证。
- `scripts/discovery.py`：公开目录发现与赛事归属核验。
- `scripts/crawl.py`：获取指标、计算统计、保存快照。
- `data/registry.json`：已核实作品 ID；`data/latest.json`：最新指标及完整作品清单；`data/history.json`：历史快照。
- `scripts/build.js`：生成可直接打开的 `dist/` 和 `data/dashboard.js`。

## 部署到 Cloudflare Pages

使用免费的 pages.dev 域名，GitHub 保留源码和数据。构建命令 `node scripts/build.js`，输出目录 `dist`，Node 22。

详细操作见 [部署流程](DEPLOY.md)，交接其他 AI 使用 [部署提示词](DEPLOY-AI-PROMPT.md)。GitHub Actions 每 3 小时整点计划抓取（北京时间 02、05、08、11、14、17、20、23 点），对应 05 分若本周期无成功快照则重试。数据与目录提交带 `[CF-Pages-Skip]`，不触发 Cloudflare Pages 构建；只有代码修改部署网站。在线页面通过 GitHub Raw 的 version.json 检查版本，按需读取 catalogue.json 与 history.json，五分钟检查一次；构建内置快照仅供首次展示、离线或网络故障时兜底。GitHub 调度及 Raw 缓存可能延迟。每天北京时间 08 点任务发布数据后补查目录。定时数据更新消耗 0 次 Pages 构建，其他代码部署仍受账户额度限制。

GitHub 工作流不再部署 GitHub Pages。Cloudflare 账号连接和首次建站需按文档完成，并验证数据提交能触发部署后，才能确认自动更新链路正常。

## 加载与缓存

首屏仅加载统计和热度前 30 款作品（`bootstrap.js`），完整榜单在首屏显示后加载。更新先读取 `version.json`，版本未变时不再下载榜单；完整榜单缓存于本地，回访优先展示。搜索、筛选、导出在完整榜单可用后开放，避免只对前 30 款执行操作。

历史数据与最新榜单独立：进入走势区域才请求历史并创建作品选择项；历史失败不会阻塞榜单更新。GitHub CDN 版本不一致时保留上次成功数据并重试。浏览器禁用存储或缓存损坏不影响正常加载。直接打开本地文件时，首屏之后再加载完整离线包。

构建生成 `data/catalogue.json` 和 `data/version.json`，抓取工作流将它们与最新/历史快照一并提交，并继续使用 `[CF-Pages-Skip]`；采集与重试时间保持不变。
