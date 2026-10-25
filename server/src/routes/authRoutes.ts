import { Router } from 'express';
import { login, refresh, logout, getMe, unlockUser } from '../controllers/authController';
import { authenticateJWT, requireRole } from '../middlewares/auth';
import { authLimiter } from '../middlewares/rateLimiter';

const router = Router();

router.post('/login', authLimiter, login);
router.post('/refresh', refresh);
router.post('/logout', logout);
router.get('/me', authenticateJWT, getMe);
router.post('/unlock', authenticateJWT, requireRole(['SUPER_ADMIN']), unlockUser);

export default router;
