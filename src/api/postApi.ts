import type { Post, PostInput, PostRevision } from '../data/blogData';
import { requestJson, requestVoid } from './client';

const SEARCH_QUERY_MAX_LENGTH = 120;

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

export async function fetchPosts(): Promise<Post[]> {
  const data = await requestJson<PostListResponse>('/posts');
  return data.posts;
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

export async function fetchPostRevisions(id: string): Promise<PostRevision[]> {
  return requestJson<PostRevision[]>(`/posts/${id}/revisions`);
}

export async function restorePostRevision(id: string, revisionId: string): Promise<Post> {
  return requestJson<Post>(`/posts/${id}/revisions/${revisionId}/restore`, {
    method: 'POST'
  });
}

export async function searchPosts(query: string): Promise<Post[]> {
  const normalizedQuery = query.replace(/\s+/g, ' ').trim().slice(0, SEARCH_QUERY_MAX_LENGTH);
  return requestJson<Post[]>(`/search?q=${encodeURIComponent(normalizedQuery)}`);
}
