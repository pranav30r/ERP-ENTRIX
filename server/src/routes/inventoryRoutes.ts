import { Router } from 'express';
import { getInventory, createInventoryItem, adjustStock, getInventoryMovements } from '../controllers/inventoryController';
import { authenticateJWT, requireRole, requireTenant } from '../middlewares/auth';
import { requireModuleEntitlement } from '../middlewares/entitlements';

const router = Router();

router.use(authenticateJWT);
router.use(requireTenant);
router.use(requireModuleEntitlement('INVENTORY'));

router.get('/', getInventory);
router.get('/movements', getInventoryMovements);
router.get('/:id/movements', getInventoryMovements);
router.post('/', requireRole(['COMPANY_ADMIN', 'SUPER_ADMIN', 'PROCUREMENT_OFFICER']), createInventoryItem);
router.patch('/:id/adjust', requireRole(['COMPANY_ADMIN', 'SUPER_ADMIN', 'PROCUREMENT_OFFICER']), adjustStock);

export default router;
