import type { Post } from '../types/blog';

const normalizeDescription = (value?: string) => (value ?? '').replace(/\s+/g, ' ').trim();

// The server owns body-text extraction so hydration and SPA navigation cannot
// replace an enriched description with a short summary. Keep legacy responses
// usable, and always give the author's explicit SEO copy first priority.
export const getPostMetaDescription = (post: Pick<Post, 'seo' | 'metaDescription' | 'summary'>) => (
  normalizeDescription(post.seo?.description)
  || normalizeDescription(post.metaDescription)
  || normalizeDescription(post.summary)
);
