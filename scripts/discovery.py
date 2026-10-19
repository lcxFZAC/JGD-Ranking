"""Build a verified event registry from public catalogues, without login.

Event search is capped at 500 results per sort. Supplement it with the public
PC / Maker catalogues and tag lists, validating the badge on each candidate.
"""
import concurrent.futures
import json
import time
import urllib.parse
from crawl import atomic_json, event_ids, timestamp, ROOT, DATA
from taptap import get, EVENT_ID

CACHE = ROOT / '.cache' / 'membership'
START = 1790784000  # 2026-10-01 00:00 in Asia/Shanghai


def paginate(path, stop_before_event=False):
    seen, result = set(), {}
    while path:
        if path in seen or len(seen) >= 500:
            raise ValueError('Catalogue pagination failed to terminate')
        seen.add(path)
        data = get(path)
        batch = data.get('list', [])
        for game in batch:
            result[str(game['id'])] = game
        path = data.get('next_page')
        if not batch or (stop_before_event and all(0 < g.get('released_time', 0) < START for g in batch)):
            break
        time.sleep(.2)
    return result


def membership(gid):
    path = CACHE / f'{gid}.json'
    now = time.time()
    if path.exists():
        saved = json.loads(path.read_text(encoding='utf-8'))
        # Membership can change while submissions are under review.
        ttl = 86400 if saved.get('eventId') == EVENT_ID else 21600
        if now - path.stat().st_mtime < ttl:
            return saved.get('eventId')
    data = get('/webapiv2/app/v6/detail', id=gid)
    app = data.get('app', data)
    event_id = app.get('game_jam_tag', {}).get('id')
    atomic_json(path, {'id': gid, 'eventId': event_id, 'checkedAt': timestamp()})
    time.sleep(.15)
    return event_id


def main():
    CACHE.mkdir(parents=True, exist_ok=True)
    confirmed = event_ids()
    prior_path = DATA / 'registry.json'
    previous = json.loads(prior_path.read_text(encoding='utf-8')) if prior_path.exists() else {'ids': []}
    candidates = {gid: {'id': int(gid)} for gid in previous['ids']}
    for tag in ['聚光灯GameJam', 'TapTap制造']:
        for sort in ['updated', 'hits', 'score']:
            path = '/webapiv2/app-tag/v1/by-tag?' + urllib.parse.urlencode({'tag': tag, 'sort': sort, 'from': 0, 'limit': 20})
            found = paginate(path)
            candidates.update(found)
            print(f'Tag {tag}/{sort}: {len(found)} candidates', flush=True)
    for kind, path in [
        ('maker', '/webapiv2/maker/v1/app-list?from=0&limit=100&sort=2'),
        ('pc', '/webapiv2/pc-game/v1/list?from=0&limit=100'),
    ]:
        found = paginate(path, stop_before_event=kind == 'maker')
        # First publication before creation opened is not a discovery candidate.
        # Already verified IDs are still checked, regardless of publication date.
        candidates.update({gid: g for gid, g in found.items() if not g.get('released_time') or g['released_time'] >= START})
        print(f'{kind}: {len(found)} catalogue entries', flush=True)
    pending = sorted(set(candidates) - confirmed, key=int)
    errors = []

    def check(gid):
        try: return gid, membership(gid), None
        except Exception as error: return gid, None, str(error)

    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        for i, (gid, event, error) in enumerate(pool.map(check, pending), 1):
            if event == EVENT_ID: confirmed.add(gid)
            if error: errors.append({'id': gid, 'error': error})
            if i % 100 == 0: print(f'Checked {i}/{len(pending)}; verified {len(confirmed)}', flush=True)
    if errors:
        atomic_json(ROOT / '.cache/discovery-errors.json', errors)
        raise RuntimeError(f'{len(errors)} membership requests failed; existing registry was preserved')
    atomic_json(DATA / 'registry.json', {'eventId': EVENT_ID, 'updatedAt': timestamp(), 'ids': sorted(confirmed, key=int)})
    print(f'Verified registry saved: {len(confirmed)} entries', flush=True)


if __name__ == '__main__': main()
