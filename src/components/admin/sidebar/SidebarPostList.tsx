import LoadingSpinner from '../../LoadingSpinner';
import SidebarPostListItem from './SidebarPostListItem';
import type { SidebarPostListProps } from './types';

export default function SidebarPostList({
  loading,
  error,
  onReload,
  posts,
  activeId,
  onSelect
}: SidebarPostListProps) {
  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg bg-red-50 p-4 text-center text-sm text-red-600">
        {error}
        <button
          type="button"
          onClick={onReload}
          className="mt-2 block w-full rounded-lg bg-white py-2 text-xs font-bold shadow-sm transition-transform hover:scale-[1.02]"
        >
          다시 시도
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      {posts.map(post => (
        <SidebarPostListItem
          key={post.id}
          post={post}
          selected={activeId === post.id}
          onSelect={onSelect}
        />
      ))}

      {posts.length === 0 && (
        <div className="rounded-lg border border-dashed border-[color:var(--border)] px-4 py-10 text-center text-sm text-[var(--text-muted)]">
          표시할 글이 없습니다.
        </div>
      )}
    </div>
  );
}
