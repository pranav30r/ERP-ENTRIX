import { Router } from 'express';
import { getLedgerEntries, createJournalEntry } from '../controllers/financeController';
import { authenticateJWT, requireRole, requireTenant } from '../middlewares/auth';
import { requireModuleEntitlement } from '../middlewares/entitlements';

const router = Router();

router.use(authenticateJWT);
router.use(requireTenant);

router.get('/ledger', requireModuleEntitlement('FINANCE'), requireRole(['COMPANY_ADMIN', 'SUPER_ADMIN', 'FINANCE_OFFICER']), getLedgerEntries);
router.post('/journal', requireModuleEntitlement('FINANCE'), requireRole(['COMPANY_ADMIN', 'SUPER_ADMIN', 'FINANCE_OFFICER']), createJournalEntry);

export default router;
