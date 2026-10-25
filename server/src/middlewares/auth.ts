import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { ENV } from '../config/env';
import { Tenant } from '../models';

export interface UserPayload {
  id: string;
  email: string;
  role_id: number;
  role_name: string;
  tenant_id: string | null;
  department_id?: string;
}

export interface AuthRequest extends Request {
  user?: UserPayload;
  tenantId?: string;
  tenant?: any;
}

export const authenticateJWT = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ success: false, error: 'Access denied. No token provided.' });
    return;
  }

  const token = authHeader.split(' ')[1];
  const jwtSecret = ENV.JWT_SECRET;

  try {
    const decoded = jwt.verify(token, jwtSecret) as UserPayload;
    
    // Inconsistent Tenant Context Detection:
    // If incoming request context or header already defined tenantId and it contradicts JWT, reject
    const incomingHeaderTenant = req.headers['x-tenant-id'];
    if (incomingHeaderTenant && typeof incomingHeaderTenant === 'string' && incomingHeaderTenant !== decoded.tenant_id) {
      res.status(403).json({ success: false, error: 'Inconsistent tenant context: header does not match authenticated token.' });
      return;
    }

    if ((req as any).tenantId && decoded.tenant_id && (req as any).tenantId !== decoded.tenant_id) {
      res.status(403).json({ success: false, error: 'Inconsistent tenant context: req.tenantId contradicts authenticated token.' });
      return;
    }

    (req as any).user = decoded;
    (req as any).tenantId = decoded.tenant_id;

    // If assigned to a tenant, verify tenant status
    if (decoded.tenant_id) {
      const tenant = await Tenant.findByPk(decoded.tenant_id);
      if (!tenant) {
        res.status(401).json({ success: false, error: 'Unauthorized. Associated company tenant not found.' });
        return;
      }
      if (tenant.status === 'SUSPENDED') {
        res.status(403).json({ success: false, error: 'Access denied. Company tenant account is suspended.' });
        return;
      }
      (req as any).tenant = tenant;
    }

    next();
  } catch (error) {
    res.status(401).json({ success: false, error: 'Invalid or expired token.' });
  }
};

export const authenticateToken = authenticateJWT;

export const requireRole = (allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = (req as any).user;
    if (!user) {
      res.status(401).json({ success: false, error: 'Authentication required.' });
      return;
    }

    // PLATFORM_ADMIN or SUPER_ADMIN bypass if explicitly allowed
    if (user.role_name === 'PLATFORM_ADMIN' && allowedRoles.includes('PLATFORM_ADMIN')) {
      return next();
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

export const requireTenant = (req: Request, res: Response, next: NextFunction): void => {
  const user = (req as any).user;
  const reqTenantId = (req as any).tenantId;
  const userTenantId = user?.tenant_id || user?.tenantId;

  if (reqTenantId && userTenantId && reqTenantId !== userTenantId) {
    res.status(403).json({
      success: false,
      error: 'Tenant context conflict detected: req.tenantId and user.tenant_id disagree.'
    });
    return;
  }

  const tenantId = userTenantId || reqTenantId;
  if (!tenantId && user?.role_name !== 'PLATFORM_ADMIN') {
    res.status(403).json({
      success: false,
      error: 'Tenant context required. Operation cannot be performed without an active company tenant.'
    });
    return;
  }
  (req as any).tenantId = tenantId;
  next();
};

export const getValidatedTenantId = (req: Request): string | null => {
  const reqTenantId = (req as any).tenantId;
  const user = (req as any).user;
  const userTenantId = user?.tenant_id || user?.tenantId;

  if (reqTenantId && userTenantId && reqTenantId !== userTenantId) {
    throw new Error('Tenant context conflict detected: req.tenantId and user.tenant_id disagree.');
  }

  return userTenantId || reqTenantId || null;
};

