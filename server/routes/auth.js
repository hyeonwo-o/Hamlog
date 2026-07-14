import express from 'express';
import { login, logout, me } from '../controllers/authController.js';
import { authenticateToken } from '../middleware/auth.js';
import { loginRateLimiter } from '../middleware/rateLimit.js';
import { requireTrustedOrigin } from '../middleware/trustedOrigin.js';

const router = express.Router();

router.post('/login', loginRateLimiter, login);
router.post('/logout', requireTrustedOrigin, logout);
router.get('/me', authenticateToken, me);

export const authRouter = router;
