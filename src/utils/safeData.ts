/**
 * Safe data utilities - ensure no crashes from undefined/null data
 * These wrap all data operations with fallbacks
 */

export const safeArray = <T>(arr: T[] | null | undefined): T[] => Array.isArray(arr) ? arr : [];

export const safeString = (str: string | null | undefined, fallback = 'Unknown'): string => {
  return (typeof str === 'string' && str.trim()) ? str : fallback;
};

export const safeObject = <T extends Record<string, any>>(obj: T | null | undefined, defaults: Partial<T>): T => {
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
