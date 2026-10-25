import crypto from 'crypto';
import { Transaction } from 'sequelize';
import { AuditLog, User } from '../models';
import { sequelize } from '../config/db';

export class AuditService {
  private static sanitizePayload(payload: Record<string, any>): Record<string, any> {
    if (!payload || typeof payload !== 'object') return {};
    const sensitiveKeys = ['password', 'password_hash', 'token', 'access_token', 'refresh_token', 'secret', 'authorization', 'card_number'];
    const sanitized: Record<string, any> = {};

    for (const [key, value] of Object.entries(payload)) {
      if (sensitiveKeys.some(s => key.toLowerCase().includes(s))) {
        sanitized[key] = '[REDACTED]';
      } else if (value && typeof value === 'object' && !Array.isArray(value)) {
        sanitized[key] = AuditService.sanitizePayload(value);
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  }

  public static async logMutation(
    actorId: string | null,
    action: string,
    entityName: string,
    entityId: string,
    diffPayload: Record<string, any>,
    transaction?: Transaction,
    tenantId?: string
  ): Promise<AuditLog> {
    let resolvedTenantId = tenantId;
    if (!resolvedTenantId && actorId) {
      const actor = await User.findByPk(actorId);
      if (actor && actor.tenant_id) {
        resolvedTenantId = actor.tenant_id;
      }
    }

    if (!resolvedTenantId) {
      throw new Error('Tenant context required for cryptographic audit logging.');
    }

    // If caller did not provide a transaction, wrap in transaction
    if (!transaction) {
      return await sequelize.transaction(async (tx) => {
        return AuditService.logMutation(actorId, action, entityName, entityId, diffPayload, tx, resolvedTenantId);
      });
    }

    // Acquire tenant-scoped advisory transaction lock to strictly serialize concurrent audit logging
    // and eliminate hash chain forks without deadlocking.
    await sequelize.query('SELECT pg_advisory_xact_lock(hashtext(:lockKey));', {
      replacements: { lockKey: `audit_chain_${resolvedTenantId}` },
      transaction
    });

    const sanitizedPayload = AuditService.sanitizePayload(diffPayload);

    // Tenant-isolated last log entry to retrieve previous hash for this tenant's chain
    const lastLog = await AuditLog.findOne({
      where: { tenant_id: resolvedTenantId },
      order: [['id', 'DESC']],
      transaction
    });

    const previousHash = lastLog ? lastLog.current_hash : '0000000000000000000000000000000000000000000000000000000000000000';
    const timestamp = new Date().toISOString();

    // SHA-256 Chaining formula: SHA256(prev_hash + actor + action + entity + payload + timestamp + tenant)
    const rawData = `${previousHash}|${actorId || 'SYSTEM'}|${action}|${entityName}|${entityId}|${JSON.stringify(sanitizedPayload)}|${timestamp}|${resolvedTenantId}`;
    const currentHash = crypto.createHash('sha256').update(rawData).digest('hex');

    return await AuditLog.create(
      {
        tenant_id: resolvedTenantId,
        actor_id: actorId,
        action,
        entity_name: entityName,
        entity_id: entityId,
        diff_payload: sanitizedPayload,
        previous_hash: previousHash,
        current_hash: currentHash
      },
      { transaction }
    );
  }

  public static async verifyChainIntegrity(tenantId?: string): Promise<{ valid: boolean; total_checked: number; broken_id?: number }> {
    if (tenantId) {
      const logs = await AuditLog.findAll({
        where: { tenant_id: tenantId },
        order: [['id', 'ASC']]
      });

      let prevHash = '0000000000000000000000000000000000000000000000000000000000000000';
      for (const log of logs) {
        if (log.previous_hash !== prevHash) {
          return { valid: false, total_checked: logs.length, broken_id: log.id };
        }
        prevHash = log.current_hash;
      }
      return { valid: true, total_checked: logs.length };
    }

    // Verify all tenant chains independently
    const logs = await AuditLog.findAll({
      order: [['tenant_id', 'ASC'], ['id', 'ASC']]
    });

    const tenantLastHash: Record<string, string> = {};
    for (const log of logs) {
      const expectedPrev = tenantLastHash[log.tenant_id] || '0000000000000000000000000000000000000000000000000000000000000000';
      if (log.previous_hash !== expectedPrev) {
        return { valid: false, total_checked: logs.length, broken_id: log.id };
      }
      tenantLastHash[log.tenant_id] = log.current_hash;
    }

    return { valid: true, total_checked: logs.length };
  }
}

