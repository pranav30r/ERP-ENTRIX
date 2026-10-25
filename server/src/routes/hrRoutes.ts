import { Router } from 'express';
import {
  getEmployees,
  createEmployee,
  updateEmployee,
  getAttendance,
  recordAttendance,
  getLeaveRequests,
  createLeaveRequest,
  reviewLeaveRequest,
  getHRMetrics
} from '../controllers/hrController';
import { authenticateJWT, requireRole, requireTenant } from '../middlewares/auth';
import { requireModuleEntitlement } from '../middlewares/entitlements';

const router = Router();

router.use(authenticateJWT);
router.use(requireTenant);
router.use(requireModuleEntitlement('HR'));

router.get('/metrics', requireRole(['COMPANY_ADMIN', 'SUPER_ADMIN', 'HR_MANAGER']), getHRMetrics);
router.get('/employees', requireRole(['COMPANY_ADMIN', 'SUPER_ADMIN', 'HR_MANAGER']), getEmployees);
router.post('/employees', requireRole(['COMPANY_ADMIN', 'SUPER_ADMIN', 'HR_MANAGER']), createEmployee);
router.put('/employees/:id', requireRole(['COMPANY_ADMIN', 'SUPER_ADMIN', 'HR_MANAGER']), updateEmployee);

router.get('/attendance', requireRole(['COMPANY_ADMIN', 'SUPER_ADMIN', 'HR_MANAGER']), getAttendance);
router.post('/attendance', requireRole(['COMPANY_ADMIN', 'SUPER_ADMIN', 'HR_MANAGER']), recordAttendance);

// Leave Management
router.get('/leave-requests', getLeaveRequests);
router.post('/leave-requests', createLeaveRequest);
router.patch('/leave-requests/:id/review', requireRole(['COMPANY_ADMIN', 'SUPER_ADMIN', 'HR_MANAGER']), reviewLeaveRequest);

export default router;
