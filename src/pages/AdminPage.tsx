import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
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
import { useAnalyticsSummary } from '../hooks/useAnalyticsSummary';

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
  const [postListOpen, setPostListOpen] = useState(false);
  const postListFocusTargetRef = useRef<'list' | 'editor' | null>(null);
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
  const visitorAnalytics = useAnalyticsSummary(activeSection === 'dashboard');
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

  useEffect(() => {
    const focusTarget = postListFocusTargetRef.current;
    if (!focusTarget) return;
    postListFocusTargetRef.current = null;

    const frame = window.requestAnimationFrame(() => {
      const targetPanel = document.getElementById(
        focusTarget === 'list' ? 'admin-post-list-panel' : 'admin-post-editor-panel'
      );
      const preferredId = focusTarget === 'list'
        ? 'admin-post-list-return'
        : 'admin-post-list-toggle';
      const preferredTarget = document.getElementById(preferredId);
      const fallbackTarget = Array.from(targetPanel?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [contenteditable="true"], [tabindex]:not([tabindex="-1"])'
      ) ?? []).find(element => element.offsetParent !== null);
      const focusableTarget = preferredTarget && preferredTarget.offsetParent !== null
        ? preferredTarget
        : fallbackTarget;
      focusableTarget?.focus();
    });

    return () => window.cancelAnimationFrame(frame);
  }, [postListOpen]);

  const setPostListVisibility = (open: boolean) => {
    if (postListOpen === open) return;
    postListFocusTargetRef.current = open ? 'list' : 'editor';
    setPostListOpen(open);
  };

  const handleSectionChange = (section: AdminSection) => {
    if (section === activeSection) return;
    if (!confirmEditorNavigation()) return;
    updateAdminLocation({ section });
  };

  const handleSelect = (post: Post) => {
    if (post.id === activeId) {
      setPostListVisibility(false);
      return;
    }
    if (!confirmEditorNavigation()) return;
    updateAdminLocation({ section: 'posts', post: post.id });
    setPostListVisibility(false);
  };

  const handleNew = () => {
    if (!confirmEditorNavigation()) return;
    updateAdminLocation({ section: 'posts', post: null });
    setPostListVisibility(false);
  };

  // Switch to post tab when clicking dashboard item
  const handleDashboardSelect = (post: Post) => {
    if (!confirmEditorNavigation()) return;
    updateAdminLocation({ section: 'posts', post: post.id });
    setPostListVisibility(false);
  };

  const handleSaveSuccess = (savedPost: Post) => {
    setEditorDirty(false);
    updateAdminLocation({ section: 'posts', post: savedPost.id }, { replace: true });
  };

  const handleDeleteSuccess = () => {
    setEditorDirty(false);
    updateAdminLocation({ post: null }, { replace: true });
    setPostListVisibility(true);
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
      <main className="mx-auto max-w-[1700px] px-2 py-4 sm:px-4 sm:py-5">
        <section className="space-y-6">
          {activeSection === 'dashboard' && (
            <DashboardSection
              stats={dashboardStats}
              totalPosts={posts.length}
              onSelectPost={handleDashboardSelect}
              analyticsSummary={visitorAnalytics.summary}
              analyticsLoading={visitorAnalytics.loading}
              analyticsError={visitorAnalytics.error}
              onRefreshAnalytics={() => void visitorAnalytics.refresh()}
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
            <div className="grid min-w-0 gap-4 2xl:grid-cols-[340px_minmax(0,1fr)]">
              <div
                id="admin-post-list-panel"
                className={`${postListOpen ? 'block' : 'hidden'} mx-auto min-w-0 w-full max-w-[640px] 2xl:mx-0 2xl:block 2xl:max-w-none`}
              >
                <div className="mb-3 flex justify-end 2xl:hidden">
                  <button
                    id="admin-post-list-return"
                    type="button"
                    onClick={() => setPostListVisibility(false)}
                    aria-controls="admin-post-editor-panel"
                    aria-expanded={false}
                    className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-[color:var(--border)] bg-[var(--surface)] px-3 text-xs font-semibold text-[var(--text)] transition hover:border-[color:var(--accent)] hover:text-[var(--accent-strong)]"
                  >
                    <ArrowLeft size={15} />
                    편집기로 돌아가기
                  </button>
                </div>
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
              </div>

              <div
                id="admin-post-editor-panel"
                className={`${postListOpen ? 'hidden' : 'block'} min-w-0 2xl:block`}
              >
                <PostEditor
                  post={activePost}
                  onSaveSuccess={handleSaveSuccess}
                  onDeleteSuccess={handleDeleteSuccess}
                  categoryTree={categoryTree}
                  onLoadCategories={loadCategories}
                  onDirtyChange={setEditorDirty}
                  postListOpen={postListOpen}
                  onOpenPostList={() => setPostListVisibility(true)}
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
