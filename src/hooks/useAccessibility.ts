import { useCallback } from 'react';

/**
 * Hook for accessibility helpers - keyboard navigation and ARIA support
 */
export function useAccessibility() {
  const handleEscapeKey = useCallback((e: React.KeyboardEvent, callback: () => void) => {
    if (e.key === 'Escape') {
      callback();
    }
  }, []);

  const handleEnterOrSpace = useCallback((e: React.KeyboardEvent, callback: () => void) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      callback();
    }
  }, []);

  return {
    handleEscapeKey,
    handleEnterOrSpace,
  };
}

/**
 * Helper for ARIA announcements
 */
export function announceToScreenReader(message: string) {
  const announcement = document.createElement('div');
  announcement.setAttribute('role', 'status');
  announcement.setAttribute('aria-live', 'polite');
  announcement.className = 'sr-only';
  announcement.textContent = message;
  document.body.appendChild(announcement);
  setTimeout(() => announcement.remove(), 1000);
}

/**
 * Helper to focus element after delay (useful for modal focus management)
 */
export function focusElement(element: HTMLElement | null, delay = 0) {
  if (element) {
    setTimeout(() => element.focus(), delay);
  }
}
