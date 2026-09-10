import type { LeaveRequest, LeaveType, LeaveStatus } from '../models/leave';
import type { UserRef } from '../models/user';
import { isValidDate, isFutureDate, normalizeDateStr } from '../models/validation';

/**
 * STATUS: SERVICE PLACEHOLDER
 * All methods operate on in-memory data passed in.
 * No real database, no real API calls.
 * Will be connected to a backend in a later phase.
 */

export function createLeaveRequest(
  userId: string,
  userRef: UserRef,
  date: string,
  leaveType: LeaveType,
  note: string = '',
): LeaveRequest | { error: string } {
  const normalizedDate = normalizeDateStr(date);
  if (!isValidDate(normalizedDate)) {
    return { error: 'Invalid date format' };
  }
  if (!isFutureDate(normalizedDate)) {
    return { error: 'Cannot request leave for past dates' };
  }

  return {
    id: `lr_${Date.now()}`,
    userId,
    userRef,
    date: normalizedDate,
    leaveType,
    status: 'pending',
    staffNote: note,
    approverNote: '',
    decidedBy: null,
    decidedAt: null,
    isOverridden: false,
    overriddenBy: null,
    overriddenAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function approveLeaveRequest(
  request: LeaveRequest,
  approver: UserRef,
  note: string = '',
): LeaveRequest {
  return {
    ...request,
    status: 'approved',
    decidedBy: approver,
    decidedAt: new Date().toISOString(),
    approverNote: note,
    updatedAt: new Date().toISOString(),
  };
}

export function rejectLeaveRequest(
  request: LeaveRequest,
  approver: UserRef,
  note: string = '',
): LeaveRequest {
  return {
    ...request,
    status: 'rejected',
    decidedBy: approver,
    decidedAt: new Date().toISOString(),
    approverNote: note,
    updatedAt: new Date().toISOString(),
  };
}

export function overrideLeaveRequest(
  request: LeaveRequest,
  newStatus: LeaveStatus,
  admin: UserRef,
  note: string = '',
): LeaveRequest {
  return {
    ...request,
    status: newStatus,
    isOverridden: true,
    overriddenBy: admin,
    overriddenAt: new Date().toISOString(),
    approverNote: note,
    updatedAt: new Date().toISOString(),
  };
}

export function filterRequestsByStatus(
  requests: LeaveRequest[],
  status: LeaveStatus,
): LeaveRequest[] {
  return requests.filter((r) => r.status === status);
}

export function filterRequestsByUser(
  requests: LeaveRequest[],
  userId: string,
): LeaveRequest[] {
  return requests.filter((r) => r.userId === userId);
}
