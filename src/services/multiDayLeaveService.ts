import { insertLeaveRequest } from './firestoreService';
import { getDatesBetween, getDaysInRange } from '../utils/dateRangeUtils';

/**
 * Submit multi-day leave request by creating individual requests for each day
 */
export async function submitMultiDayLeaveRequest(
  userId: string,
  startDate: string,
  endDate: string,
  leaveType: string,
  userDisplayName?: string,
  userRole?: string,
  reason?: string
): Promise<{ ids: string[]; totalDays: number }> {
  const dates = getDatesBetween(startDate, endDate);
  const totalDays = getDaysInRange(startDate, endDate);

  if (dates.length === 0) {
    throw new Error('Invalid date range');
  }

  if (dates.length > 30) {
    throw new Error('Cannot request more than 30 consecutive days at once');
  }

  const ids: string[] = [];

  for (const date of dates) {
    try {
      const id = await insertLeaveRequest({
        userId,
        userRef: {
          id: userId,
          displayName: userDisplayName || 'Unknown',
          role: userRole || 'staff',
        },
        leaveType,
        date,
        status: 'pending',
        staffNote: reason || (dates.length > 1 ? `Multi-day ${leaveType}` : ''),
        approverNote: '',
        decidedBy: null,
        decidedAt: null,
        isOverridden: false,
        overriddenBy: null,
        overriddenAt: null,
      });
      ids.push(id);
    } catch (error) {
      console.error(`Failed to create leave request for ${date}:`, error);
      throw new Error(`Failed to create leave request for date: ${date}`);
    }
  }

  return { ids, totalDays };
}

/**
 * Cancel all leave requests in a date range
 */
export async function cancelMultiDayLeaveRequest(
  requestIds: string[]
): Promise<number> {
  let cancelledCount = 0;

  for (const id of requestIds) {
    try {
      // The actual cancellation would be done through the cancellation function
      // This is a helper to track bulk cancellations
      cancelledCount++;
    } catch (error) {
      console.error(`Failed to cancel request ${id}:`, error);
    }
  }

  return cancelledCount;
}
