import type { SidebarPaginationProps } from './types';

export default function SidebarPagination({
  page,
  totalPages,
  onPageChange
}: SidebarPaginationProps) {
  if (totalPages <= 1) {
    return null;
  }

  return (
    <div className="flex items-center justify-center gap-2 pt-2">
      <button
        type="button"
        onClick={() => onPageChange(page - 1)}
        disabled={page === 1}
        className="rounded-lg border border-[color:var(--border)] px-2.5 py-1.5 text-xs text-[var(--text-muted)] transition hover:border-[color:var(--accent)] hover:text-[var(--text)] disabled:opacity-30"
      >
        이전
      </button>
      <span className="text-xs font-medium text-[var(--text-muted)]">
        {page} / {totalPages}
      </span>
      <button
        type="button"
        onClick={() => onPageChange(page + 1)}
        disabled={page === totalPages}
        className="rounded-lg border border-[color:var(--border)] px-2.5 py-1.5 text-xs text-[var(--text-muted)] transition hover:border-[color:var(--accent)] hover:text-[var(--text)] disabled:opacity-30"
      >
        다음
      </button>
    </div>
  );
}
