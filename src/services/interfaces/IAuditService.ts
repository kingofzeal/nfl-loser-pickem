import { AuditLog } from '../../types';

export interface IAuditService {
  /**
   * Log an action
   */
  log(data: {
    workspace_id: number;
    actor_type: 'player' | 'admin' | 'system';
    actor_id?: number;
    action: string;
    entity_type?: string;
    entity_id?: number;
    payload?: Record<string, any>;
  }): Promise<AuditLog>;

  /**
   * Get audit trail for a workspace
   */
  getAuditTrail(workspaceId: number, limit?: number): Promise<AuditLog[]>;

  /**
   * Get audit logs for a specific entity
   */
  getEntityLogs(entityType: string, entityId: number): Promise<AuditLog[]>;
}
