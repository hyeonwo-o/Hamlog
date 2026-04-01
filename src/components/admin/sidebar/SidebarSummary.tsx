import type { SidebarSummaryProps } from './types';

export default function SidebarSummary({
  totalCount,
  saving,
  onNew,
  statusCount
}: SidebarSummaryProps) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[color:var(--border)] pb-4">
      <div className="space-y-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[var(--text-muted)]">
            글 관리
          </p>
          <h2 className="mt-1 font-display text-lg font-semibold text-[var(--text)]">
            {totalCount}개 글
          </h2>
        </div>
        <div className="flex flex-wrap gap-2 text-[11px] text-[var(--text-muted)]">
          <span className="rounded-full border border-[color:var(--border)] bg-[var(--surface-muted)] px-2.5 py-1">
            초안 {statusCount.draft}
          </span>
          <span className="rounded-full border border-[color:var(--border)] bg-[var(--surface-muted)] px-2.5 py-1">
            예약 {statusCount.scheduled}
          </span>
          <span className="rounded-full border border-[color:var(--border)] bg-[var(--surface-muted)] px-2.5 py-1">
            발행 {statusCount.published}
          </span>
        </div>
      </div>
      <button
        type="button"
        onClick={onNew}
        disabled={saving}
        className="angular-control rounded-lg bg-[var(--text)] px-4 py-2 text-xs font-semibold text-[var(--bg)] transition hover:opacity-90 disabled:opacity-50"
      >
        새 글
      </button>
    </div>
  );
}
