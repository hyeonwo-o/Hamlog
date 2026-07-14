import { useState, useCallback, useEffect } from 'react';
import type { Post } from '../data/blogData';
import type { PostDraft } from '../types/admin';
import { DEFAULT_CATEGORY, normalizeDraftCategory } from '../utils/category';
import { normalizePostStatus } from '../utils/postStatus';
import { formatDateTimeLocal } from '../utils/adminDate';
import { slugify } from '../utils/slugify';
import { sectionsToHtml } from '../utils/postContent';

const formatSeoKeywords = (keywords?: string[]) =>
    keywords && keywords.length > 0 ? keywords.join(', ') : '';

const cloneContentJson = <T,>(value: T): T => JSON.parse(JSON.stringify(value));

export const toDraft = (post?: Post): PostDraft => {
    if (!post) {
        return {
            title: '',
            slug: '',
            summary: '',
            category: DEFAULT_CATEGORY,
            contentJson: undefined,
            contentHtml: '',
            publishedAt: new Date().toISOString().slice(0, 10),
            tags: [],
            series: '',
            featured: false,
            cover: '',
            status: 'draft',
            scheduledAt: '',
            seoTitle: '',
            seoDescription: '',
            seoOgImage: '',
            seoCanonicalUrl: '',
            seoKeywords: ''
        };
    }

    const contentHtml = post.contentHtml?.trim()
        ? post.contentHtml
        : post.sections?.length
            ? sectionsToHtml(post.sections)
            : '';

    return {
        title: post.title,
        slug: post.slug,
        summary: post.summary,
        category: normalizeDraftCategory(post.category ?? '', DEFAULT_CATEGORY),
        contentJson: post.contentJson ? cloneContentJson(post.contentJson) : undefined,
        contentHtml,
        publishedAt: post.publishedAt.slice(0, 10),
        tags: post.tags ?? [],
        series: post.series ?? '',
        featured: Boolean(post.featured),
        cover: post.cover ?? '',
        status: normalizePostStatus(post.status),
        scheduledAt: formatDateTimeLocal(post.scheduledAt),
        seoTitle: post.seo?.title ?? '',
        seoDescription: post.seo?.description ?? '',
        seoOgImage: post.seo?.ogImage ?? '',
        seoCanonicalUrl: post.seo?.canonicalUrl ?? '',
        seoKeywords: formatSeoKeywords(post.seo?.keywords)
    };
};

export const usePostForm = (post: Post | null) => {
    const [draft, setDraft] = useState<PostDraft>(() => toDraft(post || undefined));
    const [slugTouched, setSlugTouched] = useState(!!post);
    const [tagInput, setTagInput] = useState('');

    // Reset when post changes
    useEffect(() => {
        setDraft(toDraft(post || undefined));
        setSlugTouched(!!post);
        setTagInput('');
    }, [post]);

    const updateDraft = useCallback((patch: Partial<PostDraft>) => {
        setDraft(prev => ({ ...prev, ...patch }));
    }, []);

    const handleTitleChange = useCallback((value: string) => {
        setDraft(prev => {
            const next = { ...prev, title: value };
            if (!slugTouched) {
                next.slug = slugify(value);
            }
            return next;
        });
    }, [slugTouched]);

    const handleStatusChange = useCallback((value: PostDraft['status']) => {
        setDraft(prev => ({
            ...prev,
            status: value,
            scheduledAt: value === 'scheduled' ? prev.scheduledAt : ''
        }));
    }, []);

    const addTag = useCallback((value: string) => {
        const normalized = value.replace(/^#/, '').trim();
        if (!normalized) return;
        setDraft(prev => {
            if (prev.tags.includes(normalized)) return prev;
            return { ...prev, tags: [...prev.tags, normalized] };
        });
    }, []);

    const removeTag = useCallback((value: string) => {
        setDraft(prev => ({ ...prev, tags: prev.tags.filter(tag => tag !== value) }));
    }, []);

    const handleTagKeyDown = useCallback((event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter' || event.key === ',') {
            event.preventDefault();
            addTag(tagInput);
            setTagInput('');
        }
    }, [addTag, tagInput]);

    const handleTagBlur = useCallback(() => {
        if (tagInput.trim()) {
            addTag(tagInput);
            setTagInput('');
        }
    }, [addTag, tagInput]);

    return {
        draft,
        setDraft,
        slugTouched,
        setSlugTouched,
        tagInput,
        setTagInput,
        updateDraft,
        handleTitleChange,
        handleStatusChange,
        addTag,
        removeTag,
        handleTagKeyDown,
        handleTagBlur,
        // Helper access
        toDraft
    };
};
