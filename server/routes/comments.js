import express from 'express';
import { getComments, createComment, deleteComment } from '../controllers/commentController.js';
import { commentRateLimiter } from '../middleware/rateLimit.js';
import { publicBodyParsers } from '../middleware/bodyParser.js';
import { authenticateToken } from '../middleware/auth.js';
import { requireTrustedOrigin } from '../middleware/trustedOrigin.js';
import { listCommentsForModeration, setCommentHidden, deleteCommentAsAdmin } from '../controllers/commentModerationController.js';

const router = express.Router();

router.get('/moderation', authenticateToken, listCommentsForModeration);
router.patch('/moderation/:id', authenticateToken, requireTrustedOrigin, ...publicBodyParsers, setCommentHidden);
router.delete('/moderation/:id', authenticateToken, requireTrustedOrigin, ...publicBodyParsers, deleteCommentAsAdmin);
router.get('/', getComments);
router.post('/', commentRateLimiter, ...publicBodyParsers, createComment); // Public
router.delete('/:id', commentRateLimiter, ...publicBodyParsers, deleteComment); // Public (password protected)

export const commentRouter = router;
