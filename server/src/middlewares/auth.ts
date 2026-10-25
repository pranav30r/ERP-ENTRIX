import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface UserPayload {
  id: string;
  email: string;
  role_id: number;
  role_name: string;
  department_id?: string;
}

export interface AuthRequest extends Request {
  user?: any;
}

export const authenticateJWT = (req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ success: false, error: 'Access denied. No token provided.' });
    return;
  }

  const token = authHeader.split(' ')[1];
  const jwtSecret = process.env.JWT_SECRET || 'super_secret_jwt_key_entrix_2026_change_in_production';

  try {
    const decoded = jwt.verify(token, jwtSecret) as UserPayload;
    (req as any).user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ success: false, error: 'Invalid or expired token.' });
  }
};

export const requireRole = (allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = (req as any).user;
    if (!user) {
      res.status(401).json({ success: false, error: 'Authentication required.' });
      return;
    }

    if (!allowedRoles.includes(user.role_name)) {
      res.status(403).json({
        success: false,
        error: `Forbidden. Role '${user.role_name}' does not have sufficient permissions.`
      });
      return;
    }

    next();
  };
};
