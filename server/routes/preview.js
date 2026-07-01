import express from 'express';
import { getPreview } from '../controllers/previewController.js';
import { authenticateToken } from '../middleware/auth.js';
import { previewRateLimiter } from '../middleware/rateLimit.js';
import { requireTrustedRequestOrigin } from '../middleware/trustedOrigin.js';

const router = express.Router();

router.get('/preview', authenticateToken, requireTrustedRequestOrigin, previewRateLimiter, getPreview);

export const previewRouter = router;
