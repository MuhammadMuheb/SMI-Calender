/**
 * A public holiday — everyone is off, not counted against balances.
 */
export interface Holiday {
  id: string;
  name: string;
  date: string; // YYYY-MM-DD
  isRecurring: boolean; // Same date every year?
  createdAt: string;
}

/**
 * A special day declared by super admin.
 *
 * Special days can behave in two ways (set by admin at creation):
 *
 * 1. consumesBalance = true
 *    The day off is granted but it uses one of the staff's
 *    regular day-off allowance. Like a forced day off.
 *
 * 2. consumesBalance = false
 *    The day off is an extra — it does NOT consume any balance.
 *    A gift/bonus day off essentially.
 */
export interface SpecialDay {
  id: string;
  name: string;
  date: string; // YYYY-MM-DD
  consumesBalance: boolean;
  appliesToAll: boolean; // true = all staff, false = specific users
  appliesTo: string[]; // user IDs (only used if appliesToAll = false)
  createdBy: string; // admin user ID
  createdAt: string;
}
