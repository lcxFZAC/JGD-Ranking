"""Compare a saved dashboard snapshot with the complete official poster roster."""
import argparse
import html
import json
from pathlib import Path
from crawl import atomic_json


def reconcile(before, after, roster, history):
    old = {g['id']: g for g in before['games']}
    new = {g['id']: g for g in after['games']}
    official = {str(g['id']): g for g in roster['games']}
    historical = set().union(*(set(s['games']) for s in history['snapshots']
                               if s['ts'] <= before['crawledAt']))
    historical.update(old)
    rows = []
    for gid in sorted(official.keys() | old.keys(), key=int):
        a, b = old.get(gid), new.get(gid)
        if gid not in official:
            status = '已不在官方名单'
        elif a is None:
            status = '历史曾收录后遗漏' if gid in historical else '历史从未收录'
        elif b is None:
            status = '指标暂不可读'
        elif (a['heat'], a['followers'], a['rank']) != (b['heat'], b['followers'], b['rank']):
            status = '已收录指标变化'
        else:
            continue
        game = b or a or official[gid]
        rows.append({'id': gid, 'name': game.get('name', game.get('title')),
                     'status': status, 'url': 'https://www.taptap.cn/app/' + gid,
                     'before': {k: a[k] for k in ['heat', 'followers', 'rank']} if a else None,
                     'after': {k: b[k] for k in ['heat', 'followers', 'rank']} if b else None})
    return {'beforeAt': before['crawledAt'], 'afterAt': after['crawledAt'],
            'officialAt': roster['crawledAt'], 'sourceUrl': roster['sourceUrl'],
            'beforeTotal': len(old), 'afterTotal': len(new), 'officialTotal': len(official),
            'missingBefore': len(official.keys() - old.keys()),
            'outsideOfficialBefore': len(old.keys() - official.keys()),
            'historicallyOmitted': len((official.keys() - old.keys()) & historical),
            'neverCollected': len(official.keys() - historical), 'rows': rows}


def render(report):
    esc = lambda x: html.escape(str(x))
    rows = []
    for row in report['rows']:
        metric = lambda side, key: '—' if row[side] is None else esc(row[side][key])
        rows.append('<tr data-status="' + esc(row['status']) + '"><td>' + esc(row['status']) +
                    '</td><td><a target="_blank" rel="noopener" href="' + esc(row['url']) + '">' +
                    esc(row['name']) + '</a></td><td>' + esc(row['id']) + '</td>' +
                    ''.join('<td>' + metric(side, key) + '</td>' for key in ['heat', 'followers', 'rank'] for side in ['before', 'after']) + '</tr>')
    return '''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>TapTap 报名作品与看板快照差异</title><style>body{font:15px/1.6 system-ui;margin:32px;color:#20252b;background:#fafafa}main{max-width:1300px;margin:auto}h1{font-size:26px}p{max-width:1000px}input,select{padding:10px;margin:0 10px 16px 0}table{border-collapse:collapse;width:100%;background:white}th,td{padding:8px 12px;text-align:left;border-bottom:1px solid #ddd}th{position:sticky;top:0;background:#eee}a{color:#08756c}.scroll{overflow:auto}small{color:#555}</style><main>
<h1>TapTap 官方报名作品与看板快照差异</h1>''' + f'''
<p>线上快照 {esc(report['beforeAt'])}：<b>{report['beforeTotal']} 款</b> → 修正快照 {esc(report['afterAt'])}：<b>{report['afterTotal']} 款</b>。官方完整名单 {report['officialTotal']} 款；漏收录 {report['missingBefore']} 款，其中历史从未收录 {report['neverCollected']} 款、历史曾收录后遗漏 {report['historicallyOmitted']} 款。旧快照中不在当前官方名单：{report['outsideOfficialBefore']} 款。</p>
<p>根因：旧采集使用赛事目录 event_id=28（每种排序限 500 款）及详情赛事徽标筛选；原页面使用活动 id=3 的完整报名作品接口。现已改为与原页面相同的全部作品分页，校验总数、重复与截断。2299 是用户观察值，本次实抓为 {report['officialTotal']}，未保存 2299 时点的名单，不能指认其后新增的具体一款。</p>
<p><small>时间为 UTC，换算北京时间加 8 小时。热度、关注数和名次取两次真实快照；时间不同产生的指标变化不等于修复造成的增长。历史遗漏只表示曾在历史快照出现，不能仅凭此认定退赛或下架。来源：<a href="{esc(report['sourceUrl'])}">官方活动页面</a>；结构化明细：data/reconciliation.json。</small></p>
''' + '''<input id="q" placeholder="搜索名称或 app ID"><select id="kind"><option value="missing">仅漏收录作品</option><option value="all">全部差异（含指标变化）</option><option>历史从未收录</option><option>历史曾收录后遗漏</option><option>已不在官方名单</option><option>已收录指标变化</option></select><span id="count"></span><div class="scroll"><table><thead><tr><th>差异类型</th><th>作品</th><th>App ID</th><th>旧热度</th><th>新热度</th><th>旧关注</th><th>新关注</th><th>旧名次</th><th>新名次</th></tr></thead><tbody>''' + ''.join(rows) + '''</tbody></table></div></main><script>
const q=document.getElementById('q'),kind=document.getElementById('kind'),rows=[...document.querySelectorAll('tbody tr')];function filter(){let n=0;for(const r of rows){const s=r.dataset.status,k=kind.value;r.hidden=!(r.textContent.toLowerCase().includes(q.value.toLowerCase())&&(k==='all'||(k==='missing'?s==='历史从未收录'||s==='历史曾收录后遗漏':s===k)));if(!r.hidden)n++;}document.getElementById('count').textContent='显示 '+n+' 款';}q.oninput=kind.onchange=filter;filter();</script></html>'''


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for arg in ['before', 'after', 'roster', 'history']:
        parser.add_argument('--' + arg, required=True, type=Path)
    args = parser.parse_args()
    values = [json.loads(getattr(args, k).read_text(encoding='utf-8')) for k in ['before', 'after', 'roster', 'history']]
    report = reconcile(*values)
    atomic_json(Path('data/reconciliation.json'), report)
    Path('reports').mkdir(exist_ok=True)
    Path('reports/coverage-diff.html').write_text(render(report), encoding='utf-8')
    print(json.dumps({k: v for k, v in report.items() if k != 'rows'}, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
