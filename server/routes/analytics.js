import express from 'express';
import {
    getPublicSummary,
    getSummary,
    recordHeartbeat,
    recordVisit
} from '../controllers/analyticsController.js';
import { attachOptionalUser, authenticateToken } from '../middleware/auth.js';
import {
    analyticsRateLimiter,
    publicAnalyticsRateLimiter
} from '../middleware/rateLimit.js';
import { requireTrustedOrigin } from '../middleware/trustedOrigin.js';

const router = express.Router();

router.post('/visit', analyticsRateLimiter, attachOptionalUser, requireTrustedOrigin, recordVisit);
router.post('/heartbeat', analyticsRateLimiter, attachOptionalUser, requireTrustedOrigin, recordHeartbeat);
router.get('/public', publicAnalyticsRateLimiter, getPublicSummary);
router.get('/summary', authenticateToken, getSummary);

export const analyticsRouter = router;
