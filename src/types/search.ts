import type { Post } from './blog';

export type SearchPost = Post & { searchExcerpt?: string };
