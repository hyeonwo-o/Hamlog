const DEV_CORS_ORIGINS = ['http://localhost:5173', 'http://127.0.0.1:5173'];

export const normalizeOrigin = (origin) => origin.trim().replace(/\/+$/, '');

const parseCorsOrigins = () => {
    const raw = process.env.CORS_ORIGINS ?? '';
    const parsed = raw
        .split(',')
        .map(item => item.trim())
        .filter(Boolean)
        .map(normalizeOrigin);

    if (parsed.length > 0) {
        return new Set(parsed);
    }

    if (process.env.NODE_ENV === 'production') {
        return new Set();
    }

    return new Set(DEV_CORS_ORIGINS);
};

export const resolveTrustProxy = () => {
    const raw = String(process.env.TRUST_PROXY ?? '').trim();
    if (!raw || ['0', 'false', 'off', 'no'].includes(raw.toLowerCase())) return false;
    if (raw.toLowerCase() === 'true') return 1;

    const hopCount = Number.parseInt(raw, 10);
    if (/^\d+$/.test(raw) && Number.isFinite(hopCount) && hopCount > 0) {
        return hopCount;
    }

    // Express accepts named ranges (for example "loopback") and arrays of IP/subnet entries.
    const entries = raw.split(',').map(item => item.trim()).filter(Boolean);
    return entries.length === 1 ? entries[0] : entries;
};

const isSameOrigin = (requestOrigin, req) => {
    try {
        const parsedOrigin = new URL(requestOrigin);
        const requestHost = req.get('host') || '';
        const requestProto = req.protocol || 'http';

        if (!requestHost) {
            return false;
        }

        return (
            parsedOrigin.host === requestHost
            && parsedOrigin.protocol === `${requestProto}:`
        );
    } catch {
        return false;
    }
};

const getAllowedCorsOrigins = () => parseCorsOrigins();

export const getRequestOrigin = (req) => {
    const origin = req.get('origin');
    if (origin) {
        return normalizeOrigin(origin);
    }

    const referer = req.get('referer');
    if (!referer) {
        return '';
    }

    try {
        return normalizeOrigin(new URL(referer).origin);
    } catch {
        return '';
    }
};

export const isTrustedOrigin = (req, requestOrigin) => {
    if (!requestOrigin) {
        return false;
    }

    const normalizedOrigin = normalizeOrigin(requestOrigin);
    return (
        getAllowedCorsOrigins().has(normalizedOrigin)
        || isSameOrigin(normalizedOrigin, req)
    );
};

export const resolveCorsOptions = (req) => {
    const requestOrigin = req.get('origin');

    if (!requestOrigin) {
        return { origin: true, credentials: true };
    }

    return {
        origin: isTrustedOrigin(req, requestOrigin),
        credentials: true
    };
};
