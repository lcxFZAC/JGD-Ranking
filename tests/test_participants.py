import pathlib
import sys
import unittest
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / 'scripts'))
from participants import fetch_participants


class ParticipantTest(unittest.TestCase):
    def reader(self, pages):
        def read(path, **params):
            self.assertEqual(params['id'], 3)
            self.assertEqual(params['view'], 'all')
            return pages[params['from']]
        return read

    def page(self, ids, total=3, next_page='next'):
        return {'total': total, 'next_page': next_page,
                'list': [{'id': n, 'type': 'app', 'title': str(n)} for n in ids]}

    def test_complete_roster_includes_apps_without_badge(self):
        result = fetch_participants(self.reader({0: self.page([1, 2]), 2: self.page([3], next_page='')}))
        self.assertEqual(result['total'], 3)
        self.assertEqual([g['id'] for g in result['games']], [1, 2, 3])

    def test_incomplete_duplicate_or_changing_roster_is_rejected(self):
        for last in [self.page([]), self.page([2]), self.page([3], total=4)]:
            with self.subTest(last=last), self.assertRaises(ValueError):
                fetch_participants(self.reader({0: self.page([1, 2]), 2: last}))

    def test_no_silent_truncation_or_unsupported_types(self):
        with self.assertRaises(ValueError):
            fetch_participants(self.reader({0: self.page([1, 2], next_page='')}))
        page = self.page([1], total=1)
        page['list'][0]['type'] = 'craft'
        with self.assertRaises(ValueError):
            fetch_participants(self.reader({0: page}))
