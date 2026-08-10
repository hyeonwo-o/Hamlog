import { useCallback, useEffect, useState } from 'react';
import { fetchPublicAnalyticsSummary } from '../api/analyticsApi';
import type { PublicAnalyticsSummary } from '../types/analytics';
import { PUBLIC_ANALYTICS_REFRESH_EVENT } from '../utils/analyticsEvents';

const REFRESH_INTERVAL_MS = 30_000;

export const usePublicAnalyticsSummary = () => {
  const [summary, setSummary] = useState<PublicAnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const refresh = useCallback(async (bypassCache = false) => {
    try {
      const nextSummary = await fetchPublicAnalyticsSummary(
        bypassCache ? { cache: 'reload' } : undefined
      );
      setSummary(nextSummary);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refresh();
    }, REFRESH_INTERVAL_MS);
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') void refresh(true);
    };
    const handleAnalyticsRefresh = () => void refresh(true);

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener(PUBLIC_ANALYTICS_REFRESH_EVENT, handleAnalyticsRefresh);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener(PUBLIC_ANALYTICS_REFRESH_EVENT, handleAnalyticsRefresh);
    };
  }, [refresh]);

  return { summary, loading, error };
};
