import pathlib
import sys
import unittest
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / 'scripts'))
from reconcile import reconcile, render


class ReconciliationTest(unittest.TestCase):
    def test_future_snapshot_cannot_turn_new_games_into_historical_omissions(self):
        def game(gid):
            return {'id': gid, 'name': '<test>', 'heat': 1, 'followers': 2, 'rank': 1}
        before = {'crawledAt': '2026-10-25T01:00:00+00:00', 'games': [game('1')]}
        after = {'crawledAt': '2026-10-25T02:00:00+00:00', 'games': [game(str(i)) for i in [1, 2, 3]]}
        roster = {'crawledAt': after['crawledAt'], 'sourceUrl': 'https://www.taptap.cn/',
                  'games': after['games']}
        history = {'snapshots': [
            {'ts': '2026-10-25T00:00:00+00:00', 'games': {'2': []}},
            {'ts': after['crawledAt'], 'games': {'1': [], '2': [], '3': []}}]}
        report = reconcile(before, after, roster, history)
        self.assertEqual(report['missingBefore'], 2)
        self.assertEqual(report['historicallyOmitted'], 1)
        self.assertEqual(report['neverCollected'], 1)
        output = render(report)
        self.assertIn('&lt;test&gt;', output)
        self.assertNotIn('><test></a>', output)
