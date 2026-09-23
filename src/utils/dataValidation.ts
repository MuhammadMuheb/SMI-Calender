/**
 * BULLETPROOF data validation layer
 * Ensures all data flowing through the app is safe and never causes displayName crashes
 */

import type { StaffUser } from '@/models/user';
import type { LeaveRequest } from '@/models/leave';

/**
 * Validate and sanitize a single user object
 * NEVER returns undefined displayName
 */
export function validateUser(user: any): StaffUser {
  if (!user || typeof user !== 'object') {
    return {
      id: 'unknown',
      username: 'unknown',
      displayName: 'Unknown User',
      pin: '',
      role: 'staff',
      isActive: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  return {
    id: String(user.id || user.userId || 'unknown').trim() || 'unknown',
    username: String(user.username || user.userName || 'unknown').trim() || 'unknown',
    displayName: String(user.displayName || user.name || user.display_name || user.userName || user.username || 'Unknown User')
      .trim() || 'Unknown User',
    pin: String(user.pin || user.pin_hash || '').trim(),
    role: String(user.role || 'staff').trim() as any,
    isActive: user.isActive !== false && user.is_active !== false,
    createdAt: String(user.createdAt || user.created_at || new Date().toISOString()).trim(),
    updatedAt: String(user.updatedAt || user.updated_at || new Date().toISOString()).trim(),
    vacationOverride: typeof user.vacationOverride === 'number' ? user.vacationOverride : null,
    regularOverride: typeof user.regularOverride === 'number' ? user.regularOverride : null,
    jobRole: Array.isArray(user.jobRole) ? user.jobRole : Array.isArray(user.job_role) ? user.job_role : ['Office'],
  };
}

/**
 * Validate and sanitize an array of users
 * GUARANTEES every user has valid displayName
 */
export function validateUsers(users: any[]): StaffUser[] {
  if (!Array.isArray(users)) return [];

  return users
    .filter(u => {
      try {
        return u && (u.id || u.userId || u.username || u.display_name);
      } catch {
        return false;
      }
    })
    .map(u => {
      try {
        return validateUser(u);
      } catch (err) {
        console.error('Error validating user:', err);
        return validateUser(null);
      }
    });
}

/**
 * Validate a leave request with safe userRef
 */
export function validateLeaveRequest(req: any): LeaveRequest | null {
  if (!req || typeof req !== 'object') return null;

  try {
    return {
      id: String(req.id || '').trim() || `lr_${Date.now()}`,
      userId: String(req.userId || req.user_id || '').trim() || 'unknown',
      userRef: {
        id: String(req.userRef?.id || req.userId || req.user_id || '').trim() || 'unknown',
        displayName: String(req.userRef?.displayName || req.user_display_name || req.userName || 'Unknown User')
          .trim() || 'Unknown User',
        role: String(req.userRef?.role || req.user_role || 'staff').trim() as any,
      },
      date: String(req.date || '').trim(),
      leaveType: String(req.leaveType || req.leave_type || 'regular_day_off').trim() as any,
      status: String(req.status || 'pending').trim() as any,
      staffNote: String(req.staffNote || req.staff_note || '').trim(),
      approverNote: String(req.approverNote || req.approver_note || '').trim(),
      decidedBy: (req.decidedBy || req.decided_by) ? {
        id: String((req.decidedBy || req.decided_by)?.id || '').trim() || 'unknown',
        displayName: String((req.decidedBy || req.decided_by)?.displayName || 'Unknown')
          .trim() || 'Unknown',
        role: String((req.decidedBy || req.decided_by)?.role || 'staff').trim() as any,
      } : null,
      decidedAt: req.decidedAt || req.decided_at || null,
      isOverridden: req.isOverridden === true || req.is_overridden === true,
      overriddenBy: (req.overriddenBy || req.overridden_by) ? {
        id: String((req.overriddenBy || req.overridden_by)?.id || '').trim() || 'unknown',
        displayName: String((req.overriddenBy || req.overridden_by)?.displayName || 'Unknown')
          .trim() || 'Unknown',
        role: String((req.overriddenBy || req.overridden_by)?.role || 'staff').trim() as any,
      } : null,
      overriddenAt: req.overriddenAt || req.overridden_at || null,
      createdAt: String(req.createdAt || req.created_at || new Date().toISOString()).trim(),
      updatedAt: String(req.updatedAt || req.updated_at || new Date().toISOString()).trim(),
    };
  } catch (err) {
    console.error('Error validating leave request:', err);
    return null;
  }
}

/**
 * Validate an array of leave requests
 */
export function validateLeaveRequests(requests: any[]): LeaveRequest[] {
  if (!Array.isArray(requests)) return [];

  return requests
    .map(req => {
      try {
        return validateLeaveRequest(req);
      } catch (err) {
        console.error('Error validating leave request:', err);
        return null;
      }
    })
    .filter((req): req is LeaveRequest => req !== null);
}

/**
 * Safe map operation for users
 * Prevents displayName crashes in .map()
 */
export function safeMapUsers<T>(
  users: any[] | null | undefined,
  mapper: (user: StaffUser) => T
): T[] {
  if (!Array.isArray(users)) return [];

  return users
    .map(user => {
      try {
        const validated = validateUser(user);
        return mapper(validated);
      } catch (err) {
        console.error('Error mapping user:', err);
        return null;
      }
    })
    .filter((item): item is T => item !== null);
}

/**
 * Safe map operation for leave requests
 */
export function safeMapRequests<T>(
  requests: any[] | null | undefined,
  mapper: (request: LeaveRequest) => T
): T[] {
  if (!Array.isArray(requests)) return [];

  return requests
    .map(req => {
      try {
        const validated = validateLeaveRequest(req);
        if (!validated) return null;
        return mapper(validated);
      } catch (err) {
        console.error('Error mapping leave request:', err);
        return null;
      }
    })
    .filter((item): item is T => item !== null);
}

/**
 * Extract displayName safely from any user-like object
 */
export function getDisplayName(user: any): string {
  if (!user) return 'Unknown User';
  if (typeof user === 'string') return user;

  const name = user.displayName || user.name || user.display_name || user.userName || user.username;
  return (typeof name === 'string' && name.trim()) ? name.trim() : 'Unknown User';
}

/**
 * Extract userId safely
 */
export function getUserId(user: any): string {
  if (!user) return 'unknown';
  return String(user.id || user.userId || user.user_id || 'unknown').trim() || 'unknown';
}

/**
 * Get safe user reference with all required fields
 */
export function getUserRef(user: any) {
  return {
    id: getUserId(user),
    displayName: getDisplayName(user),
    role: String(user.role || 'staff').trim(),
  };
}
