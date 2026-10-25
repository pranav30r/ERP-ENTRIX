import { Router } from 'express';
import { getLedgerEntries } from '../controllers/financeController';
import { authenticateJWT, requireRole } from '../middlewares/auth';

const router = Router();

router.get('/ledger', authenticateJWT, requireRole(['SUPER_ADMIN', 'FINANCE_OFFICER']), getLedgerEntries);

export default router;
