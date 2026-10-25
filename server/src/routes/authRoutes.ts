import { Router } from 'express';
import { login, getMe } from '../controllers/authController';
import { authenticateJWT } from '../middlewares/auth';
import { authLimiter } from '../middlewares/rateLimiter';

const router = Router();

router.post('/login', authLimiter, login);
router.get('/me', authenticateJWT, getMe);

export default router;
