import type { Post, PostInput, PostRevision, PostRevisionDetail } from '../data/blogData';
import { requestJson, requestVoid } from './client';
import type { SearchPost } from '../types/search';
import { normalizeSearchQuery } from '../utils/searchQuery';

export type SavePostInput = PostInput & {
  expectedUpdatedAt?: string;
};

interface PostListResponse {
  posts: Post[];
  total: number;
}

interface PostViewResponse {
  slug: string;
  views: number;
}

export async function fetchPosts(summaryOnly = false): Promise<Post[]> {
  const data = await requestJson<PostListResponse>(summaryOnly ? '/posts?summary=true' : '/posts');
  return data.posts;
}

export async function fetchPostBySlug(slug: string): Promise<Post> {
  return requestJson<Post>(`/posts/${encodeURIComponent(slug)}`);
}

export async function createPost(payload: SavePostInput): Promise<Post> {
  return requestJson<Post>('/posts', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
}

export async function updatePost(id: string, payload: SavePostInput): Promise<Post> {
  return requestJson<Post>(`/posts/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
}

export async function deletePost(id: string): Promise<void> {
  await requestVoid(`/posts/${id}`, { method: 'DELETE' });
}

export async function recordPostView(slug: string): Promise<PostViewResponse> {
  return requestJson<PostViewResponse>(`/posts/${encodeURIComponent(slug)}/view`, {
    method: 'POST'
  });
}

export async function fetchPostRevisions(id: string, signal?: AbortSignal): Promise<PostRevision[]> {
  return requestJson<PostRevision[]>(`/posts/${encodeURIComponent(id)}/revisions`, { signal });
}

export async function fetchPostRevision(id: string, revisionId: string, signal?: AbortSignal): Promise<PostRevisionDetail> {
  return requestJson<PostRevisionDetail>(`/posts/${encodeURIComponent(id)}/revisions/${encodeURIComponent(revisionId)}`, { signal });
}

export async function restorePostRevision(id: string, revisionId: string, expectedUpdatedAt: string): Promise<Post> {
  return requestJson<Post>(`/posts/${encodeURIComponent(id)}/revisions/${encodeURIComponent(revisionId)}/restore`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ expectedUpdatedAt })
  });
}

export async function searchPosts(
  query: string,
  options: { category?: string | null; signal?: AbortSignal } = {}
): Promise<SearchPost[]> {
  const params = new URLSearchParams({ q: normalizeSearchQuery(query) });
  if (options.category) params.set('category', options.category);
  return requestJson<SearchPost[]>(`/search?${params}`, { signal: options.signal }, true);
}
