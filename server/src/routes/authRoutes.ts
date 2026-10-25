import { Router } from 'express';
import { login, refresh, logout, getMe } from '../controllers/authController';
import { authenticateJWT } from '../middlewares/auth';
import { authLimiter } from '../middlewares/rateLimiter';

const router = Router();

router.post('/login', authLimiter, login);
router.post('/refresh', refresh);
router.post('/logout', logout);
router.get('/me', authenticateJWT, getMe);

export default router;
