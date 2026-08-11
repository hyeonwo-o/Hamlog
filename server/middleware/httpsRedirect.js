const HTTPS_REDIRECT_STATUS = 308;

const getForwardedProtocol = (req) => {
  const value = req.get('x-forwarded-proto');
  return String(value ?? '').split(',')[0].trim().toLowerCase();
};

const getRequestHostname = (req) => {
  const host = String(req.get('host') ?? '').trim();
  if (!host) return '';

  try {
    return new URL(`http://${host}`).hostname.toLowerCase();
  } catch {
    return '';
  }
};

const resolveHttpsOrigin = (value) => {
  try {
    const parsed = new URL(String(value ?? '').trim());
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    parsed.protocol = 'https:';
    return parsed.origin;
  } catch {
    return null;
  }
};

export const createHttpsRedirectMiddleware = ({
  enabled = process.env.NODE_ENV === 'production',
  resolveCanonicalBaseUrl
} = {}) => async (req, res, next) => {
  if (!enabled || req.path === '/api/health') return next();

  // Only redirect requests that a reverse proxy explicitly identified as HTTP.
  // This preserves direct localhost/Tailscale HTTP access and avoids proxy loops.
  if (getForwardedProtocol(req) !== 'http') return next();

  try {
    const canonicalBaseUrl = await resolveCanonicalBaseUrl?.();
    const httpsOrigin = resolveHttpsOrigin(canonicalBaseUrl);
    if (!httpsOrigin) return next();

    const canonicalHostname = new URL(httpsOrigin).hostname.toLowerCase();
    if (getRequestHostname(req) !== canonicalHostname) return next();

    const requestTarget = req.originalUrl.startsWith('/')
      ? req.originalUrl
      : `/${req.originalUrl}`;
    return res.redirect(HTTPS_REDIRECT_STATUS, `${httpsOrigin}${requestTarget}`);
  } catch (error) {
    return next(error);
  }
};
