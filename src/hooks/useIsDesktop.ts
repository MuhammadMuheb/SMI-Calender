import { useCallback, useSyncExternalStore } from 'react';

/** True when the viewport is at least `breakpoint` px wide (default: Tailwind's `lg`, 1024px). Reactive to resize. */
export function useIsDesktop(breakpoint = 1024): boolean {
  const query = `(min-width: ${breakpoint}px)`;
  const subscribe = useCallback((onChange: () => void) => {
    const mql = window.matchMedia(query);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);
  return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches, () => false);
}
