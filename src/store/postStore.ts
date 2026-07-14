import { create } from 'zustand';
import type { Post, PostInput } from '../data/blogData';
import {
  fetchPosts as fetchPostsRequest,
  createPost as createPostRequest,
  updatePost as updatePostRequest,
  deletePost as deletePostRequest,
  recordPostView as recordPostViewRequest
} from '../api/postApi';

interface PostState {
  posts: Post[];
  loading: boolean;
  error: string | null;
  hasLoaded: boolean;
  loadedMode: 'none' | 'summary' | 'full';
  fetchPosts: (mode?: 'summary' | 'full') => Promise<void>;
  addPost: (post: PostInput) => Promise<Post>;
  updatePost: (id: string, post: PostInput) => Promise<Post>;
  deletePost: (id: string) => Promise<void>;
  recordPostView: (slug: string) => Promise<number>;
}

const normalizeError = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
};

export const usePostStore = create<PostState>((set, get) => ({
  posts: [],
  loading: false,
  error: null,
  hasLoaded: false,
  loadedMode: 'none',

  fetchPosts: async (mode = 'full') => {
    if (get().loading) return;
    if (get().loadedMode === 'full' && mode === 'summary') return;
    set({ loading: true, error: null });
    try {
      const posts = await fetchPostsRequest(mode === 'summary');
      set({ posts, loading: false, hasLoaded: true, loadedMode: mode });
    } catch (error) {
      set({
        loading: false,
        hasLoaded: true,
        loadedMode: mode,
        error: normalizeError(error, 'Failed to load posts.')
      });
    }
  },

  addPost: async (post) => {
    set({ loading: true, error: null });
    try {
      const created = await createPostRequest(post);
      set(state => ({
        posts: [created, ...state.posts],
        loading: false,
        hasLoaded: true,
        loadedMode: 'full'
      }));
      return created;
    } catch (error) {
      set({ loading: false, error: normalizeError(error, 'Failed to create post.') });
      throw error;
    }
  },

  updatePost: async (id, post) => {
    set({ loading: true, error: null });
    try {
      const updated = await updatePostRequest(id, post);
      set(state => ({
        posts: state.posts.map(item => (item.id === id ? updated : item)),
        loading: false,
        hasLoaded: true,
        loadedMode: 'full'
      }));
      return updated;
    } catch (error) {
      set({ loading: false, error: normalizeError(error, 'Failed to update post.') });
      throw error;
    }
  },

  deletePost: async (id) => {
    set({ loading: true, error: null });
    try {
      await deletePostRequest(id);
      set(state => ({
        posts: state.posts.filter(item => item.id !== id),
        loading: false,
        hasLoaded: true,
        loadedMode: 'full'
      }));
    } catch (error) {
      set({ loading: false, error: normalizeError(error, 'Failed to delete post.') });
      throw error;
    }
  },

  recordPostView: async (slug) => {
    const result = await recordPostViewRequest(slug);
    set(state => ({
      posts: state.posts.map(post => (
        post.slug === result.slug ? { ...post, views: result.views } : post
      ))
    }));
    return result.views;
  }
}));
