import type { SidebarSummaryProps } from './types';

export default function SidebarSummary({
  totalCount,
  saving,
  onNew,
  statusCount
}: SidebarSummaryProps) {
  return (
    <div className="angular-panel angular-stage rounded-xl border border-[color:var(--border)] bg-[linear-gradient(135deg,rgba(7,60,53,0.08),rgba(255,255,255,0)_55%),linear-gradient(180deg,var(--surface),var(--surface-muted))] p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--text-muted)]">
            콘텐츠 인박스
          </p>
          <h2 className="font-display text-2xl font-semibold text-[var(--text)]">
            {totalCount}개의 결과
          </h2>
          <p className="text-sm leading-6 text-[var(--text-muted)]">
            초안, 예약, 발행 글을 한 화면에서 탐색하고 바로 편집할 수 있습니다.
          </p>
        </div>
        <button
          type="button"
          onClick={onNew}
          disabled={saving}
          className="angular-control rounded-lg bg-[var(--text)] px-4 py-2 text-xs font-semibold text-[var(--bg)] transition hover:translate-x-1 hover:-translate-y-1 hover:opacity-90 disabled:opacity-50"
        >
          새 글 쓰기
        </button>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3">
        <div className="angular-control rounded-lg border border-[color:var(--border)] bg-[var(--surface)] p-3">
          <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">초안</div>
          <div className="mt-2 text-lg font-semibold text-[var(--text)]">{statusCount.draft}</div>
        </div>
        <div className="angular-control rounded-lg border border-[color:var(--border)] bg-[var(--surface)] p-3">
          <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">예약</div>
          <div className="mt-2 text-lg font-semibold text-[var(--text)]">
            {statusCount.scheduled}
          </div>
        </div>
        <div className="angular-control rounded-lg border border-[color:var(--border)] bg-[var(--surface)] p-3">
          <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">발행</div>
          <div className="mt-2 text-lg font-semibold text-[var(--accent)]">
            {statusCount.published}
          </div>
        </div>
      </div>
    </div>
  );
}
