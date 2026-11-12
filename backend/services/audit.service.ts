import { getDb, isDatabaseInitialized } from '../database/connection';

export interface AuditLogEntry {
  id: number;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: string | null;
  created_at: string;
}

export function logAudit(
  action: string,
  entityType: string,
  entityId?: string | number | null,
  details?: Record<string, any> | null
): void {
  try {
    if (!isDatabaseInitialized()) return;
    const db = getDb();
    const detailsJson = details ? JSON.stringify(details) : null;
    const entId = entityId !== undefined && entityId !== null ? String(entityId) : null;

    db.prepare(`
      INSERT INTO audit_logs (action, entity_type, entity_id, details)
      VALUES (?, ?, ?, ?)
    `).run(action, entityType, entId, detailsJson);
  } catch (err) {
    console.error('[AuditService.logAudit] Failed to log audit event:', err);
  }
}

export function listAuditLogs(limit = 100): AuditLogEntry[] {
  try {
    if (!isDatabaseInitialized()) return [];
    const db = getDb();
    return db
      .prepare(`SELECT * FROM audit_logs ORDER BY created_at DESC, id DESC LIMIT ?`)
      .all(limit) as AuditLogEntry[];
  } catch (err) {
    console.error('[AuditService.listAuditLogs] Failed to fetch audit logs:', err);
    return [];
  }
}
