import type { ReactNode } from 'react';
import { usePublicAnalytics } from '../../hooks/usePublicAnalytics';

interface PublicAnalyticsTrackerProps {
  children: ReactNode;
}

const PublicAnalyticsTracker = ({ children }: PublicAnalyticsTrackerProps) => {
  usePublicAnalytics();
  return children;
};

export default PublicAnalyticsTracker;
