"""Build a verified event registry from public catalogues, without login.

Event search is capped at 500 results per sort. Supplement it with the public
PC / Maker catalogues and tag lists, validating the badge on each candidate.
"""
import concurrent.futures
import json
import os
import time
import urllib.error
import urllib.parse
from crawl import MEMBERSHIP_CACHE, atomic_json, event_ids, membership, timestamp, ROOT, DATA
from taptap import get, EVENT_ID

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


STATE = DATA / 'discovery-state.json'
BATCH_SIZE = 600


def check_batch(pending, confirmed, checker=membership):
    """Bound work; add members, drop explicit non-members, retry failures."""
    selected, remaining = pending[:BATCH_SIZE], pending[BATCH_SIZE:]
    errors = []
    def check(gid):
        try: return gid, checker(gid), None
        except Exception as error: return gid, None, str(error)
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        for gid, event, error in pool.map(check, selected):
            if error:
                remaining.append(gid)
                errors.append({"id": gid, "error": error})
            elif event == EVENT_ID:
                confirmed.add(gid)
            else:
                confirmed.discard(gid)
    return remaining, errors


def main():
    MEMBERSHIP_CACHE.mkdir(parents=True, exist_ok=True)
    prior_path = DATA / 'registry.json'
    previous = json.loads(prior_path.read_text(encoding='utf-8')) if prior_path.exists() else {'ids': []}
    prior = set(previous['ids'])
    state = json.loads(STATE.read_text(encoding='utf-8')) if STATE.exists() else {}
    if state.get('eventId') == EVENT_ID and state.get('pending'):
        confirmed = set(state.get('confirmed') or prior)
        pending = state['pending']
        print(f'Resuming {len(pending)} pending candidates', flush=True)
    else:
        official = set()
        try:
            official = event_ids()
        except (urllib.error.URLError, TimeoutError, ValueError) as error:
            print(f'::warning::Event list unavailable; retaining registered games and checking new candidates: {error}', flush=True)
        # Keep priors until a detail check proves they left; trust the official list as members.
        confirmed = set(prior) | official
        candidates = {gid: {'id': int(gid)} for gid in prior}
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
        # Official-list IDs are trusted; priors and catalogue supplements are re-checked.
        pending = sorted(set(candidates) - official, key=int, reverse=True)
        state = {'eventId': EVENT_ID, 'startedAt': timestamp(), 'confirmed': sorted(confirmed, key=int)}
    # Checkpoint the candidate queue before expensive membership requests.
    state.update(pending=pending, confirmed=sorted(confirmed, key=int), updatedAt=timestamp())
    atomic_json(STATE, state)
    remaining, errors = check_batch(pending, confirmed)
    # Publish after each batch; unchecked priors remain until detail proves departure.
    atomic_json(DATA / 'registry.json', {'eventId': EVENT_ID, 'updatedAt': timestamp(), 'ids': sorted(confirmed, key=int)})
    state.update(pending=remaining, confirmed=sorted(confirmed, key=int), updatedAt=timestamp(), errors=errors)
    atomic_json(STATE, state)
    if os.environ.get('GITHUB_OUTPUT'):
        with open(os.environ['GITHUB_OUTPUT'], 'a', encoding='utf-8') as output:
            output.write(f'complete={str(not remaining).lower()}\n')
    dropped = len(prior - confirmed)
    print(f'Verified registry: {len(confirmed)}; pending: {len(remaining)}; dropped: {dropped}; request errors: {len(errors)}', flush=True)
    if errors:
        raise RuntimeError(f'{len(errors)} membership requests failed; progress saved for retry')


if __name__ == '__main__': main()
