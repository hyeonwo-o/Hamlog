import { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { Post } from '../types/blog';
import type { Category } from '../types/category';
import { isPostVisible } from '../utils/postStatus';
import { DEFAULT_CATEGORY, normalizeCategoryKey } from '../utils/category';
import { buildCategoryTree, type CategoryNode } from '../utils/categoryTree';
import { searchPosts } from '../api/postApi';
import type { SearchPage } from '../types/search';
import { normalizeSearchQuery, SEARCH_QUERY_MAX_LENGTH } from '../utils/searchQuery';

const NEW_BADGE_DAYS = 7;
const POPULAR_POST_LIMIT = 3;

interface UsePostFilterProps {
    posts: Post[];
    managedCategories: Category[];
}

interface SearchState {
    key: string;
    status: 'loading' | 'success' | 'error';
    pages: SearchPage[];
    error: string;
}

const filterKeyFor = (params: URLSearchParams) => JSON.stringify([
    normalizeSearchQuery((params.get('q') ?? '').slice(0, SEARCH_QUERY_MAX_LENGTH)),
    params.get('category') || null,
    params.get('tag')?.trim() || null,
    params.get('series')?.trim() || null
]);

export function useHomePostFilter({ posts, managedCategories }: UsePostFilterProps) {
    const [params, setParams] = useSearchParams();
    const selectedCategory = params.get('category') || null;
    const selectedTag = params.get('tag')?.trim() || null;
    const selectedSeries = params.get('series')?.trim() || null;
    const searchQuery = (params.get('q') ?? '').slice(0, SEARCH_QUERY_MAX_LENGTH);
    const normalizedQuery = normalizeSearchQuery(searchQuery);
    const [isComposing, setIsComposing] = useState(false);
    const [retryId, setRetryId] = useState(0);
    const requestKey = filterKeyFor(params);
    const requestedPages = Number(params.get('page') ?? 1);
    const desiredPages = Number.isSafeInteger(requestedPages) && requestedPages > 0 ? requestedPages : 1;
    const searchActive = Boolean(normalizedQuery || selectedTag || selectedSeries);
    const [searchState, setSearchState] = useState<SearchState | null>(null);
    const stateRef = useRef<SearchState | null>(null);
    const requestRef = useRef<AbortController | null>(null);
    const busyRef = useRef(false);
    const commitSearch = useCallback((state: SearchState) => {
        stateRef.current = state;
        setSearchState(state);
    }, []);
    const rememberLoadedPages = useCallback((count: number) => {
        setParams(current => {
            if (filterKeyFor(current) !== requestKey) return current;
            const next = new URLSearchParams(current);
            if (count > 1) next.set('page', String(count));
            else next.delete('page');
            return next;
        }, { replace: true, preventScrollReset: true });
    }, [requestKey, setParams]);

    const setSearchQuery = useCallback((query: string) => {
        setParams(current => {
            const next = new URLSearchParams(current);
            if (query) next.set('q', query.slice(0, SEARCH_QUERY_MAX_LENGTH));
            else next.delete('q');
            next.delete('page');
            return next;
        }, { replace: true, preventScrollReset: true });
    }, [setParams]);

    const selectCategory = useCallback((category: string | null) => {
        setParams(current => {
            const next = new URLSearchParams(current);
            if (category) next.set('category', category);
            else next.delete('category');
            next.delete('page');
            return next;
        }, { preventScrollReset: true });
    }, [setParams]);

    const clearReaderFilter = useCallback((filter: 'tag' | 'series') => {
        setParams(current => {
            const next = new URLSearchParams(current);
            next.delete(filter);
            next.delete('page');
            return next;
        }, { preventScrollReset: true });
    }, [setParams]);

    useEffect(() => {
        requestRef.current?.abort();
        busyRef.current = false;
        if (!searchActive || isComposing) return;
        const controller = new AbortController();
        requestRef.current = controller;
        let active = true;
        const previous = stateRef.current?.key === requestKey ? stateRef.current.pages : [];
        const pages = previous.slice(0, desiredPages);
        if (pages.length >= desiredPages || pages.at(-1)?.hasMore === false) {
            commitSearch({ key: requestKey, status: 'success', pages, error: '' });
            return () => controller.abort();
        }
        busyRef.current = true;
        commitSearch({ key: requestKey, status: 'loading', pages, error: '' });
        const timer = window.setTimeout(() => {
            void (async () => {
                try {
                    // Reconstruct accumulated pages when returning from a post
                    // or loading a shared URL; never fetch page N in isolation.
                    while (pages.length < desiredPages && pages.at(-1)?.hasMore !== false) {
                        const result = await searchPosts(normalizedQuery, {
                            category: selectedCategory, tag: selectedTag, series: selectedSeries,
                            page: pages.length + 1, signal: controller.signal
                        });
                        if (!active || controller.signal.aborted) return;
                        pages.push(result);
                        commitSearch({ key: requestKey, status: 'loading', pages: [...pages], error: '' });
                    }
                    if (!active || controller.signal.aborted) return;
                    commitSearch({ key: requestKey, status: 'success', pages: [...pages], error: '' });
                    if (pages.length !== desiredPages) rememberLoadedPages(pages.length);
                } catch (error) {
                    if (!active || controller.signal.aborted) return;
                    commitSearch({
                        key: requestKey, status: 'error', pages: [...pages],
                        error: error instanceof Error ? error.message : '검색하지 못했습니다. 잠시 후 다시 시도해 주세요.'
                    });
                } finally {
                    if (requestRef.current === controller) busyRef.current = false;
                }
            })();
        }, 250);
        return () => {
            active = false;
            window.clearTimeout(timer);
            controller.abort();
        };
    }, [normalizedQuery, selectedCategory, selectedTag, selectedSeries, searchActive, isComposing, requestKey, desiredPages, retryId, commitSearch, rememberLoadedPages]);

    const loadMore = useCallback(async () => {
        const current = stateRef.current;
        if (busyRef.current || isComposing || !searchActive || current?.key !== requestKey || !current.pages.at(-1)?.hasMore) return;
        busyRef.current = true;
        requestRef.current?.abort();
        const controller = new AbortController();
        requestRef.current = controller;
        commitSearch({ ...current, status: 'loading', error: '' });
        try {
            const result = await searchPosts(normalizedQuery, {
                category: selectedCategory, tag: selectedTag, series: selectedSeries,
                page: current.pages.length + 1, signal: controller.signal
            });
            if (controller.signal.aborted || requestRef.current !== controller) return;
            const pages = [...current.pages, result];
            commitSearch({ key: requestKey, status: 'success', pages, error: '' });
            rememberLoadedPages(pages.length);
        } catch (error) {
            if (controller.signal.aborted || requestRef.current !== controller) return;
            commitSearch({ ...current, status: 'error', error: error instanceof Error ? error.message : '추가 결과를 불러오지 못했습니다.' });
        } finally {
            if (requestRef.current === controller) busyRef.current = false;
        }
    }, [isComposing, searchActive, requestKey, normalizedQuery, selectedCategory, selectedTag, selectedSeries, commitSearch, rememberLoadedPages]);

    useEffect(() => () => requestRef.current?.abort(), []);

    const currentSearch = searchState?.key === requestKey ? searchState : null;
    const searchLoading = Boolean(searchActive && (isComposing || !currentSearch || currentSearch.status === 'loading'));
    const searchError = searchActive && currentSearch?.status === 'error' ? currentSearch.error : '';
    const retrySearch = useCallback(() => {
        const current = stateRef.current;
        if (current?.key === requestKey && current.pages.length > 0 && current.pages.length >= desiredPages) void loadMore();
        else setRetryId(value => value + 1);
    }, [requestKey, desiredPages, loadMore]);

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
    const filteredPosts = searchActive
        ? Array.from(new Map((currentSearch?.pages.flatMap(page => page.posts) ?? []).map(post => [post.id, post])).values())
        : categoryPosts;

    return {
        selectedCategory,
        selectedTag,
        selectedSeries,
        clearReaderFilter,
        selectCategory,
        searchQuery,
        setSearchQuery,
        normalizedQuery,
        setIsComposing,
        searchLoading,
        searchError,
        searchActive,
        searchTotal: searchActive ? currentSearch?.pages.at(-1)?.total ?? 0 : categoryPosts.length,
        searchHasMore: Boolean(searchActive && currentSearch?.pages.at(-1)?.hasMore),
        loadMore,
        retrySearch,
        sortedPosts,
        popularPosts,
        filteredPosts,
        categoryTree
    };
}
