import React from 'react';
import { Link } from 'react-router-dom';
import type { Post } from '../data/blogData';
import { formatDate } from '../utils/formatDate';

interface PostCardProps {
  post: Post;
  variant?: 'featured' | 'compact';
  index?: number;
}

// Sub-components
const CategoryBadge: React.FC<{ category?: string; className?: string }> = ({ category, className }) => (
  <span className={`angular-chip rounded-lg border border-[color:var(--accent)] bg-[var(--accent-soft)] px-2 py-0.5 text-[10px] font-medium text-[var(--accent-strong)] ${className}`}>
    {category ?? '미분류'}
  </span>
);

const PostMeta: React.FC<{ post: Post; className?: string }> = ({ post, className }) => {
  const meta = `${formatDate(post.publishedAt)} | ${post.readingTime}`;
  return (
    <p className={`text-[10px] uppercase tracking-[0.2em] text-[var(--text-muted)] ${className}`}>
      {meta}
    </p>
  );
};

const TagList: React.FC<{ tags: string[] }> = ({ tags }) => (
  <>
    {tags.map(tag => (
      <span
        key={tag}
        className="angular-chip rounded-lg border border-[color:var(--border)] bg-[var(--surface-muted)] px-2 py-0.5 text-[10px] text-[var(--text-muted)]"
      >
        #{tag}
      </span>
    ))}
  </>
);

const PostImage: React.FC<{ post: Post; variant: 'featured' | 'compact' }> = ({ post, variant }) => {
  if (!post.cover) return null;

  const wrapperClass = variant === 'featured'
    ? "angular-control relative overflow-hidden rounded-lg"
    : "angular-control overflow-hidden rounded-lg md:h-32 md:w-48";

  const imgClass = variant === 'featured'
    ? "h-40 w-full object-cover transition duration-500 group-hover:scale-105"
    : "h-full w-full object-cover transition duration-500 group-hover:scale-105";

  return (
    <div className={wrapperClass}>
      <img
        src={post.cover}
        alt={post.title}
        className={imgClass}
        loading="lazy"
      />
      {variant === 'featured' && (
        <span className="angular-chip absolute left-3 top-3 rounded-lg border border-[color:var(--border)] bg-[var(--surface-strong)] px-2 py-0.5 text-[10px] uppercase tracking-[0.25em] text-[var(--text-muted)] backdrop-blur-sm">
          {post.category ?? '미분류'}
        </span>
      )}
    </div>
  );
};

// Main Component
const PostCard: React.FC<PostCardProps> = ({ post, variant = 'compact', index = 0 }) => {
  const delay = `${index * 90}ms`;
  const isFeatured = variant === 'featured';

  const containerClass = isFeatured
    ? "angular-panel-strong group flex h-full flex-col gap-3 rounded-xl border border-[color:var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow)] transition duration-300 hover:translate-x-1 hover:-translate-y-1 hover:shadow-[var(--shadow-strong)] animate-slide-up"
    : "angular-panel group flex flex-col gap-4 rounded-xl border border-[color:var(--border)] bg-[var(--surface)] p-5 transition duration-300 hover:translate-x-1 hover:-translate-y-1 hover:shadow-[var(--shadow)] animate-slide-up";

  return (
    <Link
      to={`/posts/${post.slug}`}
      className={containerClass}
      style={{ animationDelay: delay }}
    >
      {isFeatured ? (
        // Featured Layout
        <>
          <PostImage post={post} variant="featured" />
          <PostMeta post={post} />
          <h3 className="font-display text-lg font-bold text-[var(--text)] leading-snug">
            {post.title}
          </h3>
          <p className="text-xs text-[var(--text-muted)] line-clamp-2">{post.summary}</p>
          <div className="mt-auto">
            <div className="flex flex-wrap items-center gap-2">
              <CategoryBadge category={post.category} />
              <TagList tags={post.tags} />
            </div>
            <span className="group/link mt-2 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--accent-strong)]">
              Read
              <span aria-hidden="true" className="transition-transform group-hover/link:translate-x-1">&rarr;</span>
            </span>
          </div>
        </>
      ) : (
        // Compact Layout
        <>
          <PostMeta post={post} className="text-xs" />
          <div className="flex flex-col gap-4 md:flex-row">
            <PostImage post={post} variant="compact" />
            <div className="flex flex-1 flex-col gap-3">
              <div className="space-y-2">
                <h3 className="font-display text-lg font-semibold text-[var(--text)]">
                  {post.title}
                </h3>
                <p className="text-sm text-[var(--text-muted)]">{post.summary}</p>
              </div>
              <div className="mt-auto flex flex-wrap items-center gap-2">
                <CategoryBadge category={post.category} className="px-2.5 py-1 text-[11px]" />
                <TagList tags={post.tags} />
                <span className="ml-auto text-xs font-medium uppercase tracking-[0.2em] text-[var(--accent-strong)]">
                  읽기
                </span>
              </div>
            </div>
          </div>
        </>
      )}
    </Link>
  );
};

export default PostCard;
