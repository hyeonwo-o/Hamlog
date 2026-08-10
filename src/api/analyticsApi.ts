import { requestJson, requestVoid } from './client';
import type {
  AnalyticsSummary,
  PublicAnalyticsSummary
} from '../types/analytics';

const postAnalyticsEvent = (path: string, payload: Record<string, string>) => (
  requestVoid(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  })
);

export const recordAnalyticsVisit = (path: string, eventId: string) => (
  postAnalyticsEvent('/analytics/visit', { path, eventId })
);

export const recordAnalyticsHeartbeat = (path: string) => (
  postAnalyticsEvent('/analytics/heartbeat', { path })
);

export const fetchAnalyticsSummary = () => (
  requestJson<AnalyticsSummary>('/analytics/summary')
);

export const fetchPublicAnalyticsSummary = (options?: RequestInit) => (
  requestJson<PublicAnalyticsSummary>('/analytics/public', options)
);
