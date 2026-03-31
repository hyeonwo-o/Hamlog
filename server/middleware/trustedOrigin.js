import { getRequestOrigin, isTrustedOrigin } from '../config/security.js';

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function requireTrustedOrigin(req, res, next) {
    if (!MUTATING_METHODS.has(req.method)) {
        return next();
    }

    const requestOrigin = getRequestOrigin(req);
    if (!requestOrigin || !isTrustedOrigin(req, requestOrigin)) {
        return res.status(403).json({ message: '유효하지 않은 요청 출처입니다.' });
    }

    next();
}
