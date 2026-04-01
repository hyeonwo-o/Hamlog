import type { SidebarListHeaderProps } from './types';

export default function SidebarListHeader({
  page,
  totalPages,
  onReload
}: SidebarListHeaderProps) {
  return (
    <div className="flex items-center justify-between gap-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">
        글 목록 · {page}/{Math.max(totalPages, 1)}
      </p>
      <button
        type="button"
        onClick={onReload}
        className="rounded-lg border border-[color:var(--border)] px-2.5 py-1.5 text-[11px] font-semibold text-[var(--text-muted)] transition hover:border-[color:var(--accent)] hover:text-[var(--text)]"
      >
        새로고침
      </button>
    </div>
  );
}
