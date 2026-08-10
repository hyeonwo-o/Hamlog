export interface AnalyticsDay {
  date: string;
  visitors: number;
  pageViews: number;
}

export interface AnalyticsSummary {
  realtimeVisitors: number;
  totalVisitors: number;
  totalPageViews: number;
  today: {
    visitors: number;
    pageViews: number;
  };
  recentDays: AnalyticsDay[];
  timeZone: string;
  updatedAt: string | null;
  generatedAt: string;
}

export interface PublicAnalyticsSummary {
  totalVisitors: number;
  realtimeVisitors: number;
}
