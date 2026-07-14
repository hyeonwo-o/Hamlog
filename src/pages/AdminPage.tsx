import React, { useEffect, useState } from 'react';
import AdminHeader from '../components/admin/AdminHeader';
import AdminNotice from '../components/admin/AdminNotice';
import AdminSidebar from '../components/admin/AdminSidebar';
import CategorySection from '../components/admin/sections/CategorySection';
import DashboardSection from '../components/admin/sections/DashboardSection';
import ProfileSection from '../components/admin/sections/ProfileSection';
import PostEditor from '../components/admin/PostEditor';
import { useAdminDataBootstrap } from '../hooks/useAdminDataBootstrap';
import { useCategoryManagement } from '../hooks/useCategoryManagement';
import { useDashboardStats } from '../hooks/useDashboardStats';
import { usePostFilter } from '../hooks/usePostFilter';
import { useProfile } from '../hooks/useProfile';
import { useAdminDirtyNavigation } from '../hooks/useAdminDirtyNavigation';
import { useAdminNotice } from '../hooks/useAdminNotice';
import { useAdminRouteState } from '../hooks/useAdminRouteState';
import { usePostStore } from '../store/postStore';
import type { Post } from '../data/blogData';
import type { AdminSection } from '../types/admin';
import { DEFAULT_CATEGORY } from '../utils/category';
import { ADMIN_SECTIONS } from '../utils/adminSections';
import * as authApi from '../api/authApi';

const AdminPage: React.FC = () => {
  const posts = usePostStore(state => state.posts);
  const loading = usePostStore(state => state.loading);
  const postError = usePostStore(state => state.error);
  const hasLoaded = usePostStore(state => state.hasLoaded);
  const loadedMode = usePostStore(state => state.loadedMode);
  const fetchPosts = usePostStore(state => state.fetchPosts);

  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState('');
  const [editorDirty, setEditorDirty] = useState(false);
  const { activeId, activeSection, updateAdminLocation } = useAdminRouteState();
  const {
    adminNotice,
    adminNoticeTone,
    clearAdminNotice,
    showAdminNotice
  } = useAdminNotice();

  const confirmEditorNavigation = useAdminDirtyNavigation({ activeSection, editorDirty });

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
    setNotice: showAdminNotice
  });

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

  const dashboardStats = useDashboardStats(posts, categoryTree);
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

  useAdminDataBootstrap({
    activeSection,
    postsLoadedMode: loadedMode,
    postsLoading: loading,
    fetchPosts,
    loadCategories,
    loadProfile
  });

  useEffect(() => {
    if (!hasLoaded || !activeId) return;
    if (!posts.some(post => post.id === activeId)) {
      updateAdminLocation({ post: null }, { replace: true });
    }
  }, [activeId, hasLoaded, posts, updateAdminLocation]);

  const handleSectionChange = (section: AdminSection) => {
    if (section === activeSection) return;
    if (!confirmEditorNavigation()) return;
    updateAdminLocation({ section });
  };

  const handleSelect = (post: Post) => {
    if (post.id === activeId) return;
    if (!confirmEditorNavigation()) return;
    updateAdminLocation({ section: 'posts', post: post.id });
  };

  const handleNew = () => {
    if (!confirmEditorNavigation()) return;
    updateAdminLocation({ section: 'posts', post: null });
  };

  // Switch to post tab when clicking dashboard item
  const handleDashboardSelect = (post: Post) => {
    if (!confirmEditorNavigation()) return;
    updateAdminLocation({ section: 'posts', post: post.id });
  };

  const handleSaveSuccess = (savedPost: Post) => {
    setEditorDirty(false);
    updateAdminLocation({ section: 'posts', post: savedPost.id }, { replace: true });
  };

  const handleDeleteSuccess = () => {
    setEditorDirty(false);
    updateAdminLocation({ post: null }, { replace: true });
  };

  const handleLogout = async () => {
    if (!confirmEditorNavigation()) return;
    setIsLoggingOut(true);
    setLogoutError('');

    try {
      await authApi.logout();
      window.location.assign('/admin');
    } catch (logoutActionError) {
      const message = logoutActionError instanceof Error
        ? logoutActionError.message
        : '로그아웃하지 못했습니다. 잠시 후 다시 시도해주세요.';
      setLogoutError(message);
      showAdminNotice(message, 'error');
      setIsLoggingOut(false);
    }
  };

  const activePost = activeId ? posts.find(p => p.id === activeId) || null : null;

  return (
    <div className="admin-compact min-h-screen bg-[var(--bg)] text-[var(--text)] transition-colors duration-300">
      <AdminHeader
        activeSection={activeSection}
        sections={ADMIN_SECTIONS}
        logoutError={logoutError}
        isLoggingOut={isLoggingOut}
        onSectionChange={handleSectionChange}
        onLogout={handleLogout}
        onBeforeNavigateHome={confirmEditorNavigation}
      />
      <AdminNotice
        message={adminNotice}
        tone={adminNoticeTone}
        onClose={clearAdminNotice}
      />
      <main className="mx-auto max-w-[1700px] px-4 py-5">
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
              onAddCategory={handleAddCategory}
              onUpdateCategory={handleUpdateCategory}
              onReorderCategory={handleReorderCategory}
              onDeleteCategory={(category) => void handleDeleteCategory(category)}
              onReload={() => void loadCategories()}
              categorySaving={categorySaving}
              defaultCategory={DEFAULT_CATEGORY}
            />
          )}

          {activeSection === 'posts' && (
            <div className="grid gap-4 xl:grid-cols-[340px_minmax(0,1fr)]">
              <AdminSidebar
                show
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                filterStatus={filterStatus}
                onFilterStatusChange={setFilterStatus}
                filterCategory={filterCategory}
                onFilterCategoryChange={setFilterCategory}
                filterCategoryIncludeDescendants={filterCategoryIncludeDescendants}
                onFilterCategoryIncludeDescendantsChange={setFilterCategoryIncludeDescendants}
                page={page}
                onPageChange={setPage}
                onNew={handleNew}
                saving={loading}
                onSelect={handleSelect}
                filteredPosts={filteredPosts}
                activeId={activeId}
                loading={loading}
                error={postError}
                onReload={() => void fetchPosts()}
                totalCount={posts.length}
                statusCount={dashboardStats.statusCount}
                categoryTree={categoryTree}
              />

              <div className="min-w-0">
                <PostEditor
                  post={activePost}
                  onSaveSuccess={handleSaveSuccess}
                  onDeleteSuccess={handleDeleteSuccess}
                  categoryTree={categoryTree}
                  onLoadCategories={loadCategories}
                  onDirtyChange={setEditorDirty}
                />
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
};

export default AdminPage;
