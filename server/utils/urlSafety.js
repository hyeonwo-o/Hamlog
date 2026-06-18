import { lookup } from 'dns/promises';
import { isIP } from 'net';

function createUrlSafetyError(code, message) {
    const error = new Error(message);
    error.code = code;
    return error;
}

function isPrivateIpv4(address) {
    const octets = address.split('.').map(item => Number.parseInt(item, 10));
    if (octets.length !== 4 || octets.some(item => Number.isNaN(item) || item < 0 || item > 255)) {
        return true;
    }

    const [a, b] = octets;

    if (a === 10) return true; // 10.0.0.0/8
    if (a === 127) return true; // 127.0.0.0/8
    if (a === 0) return true; // 0.0.0.0/8
    if (a === 169 && b === 254) return true; // 169.254.0.0/16
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
    if (a === 192 && b === 168) return true; // 192.168.0.0/16
    if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10
    if (a >= 224) return true; // multicast/reserved

    return false;
}

function isPrivateIpv6(address) {
    const normalized = address.toLowerCase();

    if (normalized === '::1' || normalized === '::') return true;

    const mappedV4 = normalized.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mappedV4 && mappedV4[1]) {
        return isPrivateIpv4(mappedV4[1]);
    }

    if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true; // fc00::/7
    if (
        normalized.startsWith('fe8')
        || normalized.startsWith('fe9')
        || normalized.startsWith('fea')
        || normalized.startsWith('feb')
    ) {
        return true; // fe80::/10
    }

    return false;
}

function isBlockedIp(address) {
    const family = isIP(address);
    if (family === 4) return isPrivateIpv4(address);
    if (family === 6) return isPrivateIpv6(address);
    return true;
}

function normalizeHostname(hostname) {
    return hostname.trim().replace(/\.$/, '').toLowerCase();
}

function isBlockedHostname(hostname) {
    if (!hostname) return true;
    if (hostname === 'localhost') return true;
    if (hostname.endsWith('.localhost')) return true;
    if (hostname.endsWith('.local')) return true;
    if (hostname.endsWith('.internal')) return true;
    if (hostname.endsWith('.lan')) return true;
    if (/^\d+$/.test(hostname)) return true; // avoid ambiguous integer host notation
    return false;
}

async function resolvePublicAddress(hostname, family = 0) {
    if (isIP(hostname)) {
        if (isBlockedIp(hostname)) {
            throw createUrlSafetyError('blocked_url', 'Blocked IP address');
        }

        return { address: hostname, family: isIP(hostname) };
    }

    let resolved;
    try {
        resolved = await lookup(hostname, {
            all: true,
            verbatim: true,
            family: family === 4 || family === 6 ? family : 0
        });
    } catch {
        throw createUrlSafetyError('unresolvable_host', 'Host could not be resolved');
    }

    if (!Array.isArray(resolved) || resolved.length === 0) {
        throw createUrlSafetyError('unresolvable_host', 'Host could not be resolved');
    }

    if (resolved.some(entry => isBlockedIp(entry.address))) {
        throw createUrlSafetyError('blocked_url', 'Blocked destination address');
    }

    return resolved[0];
}

export async function assertSafePreviewUrl(rawUrl) {
    let parsed;
    try {
        parsed = new URL(String(rawUrl));
    } catch {
        throw createUrlSafetyError('invalid_url', 'Invalid URL');
    }

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        throw createUrlSafetyError('invalid_protocol', 'Only HTTP(S) URLs are allowed');
    }

    const hostname = normalizeHostname(parsed.hostname);
    if (isBlockedHostname(hostname)) {
        throw createUrlSafetyError('blocked_url', 'Blocked hostname');
    }

    if (isIP(hostname) && isBlockedIp(hostname)) {
        throw createUrlSafetyError('blocked_url', 'Blocked IP address');
    }

    await resolvePublicAddress(hostname);

    return parsed.toString();
}

export function createSafeLookup() {
    return (hostname, options, callback) => {
        const family = typeof options === 'number' ? options : options?.family;

        resolvePublicAddress(normalizeHostname(String(hostname)), family)
            .then(({ address, family: resolvedFamily }) => {
                callback(null, address, resolvedFamily);
            })
            .catch(error => {
                callback(error);
            });
    };
}
