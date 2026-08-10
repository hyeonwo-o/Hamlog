import { createHmac } from 'crypto';
import { JWT_SECRET } from '../config/auth.js';
import {
    ANALYTICS_RETENTION_DAYS,
    readAnalytics,
    writeAnalytics
} from '../models/analyticsModel.js';
import { runWithDataStoreLock } from '../utils/storeLock.js';

const ACTIVE_WINDOW_MS = 90 * 1000;
const VISIT_EVENT_TTL_MS = 10 * 60 * 1000;
const MAX_RECENT_VISIT_EVENTS = 10_000;
const RECENT_DAYS = 7;
const DEFAULT_TIME_ZONE = 'Asia/Seoul';
const visitorPresence = new Map();
const recentVisitEvents = new Map();

const resolveTimeZone = () => {
    const configured = String(process.env.ANALYTICS_TIME_ZONE ?? '').trim() || DEFAULT_TIME_ZONE;
    try {
        new Intl.DateTimeFormat('en-CA', { timeZone: configured }).format(new Date());
        return configured;
    } catch {
        return DEFAULT_TIME_ZONE;
    }
};

export const ANALYTICS_TIME_ZONE = resolveTimeZone();

export const toAnalyticsDateKey = (date = new Date()) => (
    new Intl.DateTimeFormat('en-CA', {
        timeZone: ANALYTICS_TIME_ZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).format(date)
);

const shiftDateKey = (dateKey, days) => {
    const date = new Date(`${dateKey}T00:00:00.000Z`);
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
};

const getRecentDateKeys = (today, count) => (
    Array.from({ length: count }, (_, index) => shiftDateKey(today, index - count + 1))
);

const hashVisitorId = (visitorId) => (
    createHmac('sha256', process.env.ANALYTICS_SECRET?.trim() || JWT_SECRET)
        .update(String(visitorId))
        .digest('hex')
);

const pruneOldDays = (days, today) => {
    const oldestRetainedDate = shiftDateKey(today, -(ANALYTICS_RETENTION_DAYS - 1));
    return Object.fromEntries(
        Object.entries(days).filter(([date]) => date >= oldestRetainedDate && date <= today)
    );
};

const markVisitorActive = (visitorHash, now = new Date()) => {
    visitorPresence.set(visitorHash, now.getTime());
};

const pruneRecentVisitEvents = (now = new Date()) => {
    const cutoff = now.getTime() - VISIT_EVENT_TTL_MS;
    for (const [eventId, event] of recentVisitEvents.entries()) {
        if (event.recordedAt < cutoff || recentVisitEvents.size > MAX_RECENT_VISIT_EVENTS) {
            recentVisitEvents.delete(eventId);
        }
    }
};

const countActiveVisitors = (now = new Date()) => {
    const cutoff = now.getTime() - ACTIVE_WINDOW_MS;
    let activeVisitors = 0;

    for (const [visitorHash, lastSeenAt] of visitorPresence.entries()) {
        if (lastSeenAt < cutoff) {
            visitorPresence.delete(visitorHash);
            continue;
        }
        activeVisitors += 1;
    }

    return activeVisitors;
};

export async function recordAnalyticsVisit(visitorId, eventId, now = new Date()) {
    const visitorHash = hashVisitorId(visitorId);

    return runWithDataStoreLock(async () => {
        pruneRecentVisitEvents(now);
        const existingEvent = recentVisitEvents.get(eventId);
        if (existingEvent) {
            markVisitorActive(existingEvent.visitorHash, now);
            return {
                recorded: false,
                visitorId: existingEvent.visitorId
            };
        }

        const analytics = await readAnalytics();
        const today = toAnalyticsDateKey(now);
        const existingVisitor = analytics.visitors[visitorHash];
        const isNewVisitorToday = !existingVisitor || existingVisitor.lastSeen !== today;
        const currentDay = analytics.days[today] ?? { visitors: 0, pageViews: 0 };

        const nextAnalytics = {
            ...analytics,
            totalPageViews: analytics.totalPageViews + 1,
            visitors: {
                ...analytics.visitors,
                [visitorHash]: {
                    firstSeen: existingVisitor?.firstSeen ?? today,
                    lastSeen: today
                }
            },
            days: pruneOldDays({
                ...analytics.days,
                [today]: {
                    visitors: currentDay.visitors + (isNewVisitorToday ? 1 : 0),
                    pageViews: currentDay.pageViews + 1
                }
            }, today),
            updatedAt: now.toISOString()
        };

        await writeAnalytics(nextAnalytics);
        recentVisitEvents.set(eventId, {
            recordedAt: now.getTime(),
            visitorHash,
            visitorId
        });
        markVisitorActive(visitorHash, now);
        return { recorded: true, visitorId };
    });
}

export function recordAnalyticsHeartbeat(visitorId, now = new Date()) {
    markVisitorActive(hashVisitorId(visitorId), now);
}

export async function getAnalyticsSummary(now = new Date()) {
    const analytics = await readAnalytics();
    const today = toAnalyticsDateKey(now);
    const todayStats = analytics.days[today] ?? { visitors: 0, pageViews: 0 };
    const recentDays = getRecentDateKeys(today, RECENT_DAYS).map(date => ({
        date,
        visitors: analytics.days[date]?.visitors ?? 0,
        pageViews: analytics.days[date]?.pageViews ?? 0
    }));

    return {
        realtimeVisitors: countActiveVisitors(now),
        totalVisitors: Object.keys(analytics.visitors).length,
        totalPageViews: analytics.totalPageViews,
        today: todayStats,
        recentDays,
        timeZone: ANALYTICS_TIME_ZONE,
        updatedAt: analytics.updatedAt,
        generatedAt: now.toISOString()
    };
}

export async function getPublicAnalyticsSummary(now = new Date()) {
    const analytics = await readAnalytics();
    return {
        totalVisitors: Object.keys(analytics.visitors).length,
        realtimeVisitors: countActiveVisitors(now)
    };
}

export function resetAnalyticsPresence() {
    visitorPresence.clear();
    recentVisitEvents.clear();
}
