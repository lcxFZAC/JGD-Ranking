"""Retention and publication gates. Fail closed before writing snapshots."""
import datetime as dt
import json

MAX_BYTES = 20 * 1024 * 1024

def retain(snapshots, now):
    daily, recent = {}, {}
    for item in sorted(snapshots, key=lambda s: s['ts']):
        age = now - dt.datetime.fromisoformat(item['ts'])
        if age > dt.timedelta(days=90):
            continue
        if age > dt.timedelta(days=7):
            daily[item['ts'][:10]] = item
        else:
            recent[item['ts']] = item
    return list(daily.values()) + list(recent.values())

def check_snapshot(games, previous, requested):
    if not games or len({g['id'] for g in games}) != len(games):
        raise ValueError('Empty or duplicate snapshot')
    if len(games) < requested * .95:
        raise ValueError('More than 5% of requested games unavailable; preserving previous snapshot')
    old = {g['id']: g for g in previous.get('games', [])}
    new = {g['id']: g for g in games}
    if old and len(old.keys() & new.keys()) < len(old) * .95:
        raise ValueError('More than 5% of previous games disappeared')
    common = old.keys() & new.keys()
    for metric in ['heat', 'followers']:
        before = sum(old[k][metric] for k in common)
        after = sum(new[k][metric] for k in common)
        if before and after < before * .8:
            raise ValueError(f'Comparable {metric} dropped over 20%; manual investigation required')

def check_size(data):
    if len(json.dumps(data, ensure_ascii=False, separators=(',', ':')).encode('utf-8')) > MAX_BYTES:
        raise ValueError('Snapshot exceeds 20 MiB budget; publication stopped')
