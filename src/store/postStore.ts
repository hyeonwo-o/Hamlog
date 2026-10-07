import { create } from 'zustand';
import type { Post, PostInput } from '../data/blogData';
import type { UpdatePostInput } from '../api/postApi';
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
  fetchError: string | null;
  hasLoaded: boolean;
  loadedMode: 'none' | 'summary' | 'full';
  // A single confirmed mutation verifies only its own document, not the list.
  fullPostIds: string[];
  fetchPosts: (mode?: 'summary' | 'full') => Promise<void>;
  addPost: (post: PostInput) => Promise<Post>;
  updatePost: (id: string, post: UpdatePostInput) => Promise<Post>;
  deletePost: (id: string) => Promise<void>;
  applyConfirmedPost: (post: Post) => void;
  removeConfirmedPost: (id: string) => void;
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
  fetchError: null,
  hasLoaded: hasBootstrapPosts,
  loadedMode: hasBootstrapPosts ? 'summary' : 'none',
  fullPostIds: [],

  fetchPosts: async (mode = 'full') => {
    if (get().loading) return;
    if (get().loadedMode === 'full' && mode === 'summary') return;
    const generation = contentGeneration;
    set({ loading: true, error: null, fetchError: null });
    try {
      const posts = await fetchPostsRequest(mode === 'summary');
      // A list requested before a save/delete/restore is not authoritative after
      // that mutation. It must not resurrect a deletion or erase a new post.
      if (generation !== contentGeneration) return;
      set({
        posts,
        loading: false,
        hasLoaded: true,
        loadedMode: mode,
        fullPostIds: mode === 'full' ? posts.map(post => post.id) : []
      });
    } catch (error) {
      if (generation !== contentGeneration) return;
      set({
        loading: false,
        // A failed read does not verify list completeness. In particular, a
        // failed full read must not turn a public summary into an editor source.
        error: normalizeError(error, 'Failed to load posts.'),
        fetchError: normalizeError(error, 'Failed to load posts.')
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
        fullPostIds: [...new Set([...state.fullPostIds, created.id])]
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
        fullPostIds: [...new Set([...state.fullPostIds, updated.id])]
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
        fullPostIds: state.fullPostIds.filter(postId => postId !== id)
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
      fullPostIds: [...new Set([...state.fullPostIds, post.id])]
    }));
  },

  removeConfirmedPost: (id) => {
    contentGeneration += 1;
    set(state => ({
      posts: state.posts.filter(post => post.id !== id),
      loading: pendingWrites > 0,
      fullPostIds: state.fullPostIds.filter(postId => postId !== id)
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
