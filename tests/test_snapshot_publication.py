"""Exercise the workflow's real publication commands against an offline remote."""
import contextlib
import datetime as dt
import io
import os
import pathlib
import shutil
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
import crawl


def publication_script():
    """Read the literal Bash block, without adding a YAML runtime dependency."""
    lines = (ROOT / '.github/workflows/update.yml').read_text().splitlines()
    start = lines.index('      - name: Save verified snapshots')
    start = lines.index('        run: |', start) + 1
    script = []
    for line in lines[start:]:
        if not line.startswith('          '):
            break
        script.append(line[10:])
    if not script:
        raise AssertionError('Snapshot publication Bash block was not found')
    return '\n'.join(script)


class SnapshotPublicationTest(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.directory = pathlib.Path(temporary.name)
        self.work = self.directory / 'work'
        self.work.mkdir()
        self.env = dict(os.environ, GITHUB_REF_NAME='main', GIT_ALLOW_PROTOCOL='file',
                        GIT_CONFIG_GLOBAL=os.devnull, GIT_CONFIG_NOSYSTEM='1')
        # Only the real builder's inputs are needed; no downloaded data or API calls.
        files = ['.gitignore', 'scripts/build.js', '_headers', 'index.html',
                 'styles.css', 'spotlight.css', 'app.js', 'data-client.js',
                 'service-worker.js', 'assets/zaowuguo-icon.jpg',
                 'assets/zaowuguo-cover.jpg']
        for name in files:
            target = self.work / name
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(ROOT / name, target)
        (self.work / 'README.md').write_text('Publication fixture\n')
        self.now = dt.datetime.now(dt.timezone.utc).replace(microsecond=0)
        self.refresh(0)
        self.git('init', '-b', 'main')
        self.git('config', 'user.name', 'Publication test')
        self.git('config', 'user.email', 'publication@example.invalid')
        self.git('add', '--', *files, 'README.md', *self.snapshot_paths())
        self.git('commit', '-m', 'Initial fixture')
        self.base = self.git('rev-parse', 'HEAD').stdout.strip()
        self.remote = self.directory / 'origin.git'
        self.git('init', '--bare', '-b', 'main', str(self.remote))
        self.git('remote', 'add', 'origin', str(self.remote))
        self.git('push', '-u', 'origin', 'main')

    def run_command(self, *args, cwd=None, check=True):
        result = subprocess.run(args, cwd=cwd or self.work, env=self.env,
                                text=True, capture_output=True, timeout=30)
        if check and result.returncode:
            self.fail(f'{args} failed:\n{result.stdout}\n{result.stderr}')
        return result

    def git(self, *args, **kwargs):
        return self.run_command('git', *args, **kwargs)

    def snapshot_paths(self):
        return {str(path.relative_to(self.work))
                for path in (self.work / 'data').glob('*.json')}

    def refresh(self, minute):
        timestamp = (self.now + dt.timedelta(minutes=minute)).isoformat()
        game = {'id': 1, 'title': 'Fixture game', 'type': 'app',
                'stat': {'hits_total': 10, 'pc_download_count': 0, 'fans_count': 2}}
        roster = {'crawledAt': timestamp, 'total': 1, 'games': [game]}

        def api(path, **params):
            if path.endswith('/event-detail'):
                return {'event': {'id': 28, 'year': 2026, 'event_name': '21 days'}}
            if path.endswith('/mini-multi-get'):
                self.assertEqual(params['ids'], '1')
                return {'list': [game]}
            raise AssertionError(f'Unexpected network request: {path}')

        with patch.object(crawl, 'DATA', self.work / 'data'), \
                patch.object(crawl, 'get', side_effect=api), \
                patch.object(crawl, 'fetch_participants', return_value=roster), \
                patch.object(crawl, 'timestamp', return_value=timestamp), \
                patch.object(crawl.time, 'sleep'), patch.object(sys, 'argv', ['crawl.py']), \
                contextlib.redirect_stdout(io.StringIO()):
            crawl.main()
        self.run_command('node', 'scripts/build.js')

    def publish(self, check=True):
        # Match the workflow's explicit shell: bash fail-fast/pipefail behavior.
        return self.run_command('bash', '--noprofile', '--norc', '-eo', 'pipefail',
                                '-c', publication_script(), check=check)

    def test_every_crawl_and_build_snapshot_is_committed_before_rebase(self):
        # A real upstream change requires rebase, rather than merely an up-to-date pull.
        upstream = self.directory / 'upstream'
        self.git('clone', str(self.remote), str(upstream))
        (upstream / 'README.md').write_text('Concurrent upstream change\n')
        self.git('add', 'README.md', cwd=upstream)
        self.git('-c', 'user.name=Upstream test', '-c', 'user.email=upstream@example.invalid',
                 'commit', '-m', 'Concurrent upstream change', cwd=upstream)
        self.git('push', 'origin', 'main', cwd=upstream)
        upstream_head = self.git('rev-parse', 'HEAD', cwd=upstream).stdout.strip()

        self.refresh(1)
        generated = self.snapshot_paths()
        self.assertIn('data/participants.json', generated)
        self.assertEqual(set(self.git('diff', '--name-only').stdout.splitlines()), generated)
        (self.work / 'unrelated.txt').write_text('Do not publish me\n')
        expected_roster = (self.work / 'data/participants.json').read_text()
        self.publish()

        committed = set(self.git('diff-tree', '--no-commit-id', '--name-only', '-r',
                                 'HEAD').stdout.splitlines())
        self.assertEqual(committed, generated, 'Publication must match all generated snapshots')
        self.assertEqual(self.git('status', '--porcelain', '--untracked-files=no').stdout, '')
        self.assertEqual(self.git('rev-parse', 'HEAD^').stdout.strip(), upstream_head)
        head = self.git('rev-parse', 'HEAD').stdout.strip()
        self.assertEqual(self.git('rev-parse', 'main', cwd=self.remote).stdout.strip(), head)
        self.assertEqual(self.git('show', 'main:data/participants.json',
                                 cwd=self.remote).stdout, expected_roster)
        self.assertTrue((self.work / 'unrelated.txt').exists())
        self.assertNotIn('unrelated.txt', self.git('ls-tree', '-r', '--name-only', 'HEAD').stdout)

    def test_unchanged_snapshots_do_not_create_a_commit(self):
        self.publish()
        self.assertEqual(self.git('rev-parse', 'HEAD').stdout.strip(), self.base)
        self.assertEqual(self.git('rev-parse', 'main', cwd=self.remote).stdout.strip(), self.base)

    def test_unrelated_tracked_changes_are_not_hidden_or_pushed(self):
        self.refresh(1)
        (self.work / 'README.md').write_text('Unrelated local change\n')
        result = self.publish(check=False)
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(self.git('rev-parse', 'main', cwd=self.remote).stdout.strip(), self.base)
        self.assertEqual((self.work / 'README.md').read_text(), 'Unrelated local change\n')
        self.assertEqual(self.git('diff', '--name-only').stdout.strip(), 'README.md')


if __name__ == '__main__':
    unittest.main()
