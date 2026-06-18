import type { JSONContent } from '@tiptap/core';
import type { Post, PostStatus } from '../data/blogData';

export type AdminSection = 'dashboard' | 'posts' | 'categories' | 'profile';

export interface PostDraft {
  title: string;
  slug: string;
  summary: string;
  category: string;
  contentJson?: JSONContent;
  contentHtml: string;
  publishedAt: string;
  tags: string[];
  series: string;
  featured: boolean;
  cover: string;
  status: PostStatus;
  scheduledAt: string;
  seoTitle: string;
  seoDescription: string;
  seoOgImage: string;
  seoCanonicalUrl: string;
  seoKeywords: string;
}

export interface DashboardStats {
  statusCount: Record<PostStatus, number>;
  visibleCount: number;
  tagsCount: number;
  categoriesCount: number;
  seriesCount: number;
  topCategories: Array<{ name: string; count: number }>;
  upcomingScheduled: Post[];
  recentPublished: Post[];
}
