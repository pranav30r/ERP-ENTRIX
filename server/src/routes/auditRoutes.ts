import { Router } from 'express';
import { getAuditLogs } from '../controllers/auditController';
import { authenticateJWT, requireRole } from '../middlewares/auth';

const router = Router();

router.get('/', authenticateJWT, requireRole(['SUPER_ADMIN']), getAuditLogs);

export default router;
