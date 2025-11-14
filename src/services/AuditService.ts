/**
 * AuditService Implementation
 * 
 * Handles audit logging for all actions in the system.
 * Provides audit trail querying capabilities.
 */

import { IAuditService } from './interfaces/IAuditService';
import { IDatabase } from './interfaces/IDatabase';
import { AuditLog } from '../types';
import { logger } from '../utils/logger';

export class AuditService implements IAuditService {
  constructor(private db: IDatabase) {}

  /**
   * Log an action to the audit trail
   */
  async log(data: {
    workspace_id: number;
    actor_type: 'player' | 'admin' | 'system';
    actor_id?: number;
    action: string;
    entity_type?: string;
    entity_id?: number;
    payload?: Record<string, any>;
  }): Promise<AuditLog> {
    try {
      logger.debug('Creating audit log entry', { action: data.action, actor_type: data.actor_type });

      const auditLog = await this.db.auditLog.create({
        workspace_id: data.workspace_id,
        actor_type: data.actor_type,
        actor_id: data.actor_id || null,
        action: data.action,
        entity_type: data.entity_type || null,
        entity_id: data.entity_id || null,
        payload: data.payload || null,
      });

      logger.info('Audit log created', { 
        log_id: auditLog.log_id, 
        action: data.action,
        workspace_id: data.workspace_id,
      });

      return auditLog;
    } catch (error) {
      logger.error('Failed to create audit log', { error, data });
      throw new Error(`Failed to create audit log: ${error}`);
    }
  }

  /**
   * Get audit trail for a workspace
   * Returns most recent logs first
   */
  async getAuditTrail(workspaceId: number, limit: number = 100): Promise<AuditLog[]> {
    try {
      logger.debug('Fetching audit trail', { workspaceId, limit });

      const logs = await this.db.auditLog.findByWorkspace(workspaceId, limit);

      logger.debug('Audit trail fetched', { 
        workspaceId, 
        count: logs.length,
      });

      return logs;
    } catch (error) {
      logger.error('Failed to fetch audit trail', { error, workspaceId });
      throw new Error(`Failed to fetch audit trail: ${error}`);
    }
  }

  /**
   * Get audit logs for a specific entity
   * Useful for tracking history of a specific pick, player, etc.
   */
  async getEntityLogs(entityType: string, entityId: number): Promise<AuditLog[]> {
    try {
      logger.debug('Fetching entity logs', { entityType, entityId });

      // Note: findByEntity not in IDatabase interface yet, so we'll fetch all and filter
      const allLogs = await this.db.auditLog.findByWorkspace(0, 1000); // Temporary workaround
      const logs = allLogs.filter(log => 
        log.entity_type === entityType && log.entity_id === entityId
      );

      logger.debug('Entity logs fetched', { 
        entityType, 
        entityId, 
        count: logs.length,
      });

      return logs;
    } catch (error) {
      logger.error('Failed to fetch entity logs', { error, entityType, entityId });
      throw new Error(`Failed to fetch entity logs: ${error}`);
    }
  }
}
