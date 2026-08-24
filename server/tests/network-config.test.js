import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { promisify } from 'node:util';

import {
  assertExternalDevAccessIsSafe,
  isLoopbackHost,
  resolveServerNetworkConfig
} from '../config/network.js';

const execFileAsync = promisify(execFile);
const projectRoot = fileURLToPath(new URL('../..', import.meta.url));
const viteBin = path.join(projectRoot, 'node_modules', 'vite', 'bin', 'vite.js');

test('development server listens on loopback by default', () => {
  assert.deepEqual(
    resolveServerNetworkConfig({ NODE_ENV: 'development' }),
    { host: '127.0.0.1', port: 4000 }
  );
  assert.equal(isLoopbackHost('[::1]'), true);
});

test('production server preserves the container-friendly bind default', () => {
  assert.deepEqual(
    resolveServerNetworkConfig({ NODE_ENV: 'production', PORT: '4100' }),
    { host: '0.0.0.0', port: 4100 }
  );
});

test('external development bind requires an explicit opt-in', () => {
  assert.throws(
    () => resolveServerNetworkConfig({
      NODE_ENV: 'development',
      HOST: '100.64.0.10',
      JWT_SECRET: 'unique-jwt-secret',
      ADMIN_PASSWORD: 'unique-admin-password'
    }),
    /HAMLOG_ALLOW_EXTERNAL_DEV=true/
  );
});

test('external development bind rejects missing and default credentials', () => {
  assert.throws(
    () => assertExternalDevAccessIsSafe('0.0.0.0', {
      HAMLOG_ALLOW_EXTERNAL_DEV: 'true',
      ADMIN_PASSWORD: 'unique-admin-password'
    }),
    /non-default JWT_SECRET/
  );

  assert.throws(
    () => assertExternalDevAccessIsSafe('0.0.0.0', {
      HAMLOG_ALLOW_EXTERNAL_DEV: 'true',
      JWT_SECRET: 'unique-jwt-secret',
      ADMIN_PASSWORD: 'admin1234'
    }),
    /non-default ADMIN_PASSWORD/
  );
});

test('external development bind accepts deliberate safe configuration', () => {
  assert.deepEqual(
    resolveServerNetworkConfig({
      NODE_ENV: 'development',
      HOST: '100.64.0.10',
      PORT: '4300',
      HAMLOG_ALLOW_EXTERNAL_DEV: 'true',
      JWT_SECRET: 'unique-jwt-secret',
      ADMIN_PASSWORD: 'unique-admin-password'
    }),
    { host: '100.64.0.10', port: 4300 }
  );
});

test('Vite CLI host override cannot bypass external development guard', async () => {
  await assert.rejects(
    execFileAsync(process.execPath, [viteBin, '--host', '0.0.0.0'], {
      cwd: projectRoot,
      env: {
        ...process.env,
        HAMLOG_ALLOW_EXTERNAL_DEV: '',
        VITE_DEV_HOST: ''
      },
      timeout: 10_000
    }),
    (error) => {
      assert.match(String(error.stderr), /External development access is disabled/);
      return true;
    }
  );
});
