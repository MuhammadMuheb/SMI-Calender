/**
 * PRODUCTION SAFETY LAYER
 * Global fallbacks that make the app IMPOSSIBLE to crash from undefined data
 */

import type { StaffUser } from '@/models/user';

// Safe empty user for any place that needs a user
export const SAFE_EMPTY_USER: StaffUser = {
  id: 'unknown',
  username: 'unknown',
  displayName: 'Unknown User',
  pin: '',
  role: 'staff' as const,
  isActive: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  jobRole: [],
};

// Safe empty array of users
export const SAFE_EMPTY_USERS: StaffUser[] = [];

/**
 * Get safe user or return safe default
 * GUARANTEED to never return undefined
 */
export const getSafeUser = (user: StaffUser | null | undefined): StaffUser => {
  if (!user) return SAFE_EMPTY_USER;
  return {
    ...SAFE_EMPTY_USER,
    ...user,
    displayName: user.displayName || user.username || SAFE_EMPTY_USER.displayName,
    username: user.username || SAFE_EMPTY_USER.username,
    jobRole: Array.isArray(user.jobRole) ? user.jobRole : [],
  };
};

/**
 * Get safe users array
 * GUARANTEED to return an array, never null/undefined
 */
export const getSafeUsers = (users: StaffUser[] | null | undefined): StaffUser[] => {
  if (!Array.isArray(users)) return [];
  return users
    .filter((u): u is StaffUser => u != null)
    .map(u => getSafeUser(u));
};

/**
 * Safe map operation - NEVER crashes even if callback throws
 */
export const safeMapUsers = <T>(
  users: StaffUser[] | null | undefined,
  callback: (user: StaffUser) => T | null
): T[] => {
  try {
    return getSafeUsers(users)
      .map(u => {
        try {
          return callback(u);
        } catch (err) {
          console.warn('Error mapping user:', err);
          return null;
        }
      })
      .filter((item): item is T => item !== null);
  } catch (err) {
    console.error('Fatal error in safeMapUsers:', err);
    return [];
  }
};

/**
 * Display name extractor - safe for all contexts
 */
export const getDisplayName = (user: StaffUser | null | undefined): string => {
  if (!user) return 'Unknown';
  return (user.displayName || user.username || 'Unknown').trim() || 'Unknown';
};

/**
 * User initial for avatars - safe
 */
export const getUserInitial = (user: StaffUser | null | undefined): string => {
  const name = getDisplayName(user);
  return (name[0] || '?').toUpperCase();
};
