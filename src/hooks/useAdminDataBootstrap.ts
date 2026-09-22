import { useEffect, useState } from 'react';
import type { AdminSection } from '../types/admin';

const CATEGORY_SECTIONS: AdminSection[] = ['dashboard', 'posts', 'categories'];

interface UseAdminDataBootstrapOptions {
  activeSection: AdminSection;
  postsLoadedMode: 'none' | 'summary' | 'full';
  postsLoading: boolean;
  postsError: string | null;
  fetchPosts: (mode?: 'summary' | 'full') => void | Promise<void>;
  loadCategories: () => void | Promise<void>;
  loadProfile: () => void | Promise<void>;
}

export const useAdminDataBootstrap = ({
  activeSection,
  postsLoadedMode,
  postsLoading,
  postsError,
  fetchPosts,
  loadCategories,
  loadProfile
}: UseAdminDataBootstrapOptions) => {
  const [categoriesRequested, setCategoriesRequested] = useState(false);
  const [profileRequested, setProfileRequested] = useState(false);

  useEffect(() => {
    if (postsLoadedMode !== 'full' && !postsLoading && !postsError) {
      void fetchPosts('full');
    }
  }, [fetchPosts, postsLoadedMode, postsLoading, postsError]);

  useEffect(() => {
    if (categoriesRequested) return;
    if (!CATEGORY_SECTIONS.includes(activeSection)) return;
    setCategoriesRequested(true);
    void loadCategories();
  }, [activeSection, categoriesRequested, loadCategories]);

  useEffect(() => {
    if (profileRequested || activeSection !== 'profile') return;
    setProfileRequested(true);
    void loadProfile();
  }, [activeSection, loadProfile, profileRequested]);
};
