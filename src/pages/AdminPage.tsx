import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import AdminHeader from '../components/admin/AdminHeader';
import AdminNotice from '../components/admin/AdminNotice';
import AdminSidebar from '../components/admin/AdminSidebar';
import CategorySection from '../components/admin/sections/CategorySection';
import DashboardSection from '../components/admin/sections/DashboardSection';
import ProfileSection from '../components/admin/sections/ProfileSection';
import CommentModerationSection from '../components/admin/sections/CommentModerationSection';
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
import { useMediaQuery } from '../hooks/useMediaQuery';
import PostTrashDialog from '../components/admin/post/PostTrashDialog';
import LoadingSpinner from '../components/LoadingSpinner';

const AdminPage: React.FC = () => {
  const posts = usePostStore(state => state.posts);
  const loading = usePostStore(state => state.loading);
  const postError = usePostStore(state => state.error);
  const postFetchError = usePostStore(state => state.fetchError);
  const loadedMode = usePostStore(state => state.loadedMode);
  const fullPostIds = usePostStore(state => state.fullPostIds);
  const fetchPosts = usePostStore(state => state.fetchPosts);

  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState('');
  const [editorDirty, setEditorDirty] = useState(false);
  const [postListOpen, setPostListOpen] = useState(false);
  const [desktopPostListOpen, setDesktopPostListOpen] = useState(true);
  const [writingFocus, setWritingFocus] = useState(false);
  const [trashOpen, setTrashOpen] = useState(false);
  const isWideWorkspace = useMediaQuery('(min-width: 1536px)');
  const postListVisible = !writingFocus && (isWideWorkspace ? desktopPostListOpen : postListOpen);
  const postListFocusTargetRef = useRef<'list' | 'editor' | null>(null);
  const { activeId, activeSection, updateAdminLocation } = useAdminRouteState();
  const resolvedPostRef = useRef<Post | null>(null);
  const fetchedPost = activeId && fullPostIds.includes(activeId)
    ? posts.find(post => post.id === activeId) ?? null
    : null;
  // Once an editor is open, a background error or a missing list entry cannot
  // replace its draft with a blank/new document. Only navigation clears it.
  const activePost = fetchedPost ?? (resolvedPostRef.current?.id === activeId ? resolvedPostRef.current : null);
  useEffect(() => {
    resolvedPostRef.current = activePost;
  }, [activePost]);
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
    postsError: postFetchError,
    fetchPosts,
    loadCategories,
    loadProfile
  });

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
    setWritingFocus(false);
    updateAdminLocation({ post: null }, { replace: true });
    setPostListVisibility(true);
  };

  const handleLogout = async () => {
    if (!confirmEditorNavigation()) return;
    setIsLoggingOut(true);
    setLogoutError('');

    try {
      const result = await authApi.logout();
      window.location.assign(result.redirectTo === '/cdn-cgi/access/logout' ? result.redirectTo : '/admin');
    } catch (logoutActionError) {
      const message = logoutActionError instanceof Error
        ? logoutActionError.message
        : '로그아웃하지 못했습니다. 잠시 후 다시 시도해주세요.';
      setLogoutError(message);
      showAdminNotice(message, 'error');
      setIsLoggingOut(false);
    }
  };

  const waitingForRequestedPost = Boolean(activeId && !activePost);
  const requestedPostLoading = loading || (!postFetchError && loadedMode !== 'full');

  return (
    <div className="admin-compact min-h-screen bg-[var(--bg)] text-[var(--text)] transition-colors duration-300">
      <div className={writingFocus && activeSection === 'posts' ? 'hidden' : 'contents'}>
        <AdminHeader
          activeSection={activeSection}
          sections={ADMIN_SECTIONS}
          logoutError={logoutError}
          isLoggingOut={isLoggingOut}
          onSectionChange={handleSectionChange}
          onLogout={handleLogout}
          onBeforeNavigateHome={confirmEditorNavigation}
        />
      </div>
      <AdminNotice
        message={adminNotice}
        tone={adminNoticeTone}
        onClose={clearAdminNotice}
      />
      <main className="mx-auto max-w-[1700px] px-2 py-4 sm:px-4 sm:py-5">
        <section className="space-y-6">
          {activeSection === 'comments' && <CommentModerationSection />}
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
            <div className={`grid min-w-0 gap-4 ${desktopPostListOpen && !writingFocus ? '2xl:grid-cols-[340px_minmax(0,1fr)]' : ''}`}>
              <div
                id="admin-post-list-panel"
                className={`${postListVisible ? 'block' : 'hidden'} mx-auto min-w-0 w-full max-w-[640px] 2xl:mx-0 2xl:max-w-none`}
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
                  onOpenTrash={() => setTrashOpen(true)}
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
                className={`${postListOpen && !writingFocus ? 'hidden' : 'block'} min-w-0 2xl:block`}
              >
                {waitingForRequestedPost ? (
                  <section
                    data-testid="admin-post-load-state"
                    aria-busy={requestedPostLoading}
                    className="rounded-xl border border-[color:var(--border)] bg-[var(--surface)] p-6"
                  >
                    {requestedPostLoading ? (
                      <LoadingSpinner message="선택한 글을 불러오는 중..." />
                    ) : (
                      <>
                        <p role={postFetchError ? 'alert' : 'status'} className="text-sm text-[var(--text)]">
                          {postFetchError ? '선택한 글을 불러오지 못했습니다.' : '선택한 글을 찾을 수 없습니다.'}
                        </p>
                        <p className="mt-2 text-sm text-[var(--text-muted)]">
                          {postFetchError || '글이 삭제되었거나 현재 목록에 없습니다. 다시 불러오거나 다른 글을 선택해 주세요.'}
                        </p>
                        <button type="button" onClick={() => void fetchPosts('full')}
                          className="mt-4 min-h-11 rounded-lg border border-[color:var(--border)] px-4 text-sm font-semibold">
                          다시 시도
                        </button>
                      </>
                    )}
                    <div className="mt-4 flex flex-wrap gap-3">
                      <button type="button" onClick={() => { setWritingFocus(false); setDesktopPostListOpen(true); setPostListVisibility(true); }}
                        className="min-h-11 rounded-lg border border-[color:var(--border)] px-4 text-sm">
                        글 목록 열기
                      </button>
                      <button type="button" onClick={handleNew}
                        className="min-h-11 rounded-lg border border-[color:var(--border)] px-4 text-sm">
                        새 글 작성
                      </button>
                    </div>
                  </section>
                ) : (
                  <>
                    {postFetchError && (
                      <div data-testid="admin-post-refresh-error" role="alert"
                        className="mb-3 rounded-lg border border-[color:var(--border)] bg-[var(--surface)] p-4 text-sm">
                        <p>글 목록을 갱신하지 못했습니다. 편집 중인 내용은 유지됩니다.</p>
                        <p className="mt-1 text-[var(--text-muted)]">{postFetchError}</p>
                        <button type="button" disabled={loading} onClick={() => void fetchPosts('full')}
                          className="mt-2 min-h-11 rounded-lg border border-[color:var(--border)] px-4 font-semibold disabled:opacity-50">
                          다시 시도
                        </button>
                      </div>
                    )}
                    <PostEditor
                      post={activePost}
                      requestedPostId={activeId}
                      onSaveSuccess={handleSaveSuccess}
                      onDeleteSuccess={handleDeleteSuccess}
                      categoryTree={categoryTree}
                      onLoadCategories={loadCategories}
                      onDirtyChange={setEditorDirty}
                      postListOpen={postListVisible}
                      focusMode={writingFocus}
                      onToggleFocus={() => setWritingFocus(value => !value)}
                      onTogglePostList={() => {
                        setWritingFocus(false);
                        if (isWideWorkspace) {
                          setDesktopPostListOpen(open => writingFocus || !open);
                        } else {
                          setPostListVisibility(true);
                        }
                      }}
                      onNewPost={handleNew}
                    />
                  </>
                )}
              </div>
            </div>
          )}
        </section>
      </main>
      {trashOpen && <PostTrashDialog onClose={() => setTrashOpen(false)}
        onRestored={post => usePostStore.getState().applyConfirmedPost(post)}
        onDeleted={id => usePostStore.getState().removeConfirmedPost(id)} />}
    </div>
  );
};

export default AdminPage;
