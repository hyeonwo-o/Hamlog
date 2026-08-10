import { randomUUID } from 'crypto';
import {
    getAnalyticsSummary,
    getPublicAnalyticsSummary,
    recordAnalyticsHeartbeat,
    recordAnalyticsVisit
} from '../services/analyticsService.js';
import { buildCookieOptions } from '../config/cookies.js';

const VISITOR_COOKIE_NAME = 'hamlog_visitor';
const VISITOR_COOKIE_MAX_AGE = 365 * 24 * 60 * 60 * 1000;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EVENT_ID_PATTERN = /^[a-zA-Z0-9_-]{8,80}$/;

const readVisitorId = (req) => {
    const currentVisitorId = String(req.cookies?.[VISITOR_COOKIE_NAME] ?? '').trim();
    return UUID_PATTERN.test(currentVisitorId) ? currentVisitorId : '';
};

const resolveVisitor = (req) => {
    const currentVisitorId = readVisitorId(req);
    return currentVisitorId
        ? { visitorId: currentVisitorId, isNew: false }
        : { visitorId: randomUUID(), isNew: true };
};

const setVisitorCookie = (req, res, visitorId) => {
    res.cookie(VISITOR_COOKIE_NAME, visitorId, buildCookieOptions(req, VISITOR_COOKIE_MAX_AGE));
};

const isPublicPath = (value) => {
    const path = String(value ?? '').trim();
    return path === '/' || path.startsWith('/posts/') || path.startsWith('/p/');
};

const validatePublicPath = (req, res) => {
    if (isPublicPath(req.body?.path)) return true;
    res.status(400).json({ message: '집계할 수 없는 페이지입니다.' });
    return false;
};

const validateEventId = (req, res) => {
    const eventId = String(req.body?.eventId ?? '').trim();
    if (EVENT_ID_PATTERN.test(eventId)) return eventId;
    res.status(400).json({ message: '유효하지 않은 방문 이벤트입니다.' });
    return '';
};

export const recordVisit = async (req, res) => {
    if (req.user?.role === 'admin') {
        res.status(204).end();
        return;
    }
    if (!validatePublicPath(req, res)) return;
    const eventId = validateEventId(req, res);
    if (!eventId) return;

    try {
        const visitor = resolveVisitor(req);
        const visitResult = await recordAnalyticsVisit(visitor.visitorId, eventId);
        if (visitor.isNew) {
            setVisitorCookie(req, res, visitResult.visitorId);
        }
        res.status(204).end();
    } catch (error) {
        console.error('Failed to record analytics visit', error);
        res.status(500).json({ message: '방문 기록을 저장하지 못했습니다.' });
    }
};

export const recordHeartbeat = (req, res) => {
    if (req.user?.role === 'admin') {
        res.status(204).end();
        return;
    }
    if (!validatePublicPath(req, res)) return;

    try {
        const visitorId = readVisitorId(req);
        if (visitorId) recordAnalyticsHeartbeat(visitorId);
        res.status(204).end();
    } catch (error) {
        console.error('Failed to record analytics heartbeat', error);
        res.status(500).json({ message: '접속 상태를 갱신하지 못했습니다.' });
    }
};

export const getSummary = async (_req, res) => {
    try {
        res.set('Cache-Control', 'no-store');
        res.json(await getAnalyticsSummary());
    } catch (error) {
        console.error('Failed to read analytics summary', error);
        res.status(500).json({ message: '방문자 통계를 불러오지 못했습니다.' });
    }
};

export const getPublicSummary = async (_req, res) => {
    try {
        res.set('Cache-Control', 'public, max-age=10, s-maxage=30, stale-while-revalidate=30');
        res.json(await getPublicAnalyticsSummary());
    } catch (error) {
        console.error('Failed to read public analytics summary', error);
        res.status(500).json({ message: '방문자 현황을 불러오지 못했습니다.' });
    }
};
