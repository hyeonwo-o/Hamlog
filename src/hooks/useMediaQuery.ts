import { useCallback, useSyncExternalStore } from 'react';

/** Keep responsive UI state in sync with the same breakpoints used by CSS. */
export const useMediaQuery = (query: string) => {
  const subscribe = useCallback((onChange: () => void) => {
    const media = window.matchMedia(query);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [query]);
  const getSnapshot = useCallback(() => window.matchMedia(query).matches, [query]);

  return useSyncExternalStore(subscribe, getSnapshot, () => false);
};
