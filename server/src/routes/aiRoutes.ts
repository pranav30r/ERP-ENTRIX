import { Router } from 'express';
import { getDemandForecast, detectExpenseAnomalies } from '../controllers/aiController';
import { authenticateJWT } from '../middlewares/auth';

const router = Router();

router.post('/forecast', authenticateJWT, getDemandForecast);
router.post('/anomalies', authenticateJWT, detectExpenseAnomalies);

export default router;
