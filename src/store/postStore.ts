import { create } from 'zustand';
import type { Post, PostInput } from '../data/blogData';
import {
  fetchPosts as fetchPostsRequest,
  createPost as createPostRequest,
  updatePost as updatePostRequest,
  deletePost as deletePostRequest,
  recordPostView as recordPostViewRequest
} from '../api/postApi';
import { appBootstrapData } from '../utils/appBootstrap';

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
  applyConfirmedPost: (post: Post) => void;
  recordPostView: (slug: string) => Promise<number>;
}

const normalizeError = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
};

const initialPosts = appBootstrapData?.posts ?? [];
const hasBootstrapPosts = appBootstrapData !== null;

export const usePostStore = create<PostState>((set, get) => {
  let contentGeneration = 0;
  let pendingWrites = 0;
  const beginWrite = () => {
    contentGeneration += 1;
    pendingWrites += 1;
    set({ loading: true, error: null });
  };
  const finishWrite = () => {
    contentGeneration += 1;
    pendingWrites -= 1;
  };

  return {
  posts: initialPosts,
  loading: false,
  error: null,
  hasLoaded: hasBootstrapPosts,
  loadedMode: hasBootstrapPosts ? 'summary' : 'none',

  fetchPosts: async (mode = 'full') => {
    if (get().loading) return;
    if (get().loadedMode === 'full' && mode === 'summary') return;
    const generation = contentGeneration;
    set({ loading: true, error: null });
    try {
      const posts = await fetchPostsRequest(mode === 'summary');
      // A list requested before a save/delete/restore is not authoritative after
      // that mutation. It must not resurrect a deletion or erase a new post.
      if (generation !== contentGeneration) return;
      set({ posts, loading: false, hasLoaded: true, loadedMode: mode });
    } catch (error) {
      if (generation !== contentGeneration) return;
      set({
        loading: false,
        hasLoaded: true,
        loadedMode: mode,
        error: normalizeError(error, 'Failed to load posts.')
      });
    }
  },

  addPost: async (post) => {
    beginWrite();
    try {
      const created = await createPostRequest(post);
      finishWrite();
      set(state => ({
        posts: [created, ...state.posts],
        loading: pendingWrites > 0,
        hasLoaded: true,
        loadedMode: 'full'
      }));
      return created;
    } catch (error) {
      finishWrite();
      set({ loading: pendingWrites > 0, error: normalizeError(error, 'Failed to create post.') });
      throw error;
    }
  },

  updatePost: async (id, post) => {
    beginWrite();
    try {
      const updated = await updatePostRequest(id, post);
      finishWrite();
      set(state => ({
        posts: state.posts.map(item => (item.id === id ? updated : item)),
        loading: pendingWrites > 0,
        hasLoaded: true,
        loadedMode: 'full'
      }));
      return updated;
    } catch (error) {
      finishWrite();
      set({ loading: pendingWrites > 0, error: normalizeError(error, 'Failed to update post.') });
      throw error;
    }
  },

  deletePost: async (id) => {
    beginWrite();
    try {
      await deletePostRequest(id);
      finishWrite();
      set(state => ({
        posts: state.posts.filter(item => item.id !== id),
        loading: pendingWrites > 0,
        hasLoaded: true,
        loadedMode: 'full'
      }));
    } catch (error) {
      finishWrite();
      set({ loading: pendingWrites > 0, error: normalizeError(error, 'Failed to delete post.') });
      throw error;
    }
  },

  applyConfirmedPost: (post) => {
    contentGeneration += 1;
    set(state => ({
      posts: state.posts.some(item => item.id === post.id)
        ? state.posts.map(item => item.id === post.id ? post : item)
        : [post, ...state.posts],
      loading: pendingWrites > 0,
      error: null,
      hasLoaded: true,
      loadedMode: 'full'
    }));
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
  };
});
