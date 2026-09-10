/**
 * In-app notification for a user.
 * Supports confirm/reject workflow for shift notifications.
 */

export type NotificationType =
  | 'leave_approved'
  | 'leave_rejected'
  | 'leave_overridden'
  | 'new_request_pending'
  | 'daily_absence_summary'
  | 'staffing_warning'
  | 'balance_adjusted'
  | 'system_announcement'
  | 'coffee_offer'
  | 'coffee_response';

export type ConfirmStatus = 'pending' | 'confirmed' | 'rejected';

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  isRead: boolean;
  /** Confirm/reject workflow for shift notifications */
  confirmStatus: ConfirmStatus;
  /** If rejected, the reason provided by staff */
  rejectReason: string;
  entityType?: string;
  entityId?: string;
  createdAt: string;
}

/**
 * Global notification settings (managed by super admin).
 */
export interface NotificationSettings {
  dailyReminderTime: string;
  dailyReminderEnabled: boolean;
  updatedAt: string;
  updatedBy: string;
}
