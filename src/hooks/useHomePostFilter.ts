import { useMemo, useState, useEffect } from 'react';
import type { Post } from '../types/blog';
import type { Category } from '../types/category';
import { isPostVisible } from '../utils/postStatus';
import { DEFAULT_CATEGORY, normalizeCategoryKey } from '../utils/category';
import { buildCategoryTree, type CategoryNode } from '../utils/categoryTree';

const NEW_BADGE_DAYS = 7;

interface UsePostFilterProps {
    posts: Post[];
    managedCategories: Category[];
}

export function useHomePostFilter({ posts, managedCategories }: UsePostFilterProps) {
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    // Load category from URL
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const category = params.get('category');
        if (category) {
            setSelectedCategory(category);
        }
    }, []);

    // Sync URL when category changes
    const selectCategory = (category: string | null) => {
        setSelectedCategory(category);
        const url = new URL(window.location.href);
        if (category) {
            url.searchParams.set('category', category);
        } else {
            url.searchParams.delete('category');
        }
        window.history.pushState({}, '', url.toString());
    };

    const visiblePosts = useMemo(() => posts.filter(post => isPostVisible(post)), [posts]);

    const sortedPosts = useMemo(
        () =>
            [...visiblePosts].sort(
                (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
            ),
        [visiblePosts]
    );

    const featuredPosts = useMemo(
        () => sortedPosts.filter(post => post.featured),
        [sortedPosts]
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

    const filteredPosts = useMemo(() => {
        let result = sortedPosts;

        if (selectedCategoryKeys) {
            result = result.filter(post =>
                selectedCategoryKeys.has(
                    normalizeCategoryKey(post.category ?? DEFAULT_CATEGORY)
                )
            );
        }

        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            result = result.filter(post => {
                const fields = [
                    post.title,
                    post.summary,
                    post.series ?? '',
                    post.tags.join(' '),
                    post.category ?? ''
                ];
                return fields.some(text => text.toLowerCase().includes(q));
            });
        }

        return result;
    }, [sortedPosts, selectedCategoryKeys, searchQuery]);

    return {
        selectedCategory,
        selectCategory,
        searchQuery,
        setSearchQuery,
        sortedPosts,
        featuredPosts,
        filteredPosts,
        categoryTree
    };
}
