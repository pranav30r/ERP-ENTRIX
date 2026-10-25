import { Router } from 'express';
import {
  getCompanyProfile,
  updateCompanyProfile,
  getMembers,
  inviteMember,
  updateMember,
  exportCompanyData,
  closeCompanyAccount
} from '../controllers/companySettingsController';
import { authenticateToken, requireRole, requireTenant } from '../middlewares/auth';
import { checkUserQuota } from '../middlewares/entitlements';

const router = Router();

router.use(authenticateToken);
router.use(requireTenant);

// Company profile management
router.get('/profile', getCompanyProfile as any);
router.patch('/profile', requireRole(['COMPANY_ADMIN', 'ADMIN']), updateCompanyProfile as any);

// Team membership & administration
router.get('/members', getMembers as any);
router.post('/members', requireRole(['COMPANY_ADMIN', 'ADMIN']), checkUserQuota as any, inviteMember as any);
router.patch('/members/:id', requireRole(['COMPANY_ADMIN', 'ADMIN']), updateMember as any);

// Data portability & account lifecycle
router.get('/export', requireRole(['COMPANY_ADMIN', 'ADMIN']), exportCompanyData as any);
router.post('/close-account', requireRole(['COMPANY_ADMIN', 'ADMIN']), closeCompanyAccount as any);

export default router;
