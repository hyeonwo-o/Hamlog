import type { Post } from './blog';

export type SearchPost = Post & { searchExcerpt?: string };

export interface SearchPage {
    posts: SearchPost[];
    total: number;
    page: number;
    pageSize: number;
    hasMore: boolean;
}
