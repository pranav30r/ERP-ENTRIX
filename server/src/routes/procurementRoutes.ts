import { Router } from 'express';
import {
  createPurchaseRequest,
  getPurchaseRequests,
  managerApproval,
  financeApproval,
  receiveGoods
} from '../controllers/procurementController';
import { authenticateJWT, requireRole } from '../middlewares/auth';

const router = Router();

router.post('/requests', authenticateJWT, createPurchaseRequest);
router.get('/requests', authenticateJWT, getPurchaseRequests);
router.post('/requests/:id/manager-approval', authenticateJWT, requireRole(['SUPER_ADMIN', 'HR_MANAGER', 'DEPT_LEAD']), managerApproval);
router.post('/requests/:id/finance-approval', authenticateJWT, requireRole(['SUPER_ADMIN', 'FINANCE_OFFICER']), financeApproval);
router.post('/requests/:id/receive-goods', authenticateJWT, requireRole(['SUPER_ADMIN', 'PROCUREMENT_OFFICER']), receiveGoods);

export default router;
