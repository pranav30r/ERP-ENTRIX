import { Request, Response } from 'express';
import { AuditLog } from '../models';
import { AuditService } from '../services/auditService';

export const getAuditLogs = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user;
    const tenantId = user?.tenant_id || (req as any).tenantId;
    if (!tenantId && user?.role_name !== 'PLATFORM_ADMIN') {
      res.status(403).json({ success: false, error: 'Tenant context required. Access denied.' });
      return;
    }
    const whereClause: any = {};
    if (tenantId) {
      whereClause.tenant_id = tenantId;
    }

    const logs = await AuditLog.findAll({
      where: whereClause,
      limit: 50,
      order: [['id', 'DESC']]
    });

    const verification = await AuditService.verifyChainIntegrity(tenantId);

    res.status(200).json({
      success: true,
      data: logs,
      integrity: verification
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Error fetching audit logs.' });
  }
};
