import { Router } from 'express';
import {
  getSubscriptionStatus,
  getPlansList,
  createCheckout,
  cancelSubscription,
  resumeSubscription,
  getInvoices,
  adminOverrideSubscriptionPlan,
  handleWebhook
} from '../controllers/subscriptionController';
import { authenticateToken, requireRole } from '../middlewares/auth';
import { authLimiter } from '../middlewares/rateLimiter';

const router = Router();

// Public plan catalog
router.get('/plans', getPlansList);

// Webhook endpoint (processed asynchronously, rate limited)
router.post('/webhook', authLimiter, handleWebhook);

// Protected subscription endpoints
router.use(authenticateToken);

router.get('/status', getSubscriptionStatus as any);
router.post('/checkout', requireRole(['COMPANY_ADMIN', 'ADMIN']), createCheckout as any);
router.post('/cancel', requireRole(['COMPANY_ADMIN', 'ADMIN']), cancelSubscription as any);
router.post('/resume', requireRole(['COMPANY_ADMIN', 'ADMIN']), resumeSubscription as any);
router.get('/invoices', requireRole(['COMPANY_ADMIN', 'ADMIN']), getInvoices as any);
router.post('/override-plan', requireRole(['PLATFORM_ADMIN', 'SUPER_ADMIN']), adminOverrideSubscriptionPlan as any);

export default router;
