import express from 'express';
import {
  getPosts,
  createPost,
  updatePost,
  deletePost,
  getPostRevisions,
  restorePostRevision
} from '../controllers/postController.js';

import { attachOptionalUser, authenticateToken } from '../middleware/auth.js';
import { requireTrustedOrigin } from '../middleware/trustedOrigin.js';

const router = express.Router();

router.get('/', attachOptionalUser, getPosts);
router.post('/', authenticateToken, requireTrustedOrigin, createPost);
router.get('/:id/revisions', authenticateToken, getPostRevisions);
router.post('/:id/revisions/:revisionId/restore', authenticateToken, requireTrustedOrigin, restorePostRevision);
router.put('/:id', authenticateToken, requireTrustedOrigin, updatePost);
router.delete('/:id', authenticateToken, requireTrustedOrigin, deletePost);

export const postRouter = router;
