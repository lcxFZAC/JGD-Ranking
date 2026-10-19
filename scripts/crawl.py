"""Fetch verified 2026 Spotlight entries and save an atomic, reproducible snapshot."""
import argparse
import datetime as dt
import json
import pathlib
import statistics
import time
from taptap import get, EVENT_ID
from protection import retain, check_snapshot, check_size

ROOT = pathlib.Path(__file__).resolve().parents[1]
DATA = ROOT / 'data'


def timestamp():
    return dt.datetime.now(dt.timezone.utc).isoformat(timespec='seconds')


def atomic_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + '.tmp')
    temporary.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    temporary.replace(path)


def normalize(game):
    stat = game.get('stat', {})
    # Missing metrics are not zero. Abort the snapshot instead of hiding a schema change.
    for key in ['hits_total', 'fans_count']:
        value = stat.get(key)
        if isinstance(value, bool) or not isinstance(value, (int, float)) or value < 0:
            raise ValueError(f"{game.get('id')}: missing or invalid stat.{key}")
    tags = [tag['value'] for tag in game.get('tags', [])]
    platforms = sorted({p['key'] for p in game.get('platform_info', {}).get('supported_platforms', game.get('supported_platforms', []))})
    mobile = bool({'android', 'ios'} & set(platforms))
    pc = 'pc' in platforms
    platform = 'dual' if mobile and pc else 'mobile' if mobile else 'pc' if pc else 'unknown'
    return {
        'id': str(game['id']), 'name': game['title'],
        'developer': ' / '.join(d.get('name', '') for d in game.get('developers', [])),
        'icon': game.get('icon', {}).get('medium_url', ''),
        'cover': game.get('banner', {}).get('medium_url', ''),
        'method': 'maker' if 'TapTap制造' in tags else 'other',
        'platform': platform, 'platforms': platforms, 'tags': tags,
        'heat': stat['hits_total'], 'followers': stat['fans_count'],
        'reviewCount': stat.get('review_count'), 'score': stat.get('rating', {}).get('score'),
        'url': f"https://www.taptap.cn/app/{game['id']}",
    }


def summarize(games):
    if not games:
        raise ValueError('Refusing an empty snapshot')
    maker = sum(g['method'] == 'maker' for g in games)
    heats = [g['heat'] for g in games]
    return {
        'total': len(games), 'maker': maker, 'other': len(games) - maker,
        'platforms': {key: sum(g['platform'] == key for g in games) for key in ['dual','mobile','pc','unknown']},
        'totalHeat': sum(heats), 'medianHeat': statistics.median(heats),
        'overTenThousand': sum(h > 10000 for h in heats), 'zeroHeat': heats.count(0),
        'totalFollowers': sum(g['followers'] for g in games),
    }


def event_ids():
    ids = set()
    for sort in [0, 2, 3]:
        path = f'/webapiv2/activity/game-jam/v1/app-list-by-event?event_id={EVENT_ID}&from=0&limit=20&sort={sort}'
        seen = set()
        while path:
            if path in seen or len(seen) >= 100:
                raise ValueError('Event pagination did not terminate')
            seen.add(path)
            data = get(path)
            ids.update(str(g['id']) for g in data.get('list', []))
            path = data.get('next_page')
            time.sleep(.15)
        print(f'Event sort {sort}: union {len(ids)}', flush=True)
    return ids


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--from-discovery', action='store_true', help='Use locally verified discovery results for the initial import')
    args = parser.parse_args()
    started = timestamp()
    event = get('/webapiv2/activity/game-jam/v1/event-detail', event_id=EVENT_ID)['event']
    if event.get('year') != 2026 or event.get('id') != EVENT_ID or '21' not in event.get('event_name', ''):
        raise ValueError('Unexpected event identity')
    registry_path = DATA / 'registry.json'
    registry = json.loads(registry_path.read_text(encoding='utf-8')) if registry_path.exists() else {'eventId': EVENT_ID, 'ids': []}
    if registry['eventId'] != EVENT_ID:
        raise ValueError('Registry belongs to another event')
    if args.from_discovery:
        discovered = json.loads((ROOT / '.cache/discovered.json').read_text(encoding='utf-8'))
        ids = set(discovered)
    else:
        ids = event_ids()
    ids.update(registry['ids'])
    ids = sorted(ids, key=int)
    games, missing = [], []
    for offset in range(0, len(ids), 50):
        batch = ids[offset:offset+50]
        payload = get('/webapiv2/app/v1/mini-multi-get', ids=','.join(batch))
        found = {str(g['id']): g for g in payload.get('list', [])}
        for gid in batch:
            if gid not in found or found[gid].get('can_view') is False:
                missing.append(gid)
            else:
                games.append(normalize(found[gid]))
        print(f'Details {min(offset+50,len(ids))}/{len(ids)}', flush=True)
        time.sleep(.2)
    games.sort(key=lambda g: (-g['heat'], int(g['id'])))
    for rank, game in enumerate(games, 1): game['rank'] = rank
    ended = timestamp()
    previous_path = DATA / 'latest.json'
    previous = json.loads(previous_path.read_text(encoding='utf-8')) if previous_path.exists() else {}
    check_snapshot(games, previous, len(ids))
    latest = {
        'schemaVersion': 1, 'eventId': EVENT_ID, 'eventName': '2026 TapTap 聚光灯 · 21天游戏创作挑战',
        'theme': '涌现', 'sourceUrl': event['url'], 'startedAt': started, 'crawledAt': ended,
        'summary': summarize(games), 'games': games,
        'coverage': {
            'kind': 'verified-public-catalogues', 'officialTotal': None, 'unavailableIds': missing,
            'description': '合并官方赛事列表的热门、最新发布、最近更新排序，并从公开标签、PC 和 TapTap 制造目录补充候选；补充作品逐一核对详情赛事 ID 为 28。列表接口有展示上限，因此本看板表示已核实收录的公开作品，不宣称覆盖未公开或所有参赛提交。',
            'notice': f'已核实收录 {len(games):,} 款公开参赛作品。统计基于已收录作品，未公开与未收录作品不计入。' + (f' 本次 {len(missing)} 款无法读取，未计入统计。' if missing else ''),
        },
        'sources': [
            '/webapiv2/activity/game-jam/v1/event-detail?event_id=28',
            '/webapiv2/activity/game-jam/v1/app-list-by-event?event_id=28',
            '/webapiv2/app/v1/mini-multi-get',
            '/webapiv2/app/v6/detail',
            '/webapiv2/maker/v1/app-list', '/webapiv2/pc-game/v1/list', '/webapiv2/app-tag/v1/by-tag',
        ],
    }
    history_path = DATA / 'history.json'
    history = json.loads(history_path.read_text(encoding='utf-8')) if history_path.exists() else {'schemaVersion': 1, 'eventId': EVENT_ID, 'snapshots': []}
    if history.get('eventId') != EVENT_ID:
        raise ValueError('History belongs to another event')
    history['snapshots'].append({'ts': ended, 'games': {g['id']: [g['heat'],g['followers'],g['rank']] for g in games}})
    history['snapshots'] = retain(history['snapshots'], dt.datetime.now(dt.timezone.utc))
    check_size({'latest': latest, 'history': history})
    atomic_json(history_path, history)
    atomic_json(DATA / 'latest.json', latest)
    atomic_json(registry_path, {'eventId': EVENT_ID, 'updatedAt': ended, 'ids': ids})
    print(json.dumps(latest['summary'],ensure_ascii=False,indent=2),flush=True)


if __name__ == '__main__':
    main()
