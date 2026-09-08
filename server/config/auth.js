import { resolveAuthMode, resolveAccessConfig } from './access.js';

export const AUTH_MODE = resolveAuthMode();
export const ACCESS_CONFIG = resolveAccessConfig();

const DEFAULT_DEV_JWT_SECRET = 'dev-only-secret-do-not-use-in-production';
const DEFAULT_DEV_ADMIN_PASSWORD = 'admin1234';
const isProduction = process.env.NODE_ENV === 'production';

const jwtSecret = process.env.JWT_SECRET?.trim();
const adminPassword = process.env.ADMIN_PASSWORD?.trim();

if (!jwtSecret) {
    if (isProduction) {
        console.error('CRITICAL: JWT_SECRET environment variable is not defined!');
        process.exit(1);
    } else {
        console.warn('WARNING: JWT_SECRET is not defined. Using a temporary secret for development.');
    }
}

if (AUTH_MODE === 'password' && !adminPassword) {
    if (isProduction) {
        console.error('CRITICAL: ADMIN_PASSWORD environment variable is not defined!');
        process.exit(1);
    } else {
        console.warn('WARNING: ADMIN_PASSWORD is not defined. Using a temporary password for development.');
    }
}

export const JWT_SECRET = jwtSecret || DEFAULT_DEV_JWT_SECRET;
export const ADMIN_PASSWORD = AUTH_MODE === 'password' ? adminPassword || DEFAULT_DEV_ADMIN_PASSWORD : '';
