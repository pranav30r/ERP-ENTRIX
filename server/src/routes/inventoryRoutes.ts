import { Router } from 'express';
import { getInventory, createInventoryItem, adjustStock } from '../controllers/inventoryController';
import { authenticateJWT, requireRole } from '../middlewares/auth';

const router = Router();

router.get('/', authenticateJWT, getInventory);
router.post('/', authenticateJWT, requireRole(['SUPER_ADMIN', 'PROCUREMENT_OFFICER']), createInventoryItem);
router.patch('/:id/adjust', authenticateJWT, requireRole(['SUPER_ADMIN', 'PROCUREMENT_OFFICER']), adjustStock);

export default router;
