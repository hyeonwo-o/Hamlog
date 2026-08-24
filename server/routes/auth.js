import express from 'express';
import { login, logout, me } from '../controllers/authController.js';
import { authenticateToken } from '../middleware/auth.js';
import { loginRateLimiter } from '../middleware/rateLimit.js';
import { requireTrustedOrigin } from '../middleware/trustedOrigin.js';
import { publicBodyParsers } from '../middleware/bodyParser.js';

const router = express.Router();

router.post('/login', loginRateLimiter, ...publicBodyParsers, login);
router.post('/logout', requireTrustedOrigin, logout);
router.get('/me', authenticateToken, me);

export const authRouter = router;
