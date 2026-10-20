import datetime as dt
import pathlib
import sys
import unittest
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / 'scripts'))
from refresh_due import refresh_due


class RefreshDueTest(unittest.TestCase):
    def test_hourly_retry(self):
        now = dt.datetime(2026, 10, 20, 4, 5, tzinfo=dt.timezone.utc)
        snapshot = {'eventId': 28, 'games': [{'id': '1'}],
                    'startedAt': '2026-10-20T04:00:00+00:00',
                    'crawledAt': '2026-10-20T04:02:00+00:00'}
        self.assertFalse(refresh_due(snapshot, now))
        self.assertTrue(refresh_due(snapshot, now + dt.timedelta(hours=1)))
        self.assertTrue(refresh_due({}, now))
        self.assertTrue(refresh_due(dict(snapshot, games=[]), now))
        self.assertTrue(refresh_due(dict(snapshot, crawledAt='invalid'), now))
        self.assertTrue(refresh_due(dict(snapshot, startedAt='2026-10-20T03:59:00+00:00'), now))
        self.assertTrue(refresh_due(dict(snapshot, crawledAt='2026-10-20T04:06:00+00:00'), now))
