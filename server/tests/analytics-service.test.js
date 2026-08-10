import test, { after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';

import app from '../app.js';
import {
    createEmptyAnalytics,
    readAnalytics,
    writeAnalytics
} from '../models/analyticsModel.js';
import {
    getAnalyticsSummary,
    recordAnalyticsHeartbeat,
    recordAnalyticsVisit,
    resetAnalyticsPresence
} from '../services/analyticsService.js';

const TRUSTED_ORIGIN = 'http://hamlog.test';

if (process.env.NODE_ENV !== 'test' || !process.env.HAMLOG_DATA_DIR) {
    throw new Error('analytics service tests require NODE_ENV=test and an isolated HAMLOG_DATA_DIR.');
}

const resetAnalyticsState = async () => {
    resetAnalyticsPresence();
    await writeAnalytics(createEmptyAnalytics());
};

const withTrustedOrigin = (requestBuilder) => requestBuilder
    .set('Origin', TRUSTED_ORIGIN)
    .set('Host', new URL(TRUSTED_ORIGIN).host);

beforeEach(resetAnalyticsState);
after(resetAnalyticsState);

test('concurrent visits with the same visitor and event ID are recorded once', async () => {
    const now = new Date('2026-08-10T12:00:00.000Z');
    const results = await Promise.all(
        Array.from({ length: 8 }, () => (
            recordAnalyticsVisit('visitor-concurrent', 'event-concurrent-0001', now)
        ))
    );

    assert.equal(results.filter(result => result.recorded).length, 1);
    assert.equal(results.filter(result => !result.recorded).length, 7);
    assert.ok(results.every(result => result.visitorId === 'visitor-concurrent'));

    const stored = await readAnalytics();
    assert.equal(stored.totalPageViews, 1);
    assert.equal(Object.keys(stored.visitors).length, 1);
    assert.deepEqual(stored.days['2026-08-10'], { visitors: 1, pageViews: 1 });
});

test('concurrent first visits with no visitor cookie and the same event ID are recorded once', async () => {
    const sendFirstVisit = () => withTrustedOrigin(request(app).post('/api/analytics/visit'))
        .send({ path: '/', eventId: 'event-first-visit-0001' });

    const responses = await Promise.all([sendFirstVisit(), sendFirstVisit()]);
    assert.deepEqual(responses.map(response => response.status), [204, 204]);
    const visitorCookieValues = responses.map(response => {
        const cookies = response.headers['set-cookie'] ?? [];
        const visitorCookie = cookies.find(cookie => cookie.startsWith('hamlog_visitor='));
        return visitorCookie?.split(';')[0] ?? '';
    });
    assert.ok(visitorCookieValues.every(Boolean));
    assert.equal(new Set(visitorCookieValues).size, 1);

    const stored = await readAnalytics();
    const summary = await getAnalyticsSummary();

    assert.deepEqual({
        totalVisitors: Object.keys(stored.visitors).length,
        totalPageViews: stored.totalPageViews,
        realtimeVisitors: summary.realtimeVisitors
    }, {
        totalVisitors: 1,
        totalPageViews: 1,
        realtimeVisitors: 1
    });
});

test('a returning visitor increments each day without increasing the cumulative visitor count', async () => {
    const firstDay = new Date('2026-08-10T12:00:00.000Z');
    const nextDay = new Date('2026-08-10T16:00:00.000Z');

    await recordAnalyticsVisit('visitor-returning', 'event-day-one-0001', firstDay);
    await recordAnalyticsVisit('visitor-returning', 'event-day-two-0001', nextDay);

    const stored = await readAnalytics();
    const [visitor] = Object.values(stored.visitors);

    assert.equal(stored.totalPageViews, 2);
    assert.equal(Object.keys(stored.visitors).length, 1);
    assert.deepEqual(visitor, {
        firstSeen: '2026-08-10',
        lastSeen: '2026-08-11'
    });
    assert.deepEqual(stored.days['2026-08-10'], { visitors: 1, pageViews: 1 });
    assert.deepEqual(stored.days['2026-08-11'], { visitors: 1, pageViews: 1 });

    const summary = await getAnalyticsSummary(nextDay);
    assert.equal(summary.totalVisitors, 1);
    assert.equal(summary.totalPageViews, 2);
    assert.deepEqual(summary.today, { visitors: 1, pageViews: 1 });
});

test('visitor presence expires after the 90 second active window', async () => {
    const heartbeatAt = new Date('2026-08-10T12:00:00.000Z');
    recordAnalyticsHeartbeat('visitor-presence', heartbeatAt);

    const beforeExpiry = await getAnalyticsSummary(
        new Date(heartbeatAt.getTime() + 89_999)
    );
    assert.equal(beforeExpiry.realtimeVisitors, 1);

    const afterExpiry = await getAnalyticsSummary(
        new Date(heartbeatAt.getTime() + 90_001)
    );
    assert.equal(afterExpiry.realtimeVisitors, 0);
});

test('visit endpoint rejects missing and malformed event IDs without recording analytics', async () => {
    const invalidEventIds = [
        undefined,
        'short',
        'contains spaces',
        'a'.repeat(81)
    ];

    for (const eventId of invalidEventIds) {
        const payload = eventId === undefined
            ? { path: '/' }
            : { path: '/', eventId };
        const response = await withTrustedOrigin(request(app).post('/api/analytics/visit'))
            .send(payload);

        assert.equal(response.status, 400);
        assert.equal(response.body.message, '유효하지 않은 방문 이벤트입니다.');
    }

    assert.deepEqual(await readAnalytics(), createEmptyAnalytics());
});

test('heartbeat without an existing visitor cookie is ignored', async () => {
    const heartbeat = await withTrustedOrigin(request(app).post('/api/analytics/heartbeat'))
        .send({ path: '/' });

    assert.equal(heartbeat.status, 204);
    assert.equal(heartbeat.headers['set-cookie'], undefined);

    const publicSummary = await request(app).get('/api/analytics/public');
    assert.equal(publicSummary.status, 200);
    assert.deepEqual(publicSummary.body, {
        totalVisitors: 0,
        realtimeVisitors: 0
    });
});
