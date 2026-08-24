import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile, spawn } from 'node:child_process';
import { chmod, mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const backupScriptPath = new URL('../../scripts/backup-data.sh', import.meta.url);

const waitForFileText = async (filePath, pattern, timeoutMs = 5_000) => {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const content = await readFile(filePath, 'utf8').catch(() => '');
    if (pattern.test(content)) return content;
    await delay(25);
  }

  throw new Error(`Timed out waiting for ${pattern} in ${filePath}`);
};

const waitForChildExit = (child, timeoutMs = 5_000) => new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error('Timed out waiting for backup process to exit')), timeoutMs);
  child.once('close', (code, signal) => {
    clearTimeout(timer);
    resolve({ code, signal });
  });
});

test('backup script archives data and uploads with a verifiable checksum', async () => {
  const testRoot = await mkdtemp(path.join(tmpdir(), 'hamlog-backup-test-'));
  const sourceRoot = path.join(testRoot, 'source');
  const backupRoot = path.join(testRoot, 'backups');
  const restoreRoot = path.join(testRoot, 'restore');

  try {
    await mkdir(path.join(sourceRoot, 'data'), { recursive: true });
    await mkdir(path.join(sourceRoot, 'data', 'posts'), { recursive: true });
    await mkdir(path.join(sourceRoot, 'uploads'), { recursive: true });
    await mkdir(restoreRoot, { recursive: true });
    await writeFile(path.join(sourceRoot, 'data', 'posts.json'), '[]');
    await writeFile(path.join(sourceRoot, 'uploads', 'cover.txt'), 'uploaded asset');

    await execFileAsync('bash', [backupScriptPath.pathname, sourceRoot, backupRoot], {
      env: {
        ...process.env,
        BACKUP_RETENTION_DAYS: '14',
        GITHUB_SHA: 'abcdef0123456789',
        HAMLOG_CONTAINER_NAME: '',
        HAMLOG_VERIFY_DATA: 'true'
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
      '[]'
    );
    assert.equal(
      await readFile(path.join(restoreRoot, 'uploads', 'cover.txt'), 'utf8'),
      'uploaded asset'
    );
  } finally {
    await rm(testRoot, { recursive: true, force: true });
  }
});

test('backup script fails closed when no data exists', async () => {
  const testRoot = await mkdtemp(path.join(tmpdir(), 'hamlog-empty-backup-test-'));
  const sourceRoot = path.join(testRoot, 'source');
  const backupRoot = path.join(testRoot, 'backups');

  try {
    await mkdir(sourceRoot, { recursive: true });

    await assert.rejects(
      execFileAsync('bash', [backupScriptPath.pathname, sourceRoot, backupRoot], {
        env: {
          ...process.env,
          HAMLOG_CONTAINER_NAME: '',
          HAMLOG_ALLOW_EMPTY_BACKUP: 'false'
        }
      }),
      /No existing HamLog data found/
    );
  } finally {
    await rm(testRoot, { recursive: true, force: true });
  }
});

test('backup script can explicitly create a verified empty bootstrap archive', async () => {
  const testRoot = await mkdtemp(path.join(tmpdir(), 'hamlog-empty-backup-allow-test-'));
  const sourceRoot = path.join(testRoot, 'source');
  const backupRoot = path.join(testRoot, 'backups');

  try {
    await mkdir(sourceRoot, { recursive: true });

    await execFileAsync('bash', [backupScriptPath.pathname, sourceRoot, backupRoot], {
      env: {
        ...process.env,
        GITHUB_SHA: '1234567890abcdef',
        HAMLOG_CONTAINER_NAME: '',
        HAMLOG_ALLOW_EMPTY_BACKUP: 'true',
        HAMLOG_VERIFY_DATA: 'true'
      }
    });

    const files = await readdir(backupRoot);
    const archiveName = files.find(file => file.endsWith('.tar.gz'));
    assert.ok(archiveName);

    const { stdout: listing } = await execFileAsync('tar', ['-tzf', path.join(backupRoot, archiveName)]);
    assert.match(listing, /^data\/$/m);
    assert.match(listing, /^uploads\/$/m);
  } finally {
    await rm(testRoot, { recursive: true, force: true });
  }
});

test('backup unpauses after snapshot creation and verifies the immutable snapshot', async () => {
  const testRoot = await mkdtemp(path.join(tmpdir(), 'hamlog-snapshot-verification-test-'));
  const sourceRoot = path.join(testRoot, 'source');
  const backupRoot = path.join(testRoot, 'backups');
  const restoreRoot = path.join(testRoot, 'restore');
  const fakeBin = path.join(testRoot, 'bin');
  const operationLog = path.join(testRoot, 'operations.log');
  const fakeDocker = path.join(fakeBin, 'docker');
  const fakeNode = path.join(fakeBin, 'node');
  const postsFile = path.join(sourceRoot, 'data', 'posts.json');

  try {
    await mkdir(path.join(sourceRoot, 'data', 'posts'), { recursive: true });
    await mkdir(path.join(sourceRoot, 'uploads'), { recursive: true });
    await mkdir(restoreRoot, { recursive: true });
    await mkdir(fakeBin, { recursive: true });
    await writeFile(postsFile, '[]');
    await writeFile(path.join(sourceRoot, 'uploads', 'cover.txt'), 'snapshot upload');
    await writeFile(fakeDocker, `#!/usr/bin/env bash
printf 'docker %s\\n' "$*" >> "$OPERATION_LOG"
if [ "$1" = "inspect" ]; then
  case "$*" in
    *State.Running*) printf '%s\\n' 'true' ;;
    *State.Paused*) printf '%s\\n' 'false' ;;
  esac
elif [ "$1" = "unpause" ]; then
  printf '{' > "$SOURCE_POSTS_FILE"
fi
`, 'utf8');
    await writeFile(fakeNode, `#!/usr/bin/env bash
printf '%s\\n' 'verify snapshot' >> "$OPERATION_LOG"
exec "$REAL_NODE" "$@"
`, 'utf8');
    await chmod(fakeDocker, 0o755);
    await chmod(fakeNode, 0o755);

    await execFileAsync('bash', [backupScriptPath.pathname, sourceRoot, backupRoot], {
      env: {
        ...process.env,
        PATH: `${fakeBin}:${process.env.PATH}`,
        OPERATION_LOG: operationLog,
        SOURCE_POSTS_FILE: postsFile,
        REAL_NODE: process.execPath,
        HAMLOG_CONTAINER_NAME: 'hamlog-test',
        HAMLOG_VERIFY_DATA: 'true'
      }
    });

    const operations = await readFile(operationLog, 'utf8');
    const pauseIndex = operations.indexOf('docker pause hamlog-test');
    const unpauseIndex = operations.indexOf('docker unpause hamlog-test');
    const verifyIndex = operations.indexOf('verify snapshot');
    assert.ok(pauseIndex >= 0);
    assert.ok(unpauseIndex > pauseIndex);
    assert.ok(verifyIndex > unpauseIndex);
    assert.equal(await readFile(postsFile, 'utf8'), '{');

    const files = await readdir(backupRoot);
    const archiveName = files.find(file => file.endsWith('.tar.gz'));
    assert.ok(archiveName);
    assert.equal(files.some(file => file.startsWith('.hamlog-verify.')), false);
    await execFileAsync('tar', ['-xzf', path.join(backupRoot, archiveName), '-C', restoreRoot]);
    assert.equal(await readFile(path.join(restoreRoot, 'data', 'posts.json'), 'utf8'), '[]');
  } finally {
    await rm(testRoot, { recursive: true, force: true });
  }
});

test('backup unpauses and removes partial artifacts when snapshot creation fails', async () => {
  const testRoot = await mkdtemp(path.join(tmpdir(), 'hamlog-snapshot-failure-test-'));
  const sourceRoot = path.join(testRoot, 'source');
  const backupRoot = path.join(testRoot, 'backups');
  const fakeBin = path.join(testRoot, 'bin');
  const dockerLog = path.join(testRoot, 'docker.log');
  const fakeDocker = path.join(fakeBin, 'docker');
  const fakeTar = path.join(fakeBin, 'tar');

  try {
    await mkdir(path.join(sourceRoot, 'data'), { recursive: true });
    await mkdir(path.join(sourceRoot, 'uploads'), { recursive: true });
    await mkdir(fakeBin, { recursive: true });
    await writeFile(path.join(sourceRoot, 'data', 'posts.json'), '[]');
    await writeFile(fakeDocker, `#!/usr/bin/env bash
printf '%s\\n' "$*" >> "$DOCKER_ARGS_LOG"
if [ "$1" = "inspect" ]; then
  case "$*" in
    *State.Running*) printf '%s\\n' 'true' ;;
    *State.Paused*) printf '%s\\n' 'false' ;;
  esac
fi
`, 'utf8');
    await writeFile(fakeTar, `#!/usr/bin/env bash
exit 42
`, 'utf8');
    await chmod(fakeDocker, 0o755);
    await chmod(fakeTar, 0o755);

    await assert.rejects(execFileAsync('bash', [backupScriptPath.pathname, sourceRoot, backupRoot], {
      env: {
        ...process.env,
        PATH: `${fakeBin}:${process.env.PATH}`,
        DOCKER_ARGS_LOG: dockerLog,
        HAMLOG_CONTAINER_NAME: 'hamlog-test',
        HAMLOG_VERIFY_DATA: 'false'
      }
    }));

    const calls = await readFile(dockerLog, 'utf8');
    assert.match(calls, /pause hamlog-test/);
    assert.match(calls, /unpause hamlog-test/);
    assert.deepEqual(await readdir(backupRoot), []);
  } finally {
    await rm(testRoot, { recursive: true, force: true });
  }
});

test('backup unpauses on TERM, HUP, and INT while snapshot creation is active', async () => {
  for (const signal of ['SIGTERM', 'SIGHUP', 'SIGINT']) {
    const testRoot = await mkdtemp(path.join(tmpdir(), `hamlog-${signal.toLowerCase()}-backup-test-`));
    const sourceRoot = path.join(testRoot, 'source');
    const backupRoot = path.join(testRoot, 'backups');
    const fakeBin = path.join(testRoot, 'bin');
    const operationLog = path.join(testRoot, 'operations.log');
    const fakeDocker = path.join(fakeBin, 'docker');
    const fakeTar = path.join(fakeBin, 'tar');
    let child;
    let childExited = false;

    try {
      await mkdir(path.join(sourceRoot, 'data'), { recursive: true });
      await mkdir(path.join(sourceRoot, 'uploads'), { recursive: true });
      await mkdir(fakeBin, { recursive: true });
      await writeFile(path.join(sourceRoot, 'data', 'posts.json'), '[]');
      await writeFile(fakeDocker, `#!/usr/bin/env bash
printf 'docker %s\\n' "$*" >> "$OPERATION_LOG"
if [ "$1" = "inspect" ]; then
  case "$*" in
    *State.Running*) printf '%s\\n' 'true' ;;
    *State.Paused*) printf '%s\\n' 'false' ;;
  esac
elif [ "$1" = "unpause" ]; then
  sleep 0.25
  printf '%s\\n' 'docker unpause complete' >> "$OPERATION_LOG"
fi
`, 'utf8');
      await writeFile(fakeTar, `#!/usr/bin/env bash
printf '%s\\n' 'tar snapshot started' >> "$OPERATION_LOG"
exec sleep 30
`, 'utf8');
      await chmod(fakeDocker, 0o755);
      await chmod(fakeTar, 0o755);

      child = spawn('bash', [backupScriptPath.pathname, sourceRoot, backupRoot], {
        detached: true,
        stdio: 'ignore',
        env: {
          ...process.env,
          PATH: `${fakeBin}:${process.env.PATH}`,
          OPERATION_LOG: operationLog,
          HAMLOG_CONTAINER_NAME: 'hamlog-test',
          HAMLOG_VERIFY_DATA: 'false'
        }
      });
      const childExit = waitForChildExit(child).then(result => {
        childExited = true;
        return result;
      });

      await waitForFileText(operationLog, /docker pause hamlog-test[\s\S]*tar snapshot started/);
      process.kill(child.pid, signal);
      await waitForFileText(operationLog, /docker unpause hamlog-test/);
      process.kill(child.pid, signal);
      const result = await childExit;
      assert.ok(result.code !== 0 || result.signal, `${signal} should not report success`);

      const operations = await readFile(operationLog, 'utf8');
      assert.match(operations, /docker unpause hamlog-test/);
      assert.match(operations, /docker unpause complete/);
      assert.deepEqual(await readdir(backupRoot), []);
    } finally {
      if (child && !childExited) {
        try {
          process.kill(-child.pid, 'SIGKILL');
        } catch {
          // Best-effort cleanup: the detached process group may already be gone.
        }
      }
      await rm(testRoot, { recursive: true, force: true });
    }
  }
});

test('backup verification follows a legacy root container runtime user', async () => {
  const testRoot = await mkdtemp(path.join(tmpdir(), 'hamlog-root-backup-test-'));
  const sourceRoot = path.join(testRoot, 'source');
  const backupRoot = path.join(testRoot, 'backups');
  const fakeBin = path.join(testRoot, 'bin');
  const dockerLog = path.join(testRoot, 'docker.log');
  const fakeDocker = path.join(fakeBin, 'docker');

  try {
    await mkdir(path.join(sourceRoot, 'data', 'posts'), { recursive: true });
    await mkdir(path.join(sourceRoot, 'uploads'), { recursive: true });
    await mkdir(fakeBin, { recursive: true });
    await writeFile(path.join(sourceRoot, 'data', 'posts.json'), '[]');
    await writeFile(fakeDocker, `#!/usr/bin/env bash
printf '%s\\n' "$*" >> "$DOCKER_ARGS_LOG"
if [ "$1" = "inspect" ]; then
  case "$*" in
    *State.Running*) printf '%s\\n' 'true' ;;
    *Config.Image*) printf '%s\\n' 'legacy-root-image' ;;
    *Config.User*) : ;;
  esac
fi
`, 'utf8');
    await chmod(fakeDocker, 0o755);

    await execFileAsync('bash', [backupScriptPath.pathname, sourceRoot, backupRoot], {
      env: {
        ...process.env,
        PATH: `${fakeBin}:${process.env.PATH}`,
        DOCKER_ARGS_LOG: dockerLog,
        GITHUB_SHA: 'fedcba9876543210',
        HAMLOG_CONTAINER_NAME: 'legacy-hamlog',
        HAMLOG_VERIFY_DATA: 'true'
      }
    });

    const calls = await readFile(dockerLog, 'utf8');
    assert.match(calls, /run .*--user root .*legacy-root-image/);
    assert.match(calls, /\.hamlog-verify\.[^ ]*\/data:\/app\/server\/data:ro/);
    assert.doesNotMatch(
      calls.split('\n').find(line => line.startsWith('run ')) ?? '',
      new RegExp(`${sourceRoot.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/data`)
    );
  } finally {
    await rm(testRoot, { recursive: true, force: true });
  }
});
