import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const projectRoot = fileURLToPath(new URL('../..', import.meta.url));
const verifierPath = path.join(projectRoot, 'scripts', 'verify-data.js');

test('data verification rejects missing or unknown post statuses', async () => {
  const testRoot = await mkdtemp(path.join(tmpdir(), 'hamlog-status-verification-'));
  const postsDir = path.join(testRoot, 'posts');
  const post = {
    id: 'invalid-status-post',
    slug: 'invalid-status-post',
    title: 'Invalid status post',
    status: 'publshed'
  };

  try {
    await mkdir(postsDir, { recursive: true });
    await writeFile(path.join(testRoot, 'posts.json'), JSON.stringify([post]));
    await writeFile(path.join(postsDir, 'invalid-status-post.json'), JSON.stringify(post));

    await assert.rejects(
      execFileAsync(process.execPath, [verifierPath], {
        cwd: projectRoot,
        env: {
          ...process.env,
          HAMLOG_DATA_DIR: testRoot,
          HAMLOG_REQUIRE_DATA: 'true'
        }
      }),
      (error) => {
        assert.match(String(error.stderr), /유효하지 않은 글 상태: invalid-status-post/);
        return true;
      }
    );
  } finally {
    await rm(testRoot, { recursive: true, force: true });
  }
});
