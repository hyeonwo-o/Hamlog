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
    draft: PostDraft;
    updatedAt: string;
}

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
        const saved = localStorage.getItem(autosaveKey);
        if (!saved) {
            setAutosaveUpdatedAt(null);
            return;
        }

        const payload = parseAutosavePayload(saved);
        if (!payload) {
            localStorage.removeItem(autosaveKey);
            setAutosaveUpdatedAt(null);
            return;
        }

        const currentInit = onLoadDraft();
        if (isDraftDifferent(payload.draft, currentInit)) {
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
                localStorage.setItem(autosaveKey, JSON.stringify(payload));
            }
        }, 1000);
        return () => clearTimeout(timer);
    }, [draft, autosaveKey]);

    const clearAutosave = useCallback(() => {
        localStorage.removeItem(autosaveKey);
        setAutosaveUpdatedAt(null);
    }, [autosaveKey]);

    const handleRestoreAutosave = useCallback(() => {
        const saved = localStorage.getItem(autosaveKey);
        if (!saved) return;

        const payload = parseAutosavePayload(saved);
        if (payload) {
            setDraft(payload.draft);
            setAutosaveUpdatedAt(null);
            setNotice('임시 저장된 내용을 복구했습니다.');
        } else {
            setNotice('복구에 실패했습니다.');
        }
    }, [autosaveKey, setDraft, setNotice]);

    const discardAutosave = useCallback(() => {
        localStorage.removeItem(autosaveKey);
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
