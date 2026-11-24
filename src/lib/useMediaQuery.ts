import { useCallback, useSyncExternalStore } from 'react';

/**
 * Where a wide table has room beside the menu. The orders table needs about 960px in
 * Portuguese, the longest of the three languages; that is a window of 1200px or more.
 */
export const ROOM_FOR_A_WIDE_TABLE = '(min-width: 1200px)';

/**
 * True while the window matches a CSS media query. Used where a narrow screen gets a
 * different structure, not only different spacing: a table becomes a list of cards.
 * Where there is no window to ask (a test, a pre-render) it answers `fallback`.
 */
export function useMediaQuery(query: string, fallback = true): boolean {
  const supported = typeof window !== 'undefined' && typeof window.matchMedia === 'function';
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (!supported) return () => undefined;
      const list = window.matchMedia(query);
      list.addEventListener('change', onChange);
      return () => list.removeEventListener('change', onChange);
    },
    [query, supported],
  );
  return useSyncExternalStore(
    subscribe,
    () => (supported ? window.matchMedia(query).matches : fallback),
    () => fallback,
  );
}
