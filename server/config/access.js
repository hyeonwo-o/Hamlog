export const resolveAuthMode = (env = process.env) => {
    const mode = env.AUTH_MODE?.trim() || 'password';
    if (!['password', 'cloudflare-access'].includes(mode)) {
        throw new Error('AUTH_MODE must be password or cloudflare-access.');
    }
    return mode;
};

export const resolveAccessConfig = (env = process.env) => {
    if (resolveAuthMode(env) !== 'cloudflare-access') return null;
    const team = env.CLOUDFLARE_ACCESS_TEAM_DOMAIN?.trim() || '';
    // Only a configured Cloudflare team can supply signing keys. Never use a JWT's
    // unverified issuer, jku, or x5u to choose a network destination.
    if (!/^(?:https:\/\/)?[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.cloudflareaccess\.com\/?$/.test(team)) {
        throw new Error('CLOUDFLARE_ACCESS_TEAM_DOMAIN must be a cloudflareaccess.com team hostname.');
    }
    const issuer = `https://${team.replace(/^https:\/\//, '').replace(/\/$/, '')}`;
    const audience = env.CLOUDFLARE_ACCESS_AUD?.trim() || '';
    if (!/^[a-f0-9]{64}$/.test(audience)) {
        throw new Error('CLOUDFLARE_ACCESS_AUD must be the 64-character application audience.');
    }
    return { issuer, audience };
};
