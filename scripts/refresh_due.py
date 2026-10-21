"""Skip the redundant check when this three-hour window has a committed snapshot."""
import datetime as dt
import json
import os
from pathlib import Path


def refresh_due(snapshot, now):
    try:
        started = dt.datetime.fromisoformat(snapshot['startedAt'])
        ended = dt.datetime.fromisoformat(snapshot['crawledAt'])
        hour = now.replace(hour=(now.hour // 3) * 3, minute=0, second=0, microsecond=0)
        return not (snapshot.get('eventId') == 28 and snapshot.get('games')
                    and hour <= started <= ended <= now)
    except (KeyError, TypeError, ValueError):
        return True


if __name__ == '__main__':
    try:
        snapshot = json.loads(Path('data/latest.json').read_text(encoding='utf-8'))
    except (OSError, ValueError):
        snapshot = {}
    scheduled = os.environ.get('EVENT_NAME') == 'schedule'
    now = dt.datetime.now(dt.timezone.utc)
    refresh = refresh_due(snapshot, now) if scheduled else os.environ.get('REFRESH_DATA') == 'true' or os.environ.get('FULL_DISCOVERY') == 'true'
    try:
        pending = bool(json.loads(Path('data/discovery-state.json').read_text(encoding='utf-8')).get('pending'))
    except (OSError, ValueError):
        pending = False
    discovery = os.environ.get('FULL_DISCOVERY') == 'true' or (scheduled and (pending or (now.hour < 3 and refresh)))
    with open(os.environ['GITHUB_OUTPUT'], 'a', encoding='utf-8') as output:
        output.write(f'refresh={str(refresh).lower()}\ndiscovery={str(discovery).lower()}\n')
    print('Refresh required' if refresh else 'This three-hour window already has a snapshot; skip redundant refresh')
