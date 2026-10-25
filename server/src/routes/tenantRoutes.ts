import { Router } from 'express';
import { onboardCompany, getCurrentTenant, inviteUser, acceptInvite } from '../controllers/tenantController';
import { authenticateJWT, requireRole, requireTenant } from '../middlewares/auth';
import { authLimiter } from '../middlewares/rateLimiter';

const router = Router();

// Public onboarding & invitation acceptance
router.post('/onboard', authLimiter, onboardCompany);
router.post('/accept-invite', authLimiter, acceptInvite);

// Authenticated tenant management
router.get('/current', authenticateJWT, requireTenant, getCurrentTenant);
router.post('/invite', authenticateJWT, requireTenant, requireRole(['COMPANY_ADMIN', 'SUPER_ADMIN']), inviteUser);

export default router;
