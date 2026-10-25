"""Complete public submission list used by the 2026 poster (not event badge 28)."""
import datetime as dt
from taptap import get

POSTER_ID = 3
POSTER_URL = 'https://www.taptap.cn/poster/NIKiDS1YShdA'
ENDPOINT = '/webapiv2/activity/game-jam/v2/search-participants'


def fetch_participants(reader=get):
    entries, total, offset = {}, None, 0
    while True:
        data = reader(ENDPOINT, id=POSTER_ID, category=0, kw='', tag='',
                      view='all', limit=12, **{'from': offset})
        count = data.get('total')
        if not isinstance(count, int) or isinstance(count, bool) or count <= 0:
            raise ValueError('Invalid participant total')
        if total is not None and count != total:
            raise ValueError('Participant total changed during pagination; retry')
        total = count
        batch = data.get('list', [])
        if not batch:
            raise ValueError('Participant pagination ended before total')
        for game in batch:
            if game.get('type') != 'app':
                raise ValueError('Unsupported participant type; preserving snapshot')
            gid = str(game['id'])
            if gid in entries:
                raise ValueError('Duplicate participant across pages; retry')
            entries[gid] = game
        offset += len(batch)
        if offset >= total:
            if len(entries) != total:
                raise ValueError('Participant count does not match total')
            return {'posterId': POSTER_ID, 'sourceUrl': POSTER_URL,
                    'crawledAt': dt.datetime.now(dt.timezone.utc).isoformat(timespec='seconds'),
                    'total': total, 'games': list(entries.values())}
        if not data.get('next_page'):
            raise ValueError('Participant next page missing before total')
