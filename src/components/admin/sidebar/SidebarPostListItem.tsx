import type { Post } from '../../../data/blogData';
import { formatScheduleLabel } from '../../../utils/adminDate';
import { formatDate } from '../../../utils/formatDate';
import { getPostStatusLabel, normalizePostStatus } from '../../../utils/postStatus';

interface SidebarPostListItemProps {
  post: Post;
  selected: boolean;
  onSelect: (post: Post) => void;
}

export default function SidebarPostListItem({
  post,
  selected,
  onSelect
}: SidebarPostListItemProps) {
  const normalizedStatus = normalizePostStatus(post.status);
  const statusMeta = getPostStatusLabel(normalizedStatus);

  return (
    <button
      type="button"
      onClick={() => onSelect(post)}
      className={`group relative flex flex-col gap-2 rounded-xl border p-3 text-left transition-all ${
        selected
          ? 'border-[var(--accent)] bg-[var(--surface)] shadow-[0_18px_40px_-28px_rgba(8,46,41,0.55)] ring-1 ring-[var(--accent-soft)]'
          : 'border-[color:var(--border)] bg-[var(--surface)] hover:border-[var(--accent-soft)] hover:shadow-[0_18px_40px_-30px_rgba(8,46,41,0.45)]'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1.5">
          <h3
            className={`font-display text-sm font-semibold leading-snug ${
              selected ? 'text-[var(--accent)]' : 'text-[var(--text)]'
            }`}
          >
            {post.title || '제목 없음'}
          </h3>
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-[var(--text-muted)]">
            {post.featured && (
              <span className="rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-[10px] font-semibold text-[var(--accent-strong)]">
                추천
              </span>
            )}
            <span>{post.category || '미분류'}</span>
            <span>•</span>
            <span>
              {normalizedStatus === 'scheduled' && post.scheduledAt
                ? formatScheduleLabel(post.scheduledAt)
                : formatDate(post.publishedAt)}
            </span>
          </div>
        </div>
        <span
          className={`shrink-0 rounded-lg px-2 py-0.5 text-[10px] uppercase tracking-wider ${statusMeta.className}`}
        >
          {statusMeta.label}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-[11px] text-[var(--text-muted)]">
        <span>{post.readingTime}</span>
        {post.series && (
          <>
            <span>•</span>
            <span className="truncate">{post.series}</span>
          </>
        )}
      </div>
    </button>
  );
}
