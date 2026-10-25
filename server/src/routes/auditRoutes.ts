import { Router } from 'express';
import { getAuditLogs } from '../controllers/auditController';
import { authenticateJWT, requireRole, requireTenant } from '../middlewares/auth';
import { requireModuleEntitlement } from '../middlewares/entitlements';

const router = Router();

router.get('/', authenticateJWT, requireTenant, requireModuleEntitlement('AUDIT'), requireRole(['COMPANY_ADMIN', 'SUPER_ADMIN']), getAuditLogs);

export default router;
