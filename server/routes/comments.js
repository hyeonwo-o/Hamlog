import express from 'express';
import { getComments, createComment, deleteComment } from '../controllers/commentController.js';
import { commentRateLimiter } from '../middleware/rateLimit.js';
import { publicBodyParsers } from '../middleware/bodyParser.js';

const router = express.Router();

router.get('/', getComments);
router.post('/', commentRateLimiter, ...publicBodyParsers, createComment); // Public
router.delete('/:id', commentRateLimiter, ...publicBodyParsers, deleteComment); // Public (password protected)

export const commentRouter = router;
