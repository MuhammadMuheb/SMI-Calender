import type { AuditLogEntry, AuditAction, AuditEntity } from '../models/audit';

/**
 * STATUS: SERVICE PLACEHOLDER
 * Creates audit log entries in memory.
 * No persistence — entries exist only for the session.
 * Will be connected to a real database later.
 */

/** In-memory audit log store */
let auditLog: AuditLogEntry[] = [];

export function logAction(
  actorId: string,
  actorName: string,
  action: AuditAction,
  entityType: AuditEntity,
  entityId: string,
  description: string,
  oldValue: unknown = null,
  newValue: unknown = null,
): AuditLogEntry {
  const entry: AuditLogEntry = {
    id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    actorId,
    actorName,
    action,
    entityType,
    entityId,
    description,
    oldValue: oldValue ? JSON.stringify(oldValue) : null,
    newValue: newValue ? JSON.stringify(newValue) : null,
    timestamp: new Date().toISOString(),
  };

  auditLog.push(entry);
  return entry;
}

export function getAuditLog(): AuditLogEntry[] {
  return [...auditLog];
}

export function filterAuditLog(filters: {
  actorId?: string;
  action?: AuditAction;
  entityType?: AuditEntity;
  entityId?: string;
  fromDate?: string;
  toDate?: string;
}): AuditLogEntry[] {
  return auditLog.filter((e) => {
    if (filters.actorId && e.actorId !== filters.actorId) return false;
    if (filters.action && e.action !== filters.action) return false;
    if (filters.entityType && e.entityType !== filters.entityType) return false;
    if (filters.entityId && e.entityId !== filters.entityId) return false;
    if (filters.fromDate && e.timestamp < filters.fromDate) return false;
    if (filters.toDate && e.timestamp > filters.toDate) return false;
    return true;
  });
}

/** Reset log — useful for testing */
export function clearAuditLog(): void {
  auditLog = [];
}
