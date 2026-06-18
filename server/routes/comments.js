import express from 'express';
import { getComments, createComment, deleteComment } from '../controllers/commentController.js';
import { commentRateLimiter } from '../middleware/rateLimit.js';

const router = express.Router();

router.get('/', getComments);
router.post('/', commentRateLimiter, createComment); // Public
router.delete('/:id', commentRateLimiter, deleteComment); // Public (password protected)

export const commentRouter = router;
