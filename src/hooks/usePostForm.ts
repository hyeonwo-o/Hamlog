import { useState, useCallback, useEffect, useRef } from 'react';
import type { Dispatch, SetStateAction } from 'react';
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
    const [draft, setDraftState] = useState<PostDraft>(() => toDraft(post || undefined));
    const draftRef = useRef(draft);
    const sourcePostRef = useRef(post);
    // The version belongs to the draft being edited, not the latest list fetch.
    // A refresh may reveal a newer server version while our dirty input remains.
    const draftBaseRef = useRef<{ id: string | null; updatedAt: string | undefined }>({ id: post?.id ?? null, updatedAt: post?.updatedAt ?? '' });
    const acceptedPostRef = useRef<Post | null>(null);
    const [slugTouched, setSlugTouched] = useState(!!post);
    const [tagInput, setTagInput] = useState('');

    // Keep the latest input available synchronously, including updates in the same
    // event turn in which a pending save finishes.
    const setDraft: Dispatch<SetStateAction<PostDraft>> = useCallback(value => {
        const next = typeof value === 'function' ? value(draftRef.current) : value;
        draftRef.current = next;
        setDraftState(next);
    }, []);

    const getCurrentDraft = useCallback(() => draftRef.current, []);
    const getDraftBaseUpdatedAt = useCallback(() => draftBaseRef.current.updatedAt, []);
    const restoreDraftBaseUpdatedAt = useCallback((value: string | undefined) => {
        // Undefined deliberately preserves an unknown legacy recovery baseline.
        // It must not silently become the version fetched after a page reload.
        draftBaseRef.current = { ...draftBaseRef.current, updatedAt: value };
    }, []);

    const acceptDraftBaseline = useCallback((savedPost: Post) => {
        draftBaseRef.current = { id: savedPost.id, updatedAt: savedPost.updatedAt ?? '' };
    }, []);

    const acceptSavedPost = useCallback((savedPost: Post, submittedDraft: PostDraft) => {
        const savedDraft = toDraft(savedPost);
        const current = draftRef.current;
        const newerFields = Object.fromEntries(
            (Object.keys(current) as Array<keyof PostDraft>)
                .filter(key => JSON.stringify(current[key]) !== JSON.stringify(submittedDraft[key]))
                .map(key => [key, current[key]])
        );
        const next = { ...savedDraft, ...newerFields };
        const hasNewerChanges = JSON.stringify(next) !== JSON.stringify(savedDraft);
        // This also carries unsaved edits across a new draft receiving its server ID.
        acceptedPostRef.current = savedPost;
        acceptDraftBaseline(savedPost);
        setDraft(next);
        setSlugTouched(true);
        return { draft: next, hasNewerChanges };
    }, [setDraft, acceptDraftBaseline]);

    // A store refresh for the same post is not a request to discard current input.
    useEffect(() => {
        const previousPost = sourcePostRef.current;
        const accepted = acceptedPostRef.current;
        const isAcceptedSave = Boolean(post && accepted && post.id === accepted.id);
        const changedDocument = (previousPost?.id ?? null) !== (post?.id ?? null);
        const untouched = JSON.stringify(draftRef.current) === JSON.stringify(toDraft(previousPost || undefined));
        sourcePostRef.current = post;
        if (isAcceptedSave) {
            acceptedPostRef.current = null;
            return;
        }
        if (changedDocument || untouched) {
            acceptedPostRef.current = null;
            draftBaseRef.current = { id: post?.id ?? null, updatedAt: post?.updatedAt ?? '' };
            setDraft(toDraft(post || undefined));
            setSlugTouched(!!post);
            if (changedDocument) setTagInput('');
        }
    }, [post, setDraft]);

    const updateDraft = useCallback((patch: Partial<PostDraft>) => {
        setDraft(prev => ({ ...prev, ...patch }));
    }, [setDraft]);

    const handleTitleChange = useCallback((value: string) => {
        setDraft(prev => {
            const next = { ...prev, title: value };
            if (!slugTouched) {
                next.slug = slugify(value);
            }
            return next;
        });
    }, [setDraft, slugTouched]);

    const handleStatusChange = useCallback((value: PostDraft['status']) => {
        setDraft(prev => ({
            ...prev,
            status: value,
            scheduledAt: value === 'scheduled' ? prev.scheduledAt : ''
        }));
    }, [setDraft]);

    const addTag = useCallback((value: string) => {
        const normalized = value.replace(/^#/, '').trim();
        if (!normalized) return;
        setDraft(prev => {
            if (prev.tags.includes(normalized)) return prev;
            return { ...prev, tags: [...prev.tags, normalized] };
        });
    }, [setDraft]);

    const removeTag = useCallback((value: string) => {
        setDraft(prev => ({ ...prev, tags: prev.tags.filter(tag => tag !== value) }));
    }, [setDraft]);

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
        getCurrentDraft,
        getDraftBaseUpdatedAt,
        restoreDraftBaseUpdatedAt,
        acceptDraftBaseline,
        acceptSavedPost,
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
