import { Router } from 'express';
import { getInventory, createInventoryItem } from '../controllers/inventoryController';
import { authenticateJWT, requireRole } from '../middlewares/auth';

const router = Router();

router.get('/', authenticateJWT, getInventory);
router.post('/', authenticateJWT, requireRole(['SUPER_ADMIN', 'PROCUREMENT_OFFICER']), createInventoryItem);

export default router;
