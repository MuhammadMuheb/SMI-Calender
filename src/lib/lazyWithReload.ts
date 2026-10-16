import { lazy, type ComponentType } from 'react';

const RELOAD_KEY = 'smi_chunk_reload_at';
/** Don't reload again within this window, so a real outage can't loop. */
const RELOAD_COOLDOWN_MS = 30_000;

/** True for the errors browsers throw when a code-split file can't be loaded. */
export function isChunkLoadError(error: unknown): boolean {
  const message = error instanceof Error ? `${error.name} ${error.message}` : String(error ?? '');
  return /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|ChunkLoadError|Loading chunk .* failed|Unable to preload CSS/i.test(message);
}

/**
 * After a deploy, a page opened on the old version asks for code files that no
 * longer exist. Reload once to pick up the new version. Returns false if we
 * already reloaded very recently (so the caller should show an error instead).
 */
export function reloadForNewVersion(): boolean {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) ?? 0);
    if (Date.now() - last < RELOAD_COOLDOWN_MS) return false;
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch {
    // Storage unavailable (private mode): still reload once.
  }
  window.location.reload();
  return true;
}

/**
 * React.lazy that recovers from a stale deployment: if the page's code file
 * can't be loaded, reload the app to get the current version.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- matches React.lazy's own constraint
export function lazyWithReload<T extends ComponentType<any>>(load: () => Promise<{ default: T }>) {
  return lazy(async () => {
    try {
      return await load();
    } catch (error) {
      if (isChunkLoadError(error) && reloadForNewVersion()) {
        // Keep suspending while the page reloads.
        return new Promise<{ default: T }>(() => {});
      }
      throw error;
    }
  });
}
