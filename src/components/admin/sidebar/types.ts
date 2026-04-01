import type { Post, PostStatus } from '../../../data/blogData';
import type { CategoryNode, CategoryTreeResult } from '../../../utils/categoryTree';

export interface StatusFilterOption {
  key: PostStatus | 'all';
  label: string;
  count: number;
}

export interface AdminSidebarProps {
  show: boolean;
  embedded?: boolean;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  filterStatus: string;
  onFilterStatusChange: (value: string) => void;
  filterCategory: string;
  onFilterCategoryChange: (value: string) => void;
  filterCategoryIncludeDescendants: boolean;
  onFilterCategoryIncludeDescendantsChange: (value: boolean) => void;
  page: number;
  onPageChange: (page: number) => void;
  onNew: () => void;
  saving: boolean;
  onSelect: (post: Post) => void;
  filteredPosts: Post[];
  activeId: string | null;
  loading: boolean;
  error: string | null;
  onReload: () => void;
  totalCount: number;
  statusCount: Record<PostStatus, number>;
  categoryTree: CategoryTreeResult;
}

export interface SidebarSummaryProps {
  totalCount: number;
  saving: boolean;
  onNew: () => void;
  statusCount: Record<PostStatus, number>;
}

export interface SidebarFiltersProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  filterStatus: string;
  onFilterStatusChange: (value: string) => void;
  filterCategory: string;
  onFilterCategoryChange: (value: string) => void;
  filterCategoryIncludeDescendants: boolean;
  onFilterCategoryIncludeDescendantsChange: (value: boolean) => void;
  categoryTree: CategoryTreeResult;
  statusFilters: StatusFilterOption[];
  quickCategoryNodes: CategoryNode[];
}

export interface SidebarListHeaderProps {
  page: number;
  totalPages: number;
  onReload: () => void;
}

export interface SidebarPostListProps {
  loading: boolean;
  error: string | null;
  onReload: () => void;
  posts: Post[];
  activeId: string | null;
  onSelect: (post: Post) => void;
}

export interface SidebarPaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}
