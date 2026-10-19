import pathlib
import sys
import unittest
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parents[1]/'scripts'))
from crawl import normalize, summarize


def raw(gid=1, heat=0, platforms=None, maker=False):
    return {'id':gid,'title':'示例','stat':{'hits_total':heat,'fans_count':2},
            'tags':[{'value':'TapTap制造'}] if maker else [],
            'platform_info':{'supported_platforms':[{'key':p} for p in (platforms or [])]}}


class StatisticsTest(unittest.TestCase):
    def test_platforms_are_mutually_exclusive(self):
        games=[normalize(raw(i,platforms=p)) for i,p in enumerate([['pc','android'],['android','ios'],['pc'],[],['pc','steam']])]
        self.assertEqual([g['platform'] for g in games],['dual','mobile','pc','unknown','pc'])
        self.assertEqual(sum(summarize(games)['platforms'].values()),len(games))

    def test_missing_stats_are_not_zero(self):
        game=raw();del game['stat']['hits_total']
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
