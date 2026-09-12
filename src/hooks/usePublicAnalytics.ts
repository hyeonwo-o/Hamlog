import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import {
  recordAnalyticsHeartbeat,
  recordAnalyticsVisit
} from '../api/analyticsApi';
import { PUBLIC_ANALYTICS_REFRESH_EVENT } from '../utils/analyticsEvents';

const HEARTBEAT_INTERVAL_MS = 30_000;

const isTrackablePath = (path: string) => (
  path === '/' || path.startsWith('/posts/') || path.startsWith('/p/')
);

const createEventId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `visit_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
};

export const usePublicAnalytics = () => {
  const location = useLocation();
  const path = location.pathname;
  const navigationEventRef = useRef<{
    path: string;
    eventId: string;
    sent: boolean;
  } | null>(null);

  useEffect(() => {
    if (!isTrackablePath(path)) {
      navigationEventRef.current = null;
      return;
    }

    // Search filters and table-of-contents links change location.key without
    // opening another page. Keep both the visit ID and heartbeat cadence intact.
    if (navigationEventRef.current?.path !== path) {
      navigationEventRef.current = {
        path,
        eventId: createEventId(),
        sent: false
      };
    }

    const navigationEvent = navigationEventRef.current;
    const sendHeartbeat = () => {
      if (document.visibilityState !== 'visible') return;
      void recordAnalyticsHeartbeat(path).catch(() => undefined);
    };

    if (!navigationEvent.sent) {
      navigationEvent.sent = true;
      void recordAnalyticsVisit(path, navigationEvent.eventId)
        .then(() => window.dispatchEvent(new Event(PUBLIC_ANALYTICS_REFRESH_EVENT)))
        .catch(() => undefined);
    }

    const intervalId = window.setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') sendHeartbeat();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [path]);
};
