import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const backupScriptPath = new URL('../../scripts/backup-data.sh', import.meta.url);

test('backup script archives data and uploads with a verifiable checksum', async () => {
  const testRoot = await mkdtemp(path.join(tmpdir(), 'hamlog-backup-test-'));
  const sourceRoot = path.join(testRoot, 'source');
  const backupRoot = path.join(testRoot, 'backups');
  const restoreRoot = path.join(testRoot, 'restore');

  try {
    await mkdir(path.join(sourceRoot, 'data'), { recursive: true });
    await mkdir(path.join(sourceRoot, 'uploads'), { recursive: true });
    await mkdir(restoreRoot, { recursive: true });
    await writeFile(path.join(sourceRoot, 'data', 'posts.json'), '[{"id":"post-1"}]');
    await writeFile(path.join(sourceRoot, 'uploads', 'cover.txt'), 'uploaded asset');

    await execFileAsync('bash', [backupScriptPath.pathname, sourceRoot, backupRoot], {
      env: {
        ...process.env,
        BACKUP_RETENTION_DAYS: '14',
        GITHUB_SHA: 'abcdef0123456789',
        HAMLOG_CONTAINER_NAME: ''
      }
    });

    const backupFiles = await readdir(backupRoot);
    const archiveName = backupFiles.find(file => file.endsWith('.tar.gz'));
    assert.ok(archiveName);
    assert.ok(backupFiles.includes(`${archiveName}.sha256`));

    await execFileAsync('sha256sum', ['-c', `${archiveName}.sha256`], { cwd: backupRoot });
    await execFileAsync('tar', ['-xzf', path.join(backupRoot, archiveName), '-C', restoreRoot]);

    assert.equal(
      await readFile(path.join(restoreRoot, 'data', 'posts.json'), 'utf8'),
      '[{"id":"post-1"}]'
    );
    assert.equal(
      await readFile(path.join(restoreRoot, 'uploads', 'cover.txt'), 'utf8'),
      'uploaded asset'
    );
  } finally {
    await rm(testRoot, { recursive: true, force: true });
  }
});
