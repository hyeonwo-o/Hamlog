import express from 'express';
import {
  getCategories,
  createCategory,
  deleteCategory,
  reorderCategories,
  updateCategory
} from '../controllers/categoryController.js';

import { authenticateToken } from '../middleware/auth.js';
import { requireTrustedOrigin } from '../middleware/trustedOrigin.js';

const router = express.Router();

router.get('/', getCategories);
router.post('/', authenticateToken, requireTrustedOrigin, createCategory);
router.patch('/reorder', authenticateToken, requireTrustedOrigin, reorderCategories); // Specific routes before parameters
router.delete('/:name', authenticateToken, requireTrustedOrigin, deleteCategory);
router.patch('/:id', authenticateToken, requireTrustedOrigin, updateCategory);

export const categoryRouter = router;
