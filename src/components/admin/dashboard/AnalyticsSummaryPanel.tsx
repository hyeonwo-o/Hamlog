import { Activity, Eye, RefreshCw, Users } from 'lucide-react';
import type { ReactNode } from 'react';
import type { AnalyticsSummary } from '../../../types/analytics';

interface AnalyticsSummaryPanelProps {
  summary: AnalyticsSummary | null;
  loading: boolean;
  error: string;
  onRefresh: () => void;
}

const numberFormatter = new Intl.NumberFormat('ko-KR');

const formatDate = (date: string) => {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  return new Intl.DateTimeFormat('ko-KR', {
    month: 'short',
    day: 'numeric',
    weekday: 'short',
    timeZone: 'UTC'
  }).format(parsed);
};

const MetricCard = ({
  label,
  value,
  description,
  icon
}: {
  label: string;
  value: number;
  description: string;
  icon: ReactNode;
}) => (
  <div className="rounded-lg border border-[color:var(--border)] bg-[var(--surface-muted)] px-4 py-3">
    <div className="flex items-center justify-between gap-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
        {label}
      </p>
      <span className="text-[var(--text-muted)]" aria-hidden="true">{icon}</span>
    </div>
    <p className="mt-2 font-display text-2xl font-semibold text-[var(--text)]">
      {numberFormatter.format(value)}
    </p>
    <p className="mt-1 text-xs text-[var(--text-muted)]">{description}</p>
  </div>
);

const AnalyticsSummaryPanel = ({
  summary,
  loading,
  error,
  onRefresh
}: AnalyticsSummaryPanelProps) => {
  const metrics = summary ? [
    {
      label: '현재 접속자',
      value: summary.realtimeVisitors,
      description: '최근 90초 기준',
      icon: <Activity size={15} className="text-emerald-600" />
    },
    {
      label: '오늘 방문자',
      value: summary.today.visitors,
      description: '오늘 순 방문자',
      icon: <Users size={15} />
    },
    {
      label: '누적 방문자',
      value: summary.totalVisitors,
      description: '익명 순 방문자',
      icon: <Users size={15} />
    },
    {
      label: '오늘 페이지뷰',
      value: summary.today.pageViews,
      description: '오늘 열람 횟수',
      icon: <Eye size={15} />
    },
    {
      label: '누적 페이지뷰',
      value: summary.totalPageViews,
      description: '전체 열람 횟수',
      icon: <Eye size={15} />
    }
  ] : [];

  return (
    <section
      className="rounded-lg border border-[color:var(--border)] bg-[var(--surface)] p-4"
      aria-labelledby="analytics-summary-title"
      aria-busy={loading}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden="true" />
            <h2 id="analytics-summary-title" className="font-display text-lg font-semibold">
              방문자 현황
            </h2>
          </div>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            원본 IP를 저장하지 않는 익명 집계 · 30초마다 자동 갱신
          </p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-[color:var(--border)] px-3 text-xs font-semibold text-[var(--text-muted)] transition hover:border-[color:var(--accent)] hover:text-[var(--accent-strong)] disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          새로고침
        </button>
      </div>

      {error && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2" role="alert">
          <p className="text-xs text-red-700">{error}</p>
          <button type="button" onClick={onRefresh} className="text-xs font-semibold text-red-700 underline">
            다시 시도
          </button>
        </div>
      )}

      {!summary && loading && (
        <p className="mt-4 text-sm text-[var(--text-muted)]" aria-live="polite">
          방문자 통계를 불러오는 중...
        </p>
      )}

      {summary && (
        <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {metrics.map(metric => <MetricCard key={metric.label} {...metric} />)}
          </div>

          <div className="rounded-lg border border-[color:var(--border)] bg-[var(--surface-muted)] px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-[var(--text)]">최근 7일</h3>
              <span className="text-[10px] uppercase tracking-[0.16em] text-[var(--text-muted)]">
                {summary.timeZone}
              </span>
            </div>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[280px] text-xs">
                <thead className="text-[var(--text-muted)]">
                  <tr>
                    <th scope="col" className="pb-2 text-left font-medium">날짜</th>
                    <th scope="col" className="pb-2 text-right font-medium">방문자</th>
                    <th scope="col" className="pb-2 text-right font-medium">페이지뷰</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.recentDays.map(day => (
                    <tr key={day.date} className="border-t border-[color:var(--border)]">
                      <th scope="row" className="py-1.5 text-left font-medium text-[var(--text)]">
                        {formatDate(day.date)}
                      </th>
                      <td className="py-1.5 text-right text-[var(--text-muted)]">
                        {numberFormatter.format(day.visitors)}
                      </td>
                      <td className="py-1.5 text-right text-[var(--text-muted)]">
                        {numberFormatter.format(day.pageViews)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default AnalyticsSummaryPanel;
