import type { StaffUser } from '../models/user';

/**
 * Safe user property accessor with fallbacks for undefined/missing data
 */
export const safeUser = (user: StaffUser | null | undefined) => ({
  id: user?.id ?? 'unknown',
  username: user?.username ?? 'unknown-user',
  displayName: user?.displayName ?? user?.username ?? 'Unknown User',
  pin: user?.pin ?? '',
  role: user?.role ?? 'staff',
  isActive: user?.isActive !== false,
  createdAt: user?.createdAt ?? new Date().toISOString(),
  updatedAt: user?.updatedAt ?? new Date().toISOString(),
  vacationOverride: user?.vacationOverride ?? null,
  regularOverride: user?.regularOverride ?? null,
  jobRole: Array.isArray(user?.jobRole) ? user.jobRole : ['Office'],
});

/**
 * Get display name with multiple fallbacks
 */
export const getUserDisplayName = (user: StaffUser | null | undefined): string => {
  return user?.displayName ?? user?.username ?? 'Unknown';
};

/**
 * Get user initials for avatar
 */
export const getUserInitials = (user: StaffUser | null | undefined): string => {
  const displayName = getUserDisplayName(user);
  return (displayName[0] ?? '?').toUpperCase();
};

/**
 * Get user role with default fallback
 */
export const getUserRole = (user: StaffUser | null | undefined) => {
  return user?.role ?? 'staff';
};

/**
 * Safely get user ID
 */
export const getUserId = (user: StaffUser | null | undefined): string => {
  return user?.id ?? 'unknown';
};

/**
 * Filter and validate user array
 */
export const validateUsers = (users: any[]): StaffUser[] => {
  return (users ?? []).filter((u): u is StaffUser => {
    return u && typeof u === 'object' && (u.id || u.username);
  });
};

/**
 * Safe user array access
 */
export const getSafeUserArray = (users: StaffUser[] | null | undefined): StaffUser[] => {
  return Array.isArray(users) ? users.filter((u) => u && u.id) : [];
};
