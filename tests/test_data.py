import pathlib
import sys
import unittest
from unittest.mock import patch
import urllib.error
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parents[1]/'scripts'))
from crawl import normalize, summarize, collect_ids, prune_inactive


def raw(gid=1, heat=0, platforms=None, maker=False):
    return {'id':gid,'title':'示例','stat':{'hits_total':heat,'pc_download_count':0,'fans_count':2},
            'tags':[{'value':'TapTap制造'}] if maker else [],
            'platform_info':{'supported_platforms':[{'key':p} for p in (platforms or [])]}}


class StatisticsTest(unittest.TestCase):
    def test_discovery_outage_preserves_registry(self):
        with patch('crawl.event_ids', side_effect=urllib.error.URLError('temporary outage')):
            ids, official, error = collect_ids({'ids': ['1', '2']})
            self.assertEqual(ids, {'1', '2'})
            self.assertEqual(official, set())
            self.assertIsNotNone(error)
            with self.assertRaises(urllib.error.URLError):
                collect_ids({'ids': []})

    def test_discovery_adds_new_entries(self):
        with patch('crawl.event_ids', return_value={'2', '3'}):
            ids, official, error = collect_ids({'ids': ['1', '2']})
            self.assertEqual(ids, {'1', '2', '3'})
            self.assertEqual(official, {'2', '3'})
            self.assertIsNone(error)

    def test_prune_drops_non_members_keeps_official_and_errors(self):
        def checker(gid):
            if gid == '2':
                return None
            if gid == '3':
                raise TimeoutError('temporary')
            return 28
        active, departed, errors = prune_inactive({'1', '2', '3', '9'}, {'9'}, checker=checker)
        self.assertEqual(active, {'1', '3', '9'})
        self.assertEqual(departed, ['2'])
        self.assertEqual(errors[0]['id'], '3')

    def test_platforms_are_mutually_exclusive(self):
        games=[normalize(raw(i,platforms=p)) for i,p in enumerate([['pc','android'],['android','ios'],['pc'],[],['pc','steam']])]
        self.assertEqual([g['platform'] for g in games],['dual','mobile','pc','unknown','pc'])
        self.assertEqual(sum(summarize(games)['platforms'].values()),len(games))

    def test_missing_stats_are_not_zero(self):
        game=raw();del game['stat']['hits_total']
        with self.assertRaises(ValueError):normalize(game)

    def test_pc_heat_matches_detail_combined_metric(self):
        game=raw(984642,0,platforms=['pc'])
        game['stat']['pc_download_count']=19
        self.assertEqual(normalize(game)['heat'],19)
        game=raw(972285,14333,platforms=['pc','android'])
        game['stat']['pc_download_count']=962
        self.assertEqual(normalize(game)['heat'],15295)
        self.assertEqual(normalize(raw(984730))['heat'],0)
        for value in [None,False,-1,'19']:
            game['stat']['pc_download_count']=value
            with self.assertRaises(ValueError):normalize(game)
        del game['stat']['pc_download_count']
        with self.assertRaises(ValueError):normalize(game)

    def test_median_and_ten_thousand_boundary(self):
        games=[normalize(raw(i,h,maker=i==0)) for i,h in enumerate([0,2,10000,10001])]
        summary=summarize(games)
        self.assertEqual(summary['medianHeat'],5001)
        self.assertEqual(summary['overTenThousand'],1)
        self.assertEqual(summary['zeroHeat'],1)
        self.assertEqual(summary['maker']+summary['other'],4)
        self.assertEqual(summary['totalHeat'],20003)

    def test_no_fake_empty_snapshot(self):
        with self.assertRaises(ValueError):summarize([])


if __name__=='__main__':unittest.main()
