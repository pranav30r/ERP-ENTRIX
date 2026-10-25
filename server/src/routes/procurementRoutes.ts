import { Router } from 'express';
import {
  createPurchaseRequest,
  getPurchaseRequests,
  managerApproval,
  financeApproval,
  receiveGoods,
  getSuppliers,
  createSupplier,
  selectSupplier,
  matchSupplierInvoice,
  settleSupplierInvoice
} from '../controllers/procurementController';
import { authenticateJWT, requireRole, requireTenant } from '../middlewares/auth';
import { requireModuleEntitlement } from '../middlewares/entitlements';

const router = Router();

router.use(authenticateJWT);
router.use(requireTenant);
router.use(requireModuleEntitlement('PROCUREMENT'));

router.post('/requests', createPurchaseRequest);
router.get('/requests', getPurchaseRequests);
router.post('/requests/:id/manager-approval', requireRole(['COMPANY_ADMIN', 'SUPER_ADMIN', 'HR_MANAGER', 'DEPT_LEAD']), managerApproval);
router.post('/requests/:id/finance-approval', requireRole(['COMPANY_ADMIN', 'SUPER_ADMIN', 'FINANCE_OFFICER']), financeApproval);
router.post('/requests/:id/select-supplier', requireRole(['COMPANY_ADMIN', 'SUPER_ADMIN', 'PROCUREMENT_OFFICER']), selectSupplier);
router.post('/requests/:id/receive-goods', requireRole(['COMPANY_ADMIN', 'SUPER_ADMIN', 'PROCUREMENT_OFFICER']), receiveGoods);

// Suppliers & 3-Way Invoicing
router.get('/suppliers', getSuppliers);
router.post('/suppliers', requireRole(['COMPANY_ADMIN', 'SUPER_ADMIN', 'PROCUREMENT_OFFICER']), createSupplier);
router.post('/invoices/match', requireRole(['COMPANY_ADMIN', 'SUPER_ADMIN', 'FINANCE_OFFICER', 'PROCUREMENT_OFFICER']), matchSupplierInvoice);
router.post('/invoices/:id/pay', requireRole(['COMPANY_ADMIN', 'SUPER_ADMIN', 'FINANCE_OFFICER']), settleSupplierInvoice);

export default router;
