import { Router } from 'express';
import {
  getProjects,
  createProject,
  updateProjectProgress,
  getProjectTasks,
  createProjectTask
} from '../controllers/projectController';
import { authenticateJWT, requireRole, requireTenant } from '../middlewares/auth';
import { requireModuleEntitlement } from '../middlewares/entitlements';

const router = Router();

router.use(authenticateJWT);
router.use(requireTenant);
router.use(requireModuleEntitlement('PROJECTS'));

router.get('/', getProjects);
router.post(
  '/',
  requireRole(['SUPER_ADMIN', 'COMPANY_ADMIN', 'HR_MANAGER', 'FINANCE_OFFICER', 'PROCUREMENT_OFFICER']),
  createProject
);
router.put(
  '/:id/progress',
  requireRole(['SUPER_ADMIN', 'COMPANY_ADMIN', 'HR_MANAGER', 'FINANCE_OFFICER', 'PROCUREMENT_OFFICER']),
  updateProjectProgress
);

router.get('/:id/tasks', getProjectTasks);
router.post(
  '/:id/tasks',
  requireRole(['SUPER_ADMIN', 'COMPANY_ADMIN', 'HR_MANAGER', 'FINANCE_OFFICER', 'PROCUREMENT_OFFICER']),
  createProjectTask
);

export default router;
