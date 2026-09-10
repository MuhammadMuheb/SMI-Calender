/**
 * Day swap between two staff members with the same job role.
 *
 * Flow:
 * 1. Staff A (who has an approved day off) proposes a swap with Staff B
 * 2. Staff B receives a notification
 * 3. If Staff B accepts → swap is instant (A works, B gets the day off)
 * 4. Manager and super admin are notified of the completed swap
 * 5. If Staff B declines → swap is cancelled
 *
 * Requirement: both staff must share at least one common job role.
 */

export type SwapStatus = 'pending' | 'accepted' | 'declined' | 'cancelled';

export interface DaySwap {
  id: string;

  /** Staff member proposing the swap (giving up their day off) */
  proposerId: string;
  proposerName: string;

  /** Staff member receiving the swap (getting the day off) */
  receiverId: string;
  receiverName: string;

  /** The date being swapped */
  date: string;

  /** The original leave request ID that the proposer is giving up */
  originalRequestId: string;

  /** Common job role that makes this swap valid */
  commonJobRoleId: string;

  status: SwapStatus;

  createdAt: string;
  resolvedAt: string | null;
}
