import { useCallback, useEffect, useState } from 'react';
import { fetchAnalyticsSummary } from '../api/analyticsApi';
import type { AnalyticsSummary } from '../types/analytics';

const SUMMARY_REFRESH_INTERVAL_MS = 30_000;

export const useAnalyticsSummary = (enabled: boolean) => {
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);

    try {
      const nextSummary = await fetchAnalyticsSummary();
      setSummary(nextSummary);
      setError('');
    } catch (refreshError) {
      setError(refreshError instanceof Error
        ? refreshError.message
        : '방문자 통계를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;

    void refresh();
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refresh();
    }, SUMMARY_REFRESH_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [enabled, refresh]);

  return { summary, loading, error, refresh };
};
