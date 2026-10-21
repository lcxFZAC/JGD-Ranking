/* UI for verified TapTap snapshots. Data is never interpolated as HTML. */
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const number = (n) => Number(n).toLocaleString('zh-CN');
  const short = (n) => n >= 10000 ? `${(n / 10000).toFixed(1)}万` : number(n);
  const when = (value) => new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(value)).replaceAll('/', '-');
  const labels = { dual: 'PC + 移动', mobile: '仅移动端', pc: '仅 PC', unknown: '未标明' };
  const state = { data: null, history: [], trendsVisible: false, historyVersion: null, page: 1, size: 30, range: '24h', selected: '961322' };
  const node = (tag, className, text) => {
    const result = document.createElement(tag);
    if (className) result.className = className;
    if (text !== undefined) result.textContent = text;
    return result;
  };
  function gameLink(game, developer = false) {
    const link = node('a', 'game-link');
    link.href = `https://www.taptap.cn/app/${encodeURIComponent(game.id)}`;
    link.target = '_blank'; link.rel = 'noopener noreferrer';
    const icon = node('img', 'game-icon');
    if (String(game.id) === '961322') icon.src = './assets/zaowuguo-icon.jpg';
    else if (/^https:\/\/(?:[\w-]+\.)*tapimg\.com\//.test(game.icon)) icon.src = game.icon;
    icon.alt = ''; icon.loading = 'lazy'; icon.decoding = 'async'; icon.fetchPriority = 'low'; icon.width = 34; icon.height = 34; icon.referrerPolicy = 'no-referrer';
    icon.addEventListener('error', () => { icon.removeAttribute('src'); icon.alt = '✦'; }, { once: true });
    const text = node('span'); text.style.minWidth = '0';
    const name = node('span', 'game-name', game.name); name.title = game.name;
    text.append(name);
    if (developer) text.append(node('span', 'developer-name', game.developer || '独立开发者'));
    link.append(icon, text);
    return link;
  }
  let lastRandomId = null;
  function randomGame() {
    if (!state.data || state.data.partial || !state.data.games.length) return;
    const games = state.data.games;
    const choices = games.length > 1 ? games.filter(game => game.id !== lastRandomId) : games;
    const game = choices[Math.floor(Math.random() * choices.length)];
    lastRandomId = game.id;
    const card = $('randomGameCard');
    card.dataset.gameId = game.id;
    const heading = gameLink(game, true);
    const icon = heading.querySelector('img');
    icon.loading = 'eager'; icon.width = 104; icon.height = 104;
    const tags = node('div', 'random-tags');
    tags.append(node('span', '', labels[game.platform] || '未标明平台'), node('span', '', game.method === 'maker' ? 'TapTap 制造' : '其他方式开发'));
    const stats = node('div', 'random-stats');
    stats.append(node('div', '', `热度 ${number(game.heat)}`), node('div', '', `关注 ${number(game.followers)}`));
    const play = node('a', 'random-play', '在 TapTap 查看 ↗');
    play.href = `https://www.taptap.cn/app/${encodeURIComponent(game.id)}`;
    play.target = '_blank'; play.rel = 'noopener noreferrer';
    card.replaceChildren(heading, tags, stats, play);
    $('nextRandomGame').disabled = games.length < 2;
  }
  $('randomGameButton').addEventListener('click', () => { randomGame(); $('randomGameDialog').showModal(); });
  $('nextRandomGame').addEventListener('click', randomGame);
  $('closeRandomGame').addEventListener('click', () => $('randomGameDialog').close());
  $('randomGameDialog').addEventListener('click', event => {
    if (event.target !== event.currentTarget) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) event.currentTarget.close();
  });
  function hourlyRecommendations() {
    if (!$('dailyDate') || !$('dailyGames')) return;
    const hour = new Date(Date.now() + 8 * 3600000).toISOString().slice(0,13);
    if ($('dailyDate').dataset.hour === hour) return;
    const snapshots = [...state.history].sort((a,b)=>a.ts.localeCompare(b.ts));
    const hourStart = Date.parse(hour + ':00:00+08:00');
    const baseline = snapshots.filter(s => Date.parse(s.ts) <= hourStart).at(-1) || snapshots[0];
    const ids = baseline ? new Set(Object.keys(baseline.games)) : null;
    function hash(value) { let n=2166136261; for(const c of value) n=Math.imul(n^c.charCodeAt(0),16777619); n^=n>>>16; n=Math.imul(n,0x85ebca6b); n^=n>>>13; return n>>>0; }
    const picks = state.data.games.filter(g=>g.id!=='961322' && (!ids || ids.has(g.id)))
      .map(g=>({g,key:hash(hour+':'+g.id)})).sort((a,b)=>a.key-b.key || a.g.id.localeCompare(b.g.id)).slice(0,3);
    $('dailyGames').replaceChildren();
    picks.forEach(({g},i)=>{
      const card=node('article','card daily-card');
      card.append(node('span','daily-number',`0${i+1} / 本小时发现`),gameLink(g,true));
      card.append(node('p','muted small',`${labels[g.platform]} · ${g.method==='maker'?'TapTap 制造':'其他方式开发'}`));
      const footer=node('div','daily-footer');
      footer.append(node('span','small',`热度 ${short(g.heat)} · 关注 ${short(g.followers)}`));
      const link=node('a','daily-cta','去发现 ↗'); link.href=g.url; link.target='_blank'; link.rel='noopener noreferrer';
      footer.append(link);card.append(footer);$('dailyGames').append(card);
    });
    $('dailyDate').textContent=hour.replace('T',' ') + ':00 · 每小时三款'; $('dailyDate').dataset.hour=hour;
  }
  const adIcon = $('adIcon');
  const fallbackIcon = () => { adIcon.src = './assets/zaowuguo-cover.jpg'; };
  adIcon.addEventListener('error', fallbackIcon, { once: true });
  if (adIcon.complete && !adIcon.naturalWidth) fallbackIcon();
  $('adCover').addEventListener('error',()=>{
    $('adCover').hidden=true;
    $('adCover').parentElement.append(node('div','cover-fallback','✦ 造物锅 · 创造你的无限可能'));
  },{once:true});
  function kpi(label, value, className = '', caption = '') {
    const card = node('div', `kpi ${className}`);
    card.append(node('div', 'label', label), node('div', 'value', value));
    if (caption) card.append(node('div', 'kpi-caption', caption));
    return card;
  }
  function bar(id, legendId, items, total) {
    const container = $(id), legend = $(legendId);
    container.replaceChildren(); legend.replaceChildren();
    container.setAttribute('role', 'img');
    container.setAttribute('aria-label', items.map(([label, count]) => `${label} ${count} 款`).join('，'));
    items.forEach(([label, count, color]) => {
      const percent = total ? count / total * 100 : 0;
      const segment = node('span', 'stack-segment');
      segment.style.width = `${percent}%`; segment.style.background = color;
      segment.title = `${label}：${number(count)} 款（${percent.toFixed(1)}%）`;
      container.append(segment);
      const item = node('span');
      const dot = node('i', 'legend-dot'); dot.style.background = color;
      item.append(dot, document.createTextNode(`${label} `), node('strong', '', `${percent.toFixed(1)}%`));
      item.title = `${number(count)} 款`; legend.append(item);
    });
  }
  function overview() {
    const data = state.data, s = data.summary;
    $('workCount').textContent = number(s.total);
    $('snapshotTime').textContent = `统计时间 ${when(data.crawledAt)}（北京时间） · 点击作品图标跳转 TapTap`;
    updateFreshness();
    $('overviewKpis').replaceChildren(
      kpi('TapTap 制造', number(s.maker), 'mobile', '使用 TapTap 制造标签的作品'),
      kpi('其他方式开发', number(s.other), '', '其他已收录参赛作品'),
      kpi('PC + 移动双端', number(s.platforms.dual), 'pc', '支持 PC 及至少一种移动平台')
    );
    bar('developmentBar', 'developmentLegend', [['TapTap 制造', s.maker, '#ffe044'], ['其他', s.other, '#298565']], s.total);
    const platforms = [['双端', s.platforms.dual, 'var(--accent)'], ['移动', s.platforms.mobile, 'var(--pc)'], ['PC', s.platforms.pc, '#9b8af2']];
    if (s.platforms.unknown) platforms.push(['未标明', s.platforms.unknown, 'var(--muted)']);
    bar('platformBar', 'platformLegend', platforms, s.total);
    const heat50 = data.partial ? s.atLeast50 : data.games.filter(g => g.heat >= 50).length;
    $('heatKpis').replaceChildren(
      kpi('总热度', short(s.totalHeat), 'mobile'), kpi('热度中位数', number(s.medianHeat)),
      kpi('热度 ≥ 50 作品', heat50 == null ? '—' : number(heat50), 'heat-qualified'), kpi('热度破万', number(s.overTenThousand)), kpi('零热度作品', number(s.zeroHeat)), kpi('总关注数', short(s.totalFollowers), 'pc')
    );
    [...$('heatKpis').children].forEach((card, i) => card.title = number([s.totalHeat, s.medianHeat, heat50, s.overTenThousand, s.zeroHeat, s.totalFollowers][i]));
    if (data.coverage?.notice) {
      $('dataNotice').hidden = false;
      $('dataNotice').textContent = data.coverage.notice;
    }
    $('topTen').replaceChildren();
    data.games.slice(0, 10).forEach((game, i) => {
      const row = node('div', 'top-row');
      const track = node('div', 'rank-track'), fill = node('span', 'rank-fill');
      fill.style.width = `${data.games[0].heat ? game.heat / data.games[0].heat * 100 : 0}%`;
      track.append(fill); track.setAttribute('aria-hidden', 'true');
      const value = node('span', 'rank-value', short(game.heat)); value.title = `${number(game.heat)} 热度`;
      row.append(node('span', `rank-index ${i < 3 ? 'podium' : ''}`, String(i + 1).padStart(2, '0')), gameLink(game), track, value);
      $('topTen').append(row);
    });
  }
  function updateFreshness() {
    if (!state.data) return;
    const ts = state.data.crawledAt;
    const stale = Date.now() - Date.parse(ts) > 3.5 * 3600000;
    $('statusPill').textContent = `${stale ? '上次更新' : '数据更新'} · ${when(ts)} 北京时间`;
    $('statusPill').className = `status ${stale ? '' : 'ok'}`;
    $('statusPill').title = '点击刷新数据';
  }
  function filtered() {
    const query = $('searchInput').value.trim().toLocaleLowerCase();
    const method = $('methodSelect').value, platform = $('platformSelect').value;
    const games = state.data.games.filter(g => (!query || `${g.name} ${g.developer} ${g.id}`.toLocaleLowerCase().includes(query)) &&
      (method === 'all' || g.method === method) && (platform === 'all' || g.platform === platform));
    const [key, direction] = $('sortSelect').value.split('-');
    return games.sort((a, b) => (key === 'name' ? a.name.localeCompare(b.name, 'zh-CN') : a[key] - b[key]) * (direction === 'desc' ? -1 : 1) || a.rank - b.rank);
  }
  function renderTable() {
    if (!state.data) return;
    const games = filtered(), totalPages = Math.max(1, Math.ceil(games.length / state.size));
    state.page = Math.min(state.page, totalPages);
    $('resultCount').textContent = state.data.partial ? `共 ${number(state.data.summary.total)} 款 · 先显示热度前 30 款，完整榜单加载中…` : `共 ${number(state.data.games.length)} 款 · 当前筛选 ${number(games.length)} 款`;
    const body = $('totalBody'); body.replaceChildren();
    for (const game of games.slice((state.page - 1) * state.size, state.page * state.size)) {
      const row = node('tr', game.heat >= 50 ? 'heat-qualified-row' : '');
      row.append(node('td', 'rank-index', String(game.rank)));
      const title = node('td'); title.append(gameLink(game, true)); if (game.heat >= 50) title.append(node('span', 'heat-threshold-badge', '热度 ≥ 50')); row.append(title);
      const method = node('td'); method.append(node('span', `method-badge ${game.method}`, game.method === 'maker' ? 'TapTap 制造' : '其他方式')); row.append(method);
      row.append(node('td', 'platform-label', labels[game.platform]), node('td', 'num', number(game.heat)), node('td', 'num', number(game.followers)));
      const action = node('td'), button = node('button', 'btn-sm secondary', '看走势'); button.type = 'button';
      button.setAttribute('aria-label', `查看 ${game.name} 的走势`);
      button.addEventListener('click', () => { state.selected = game.id; activateTrends(); $('trends').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' }); });
      action.append(button); row.append(action); body.append(row);
    }
    if (!games.length) { const row = node('tr'), cell = node('td', 'empty-state', '没有找到匹配的作品，试试其他关键词或重置筛选。'); cell.colSpan = 7; row.append(cell); body.append(row); }
    $('pageInfo').textContent = `第 ${state.page} / ${totalPages} 页 · 每页 ${state.size} 款`;
    $('prevPage').disabled = state.page <= 1; $('nextPage').disabled = state.page >= totalPages;
  }
  function chart(id, points, field, reverse = false) {
    const container = $(id); container.replaceChildren();
    const valid = points.filter(p => p[field] !== null && p[field] !== undefined);
    if (valid.length < 2) {
      const message = node('div', 'chart-empty');
      if (valid.length) message.append(node('strong', '', `${reverse ? '#' : ''}${number(valid[0][field])}`));
      message.append(node('div', '', valid.length ? '已记录首个快照，累计两次抓取后显示走势。' : '所选时间范围内暂无该作品的快照。'));
      container.append(message); return;
    }
    const ns = 'http://www.w3.org/2000/svg', svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 560 210'); svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', `${reverse ? '排名' : '热度'}走势：${valid.map(p => `${when(p.ts)} ${p[field]}`).join('；')}`);
    const values = valid.map(p => p[field]);
    let min = Math.min(...values), max = Math.max(...values);
    if (min === max) { min = Math.max(0, min - 1); max += 1; }
    const first = Date.parse(points[0].ts), last = Date.parse(points.at(-1).ts);
    const x = p => 55 + (Date.parse(p.ts) - first) / Math.max(1, last - first) * 475;
    const y = p => reverse ? 20 + (p[field] - min) / (max - min) * 145 : 165 - (p[field] - min) / (max - min) * 145;
    function part(tag, attributes, text) { const el = document.createElementNS(ns, tag); Object.entries(attributes).forEach(([k,v]) => el.setAttribute(k, String(v))); if (text !== undefined) el.textContent = text; svg.append(el); return el; }
    for (let i = 0; i < 4; i++) {
      const yy = 20 + i / 3 * 145, value = reverse ? min + i / 3 * (max - min) : max - i / 3 * (max - min);
      part('line', { x1: 55, x2: 530, y1: yy, y2: yy, stroke: 'var(--line)' });
      part('text', { x: 45, y: yy + 4, fill: 'var(--muted)', 'font-size': 10, 'text-anchor': 'end' }, number(Math.round(value)));
    }
    // Missing observations remain gaps rather than fabricated zero values.
    let path = '', connected = false;
    points.forEach(p => { if (p[field] == null) { connected = false; return; } path += `${connected ? 'L' : 'M'}${x(p)},${y(p)} `; connected = true; });
    part('path', { d: path, fill: 'none', stroke: reverse ? 'var(--pc)' : 'var(--accent)', 'stroke-width': 2.5, 'stroke-linejoin': 'round' });
    valid.forEach(p => { const dot = part('circle', { cx: x(p), cy: y(p), r: 3.2, fill: reverse ? 'var(--pc)' : 'var(--accent)' }); const title = document.createElementNS(ns, 'title'); title.textContent = `${when(p.ts)} · ${number(p[field])}`; dot.append(title); });
    part('text', { x: 55, y: 195, fill: 'var(--muted)', 'font-size': 10 }, when(points[0].ts));
    part('text', { x: 530, y: 195, fill: 'var(--muted)', 'font-size': 10, 'text-anchor': 'end' }, when(points.at(-1).ts));
    container.append(svg);
  }
  function renderTrends() {
    if (!state.trendsVisible || !state.data) return;
    const game = state.data.games.find(g => g.id === state.selected) || state.data.games[0];
    if (!game) return;
    state.selected = game.id;
    const cutoff = state.range === 'all' ? 0 : Date.parse(state.data.crawledAt) - (state.range === '24h' ? 86400000 : 7 * 86400000);
    const points = state.history.filter(s => Date.parse(s.ts) >= cutoff).map(s => { const value = s.games[game.id]; return { ts: s.ts, heat: value?.[0] ?? null, rank: value?.[2] ?? null }; });
    $('historyCount').textContent = state.historyVersion ? `${points.length} 个快照${state.historyVersion !== state.data.crawledAt ? ' · 历史更新中' : ''}` : '历史数据加载中…';
    $('selectedStats').replaceChildren();
    for (const [label, value] of [['当前作品', game.name], ['热度', number(game.heat)], ['关注', number(game.followers)], ['总榜排名', `#${game.rank}`]]) { const item = node('span', '', label); item.append(node('strong', '', value)); $('selectedStats').append(item); }
    chart('heatChart', points, 'heat'); chart('rankChart', points, 'rank', true);
  }
  function sources() {
    const data = state.data, body = $('sourceDetails'); body.replaceChildren();
    body.append(node('p', '', `数据抓取：${when(data.startedAt)} — ${when(data.crawledAt)}（北京时间）。已收录 ${number(data.summary.total)} 款本届公开作品。`));
    const list = node('ul');
    [
      '赛事：TapTap 聚光灯 2026 年 21 天游戏创作挑战，官方赛事 ID 28，主题「涌现」。',
      data.coverage?.description || '以官方赛事目录为入口，按 TapTap 游戏 ID 去重。',
      '热度取公开作品详情 stat.hits_total；关注取 stat.fans_count。列表中的占位统计不参与计算。零热度仅指详情明确返回 0 的作品。',
      'TapTap 制造按官方「TapTap制造」标签识别；未带此标签的作品归入其他方式。分类不等同于对实际引擎或 AI 使用情况的鉴定。',
      '平台依据 supported_platforms；同时包含 PC 和 Android/iOS 归为双端，仅移动与仅 PC 互斥。未标明的平台单独统计。',
      '中位数基于已收录作品计算；热度破万指严格大于 10,000。热度相同按游戏 ID 排序，便于比较快照。',
      '采集需要时间，各作品数据并非同一秒更新。历史走势只使用实际保存的快照，不补造历史点。'
    ].forEach(text => list.append(node('li', '', text)));
    body.append(list);
  }
  function exportCsv() {
    // Prevent spreadsheet formula execution from external game/developer names.
    const cell = value => { let text = String(value ?? ''); if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`; return `"${text.replaceAll('"', '""')}"`; };
    const rows = [['总榜排名','游戏ID','作品','开发者','开发方式','平台','热度','关注数','TapTap链接','统计时间'], ...filtered().map(g => [g.rank,g.id,g.name,g.developer,g.method === 'maker' ? 'TapTap 制造' : '其他方式',labels[g.platform],g.heat,g.followers,`https://www.taptap.cn/app/${g.id}`,state.data.crawledAt])];
    const blob = new Blob(['\uFEFF', rows.map(row => row.map(cell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob), link = node('a'); link.href = url; link.download = `聚光灯2026-${state.data.crawledAt.slice(0,10)}.csv`; document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function themeLabel() { const light = document.documentElement.dataset.theme === 'light'; $('themeToggle').textContent = light ? '☾' : '☀'; $('themeToggle').setAttribute('aria-label', `切换${light ? '深' : '浅'}色主题`); }
  $('themeToggle').addEventListener('click', () => { const theme = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light'; document.documentElement.dataset.theme = theme; try { localStorage.setItem('spotlight-theme', theme); } catch {} themeLabel(); });
  themeLabel();
  ['searchInput','methodSelect','platformSelect','sortSelect'].forEach(id => $(id).addEventListener(id === 'searchInput' ? 'input' : 'change', () => { state.page = 1; renderTable(); }));
  $('resetFilters').addEventListener('click', () => { $('searchInput').value = ''; $('methodSelect').value = 'all'; $('platformSelect').value = 'all'; $('sortSelect').value = 'heat-desc'; state.page = 1; renderTable(); });
  $('prevPage').addEventListener('click', () => { state.page--; renderTable(); });
  $('nextPage').addEventListener('click', () => { state.page++; renderTable(); });
  $('trendSelect').addEventListener('change', () => { state.selected = $('trendSelect').value; renderTrends(); });
  $('rangeSeg').addEventListener('click', event => { const button = event.target.closest('button'); if (!button || !state.data) return; state.range = button.dataset.range; [...$('rangeSeg').children].forEach(b => { b.classList.toggle('active', b === button); b.setAttribute('aria-pressed', b === button ? 'true' : 'false'); }); renderTrends(); });
  $('exportButton').addEventListener('click', exportCsv);
  ['sourceButton','footerSource'].forEach(id => $(id).addEventListener('click', () => { if (state.data) sources(); $('sourceDialog').showModal(); }));
  $('closeDialog').addEventListener('click', () => $('sourceDialog').close());
  $('sourceDialog').addEventListener('click', event => { if (event.target === $('sourceDialog')) { const box = event.target.getBoundingClientRect(); if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) event.target.close(); } });
  function initialize(bundle) {
    if (!bundle?.latest?.games?.length) throw new Error('没有可用的参赛作品快照');
    state.data = bundle.latest;
    if (bundle.history) {
      state.history = bundle.history.snapshots || [];
      state.historyVersion = state.data.crawledAt;
    }
    overview(); renderTable();
    if ($('dailyDate')) delete $('dailyDate').dataset.hour;
    if (!state.data.partial) hourlyRecommendations();
    else $('dailyDate').textContent = '完整榜单加载后显示推荐';
    for (const id of ['searchInput','methodSelect','platformSelect','sortSelect','exportButton','randomGameButton']) $(id).disabled = !!state.data.partial;
    if (state.trendsVisible) populateTrends();
    if (!document.documentElement.dataset.overviewReadyMs) document.documentElement.dataset.overviewReadyMs = String(Math.round(performance.now()));
  }
  function populateTrends() {
    const select = $('trendSelect');
    if (select.dataset.version !== state.data.crawledAt || select.options.length !== state.data.games.length) {
      const fragment = document.createDocumentFragment();
      state.data.games.forEach(game => { const option = node('option', '', `#${game.rank} ${game.name}`); option.value = game.id; fragment.append(option); });
      select.replaceChildren(fragment); select.dataset.version = state.data.crawledAt;
    }
    if (!state.data.games.some(g => g.id === state.selected)) state.selected = state.data.games[0].id;
    select.value = state.selected; renderTrends();
  }
  async function activateTrends() {
    state.trendsVisible = true;
    if (!state.data) return;
    populateTrends();
    if (location.protocol === 'file:') return;
    try {
      const history = await client.loadHistory();
      state.history = history.snapshots;
      state.historyVersion = history.snapshots.at(-1)?.ts;
      renderTrends();
    } catch (error) {
      $('historyCount').textContent = state.history.length ? '历史更新失败，显示已有记录' : '历史加载失败，点击重试';
      $('historyCount').title = error.message;
    }
  }
  let storage;
  try { storage = localStorage; } catch {}
  const client = new window.SpotlightDataClient({fetcher: (...args) => fetch(...args), storage, initial: window.SPOTLIGHT_DATA.latest,
    base: ['localhost','127.0.0.1'].includes(location.hostname) ? './data/' : undefined});
  let refreshing = false;
  async function refreshSnapshot() {
    if (location.protocol === 'file:' || refreshing) return;
    refreshing = true;
    const before = state.data.crawledAt;
    const feedback = $('refreshFeedback');
    const report = text => { if (feedback) feedback.textContent = text; };
    $('statusPill').disabled = true;
    $('statusPill').setAttribute('aria-busy', 'true');
    report('正在更新…');
    try {
      const latest = await client.check();
      if (state.data !== latest) initialize({latest});
      updateFreshness();
      const checked = new Date().toLocaleTimeString('zh-CN', {timeZone:'Asia/Shanghai',hour12:false});
      report(latest.crawledAt !== before ? `已更新 · ${checked}` : `已检查 · ${checked}`);
      if (state.trendsVisible) await activateTrends();
    } catch (error) {
      try {
        const latest = await client.localFallback();
        if (state.data !== latest) initialize({latest});
      } catch { /* Keep the overview and first 30 entries usable. */ }
      updateFreshness();
      report('暂时无法更新，请稍后重试');
      $('statusPill').title = `暂时无法更新，点击重试：${error.message}`;
    } finally {
      refreshing = false;
      $('statusPill').disabled = false;
      $('statusPill').removeAttribute('aria-busy');
    }
  }
  initialize({latest:client.catalogue});
  if (location.protocol === 'file:') {
    // Directly opened files cannot fetch JSON. Load the optional offline bundle after first paint.
    setTimeout(() => {
      const script = document.createElement('script'); script.src = './data/dashboard.js';
      script.onload = () => initialize(window.SPOTLIGHT_DATA);
      document.body.append(script);
    }, 0);
  } else {
    // Give the lightweight overview a paint before starting background requests.
    requestAnimationFrame(() => setTimeout(refreshSnapshot, 0));
  }
  $('historyCount').setAttribute('role', 'button');
  $('historyCount').tabIndex = 0;
  $('historyCount').addEventListener('click', activateTrends);
  $('historyCount').addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') activateTrends(); });
  $('statusPill').addEventListener('click', refreshSnapshot);
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { observer.disconnect(); activateTrends(); }
    }, {rootMargin:'100px'});
    observer.observe($('trends'));
  } else {
    const reveal = () => { if ($('trends').getBoundingClientRect().top < innerHeight + 100) { window.removeEventListener('scroll', reveal); activateTrends(); } };
    window.addEventListener('scroll', reveal, {passive:true}); reveal();
  }
  setInterval(() => { updateFreshness(); if (state.data && !state.data.partial) hourlyRecommendations(); }, 60000);
  function scheduleRefresh() {
    setTimeout(async () => { await refreshSnapshot(); scheduleRefresh(); }, 5 * 60000 - Date.now() % (5 * 60000));
  }
  scheduleRefresh();
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshSnapshot(); });
  if (location.protocol === 'https:' && 'serviceWorker' in navigator) {
    const reportCache = () => { document.documentElement.dataset.shellCache = navigator.serviceWorker.controller ? 'active' : 'pending'; };
    reportCache();
    navigator.serviceWorker.addEventListener('controllerchange', reportCache);
    // Installing the repeat-visit cache must not compete with initial rendering.
    setTimeout(() => navigator.serviceWorker.register('./service-worker.js', {updateViaCache:'none'}).catch(() => {}), 3000);
  }
})();
