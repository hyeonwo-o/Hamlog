import express from 'express';
import { getProfile, updateProfile } from '../controllers/profileController.js';

import { authenticateToken } from '../middleware/auth.js';
import { requireTrustedOrigin } from '../middleware/trustedOrigin.js';

const router = express.Router();

router.get('/', getProfile);
router.put('/', authenticateToken, requireTrustedOrigin, updateProfile);

export const profileRouter = router;
