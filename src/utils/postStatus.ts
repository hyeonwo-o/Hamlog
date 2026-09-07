import type { Post, PostStatus } from '../data/blogData';

export const normalizePostStatus = (status?: PostStatus) => status ?? 'published';

export const getScheduledTimestamp = (value?: string) => {
  if (!value) return null;
  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? null : timestamp;
};

export const isPostVisible = (post: Post, now: number = Date.now()) => {
  const status = normalizePostStatus(post.status);
  if (status === 'draft') return false;
  if (status === 'scheduled') {
    const scheduledAt = getScheduledTimestamp(post.scheduledAt);
    return scheduledAt !== null && scheduledAt <= now;
  }
  return true;
};

export const getPostStatusLabel = (status: PostStatus) => {
  switch (status) {
    case 'draft':
      return {
        label: '초안',
        className: 'bg-[var(--surface-muted)] text-[var(--text-muted)]'
      };
    case 'scheduled':
      return {
        label: '예약',
        className: 'bg-yellow-100 dark:bg-yellow-400/15 text-yellow-800 dark:text-yellow-200'
      };
    case 'published':
    default:
      return {
        label: '발행',
        className: 'bg-[var(--accent-soft)] text-[var(--accent-strong)]'
      };
  }
};
