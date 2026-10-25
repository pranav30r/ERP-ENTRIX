import { Router } from 'express';
import { getDemandForecast, detectExpenseAnomalies } from '../controllers/aiController';
import { authenticateJWT } from '../middlewares/auth';
import { requireModuleEntitlement, trackAiUsage } from '../middlewares/entitlements';

const router = Router();

router.use(authenticateJWT);
router.use(requireModuleEntitlement('AI'));
router.use(trackAiUsage);

router.post('/forecast', getDemandForecast);
router.post('/anomalies', detectExpenseAnomalies);

export default router;
