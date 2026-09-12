import { useMemo, useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { Post } from '../types/blog';
import type { Category } from '../types/category';
import { isPostVisible } from '../utils/postStatus';
import { DEFAULT_CATEGORY, normalizeCategoryKey } from '../utils/category';
import { buildCategoryTree, type CategoryNode } from '../utils/categoryTree';
import { searchPosts } from '../api/postApi';
import type { SearchPost } from '../types/search';
import { normalizeSearchQuery, SEARCH_QUERY_MAX_LENGTH } from '../utils/searchQuery';

const NEW_BADGE_DAYS = 7;
const POPULAR_POST_LIMIT = 3;

interface UsePostFilterProps {
    posts: Post[];
    managedCategories: Category[];
}

export function useHomePostFilter({ posts, managedCategories }: UsePostFilterProps) {
    const [params, setParams] = useSearchParams();
    const selectedCategory = params.get('category') || null;
    const searchQuery = (params.get('q') ?? '').slice(0, SEARCH_QUERY_MAX_LENGTH);
    const normalizedQuery = normalizeSearchQuery(searchQuery);
    const [isComposing, setIsComposing] = useState(false);
    const [retryId, setRetryId] = useState(0);
    const requestKey = JSON.stringify([normalizedQuery, selectedCategory, retryId]);
    const [searchState, setSearchState] = useState<{
        key: string;
        status: 'loading' | 'success' | 'error';
        posts: SearchPost[];
        error: string;
    } | null>(null);

    const setSearchQuery = useCallback((query: string) => {
        setParams(current => {
            const next = new URLSearchParams(current);
            if (query) next.set('q', query.slice(0, SEARCH_QUERY_MAX_LENGTH));
            else next.delete('q');
            return next;
        }, { replace: true, preventScrollReset: true });
    }, [setParams]);

    const selectCategory = useCallback((category: string | null) => {
        setParams(current => {
            const next = new URLSearchParams(current);
            if (category) next.set('category', category);
            else next.delete('category');
            return next;
        }, { preventScrollReset: true });
    }, [setParams]);

    useEffect(() => {
        if (!normalizedQuery || isComposing) return;
        const controller = new AbortController();
        let active = true;
        setSearchState({ key: requestKey, status: 'loading', posts: [], error: '' });
        const timer = window.setTimeout(() => {
            void searchPosts(normalizedQuery, { category: selectedCategory, signal: controller.signal })
                .then(results => {
                    if (active) setSearchState({ key: requestKey, status: 'success', posts: results, error: '' });
                })
                .catch(error => {
                    if (!active || controller.signal.aborted) return;
                    setSearchState({
                        key: requestKey, status: 'error', posts: [],
                        error: error instanceof Error ? error.message : '검색하지 못했습니다. 잠시 후 다시 시도해 주세요.'
                    });
                });
        }, 250);
        return () => {
            active = false;
            window.clearTimeout(timer);
            controller.abort();
        };
    }, [normalizedQuery, selectedCategory, isComposing, requestKey]);

    const currentSearch = searchState?.key === requestKey ? searchState : null;
    const searchLoading = Boolean(normalizedQuery && (isComposing || !currentSearch || currentSearch.status === 'loading'));
    const searchError = normalizedQuery && currentSearch?.status === 'error' ? currentSearch.error : '';
    const retrySearch = useCallback(() => setRetryId(value => value + 1), []);

    const visiblePosts = useMemo(() => posts.filter(post => isPostVisible(post)), [posts]);

    const sortedPosts = useMemo(
        () =>
            [...visiblePosts].sort(
                (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
            ),
        [visiblePosts]
    );

    const popularPosts = useMemo(
        () => {
            const viewedPosts = [...visiblePosts]
                .filter(post => (post.views ?? 0) > 0)
                .sort((a, b) => {
                    const viewDiff = (b.views ?? 0) - (a.views ?? 0);
                    if (viewDiff !== 0) return viewDiff;
                    return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
                });

            if (viewedPosts.length > 0) {
                return viewedPosts.slice(0, POPULAR_POST_LIMIT);
            }

            return sortedPosts
                .filter(post => post.featured)
                .slice(0, POPULAR_POST_LIMIT);
        },
        [sortedPosts, visiblePosts]
    );

    const newSince = useMemo(
        () => Date.now() - NEW_BADGE_DAYS * 24 * 60 * 60 * 1000,
        []
    );

    const categoryTree = useMemo(
        () =>
            buildCategoryTree({
                categories: managedCategories,
                posts: visiblePosts,
                defaultCategory: DEFAULT_CATEGORY,
                newSince
            }),
        [managedCategories, visiblePosts, newSince]
    );

    const selectedCategoryKeys = useMemo(() => {
        if (!selectedCategory) return null;
        const key = normalizeCategoryKey(selectedCategory);
        const node = categoryTree.nodesByKey.get(key);
        const keys = new Set<string>();
        const collect = (target: CategoryNode) => {
            keys.add(normalizeCategoryKey(target.name));
            target.children.forEach(child => collect(child));
        };
        if (node) {
            collect(node);
        } else {
            keys.add(key);
        }
        return keys;
    }, [selectedCategory, categoryTree]);

    const categoryPosts = useMemo(() => {
        let result = sortedPosts;

        if (selectedCategoryKeys) {
            result = result.filter(post =>
                selectedCategoryKeys.has(
                    normalizeCategoryKey(post.category ?? DEFAULT_CATEGORY)
                )
            );
        }

        return result;
    }, [sortedPosts, selectedCategoryKeys]);

    // The API filters categories before its result limit. Filtering a truncated
    // response here could incorrectly hide matching posts in child categories.
    const filteredPosts = normalizedQuery
        ? (!searchLoading && !searchError ? currentSearch?.posts ?? [] : [])
        : categoryPosts;

    return {
        selectedCategory,
        selectCategory,
        searchQuery,
        setSearchQuery,
        normalizedQuery,
        setIsComposing,
        searchLoading,
        searchError,
        retrySearch,
        sortedPosts,
        popularPosts,
        filteredPosts,
        categoryTree
    };
}
