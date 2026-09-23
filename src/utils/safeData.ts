/**
 * Safe data utilities - ensure no crashes from undefined/null data
 * These wrap all data operations with fallbacks
 */

export const safeArray = <T>(arr: T[] | null | undefined): T[] => Array.isArray(arr) ? arr : [];

export const safeString = (str: string | null | undefined, fallback = 'Unknown'): string => {
  return (typeof str === 'string' && str.trim()) ? str : fallback;
};

export const safeObject = <T extends object>(obj: T | null | undefined, defaults: Partial<T>): T => {
  return { ...defaults, ...obj } as T;
};

export const safeMap = <T, R>(arr: T[] | null | undefined, fn: (item: T, index: number) => R | null): R[] => {
  return safeArray(arr).map(fn).filter((item): item is R => item !== null);
};

export const safeFind = <T>(arr: T[] | null | undefined, fn: (item: T) => boolean): T | undefined => {
  return safeArray(arr).find(fn);
};

export const safeFilter = <T>(arr: T[] | null | undefined, fn: (item: T) => boolean): T[] => {
  return safeArray(arr).filter(fn);
};

export const safeSort = <T extends object>(arr: T[] | null | undefined, key: keyof T, descending = true): T[] => {
  return [...safeArray(arr)].sort((a, b) => {
    const aVal = a[key];
    const bVal = b[key];

    // Handle null/undefined
    if (!aVal && !bVal) return 0;
    if (!aVal) return descending ? 1 : -1;
    if (!bVal) return descending ? -1 : 1;

    // String comparison
    if (typeof aVal === 'string' && typeof bVal === 'string') {
      const comp = aVal.localeCompare(bVal);
      return descending ? -comp : comp;
    }

    // Number comparison
    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return descending ? bVal - aVal : aVal - bVal;
    }

    // Fallback
    return 0;
  });
};
