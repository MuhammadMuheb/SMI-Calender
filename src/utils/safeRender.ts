/**
 * Bulletproof safety utilities for rendering user data
 * Prevents "Cannot read properties of undefined (reading 'displayName')" errors
 */

/**
 * Safely get displayName from any user-like object
 * Returns a valid string in all cases - never null/undefined
 */
export const safeGetDisplayName = (user: any): string => {
  if (!user) return 'Unknown User';
  if (typeof user === 'string') return user;
  if (typeof user.displayName === 'string' && user.displayName.trim()) return user.displayName.trim();
  if (typeof user.username === 'string' && user.username.trim()) return user.username.trim();
  if (typeof user.name === 'string' && user.name.trim()) return user.name.trim();
  if (typeof user.userName === 'string' && user.userName.trim()) return user.userName.trim();
  return 'Unknown User';
};

/**
 * Safely get first letter for avatar
 */
export const safeGetInitial = (user: any): string => {
  const name = safeGetDisplayName(user);
  return (name[0] || '?').toUpperCase();
};

/**
 * Safely access nested user ref
 */
export const safeGetUserRef = (obj: any): { displayName: string; id: string; role: string } => {
  const userRef = obj?.userRef || obj;
  return {
    displayName: safeGetDisplayName(userRef),
    id: userRef?.id ?? obj?.userId ?? 'unknown',
    role: userRef?.role ?? 'staff',
  };
};

/**
 * Safe array map with error handling
 */
export const safeMapArray = <T, U>(
  arr: T[] | null | undefined,
  mapper: (item: T, index: number) => U | null
): U[] => {
  if (!Array.isArray(arr)) return [];
  try {
    return arr
      .map((item, index) => {
        try {
          return mapper(item, index);
        } catch (err) {
          console.warn('Error mapping item:', err);
          return null;
        }
      })
      .filter((item): item is U => item !== null);
  } catch (err) {
    console.error('Error in safeMapArray:', err);
    return [];
  }
};

/**
 * Wrap any component render in error handling
 */
export const safeRender = <T extends object>(
  data: T | null | undefined,
  renderer: (data: T) => React.ReactNode,
  fallback: React.ReactNode = null
): React.ReactNode => {
  if (!data) return fallback;
  try {
    return renderer(data);
  } catch (err) {
    console.error('Error in safeRender:', err);
    return fallback;
  }
};

/**
 * Validate that user has required displayName field
 */
export const validateUserDisplayName = (user: any): user is { displayName: string } => {
  return user && typeof user.displayName === 'string' && user.displayName.length > 0;
};

/**
 * Ensure all users in array have valid displayName
 */
export const ensureUsersHaveDisplayNames = (users: any[]): any[] => {
  return (users ?? []).map(user => ({
    ...user,
    displayName: safeGetDisplayName(user),
  }));
};
