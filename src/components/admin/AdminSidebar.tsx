import { useMemo } from 'react';
import { normalizeCategoryKey } from '../../utils/category';
import SidebarFilters from './sidebar/SidebarFilters';
import SidebarListHeader from './sidebar/SidebarListHeader';
import SidebarPagination from './sidebar/SidebarPagination';
import SidebarPostList from './sidebar/SidebarPostList';
import SidebarSummary from './sidebar/SidebarSummary';
import type { AdminSidebarProps, StatusFilterOption } from './sidebar/types';

const ITEMS_PER_PAGE = 10;

export default function AdminSidebar({
  show,
  searchQuery,
  onSearchChange,
  filterStatus,
  onFilterStatusChange,
  filterCategory,
  onFilterCategoryChange,
  filterCategoryIncludeDescendants,
  onFilterCategoryIncludeDescendantsChange,
  page,
  onPageChange,
  onNew,
  saving,
  onSelect,
  filteredPosts,
  activeId,
  loading,
  error,
  onReload,
  totalCount,
  statusCount,
  categoryTree
}: AdminSidebarProps) {
  const quickCategoryNodes = useMemo(
    () =>
      [...categoryTree.roots]
        .filter(node => normalizeCategoryKey(node.name) !== normalizeCategoryKey('미분류'))
        .sort((left, right) => {
          if (right.count !== left.count) return right.count - left.count;
          return left.name.localeCompare(right.name, 'ko');
        })
        .slice(0, 4),
    [categoryTree.roots]
  );

  if (!show) {
    return null;
  }

  const totalPages = Math.ceil(filteredPosts.length / ITEMS_PER_PAGE);
  const paginatedPosts = filteredPosts.slice(
    (page - 1) * ITEMS_PER_PAGE,
    page * ITEMS_PER_PAGE
  );
  const statusFilters: StatusFilterOption[] = [
    { key: 'all', label: '전체', count: totalCount },
    { key: 'draft', label: '초안', count: statusCount.draft },
    { key: 'scheduled', label: '예약', count: statusCount.scheduled },
    { key: 'published', label: '발행', count: statusCount.published }
  ];

  return (
    <aside className="angular-panel flex h-full flex-col gap-5 overflow-y-auto rounded-xl border border-[color:var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow)] lg:sticky lg:top-24 lg:h-[calc(100vh-110px)]">
      <SidebarSummary
        totalCount={totalCount}
        statusCount={statusCount}
        saving={saving}
        onNew={onNew}
      />

      <SidebarFilters
        searchQuery={searchQuery}
        onSearchChange={onSearchChange}
        filterStatus={filterStatus}
        onFilterStatusChange={onFilterStatusChange}
        filterCategory={filterCategory}
        onFilterCategoryChange={onFilterCategoryChange}
        filterCategoryIncludeDescendants={filterCategoryIncludeDescendants}
        onFilterCategoryIncludeDescendantsChange={onFilterCategoryIncludeDescendantsChange}
        categoryTree={categoryTree}
        statusFilters={statusFilters}
        quickCategoryNodes={quickCategoryNodes}
      />

      <SidebarListHeader page={page} totalPages={totalPages} onReload={onReload} />

      <SidebarPostList
        loading={loading}
        error={error}
        onReload={onReload}
        posts={paginatedPosts}
        activeId={activeId}
        onSelect={onSelect}
      />

      <SidebarPagination page={page} totalPages={totalPages} onPageChange={onPageChange} />
    </aside>
  );
}
