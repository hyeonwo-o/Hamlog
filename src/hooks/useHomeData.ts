import { useState, useEffect, useCallback } from 'react';
import { siteMeta } from '../data/blogData';
import { fetchCategories } from '../api/categoryApi';
import { fetchProfile } from '../api/profileApi';
import { usePostStore } from '../store/postStore';
import type { Category } from '../types/category';

const normalizeHomeProfile = (profile: typeof siteMeta) => ({
    ...siteMeta,
    ...profile,
    social: {
        ...siteMeta.social,
        ...(profile.social ?? {})
    },
    stack: profile.stack ?? [],
    display: {
        ...siteMeta.display,
        ...(profile.display ?? {})
    }
});

export function useHomeData() {
    const [profile, setProfile] = useState(siteMeta);
    const [initialLoading, setInitialLoading] = useState(true);
    const [managedCategories, setManagedCategories] = useState<Category[]>([]);

    const posts = usePostStore(state => state.posts);
    const loading = usePostStore(state => state.loading);
    const error = usePostStore(state => state.error);
    const hasLoaded = usePostStore(state => state.hasLoaded);
    const loadedMode = usePostStore(state => state.loadedMode);
    const fetchPosts = usePostStore(state => state.fetchPosts);
    const fetchHomePosts = useCallback(() => fetchPosts('summary'), [fetchPosts]);

    // Fetch Posts
    useEffect(() => {
        if (loadedMode === 'none' && !loading) {
            void fetchHomePosts();
        }
    }, [fetchHomePosts, loadedMode, loading]);

    // Fetch Profile
    useEffect(() => {
        let isActive = true;
        const loadProfile = async () => {
            try {
                const nextProfile = await fetchProfile();
                if (isActive) {
                    setProfile(normalizeHomeProfile(nextProfile));
                }
            } catch (error) {
                console.error('Failed to load profile', error);
            } finally {
                if (isActive) {
                    setInitialLoading(false);
                }
            }
        };
        void loadProfile();
        return () => {
            isActive = false;
        };
    }, []);

    // Fetch Categories
    useEffect(() => {
        let isActive = true;
        const loadCategories = async () => {
            try {
                const list = await fetchCategories();
                if (isActive) {
                    setManagedCategories(list);
                }
            } catch (error) {
                console.error('Failed to load categories', error);
            }
        };
        void loadCategories();
        return () => {
            isActive = false;
        };
    }, []);

    return {
        profile,
        managedCategories,
        posts,
        loading: initialLoading || (loading && !hasLoaded), // Unified loading state
        error,
        fetchPosts: fetchHomePosts,
        hasLoaded
    };
}
