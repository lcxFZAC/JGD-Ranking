"""Fetch verified 2026 Spotlight entries and save an atomic, reproducible snapshot."""
import argparse
import concurrent.futures
import datetime as dt
import json
import pathlib
import statistics
import time
import urllib.error
from taptap import get, EVENT_ID
from protection import retain, check_snapshot, check_size

ROOT = pathlib.Path(__file__).resolve().parents[1]
DATA = ROOT / 'data'
MEMBERSHIP_CACHE = ROOT / '.cache' / 'membership'


def timestamp():
    return dt.datetime.now(dt.timezone.utc).isoformat(timespec='seconds')


def atomic_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + '.tmp')
    temporary.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    temporary.replace(path)


def membership(gid, max_age=None):
    """Return game_jam_tag.id for an app, with optional cache max age in seconds."""
    MEMBERSHIP_CACHE.mkdir(parents=True, exist_ok=True)
    path = MEMBERSHIP_CACHE / f'{gid}.json'
    now = time.time()
    if path.exists():
        saved = json.loads(path.read_text(encoding='utf-8'))
        # Membership can change while submissions are under review.
        ttl = 86400 if saved.get('eventId') == EVENT_ID else 21600
        if max_age is not None:
            ttl = min(ttl, max_age)
        if now - path.stat().st_mtime < ttl:
            return saved.get('eventId')
    data = get('/webapiv2/app/v6/detail', id=gid)
    app = data.get('app', data)
    event_id = app.get('game_jam_tag', {}).get('id')
    atomic_json(path, {'id': gid, 'eventId': event_id, 'checkedAt': timestamp()})
    time.sleep(.15)
    return event_id


def prune_inactive(ids, official, checker=None, max_age=3 * 3600):
    """Keep official event-list IDs; re-check the rest and drop non-members.

    Check failures keep the ID (fail closed on removal) so a detail outage cannot
    empty the board. Official list IDs are trusted without a detail round-trip.
    """
    if checker is None:
        checker = lambda gid: membership(gid, max_age=max_age)
    active = set(official)
    candidates = sorted(set(ids) - official, key=int)
    departed, errors = [], []

    def check(gid):
        try:
            return gid, checker(gid), None
        except Exception as error:
            return gid, None, str(error)

    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        for gid, event, error in pool.map(check, candidates):
            if error:
                active.add(gid)
                errors.append({'id': gid, 'error': error})
            elif event == EVENT_ID:
                active.add(gid)
            else:
                departed.append(gid)
    return active, departed, errors


def normalize(game):
    stat = game.get('stat', {})
    # Missing metrics are not zero. Abort the snapshot instead of hiding a schema change.
    for key in ['hits_total', 'pc_download_count', 'fans_count']:
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
        # mini-multi-get splits PC downloads out; detail.stat.hits_total combines them.
        'heat': stat['hits_total'] + stat['pc_download_count'],
        'heatComponents': {'appHits': stat['hits_total'], 'pcDownloads': stat['pc_download_count']},
        'followers': stat['fans_count'],
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


def collect_ids(registry):
    """Union registry with the official event list; return (ids, official, list_error)."""
    ids = set(registry['ids'])
    official = set()
    list_error = None
    try:
        official = event_ids()
        ids.update(official)
    except (urllib.error.URLError, TimeoutError, ValueError) as error:
        list_error = error
        if not ids:
            raise
        print(f'::warning::Event discovery unavailable; refreshing {len(ids)} registered games: {error}', flush=True)
    return ids, official, list_error


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
    departed = []
    if args.from_discovery:
        discovered = json.loads((ROOT / '.cache/discovered.json').read_text(encoding='utf-8'))
        ids = set(discovered)
        ids.update(registry['ids'])
    else:
        ids, official, list_error = collect_ids(registry)
        ids.update(registry['ids'])
        # Without the official list we cannot safely distinguish departures from an outage.
        if not list_error:
            ids, departed, membership_errors = prune_inactive(ids, official)
            if departed:
                print(f'Pruned {len(departed)} games no longer tagged event {EVENT_ID}', flush=True)
            if membership_errors:
                print(f'::warning::Kept {len(membership_errors)} games after membership check errors', flush=True)
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
    check_snapshot(games, previous, len(ids), departed=departed)
    notice = f'已核实收录 {len(games):,} 款公开参赛作品。统计基于已收录作品，未公开与未收录作品不计入。'
    if missing:
        notice += f' 本次 {len(missing)} 款无法读取，未计入统计。'
    if departed:
        notice += f' 本次复核移除 {len(departed)} 款已不再属于本届聚光灯的作品。'
    latest = {
        'schemaVersion': 1, 'heatMetricVersion': 2, 'eventId': EVENT_ID, 'eventName': '2026 TapTap 聚光灯 · 21天游戏创作挑战',
        'theme': '涌现', 'sourceUrl': event['url'], 'startedAt': started, 'crawledAt': ended,
        'summary': summarize(games), 'games': games,
        'coverage': {
            'kind': 'verified-public-catalogues', 'officialTotal': None, 'unavailableIds': missing,
            'departedIds': departed,
            'description': '合并官方赛事列表的热门、最新发布、最近更新排序，并从公开标签、PC 和 TapTap 制造目录补充候选；补充作品与已登记但不在官方列表中的作品逐一核对详情赛事 ID 为 28，离开本届聚光灯的作品会从榜单与名单移除。列表接口有展示上限，因此本看板表示已核实收录的公开作品，不宣称覆盖未公开或所有参赛提交。',
            'notice': notice,
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
    history['snapshots'].append({'ts': ended, 'heatMetricVersion': 2, 'games': {g['id']: [g['heat'],g['followers'],g['rank']] for g in games}})
    history['snapshots'] = retain(history['snapshots'], dt.datetime.now(dt.timezone.utc))
    check_size({'latest': latest, 'history': history})
    atomic_json(history_path, history)
    atomic_json(DATA / 'latest.json', latest)
    atomic_json(registry_path, {'eventId': EVENT_ID, 'updatedAt': ended, 'ids': ids})
    print(json.dumps(latest['summary'],ensure_ascii=False,indent=2),flush=True)


if __name__ == '__main__':
    main()
