import React, { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import AdminNav from '../components/admin/AdminNav';
import CategorySection from '../components/admin/sections/CategorySection';
import DashboardSection from '../components/admin/sections/DashboardSection';
import ProfileSection from '../components/admin/sections/ProfileSection';
import PostEditor from '../components/admin/PostEditor';
import { useCategoryManagement } from '../hooks/useCategoryManagement';
import { usePostFilter } from '../hooks/usePostFilter';
import { useDashboardStats } from '../hooks/useDashboardStats';
import { useProfile } from '../hooks/useProfile';
import { usePostStore } from '../store/postStore';
import { LogOut } from 'lucide-react';
import type { Post, PostStatus } from '../data/blogData';
import type { AdminSection } from '../types/admin';
import { DEFAULT_CATEGORY } from '../utils/category';
import * as authApi from '../api/authApi';

const ADMIN_SECTIONS: Array<{ key: AdminSection; label: string }> = [
  { key: 'dashboard', label: '대시보드' },
  { key: 'posts', label: '글 관리' },
  { key: 'categories', label: '카테고리' },
  { key: 'profile', label: '자기소개' }
];

const ADMIN_SECTION_KEYS = new Set(ADMIN_SECTIONS.map(section => section.key));

const parseAdminSection = (value: string | null): AdminSection => (
  value && ADMIN_SECTION_KEYS.has(value as AdminSection)
    ? value as AdminSection
    : 'posts'
);

const AdminPage: React.FC = () => {
  const posts = usePostStore(state => state.posts);
  const loading = usePostStore(state => state.loading);
  const error = usePostStore(state => state.error);
  const hasLoaded = usePostStore(state => state.hasLoaded);
  const fetchPosts = usePostStore(state => state.fetchPosts);

  const [searchParams, setSearchParams] = useSearchParams();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState('');
  const sectionParam = searchParams.get('section');
  const activeSection = parseAdminSection(sectionParam);
  const activeId = searchParams.get('post');

  const updateAdminLocation = useCallback((
    updates: { section?: AdminSection; post?: string | null },
    options?: { replace?: boolean }
  ) => {
    setSearchParams(current => {
      const next = new URLSearchParams(current);

      if (updates.section !== undefined) {
        next.set('section', updates.section);
      }

      if (updates.post !== undefined) {
        if (updates.post) {
          next.set('post', updates.post);
        } else {
          next.delete('post');
        }
      }

      return next;
    }, options);
  }, [setSearchParams]);

  // Category Management (still needed for Sidebar & Category Manager)
  const {
    categoriesLoading,
    categorySaving,
    categoriesError,
    loadCategories,
    categoryTree,
    parentOptions,
    managedCategoryIds,
    handleAddCategory,
    handleUpdateCategory,
    handleDeleteCategory,
    handleReorderCategory
  } = useCategoryManagement({
    posts,
    draftCategory: '', // Not needed for page level
    setDraftCategory: () => { }, // Not needed
    refreshPosts: fetchPosts,
    setNotice: () => { } // Handled in components
  });

  // Post Filter (for Sidebar)
  const {
    searchQuery,
    setSearchQuery,
    filterStatus,
    setFilterStatus,
    filterCategory,
    setFilterCategory,
    filterCategoryIncludeDescendants,
    setFilterCategoryIncludeDescendants,
    page,
    setPage,
    filteredPosts
  } = usePostFilter({ posts, categoryTree });

  // Profile Management
  const {
    profileDraft,
    loading: profileLoading,
    saving: profileSaving,
    error: profileError,
    notice: profileNotice,
    loadProfile,
    saveProfile,
    updateProfileField,
    updateProfileSocial
  } = useProfile();

  // Initial Data Load
  useEffect(() => {
    if (!hasLoaded && !loading) {
      void fetchPosts();
    }
  }, [hasLoaded, loading, fetchPosts]);

  useEffect(() => {
    void loadCategories();
  }, [loadCategories]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    if (!sectionParam) {
      updateAdminLocation({ section: activeSection }, { replace: true });
    }
  }, [activeSection, sectionParam, updateAdminLocation]);

  useEffect(() => {
    if (!hasLoaded || !activeId) return;
    if (!posts.some(post => post.id === activeId)) {
      updateAdminLocation({ post: null }, { replace: true });
    }
  }, [activeId, hasLoaded, posts, updateAdminLocation]);

  const dashboardStats = useDashboardStats(posts, categoryTree);

  const handleSelect = (post: Post) => {
    updateAdminLocation({ section: 'posts', post: post.id });
  };

  const handleNew = () => {
    updateAdminLocation({ section: 'posts', post: null });
  };

  // Switch to post tab when clicking dashboard item
  const handleDashboardSelect = (post: Post) => {
    updateAdminLocation({ section: 'posts', post: post.id });
  };

  const handleSaveSuccess = (savedPost: Post) => {
    updateAdminLocation({ section: 'posts', post: savedPost.id }, { replace: true });
  };

  const handleDeleteSuccess = () => {
    updateAdminLocation({ post: null }, { replace: true });
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    setLogoutError('');

    try {
      await authApi.logout();
      window.location.assign('/admin');
    } catch (logoutActionError) {
      setLogoutError(logoutActionError instanceof Error
        ? logoutActionError.message
        : '로그아웃하지 못했습니다. 잠시 후 다시 시도해주세요.');
      setIsLoggingOut(false);
    }
  };

  const activePost = activeId ? posts.find(p => p.id === activeId) || null : null;

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] transition-colors duration-300">
      <header className="sticky top-0 z-10 border-b border-[color:var(--border)] bg-[var(--surface-overlay)] backdrop-blur-md">
        <div className="mx-auto flex max-w-[1700px] items-center justify-between gap-4 px-4 py-4">
          <div>
            <h1 className="font-display text-xl font-bold text-[var(--accent)]">HamLog Admin</h1>
            {logoutError && (
              <p className="mt-1 text-xs text-[var(--accent-strong)]">{logoutError}</p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="inline-flex items-center gap-2 rounded-lg border border-[color:var(--border)] bg-[var(--surface)] px-3 py-2 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <LogOut size={16} />
              {isLoggingOut ? '로그아웃 중...' : '로그아웃'}
            </button>
            <Link
              to="/"
              className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] hover:text-[var(--accent)]"
            >
              사이트로 돌아가기
            </Link>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[1700px] space-y-6 px-4 py-8">
        <AdminNav
          activeSection={activeSection}
          sections={ADMIN_SECTIONS}
          onChange={(section) => updateAdminLocation({ section })}
        />

        <section className="space-y-6">
          {activeSection === 'dashboard' && (
            <DashboardSection
              stats={dashboardStats}
              totalPosts={posts.length}
              onSelectPost={handleDashboardSelect}
            />
          )}

          {activeSection === 'profile' && (
            <ProfileSection
              profileDraft={profileDraft}
              profileLoading={profileLoading}
              profileSaving={profileSaving}
              profileError={profileError}
              profileNotice={profileNotice}
              onProfileChange={updateProfileField}
              onProfileSocialChange={updateProfileSocial}
              onSave={() => void saveProfile()}
              onReload={() => void loadProfile()}
            />
          )}

          {activeSection === 'categories' && (
            <CategorySection
              categoryTree={categoryTree}
              managedCategoryIds={managedCategoryIds}
              categoriesLoading={categoriesLoading}
              categoriesError={categoriesError}
              parentOptions={parentOptions}
              onAddCategory={(name, parentId) => void handleAddCategory(name, parentId)}
              onUpdateCategory={(category, updates) =>
                void handleUpdateCategory(category, updates)
              }
              onReorderCategory={(parentId, orderedIds) =>
                void handleReorderCategory(parentId, orderedIds)
              }
              onDeleteCategory={(category) => void handleDeleteCategory(category)}
              onReload={() => void loadCategories()}
              categorySaving={categorySaving}
              defaultCategory={DEFAULT_CATEGORY}
            />
          )}

          {activeSection === 'posts' && (
            <PostEditor
              post={activePost}
              onSaveSuccess={handleSaveSuccess}
              onDeleteSuccess={handleDeleteSuccess}
              categoryTree={categoryTree}
              onLoadCategories={loadCategories}
              sidebarProps={{
                searchQuery,
                onSearchChange: (value) => {
                  setSearchQuery(value);
                  setPage(1);
                },
                filterStatus,
                onFilterStatusChange: (value) => {
                  setFilterStatus(value as PostStatus | 'all');
                  setPage(1);
                },
                filterCategory,
                onFilterCategoryChange: (value) => {
                  setFilterCategory(value);
                  setPage(1);
                },
                filterCategoryIncludeDescendants,
                onFilterCategoryIncludeDescendantsChange: (value) => {
                  setFilterCategoryIncludeDescendants(value);
                  setPage(1);
                },
                page,
                onPageChange: setPage,
                onNew: handleNew,
                saving: false,
                onSelect: handleSelect,
                filteredPosts,
                activeId,
                loading,
                error,
                onReload: fetchPosts,
                totalCount: filteredPosts.length,
                statusCount: dashboardStats.statusCount,
                categoryTree
              }}
            />
          )}
        </section>
      </main>
    </div>
  );
};

export default AdminPage;
