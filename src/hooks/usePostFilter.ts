import { useEffect, useMemo, useState } from 'react';
import type { Post, PostStatus } from '../data/blogData';
import type { CategoryTreeResult } from '../utils/categoryTree';
import { collectCategoryNames } from '../utils/categoryTree';
import { normalizeCategoryKey } from '../utils/category';

interface UsePostFilterProps {
    posts: Post[];
    categoryTree: CategoryTreeResult;
}

const POSTS_PER_PAGE = 10;
const FILTER_STORAGE_KEY = 'hamlog:admin:post-filter';
const DEFAULT_FILTERS = { status: 'all' as PostStatus | 'all', category: 'all', includeDescendants: true };

const readSavedFilters = () => {
    try {
        if (typeof window === 'undefined') return DEFAULT_FILTERS;
        const raw = window.localStorage.getItem(FILTER_STORAGE_KEY);
        const saved: unknown = raw ? JSON.parse(raw) : null;
        if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return DEFAULT_FILTERS;
        const candidate = saved as Record<string, unknown>;
        const validStatuses: Array<PostStatus | 'all'> = ['all', 'draft', 'scheduled', 'published'];
        return {
            status: validStatuses.includes(candidate.status as PostStatus | 'all')
                ? candidate.status as PostStatus | 'all' : DEFAULT_FILTERS.status,
            category: typeof candidate.category === 'string' && candidate.category.trim()
                ? candidate.category.trim() : DEFAULT_FILTERS.category,
            includeDescendants: typeof candidate.includeDescendants === 'boolean'
                ? candidate.includeDescendants : DEFAULT_FILTERS.includeDescendants
        };
    } catch {
        // Browser preferences are optional, including when storage is blocked.
        return DEFAULT_FILTERS;
    }
};

export function usePostFilter({ posts, categoryTree }: UsePostFilterProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [savedFilters] = useState(readSavedFilters);
    const [filterStatus, setFilterStatus] = useState(savedFilters.status);
    const [filterCategory, setFilterCategory] = useState(savedFilters.category);
    const [filterCategoryIncludeDescendants, setFilterCategoryIncludeDescendants] = useState(savedFilters.includeDescendants);
    const [page, setPage] = useState(1);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        try {
            window.localStorage.setItem(
                FILTER_STORAGE_KEY,
                JSON.stringify({
                    status: filterStatus,
                    category: filterCategory,
                    includeDescendants: filterCategoryIncludeDescendants
                })
            );
        } catch {
            // Continue with the current in-memory filters when persistence fails.
        }
    }, [filterCategory, filterCategoryIncludeDescendants, filterStatus]);

    const matchingCategoryKeys = useMemo(() => {
        if (filterCategory === 'all') return null;

        const selectedNode = categoryTree.nodesByKey.get(normalizeCategoryKey(filterCategory));
        if (!selectedNode) {
            return new Set([normalizeCategoryKey(filterCategory)]);
        }

        if (!filterCategoryIncludeDescendants) {
            return new Set([normalizeCategoryKey(selectedNode.name)]);
        }

        return new Set(
            collectCategoryNames(selectedNode).map(categoryName => normalizeCategoryKey(categoryName))
        );
    }, [categoryTree, filterCategory, filterCategoryIncludeDescendants]);

    const filteredPosts = useMemo(() => {
        let result = [...posts].sort((a, b) =>
            new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
        );

        if (filterStatus !== 'all') {
            result = result.filter(post => post.status === filterStatus);
        }

        if (filterCategory !== 'all') {
            result = result.filter(post =>
                matchingCategoryKeys?.has(normalizeCategoryKey(post.category ?? ''))
            );
        }

        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            result = result.filter(post =>
                post.title.toLowerCase().includes(q) ||
                post.slug.toLowerCase().includes(q)
            );
        }

        return result;
    }, [posts, filterStatus, filterCategory, matchingCategoryKeys, searchQuery]);

    useEffect(() => {
        setPage(1);
    }, [filterCategory, filterCategoryIncludeDescendants, filterStatus, searchQuery]);

    useEffect(() => {
        const totalPages = Math.max(1, Math.ceil(filteredPosts.length / POSTS_PER_PAGE));
        if (page > totalPages) {
            setPage(totalPages);
        }
    }, [filteredPosts.length, page]);

    return {
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
    };
}
