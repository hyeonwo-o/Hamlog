import express from 'express';
import { getPublicImage } from '../controllers/publicImageController.js';
import { publicImageRateLimiter } from '../middleware/rateLimit.js';

const router = express.Router();

router.get('/:filename', publicImageRateLimiter, getPublicImage);

export const publicImageRouter = router;
