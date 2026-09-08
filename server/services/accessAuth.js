import { createRemoteJWKSet, jwtVerify } from 'jose';
import { ACCESS_CONFIG } from '../config/auth.js';

const keySet = ACCESS_CONFIG ? createRemoteJWKSet(
    new URL(`${ACCESS_CONFIG.issuer}/cdn-cgi/access/certs`),
    { timeoutDuration: 5000, cooldownDuration: 30000, cacheMaxAge: 10 * 60 * 1000 }
) : null;

export async function verifyAccessToken(token) {
    if (!keySet || typeof token !== 'string' || !token || token.length > 16384) {
        throw new Error('Missing or invalid Access token.');
    }
    const { payload } = await jwtVerify(token, keySet, {
        issuer: ACCESS_CONFIG.issuer,
        audience: ACCESS_CONFIG.audience,
        algorithms: ['RS256'],
        requiredClaims: ['exp', 'iat', 'sub', 'email', 'type']
    });
    // This application is for human administrators, not Access service tokens.
    if (payload.type !== 'app' || typeof payload.sub !== 'string' || !payload.sub
        || typeof payload.email !== 'string' || !payload.email.includes('@')) {
        throw new Error('An Access user identity is required.');
    }
    return { role: 'admin', email: payload.email, sub: payload.sub };
}
