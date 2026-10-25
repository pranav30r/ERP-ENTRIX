import { Router } from 'express';
import { getEmployees } from '../controllers/hrController';
import { authenticateJWT, requireRole } from '../middlewares/auth';

const router = Router();

router.get('/employees', authenticateJWT, requireRole(['SUPER_ADMIN', 'HR_MANAGER']), getEmployees);

export default router;
