import { Request, Response } from 'express';
import { AuditLog, User } from '../models';
import { AuditService } from '../services/auditService';

export const getAuditLogs = async (req: Request, res: Response): Promise<void> => {
  try {
    const logs = await AuditLog.findAll({
      limit: 50,
      order: [['id', 'DESC']]
    });

    const verification = await AuditService.verifyChainIntegrity();

    res.status(200).json({
      success: true,
      data: logs,
      integrity: verification
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Error fetching audit logs.' });
  }
};
