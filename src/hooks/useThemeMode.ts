import { useCallback, useEffect, useState } from 'react';

export type ThemeMode = 'dark' | 'light';

const STORAGE_KEY = 'smi_theme_mode';

function readStoredMode(): ThemeMode {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

function applyMode(mode: ThemeMode) {
  if (mode === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
}

/**
 * Dark is the app's default and native look — light mode is opt-in and
 * persisted per-device. Switching modes doesn't need to re-render any other
 * component: every color in the app resolves through the CSS variables that
 * `data-theme` toggles (see src/index.css), so this hook only needs to be
 * used by the toggle button itself.
 */
export function useThemeMode() {
  const [mode, setMode] = useState<ThemeMode>(() => readStoredMode());

  useEffect(() => {
    applyMode(mode);
  }, [mode]);

  const toggle = useCallback(() => {
    setMode((prev) => {
      const next: ThemeMode = prev === 'dark' ? 'light' : 'dark';
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // Ignore — worst case the preference doesn't persist across reloads.
      }
      return next;
    });
  }, []);

  return { mode, toggle };
}
