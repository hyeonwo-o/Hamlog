import { Activity, Users } from 'lucide-react';
import { usePublicAnalyticsSummary } from '../../hooks/usePublicAnalyticsSummary';

const numberFormatter = new Intl.NumberFormat('ko-KR');

const PublicVisitorStatus = () => {
  const { summary, loading, error } = usePublicAnalyticsSummary();
  const totalVisitors = summary ? numberFormatter.format(summary.totalVisitors) : '—';
  const realtimeVisitors = summary ? numberFormatter.format(summary.realtimeVisitors) : '—';

  return (
    <dl
      className="flex shrink-0 items-center divide-x divide-[color:var(--border)] border border-[color:var(--border)] bg-[var(--surface-muted)] text-[11px] tabular-nums text-[var(--text-muted)]"
      aria-label="방문자 현황"
      aria-busy={loading}
      title={error ? '방문자 현황을 불러오지 못했습니다.' : undefined}
      data-testid="public-visitor-status"
    >
      <div className="flex min-h-8 items-center gap-1.5 px-2.5 sm:px-3">
        <Users size={13} aria-hidden="true" />
        <dt className="font-medium">누적</dt>
        <dd className="font-semibold text-[var(--text)]" aria-label={`누적 방문자 ${totalVisitors}명`}>
          {totalVisitors}
        </dd>
      </div>
      <div className="flex min-h-8 items-center gap-1.5 px-2.5 sm:px-3">
        <span
          className={`h-1.5 w-1.5 rounded-full ${summary ? 'bg-emerald-500' : 'bg-[var(--text-muted)]'}`}
          aria-hidden="true"
        />
        <Activity size={13} className="hidden sm:block" aria-hidden="true" />
        <dt className="font-medium">실시간</dt>
        <dd className="font-semibold text-[var(--text)]" aria-label={`실시간 방문자 ${realtimeVisitors}명`}>
          {realtimeVisitors}
        </dd>
      </div>
    </dl>
  );
};

export default PublicVisitorStatus;
