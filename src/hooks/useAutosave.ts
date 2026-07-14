import { useCallback, useEffect, useState } from 'react';
import type { PostDraft } from '../types/admin';

interface UseAutosaveProps {
    activeId: string | null;
    draft: PostDraft;
    setDraft: (draft: PostDraft) => void;
    setNotice: (message: string) => void;
    onLoadDraft: () => PostDraft; // To compare against
}

interface AutosavePayload {
    draft: Partial<PostDraft>;
    updatedAt: string;
}

const normalizeStoredDraft = (
    candidate: Partial<PostDraft>,
    fallback: PostDraft
): PostDraft => {
    const merged = { ...fallback, ...candidate };
    const stringValue = (value: unknown, fallbackValue: string) =>
        typeof value === 'string' ? value : fallbackValue;
    const validStatuses = new Set(['draft', 'scheduled', 'published']);

    return {
        ...merged,
        title: stringValue(merged.title, fallback.title),
        slug: stringValue(merged.slug, fallback.slug),
        summary: stringValue(merged.summary, fallback.summary),
        category: stringValue(merged.category, fallback.category),
        contentJson: merged.contentJson && typeof merged.contentJson === 'object'
            ? merged.contentJson
            : fallback.contentJson,
        contentHtml: stringValue(merged.contentHtml, fallback.contentHtml),
        publishedAt: stringValue(merged.publishedAt, fallback.publishedAt),
        tags: Array.isArray(merged.tags)
            ? merged.tags.filter((tag): tag is string => typeof tag === 'string')
            : fallback.tags,
        series: stringValue(merged.series, fallback.series),
        featured: typeof merged.featured === 'boolean' ? merged.featured : fallback.featured,
        cover: stringValue(merged.cover, fallback.cover),
        status: validStatuses.has(String(merged.status)) ? merged.status : fallback.status,
        scheduledAt: stringValue(merged.scheduledAt, fallback.scheduledAt),
        seoTitle: stringValue(merged.seoTitle, fallback.seoTitle),
        seoDescription: stringValue(merged.seoDescription, fallback.seoDescription),
        seoOgImage: stringValue(merged.seoOgImage, fallback.seoOgImage),
        seoCanonicalUrl: stringValue(merged.seoCanonicalUrl, fallback.seoCanonicalUrl),
        seoKeywords: stringValue(merged.seoKeywords, fallback.seoKeywords)
    };
};

const readAutosave = (key: string) => {
    try {
        return localStorage.getItem(key);
    } catch {
        return null;
    }
};

const removeAutosave = (key: string) => {
    try {
        localStorage.removeItem(key);
    } catch {
        // Storage may be unavailable in restricted browsing modes.
    }
};

const getDraftAutosaveSignature = (draft: PostDraft) => JSON.stringify({
    title: draft.title,
    slug: draft.slug,
    summary: draft.summary,
    category: draft.category,
    content: draft.contentJson ? JSON.stringify(draft.contentJson) : draft.contentHtml,
    publishedAt: draft.publishedAt,
    tags: draft.tags,
    series: draft.series,
    featured: draft.featured,
    cover: draft.cover,
    status: draft.status,
    scheduledAt: draft.scheduledAt,
    seoTitle: draft.seoTitle,
    seoDescription: draft.seoDescription,
    seoOgImage: draft.seoOgImage,
    seoCanonicalUrl: draft.seoCanonicalUrl,
    seoKeywords: draft.seoKeywords
});

const parseAutosavePayload = (raw: string): AutosavePayload | null => {
    try {
        const parsed = JSON.parse(raw) as Partial<AutosavePayload>;
        if (!parsed || typeof parsed !== 'object') return null;

        // Backward compatibility: old schema stored PostDraft directly.
        if ('title' in parsed && 'contentHtml' in parsed) {
            return {
                draft: parsed as unknown as PostDraft,
                updatedAt: new Date().toISOString()
            };
        }

        if (!parsed.draft || typeof parsed.draft !== 'object') return null;
        if (!parsed.updatedAt || typeof parsed.updatedAt !== 'string') return null;
        return {
            draft: parsed.draft as PostDraft,
            updatedAt: parsed.updatedAt
        };
    } catch {
        return null;
    }
};

const isDraftDifferent = (left: PostDraft, right: PostDraft) =>
    getDraftAutosaveSignature(left) !== getDraftAutosaveSignature(right);

export const useAutosave = ({
    activeId,
    draft,
    setDraft,
    setNotice,
    onLoadDraft
}: UseAutosaveProps) => {
    const autosaveKey = `hamlog_draft_${activeId || 'new'}`;
    const [autosaveUpdatedAt, setAutosaveUpdatedAt] = useState<string | null>(null);
    const hasRestorableDraft = Boolean(autosaveUpdatedAt);

    // Check for autosave on mount (or when activeId changes)
    useEffect(() => {
        const saved = readAutosave(autosaveKey);
        if (!saved) {
            setAutosaveUpdatedAt(null);
            return;
        }

        const payload = parseAutosavePayload(saved);
        if (!payload) {
            removeAutosave(autosaveKey);
            setAutosaveUpdatedAt(null);
            return;
        }

        const currentInit = onLoadDraft();
        const storedDraft = normalizeStoredDraft(payload.draft, currentInit);
        if (isDraftDifferent(storedDraft, currentInit)) {
            setAutosaveUpdatedAt(payload.updatedAt);
            setNotice('임시 저장본이 있습니다. 복구 또는 삭제를 선택하세요.');
        } else {
            setAutosaveUpdatedAt(null);
        }
    }, [autosaveKey, onLoadDraft, setNotice]); // Check once per post switch

    // Save to LocalStorage (Debounced)
    useEffect(() => {
        const timer = setTimeout(() => {
            if (draft.contentHtml || draft.contentJson || draft.title) {
                const payload: AutosavePayload = {
                    draft,
                    updatedAt: new Date().toISOString()
                };
                try {
                    localStorage.setItem(autosaveKey, JSON.stringify(payload));
                } catch {
                    setNotice('브라우저 저장 공간이 부족해 임시 저장하지 못했습니다.');
                }
            }
        }, 1000);
        return () => clearTimeout(timer);
    }, [draft, autosaveKey, setNotice]);

    const clearAutosave = useCallback(() => {
        removeAutosave(autosaveKey);
        setAutosaveUpdatedAt(null);
    }, [autosaveKey]);

    const handleRestoreAutosave = useCallback(() => {
        const saved = readAutosave(autosaveKey);
        if (!saved) return;

        const payload = parseAutosavePayload(saved);
        if (payload) {
            setDraft(normalizeStoredDraft(payload.draft, onLoadDraft()));
            setAutosaveUpdatedAt(null);
            setNotice('임시 저장된 내용을 복구했습니다.');
        } else {
            setNotice('복구에 실패했습니다.');
        }
    }, [autosaveKey, onLoadDraft, setDraft, setNotice]);

    const discardAutosave = useCallback(() => {
        removeAutosave(autosaveKey);
        setAutosaveUpdatedAt(null);
        setNotice('임시 저장본을 삭제했습니다.');
    }, [autosaveKey, setNotice]);

    return {
        clearAutosave,
        handleRestoreAutosave,
        discardAutosave,
        hasRestorableDraft,
        autosaveUpdatedAt
    };
};
