import { useEffect, useState } from 'react';
import type { AdminSection } from '../types/admin';

const CATEGORY_SECTIONS: AdminSection[] = ['dashboard', 'posts', 'categories'];

interface UseAdminDataBootstrapOptions {
  activeSection: AdminSection;
  hasLoadedPosts: boolean;
  postsLoading: boolean;
  fetchPosts: () => void | Promise<void>;
  loadCategories: () => void | Promise<void>;
  loadProfile: () => void | Promise<void>;
}

export const useAdminDataBootstrap = ({
  activeSection,
  hasLoadedPosts,
  postsLoading,
  fetchPosts,
  loadCategories,
  loadProfile
}: UseAdminDataBootstrapOptions) => {
  const [categoriesRequested, setCategoriesRequested] = useState(false);
  const [profileRequested, setProfileRequested] = useState(false);

  useEffect(() => {
    if (!hasLoadedPosts && !postsLoading) {
      void fetchPosts();
    }
  }, [fetchPosts, hasLoadedPosts, postsLoading]);

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
