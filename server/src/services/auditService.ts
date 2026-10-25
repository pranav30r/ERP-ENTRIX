import crypto from 'crypto';
import { AuditLog } from '../models';

export class AuditService {
  public static async logMutation(
    actorId: string | null,
    action: string,
    entityName: string,
    entityId: string,
    diffPayload: Record<string, any>
  ): Promise<AuditLog> {
    // Get last log entry to retrieve previous hash
    const lastLog = await AuditLog.findOne({
      order: [['id', 'DESC']]
    });

    const previousHash = lastLog ? lastLog.current_hash : '0000000000000000000000000000000000000000000000000000000000000000';
    const timestamp = new Date().toISOString();

    // SHA-256 Chaining formula: SHA256(prev_hash + actor + action + entity + payload + timestamp)
    const rawData = `${previousHash}|${actorId || 'SYSTEM'}|${action}|${entityName}|${entityId}|${JSON.stringify(diffPayload)}|${timestamp}`;
    const currentHash = crypto.createHash('sha256').update(rawData).digest('hex');

    return await AuditLog.create({
      actor_id: actorId,
      action,
      entity_name: entityName,
      entity_id: entityId,
      diff_payload: diffPayload,
      previous_hash: previousHash,
      current_hash: currentHash
    });
  }

  public static async verifyChainIntegrity(): Promise<{ valid: boolean; total_checked: number; broken_id?: number }> {
    const logs = await AuditLog.findAll({ order: [['id', 'ASC']] });
    let prevHash = '0000000000000000000000000000000000000000000000000000000000000000';

    for (const log of logs) {
      if (log.previous_hash !== prevHash) {
        return { valid: false, total_checked: logs.length, broken_id: log.id };
      }
      prevHash = log.current_hash;
    }

    return { valid: true, total_checked: logs.length };
  }
}
