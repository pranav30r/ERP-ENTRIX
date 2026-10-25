import { Router } from 'express';
import { getProjects, createProject } from '../controllers/projectController';
import { authenticateJWT, requireRole } from '../middlewares/auth';

const router = Router();

router.get('/', authenticateJWT, getProjects);
router.post('/', authenticateJWT, requireRole(['SUPER_ADMIN']), createProject);

export default router;
