import datetime as dt
import pathlib
import sys
import unittest
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]/'scripts'))
from protection import retain, check_snapshot, check_size, MAX_BYTES

class ProtectionTest(unittest.TestCase):
    def test_retention_boundaries_and_daily_last(self):
        now=dt.datetime(2026,10,20,tzinfo=dt.timezone.utc)
        times=[now-dt.timedelta(days=91),now-dt.timedelta(days=90),now-dt.timedelta(days=8,hours=2),now-dt.timedelta(days=8,hours=1),now-dt.timedelta(days=7),now]
        samples=[{'ts':t.isoformat(),'games':{}} for t in times]
        result=retain(samples+[samples[-1]],now)
        self.assertEqual([s['ts'] for s in result],[samples[i]['ts'] for i in [1,3,4,5]])

    def test_missing_and_replaced_ids_blocked(self):
        games=[{'id':str(i),'heat':100,'followers':100} for i in range(100)]
        with self.assertRaises(ValueError):check_snapshot(games[:94],{'games':games},100)
        replacements=[dict(g,id=str(int(g['id'])+100)) for g in games]
        with self.assertRaises(ValueError):check_snapshot(replacements,{'games':games},100)
        check_snapshot(games[:95],{'games':games},100)

    def test_confirmed_departures_are_allowed(self):
        games=[{'id':str(i),'heat':100,'followers':100} for i in range(100)]
        departed=[g['id'] for g in games[90:]]
        check_snapshot(games[:90],{'games':games},90,departed=departed)

    def test_metric_collapse_and_size(self):
        old=[{'id':'1','heat':100,'followers':100}]
        with self.assertRaises(ValueError):check_snapshot([dict(old[0],heat=0)],{'games':old},1)
        with self.assertRaises(ValueError):check_size({'payload':'x'*MAX_BYTES})
        check_size({'payload':'ok'})
