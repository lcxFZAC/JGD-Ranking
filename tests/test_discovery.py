import pathlib
import sys
import unittest
from unittest.mock import patch
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parents[1]/'scripts'))
from discovery import check_batch

class DiscoveryBatchTest(unittest.TestCase):
    def test_bounded_resume_preserves_previous_and_new_ids(self):
        confirmed={'old'}
        with patch('discovery.BATCH_SIZE',2):
            pending, errors=check_batch(['1','2','3'],confirmed,lambda gid:28 if gid!='2' else None)
            self.assertEqual(pending,['3'])
            self.assertEqual(confirmed,{'old','1'})
            self.assertFalse(errors)
            pending, errors=check_batch(pending,confirmed,lambda gid:28)
            self.assertFalse(pending)
            self.assertEqual(confirmed,{'old','1','3'})

    def test_failed_candidate_is_retained_without_losing_successes(self):
        def checker(gid):
            if gid=='2': raise TimeoutError('temporary')
            return 28
        confirmed={'old'}
        pending, errors=check_batch(['1','2'],confirmed,checker)
        self.assertEqual(pending,['2'])
        self.assertEqual(confirmed,{'old','1'})
        self.assertEqual(errors[0]['id'],'2')

    def test_non_member_is_removed_from_confirmed(self):
        confirmed={'old','gone','keep'}
        pending, errors=check_batch(['gone','keep','new'],confirmed,lambda gid:28 if gid!='gone' else None)
        self.assertFalse(pending)
        self.assertFalse(errors)
        self.assertEqual(confirmed,{'old','keep','new'})
