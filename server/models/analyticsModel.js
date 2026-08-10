import { mkdir, readFile } from 'fs/promises';
import { analyticsFilePath, dataDir } from '../config/paths.js';
import { writeJsonAtomic } from '../utils/fsUtils.js';

export const ANALYTICS_VERSION = 1;
export const ANALYTICS_RETENTION_DAYS = 90;

export const createEmptyAnalytics = () => ({
    version: ANALYTICS_VERSION,
    totalPageViews: 0,
    visitors: {},
    days: {},
    updatedAt: null
});

const normalizeNonNegativeInteger = (value) => {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed >= 0 ? parsed : 0;
};

const normalizeDateKey = (value) => {
    const normalized = String(value ?? '').trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : '';
};

export const normalizeAnalytics = (value) => {
    const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    const visitorsSource = source.visitors && typeof source.visitors === 'object' && !Array.isArray(source.visitors)
        ? source.visitors
        : {};
    const daysSource = source.days && typeof source.days === 'object' && !Array.isArray(source.days)
        ? source.days
        : {};

    const visitors = Object.fromEntries(
        Object.entries(visitorsSource)
            .map(([visitorHash, visitor]) => {
                const normalizedHash = String(visitorHash ?? '').trim();
                const firstSeen = normalizeDateKey(visitor?.firstSeen);
                const lastSeen = normalizeDateKey(visitor?.lastSeen);
                if (!normalizedHash || !firstSeen || !lastSeen) return null;
                return [normalizedHash, { firstSeen, lastSeen }];
            })
            .filter(Boolean)
    );

    const days = Object.fromEntries(
        Object.entries(daysSource)
            .map(([date, day]) => {
                const normalizedDate = normalizeDateKey(date);
                if (!normalizedDate) return null;
                return [normalizedDate, {
                    visitors: normalizeNonNegativeInteger(day?.visitors),
                    pageViews: normalizeNonNegativeInteger(day?.pageViews)
                }];
            })
            .filter(Boolean)
    );

    return {
        version: ANALYTICS_VERSION,
        totalPageViews: normalizeNonNegativeInteger(source.totalPageViews),
        visitors,
        days,
        updatedAt: typeof source.updatedAt === 'string' && source.updatedAt ? source.updatedAt : null
    };
};

export async function readAnalytics() {
    try {
        const raw = await readFile(analyticsFilePath, 'utf8');
        return normalizeAnalytics(JSON.parse(raw));
    } catch (error) {
        if (error?.code === 'ENOENT') return createEmptyAnalytics();
        throw error;
    }
}

export async function writeAnalytics(analytics) {
    await mkdir(dataDir, { recursive: true });
    const normalized = normalizeAnalytics(analytics);
    await writeJsonAtomic(analyticsFilePath, normalized);
    return normalized;
}

export async function ensureAnalyticsFile() {
    const current = await readAnalytics();
    await writeAnalytics(current);
}
