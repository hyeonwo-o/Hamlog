const VALID_SAME_SITE = new Set(['strict', 'lax', 'none']);

const normalizeSameSite = (value) => {
    const normalized = String(value ?? '').trim().toLowerCase();
    return VALID_SAME_SITE.has(normalized) ? normalized : '';
};

export const resolveCookieSameSite = () => {
    const configured = normalizeSameSite(process.env.COOKIE_SAME_SITE);
    if (configured) return configured;
    return process.env.CORS_ORIGINS?.trim() ? 'none' : 'lax';
};

const isHttpsRequest = (req) => req.secure || req.protocol === 'https';

export const resolveCookieSecure = (req, sameSite) => {
    const configured = String(process.env.COOKIE_SECURE ?? '').trim().toLowerCase();
    if (configured === 'true') return true;
    if (configured === 'false') return false;
    if (sameSite === 'none') return true;
    return isHttpsRequest(req);
};

export const buildCookieOptions = (req, maxAge) => {
    const sameSite = resolveCookieSameSite();
    return {
        httpOnly: true,
        secure: resolveCookieSecure(req, sameSite),
        sameSite,
        path: '/',
        maxAge
    };
};

export const buildClearCookieOptions = (req) => {
    const { httpOnly, secure, sameSite, path } = buildCookieOptions(req);
    return { httpOnly, secure, sameSite, path };
};
