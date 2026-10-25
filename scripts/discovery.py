"""Refresh the registry from the complete public poster submission roster.

Legacy catalogue helpers remain for compatibility; publication uses activity 3.
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
    # Use the same complete roster as the dashboard refresh; never let the
    # legacy badge checker overwrite it with a narrower list.
    from participants import fetch_participants
    roster = fetch_participants()
    ids = sorted((str(g['id']) for g in roster['games']), key=int)
    atomic_json(DATA / 'registry.json', {'eventId': EVENT_ID, 'posterId': 3,
                'updatedAt': timestamp(), 'ids': ids})
    atomic_json(STATE, {'eventId': EVENT_ID, 'posterId': 3,
                'updatedAt': timestamp(), 'pending': [], 'confirmed': ids, 'errors': []})
    if os.environ.get('GITHUB_OUTPUT'):
        with open(os.environ['GITHUB_OUTPUT'], 'a', encoding='utf-8') as output:
            output.write('complete=true\n')
    print(f'Official poster participants: {len(ids)}', flush=True)


if __name__ == '__main__': main()
