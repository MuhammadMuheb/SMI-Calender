/**
 * Every significant action in the system is recorded as an audit entry.
 * Super admin can view and filter the full log.
 *
 * The `oldValue` and `newValue` fields capture what changed,
 * stored as JSON strings for flexibility.
 */

export type AuditAction =
  | 'work_policy_updated' | 'work_arrangement_request' | 'work_arrangement_assign' | 'work_arrangement_approve' | 'work_arrangement_reject' | 'work_arrangement_modify' | 'work_arrangement_revoke' | 'work_arrangement_cancel'
  | 'user_created'
  | 'user_updated'
  | 'user_deleted'
  | 'role_assigned'
  | 'role_removed'
  | 'leave_requested'
  | 'leave_approved'
  | 'leave_rejected'
  | 'leave_cancelled'
  | 'leave_overridden'
  | 'balance_adjusted'
  | 'staffing_rule_created'
  | 'staffing_rule_updated'
  | 'staffing_rule_deleted'
  | 'special_day_created'
  | 'special_day_updated'
  | 'special_day_deleted'
  | 'holiday_created'
  | 'holiday_deleted'
  | 'auto_assignment_run'
  | 'notification_setting_changed';

export type AuditEntity =
  | 'work_arrangement' | 'work_policy'
  | 'user'
  | 'leave_request'
  | 'balance'
  | 'staffing_rule'
  | 'special_day'
  | 'holiday'
  | 'auto_assignment'
  | 'notification_setting';

export interface AuditLogEntry {
  id: string;

  /** Who performed the action */
  actorId: string;
  actorName: string;

  /** What was done */
  action: AuditAction;

  /** What entity was affected */
  entityType: AuditEntity;
  entityId: string;

  /** Human-readable summary */
  description: string;

  /** Before/after values for change tracking (JSON strings, nullable) */
  oldValue: string | null;
  newValue: string | null;

  /** When it happened */
  timestamp: string; // ISO datetime
}
