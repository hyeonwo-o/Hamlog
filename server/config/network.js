const LOOPBACK_HOSTS = new Set(['127.0.0.1', '::1', 'localhost']);
const DEFAULT_DEV_JWT_SECRET = 'dev-only-secret-do-not-use-in-production';
const DEFAULT_DEV_ADMIN_PASSWORD = 'admin1234';

const normalizeHost = (host) => String(host ?? '')
  .trim()
  .toLowerCase()
  .replace(/^\[|\]$/g, '');

export const isLoopbackHost = (host) => LOOPBACK_HOSTS.has(normalizeHost(host));

export const assertExternalDevAccessIsSafe = (host, env = process.env) => {
  if (isLoopbackHost(host)) {
    return;
  }

  if (env.HAMLOG_ALLOW_EXTERNAL_DEV !== 'true') {
    throw new Error(
      'External development access is disabled. Set HAMLOG_ALLOW_EXTERNAL_DEV=true only when it is intentional.'
    );
  }

  const jwtSecret = env.JWT_SECRET?.trim();
  const adminPassword = env.ADMIN_PASSWORD?.trim();

  if (!jwtSecret || jwtSecret === DEFAULT_DEV_JWT_SECRET) {
    throw new Error('External development access requires a non-default JWT_SECRET.');
  }

  if (!adminPassword || adminPassword === DEFAULT_DEV_ADMIN_PASSWORD) {
    throw new Error('External development access requires a non-default ADMIN_PASSWORD.');
  }
};

export const resolveServerNetworkConfig = (env = process.env) => {
  const isProduction = env.NODE_ENV === 'production';
  const host = env.HOST?.trim() || (isProduction ? '0.0.0.0' : '127.0.0.1');
  const port = env.PORT?.trim() || '4000';

  if (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535) {
    throw new Error(`Invalid PORT: ${port}`);
  }

  if (!isProduction) {
    assertExternalDevAccessIsSafe(host, env);
  }

  return { host, port: Number(port) };
};
