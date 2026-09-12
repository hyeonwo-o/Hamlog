import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PostDraft } from '../types/admin';
import { normalizeContentHtmlForDirtyCheck, normalizeContentJsonForDirtyCheck } from '../utils/postContent';

export type BrowserSaveStatus = 'idle' | 'pending' | 'saved' | 'error' | 'blocked';
interface SavedDraftReconciliation {
    previousId: string | null;
    savedId: string;
    draft: PostDraft;
    hasNewerChanges: boolean;
}

interface UseAutosaveProps {
    activeId: string | null;
    draft: PostDraft;
    setDraft: (draft: PostDraft) => void;
    setNotice: (message: string) => void;
    onLoadDraft: () => PostDraft; // To compare against
    getDraftBaseUpdatedAt: () => string | undefined;
    restoreDraftBaseUpdatedAt: (value: string | undefined) => void;
}

interface AutosavePayload {
    draft: Partial<PostDraft>;
    updatedAt: string;
    baseUpdatedAt?: string;
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
        // HTML-only legacy drafts own their body. Inheriting the server JSON
        // here would hide their HTML and could misclassify it as an unchanged copy.
        contentJson: candidate.contentJson && typeof candidate.contentJson === 'object'
            ? candidate.contentJson
            : typeof candidate.contentHtml === 'string' ? undefined : fallback.contentJson,
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
        return true;
    } catch {
        return false;
    }
};

const getDraftAutosaveSignature = (draft: PostDraft) => JSON.stringify({
    title: draft.title,
    slug: draft.slug,
    summary: draft.summary,
    category: draft.category,
    content: normalizeContentJsonForDirtyCheck(draft.contentJson) ?? normalizeContentHtmlForDirtyCheck(draft.contentHtml),
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

        if (!parsed.draft || typeof parsed.draft !== 'object' || Array.isArray(parsed.draft)) return null;
        if (!parsed.updatedAt || typeof parsed.updatedAt !== 'string' || !Number.isFinite(Date.parse(parsed.updatedAt))) return null;
        return {
            draft: parsed.draft as PostDraft,
            updatedAt: parsed.updatedAt,
            baseUpdatedAt: typeof parsed.baseUpdatedAt === 'string' ? parsed.baseUpdatedAt : undefined
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
    onLoadDraft,
    getDraftBaseUpdatedAt,
    restoreDraftBaseUpdatedAt
}: UseAutosaveProps) => {
    const autosaveKey = `hamlog_draft_${activeId || 'new'}`;
    const [autosaveUpdatedAt, setAutosaveUpdatedAt] = useState<string | null>(null);
    const [browserSaveStatus, setBrowserSaveStatus] = useState<BrowserSaveStatus>('idle');
    const [browserSavedAt, setBrowserSavedAt] = useState<string | null>(null);
    const hasRestorableDraft = Boolean(autosaveUpdatedAt);
    const baseline = useMemo(() => onLoadDraft(), [onLoadDraft]);
    const baselineSignature = useMemo(() => getDraftAutosaveSignature(baseline), [baseline]);
    const baseUpdatedAt = getDraftBaseUpdatedAt();
    const latest = useRef({ key: autosaveKey, draft, baseline, baselineSignature, baseUpdatedAt });
    latest.current = { key: autosaveKey, draft, baseline, baselineSignature, baseUpdatedAt };
    const initializedKey = useRef<string | null>(null);
    const blockedKeys = useRef(new Set<string>());
    const pending = useRef<{ key: string; draft: PostDraft; baselineSignature: string; baseUpdatedAt: string | undefined } | null>(null);
    const written = useRef(new Map<string, { signature: string; updatedAt: string; baseUpdatedAt?: string }>());
    const observed = useRef(new Map<string, string | null>());
    const retiredKeys = useRef(new Set<string>());
    const migrated = useRef<{ key: string; status: BrowserSaveStatus; updatedAt: string | null } | null>(null);

    const hasStorageConflict = useCallback((key: string) => {
        const raw = readAutosave(key);
        if (raw === (observed.current.get(key) ?? null)) return false;
        observed.current.set(key, raw);
        written.current.delete(key);
        if (raw === null) return false;
        // A different tab (or an older editor instance) owns this copy. Never
        // silently delete or replace it during a timer/lifecycle flush.
        blockedKeys.current.add(key);
        if (latest.current.key === key) {
            setAutosaveUpdatedAt(parseAutosavePayload(raw)?.updatedAt ?? new Date().toISOString());
            setBrowserSaveStatus('blocked');
            setNotice('임시 저장본이 있습니다. 복구 또는 삭제를 선택하세요.');
        }
        return true;
    }, [setNotice]);

    const persistPending = useCallback((job: NonNullable<typeof pending.current>) => {
        if (retiredKeys.current.has(job.key) || blockedKeys.current.has(job.key) || hasStorageConflict(job.key)) return;
        const signature = getDraftAutosaveSignature(job.draft);
        if (signature === job.baselineSignature) {
            // Reverting to the saved version must not leave an obsolete recovery
            // draft that would reappear on the next visit.
            const removed = removeAutosave(job.key);
            if (removed) {
                written.current.delete(job.key);
                observed.current.set(job.key, null);
            }
            if (latest.current.key === job.key) {
                setBrowserSaveStatus(removed ? 'idle' : 'error');
                if (removed) setBrowserSavedAt(null);
            }
            if (pending.current === job) pending.current = null;
            return;
        }
        const previous = written.current.get(job.key);
        if (previous?.signature === signature && previous.baseUpdatedAt === job.baseUpdatedAt) {
            if (latest.current.key === job.key) {
                setBrowserSaveStatus('saved');
                setBrowserSavedAt(previous.updatedAt);
            }
            if (pending.current === job) pending.current = null;
            return;
        }
        try {
            const updatedAt = new Date().toISOString();
            const raw = JSON.stringify({ draft: job.draft, updatedAt, baseUpdatedAt: job.baseUpdatedAt });
            localStorage.setItem(job.key, raw);
            observed.current.set(job.key, raw);
            written.current.set(job.key, { signature, updatedAt, baseUpdatedAt: job.baseUpdatedAt });
            if (latest.current.key === job.key) {
                setBrowserSaveStatus('saved');
                setBrowserSavedAt(updatedAt);
            }
            if (pending.current === job) pending.current = null;
        } catch {
            if (latest.current.key === job.key) {
                setBrowserSaveStatus('error');
                setNotice('브라우저 임시 저장에 실패했습니다. 서버 저장으로 내용을 보관해 주세요.');
            }
        }
    }, [hasStorageConflict, setNotice]);

    const flushAutosave = useCallback(() => {
        const current = latest.current;
        if (initializedKey.current !== current.key || retiredKeys.current.has(current.key) || blockedKeys.current.has(current.key)) return;
        const job = { key: current.key, draft: current.draft, baselineSignature: current.baselineSignature, baseUpdatedAt: current.baseUpdatedAt };
        pending.current = job;
        persistPending(job);
    }, [persistPending]);

    // Only a document switch opens a recovery prompt. A save response for the same
    // document must not mistake our own new edits for an unrelated recovery copy.
    useEffect(() => {
        initializedKey.current = autosaveKey;
        retiredKeys.current.delete(autosaveKey);
        if (migrated.current?.key === autosaveKey) {
            blockedKeys.current.delete(autosaveKey);
            setAutosaveUpdatedAt(null);
            setBrowserSaveStatus(migrated.current.status);
            setBrowserSavedAt(migrated.current.updatedAt);
            migrated.current = null;
            return;
        }
        setBrowserSaveStatus('idle');
        setBrowserSavedAt(null);
        blockedKeys.current.delete(autosaveKey);
        const saved = readAutosave(autosaveKey);
        observed.current.set(autosaveKey, saved);
        if (!saved) {
            setAutosaveUpdatedAt(null);
            return;
        }

        const payload = parseAutosavePayload(saved);
        if (!payload) {
            if (removeAutosave(autosaveKey)) observed.current.set(autosaveKey, null);
            setAutosaveUpdatedAt(null);
            return;
        }

        const currentInit = latest.current.baseline;
        const storedDraft = normalizeStoredDraft(payload.draft, currentInit);
        written.current.set(autosaveKey, { signature: getDraftAutosaveSignature(storedDraft), updatedAt: payload.updatedAt, baseUpdatedAt: payload.baseUpdatedAt });
        if (isDraftDifferent(storedDraft, currentInit)) {
            blockedKeys.current.add(autosaveKey);
            setAutosaveUpdatedAt(payload.updatedAt);
            setBrowserSaveStatus('blocked');
            setNotice('임시 저장본이 있습니다. 복구 또는 삭제를 선택하세요.');
        } else {
            setAutosaveUpdatedAt(null);
        }
    }, [autosaveKey, setNotice]);

    // Expensive serialization is debounced; lifecycle flushes still persist the
    // latest draft immediately without making a server request.
    useEffect(() => {
        if (retiredKeys.current.has(autosaveKey) || blockedKeys.current.has(autosaveKey)) return;
        const job = { key: autosaveKey, draft, baselineSignature, baseUpdatedAt };
        pending.current = job;
        setBrowserSaveStatus('pending');
        const timer = setTimeout(() => {
            if (pending.current === job) persistPending(job);
        }, 1000);
        return () => clearTimeout(timer);
    }, [draft, autosaveKey, baselineSignature, baseUpdatedAt, autosaveUpdatedAt, persistPending]);

    useEffect(() => {
        const onVisibilityChange = () => { if (document.visibilityState === 'hidden') flushAutosave(); };
        window.addEventListener('pagehide', flushAutosave);
        window.addEventListener('beforeunload', flushAutosave);
        document.addEventListener('visibilitychange', onVisibilityChange);
        return () => {
            window.removeEventListener('pagehide', flushAutosave);
            window.removeEventListener('beforeunload', flushAutosave);
            document.removeEventListener('visibilitychange', onVisibilityChange);
            // This snapshot belongs to the old document, even if a new document
            // rendered before React ran its effect cleanup.
            const job = pending.current;
            if (job) persistPending(job);
        };
    }, [flushAutosave, persistPending]);

    // A post switch must flush before its replacement schedules a new job.
    useEffect(() => () => {
        const job = pending.current;
        if (job?.key === autosaveKey) persistPending(job);
    }, [autosaveKey, persistPending]);

    const clearAutosave = useCallback(() => {
        if (pending.current?.key === autosaveKey) pending.current = null;
        if (!removeAutosave(autosaveKey)) {
            setBrowserSaveStatus('error');
            setNotice('브라우저 임시 저장본을 지우지 못했습니다. 브라우저 저장 권한을 확인해 주세요.');
            return false;
        }
        written.current.delete(autosaveKey);
        observed.current.set(autosaveKey, null);
        blockedKeys.current.delete(autosaveKey);
        setAutosaveUpdatedAt(null);
        setBrowserSavedAt(null);
        setBrowserSaveStatus('idle');
        return true;
    }, [autosaveKey, setNotice]);

    const reconcileSavedDraft = useCallback(({ previousId, savedId, draft: currentDraft, hasNewerChanges }: SavedDraftReconciliation) => {
        const previousKey = `hamlog_draft_${previousId || 'new'}`;
        const savedKey = `hamlog_draft_${savedId}`;
        if (pending.current && [previousKey, savedKey].includes(pending.current.key)) pending.current = null;
        // React may briefly render the accepted draft before its new ID. Its old
        // effect cleanup must not recreate the key we have just migrated.
        if (previousKey !== savedKey) retiredKeys.current.add(previousKey);
        const previousConflict = blockedKeys.current.has(previousKey) || hasStorageConflict(previousKey);
        const savedConflict = previousKey !== savedKey
            && (blockedKeys.current.has(savedKey) || hasStorageConflict(savedKey));
        if (previousConflict || savedConflict) {
            migrated.current = null;
            setNotice('서버 저장은 완료했습니다. 다른 브라우저 임시 저장본을 발견해 덮어쓰지 않았습니다. 복구 또는 삭제를 선택해 주세요.');
            return;
        }
        blockedKeys.current.delete(previousKey);
        blockedKeys.current.delete(savedKey);
        setAutosaveUpdatedAt(null);
        if (!hasNewerChanges) {
            const previousRemoved = removeAutosave(previousKey);
            const savedRemoved = previousKey === savedKey ? previousRemoved : removeAutosave(savedKey);
            if (previousRemoved) observed.current.set(previousKey, null);
            if (savedRemoved) observed.current.set(savedKey, null);
            written.current.delete(previousKey);
            written.current.delete(savedKey);
            const status = previousRemoved && savedRemoved ? 'idle' : 'error';
            migrated.current = previousKey !== savedKey ? { key: savedKey, status, updatedAt: null } : null;
            setBrowserSaveStatus(status);
            setBrowserSavedAt(null);
            if (status === 'error') setNotice('서버 저장은 완료했지만 브라우저의 이전 임시 저장본을 정리하지 못했습니다.');
            return;
        }
        const updatedAt = new Date().toISOString();
        const savedBaseUpdatedAt = getDraftBaseUpdatedAt();
        const payload = JSON.stringify({ draft: currentDraft, updatedAt, baseUpdatedAt: savedBaseUpdatedAt });
        try {
            // New-post key migration is copy-before-delete to preserve recovery
            // data if storage is full or unavailable.
            localStorage.setItem(savedKey, payload);
            observed.current.set(savedKey, payload);
            written.current.set(savedKey, { signature: getDraftAutosaveSignature(currentDraft), updatedAt, baseUpdatedAt: savedBaseUpdatedAt });
            const previousRemoved = savedKey === previousKey || removeAutosave(previousKey);
            if (savedKey !== previousKey && previousRemoved) observed.current.set(previousKey, null);
            if (savedKey !== previousKey) written.current.delete(previousKey);
            const status = previousRemoved ? 'saved' : 'error';
            migrated.current = previousKey !== savedKey ? { key: savedKey, status, updatedAt } : null;
            setBrowserSaveStatus(status);
            setBrowserSavedAt(updatedAt);
            if (!previousRemoved) setNotice('추가 입력은 새 글의 브라우저 임시 저장본에 보관했지만 이전 임시 저장본을 정리하지 못했습니다.');
        } catch {
            try {
                localStorage.setItem(previousKey, payload);
                observed.current.set(previousKey, payload);
            } catch { /* Preserve any existing copy. */ }
            migrated.current = previousKey !== savedKey ? { key: savedKey, status: 'error', updatedAt: null } : null;
            setBrowserSaveStatus('error');
            setNotice('저장 중 추가한 내용은 아직 서버에 저장되지 않았고 브라우저 임시 저장도 실패했습니다. 다시 저장해 주세요.');
        }
    }, [getDraftBaseUpdatedAt, hasStorageConflict, setNotice]);

    const handleRestoreAutosave = useCallback(() => {
        const saved = readAutosave(autosaveKey);
        if (!saved) return;

        const payload = parseAutosavePayload(saved);
        if (payload) {
            observed.current.set(autosaveKey, saved);
            blockedKeys.current.delete(autosaveKey);
            restoreDraftBaseUpdatedAt(payload.baseUpdatedAt);
            setDraft(normalizeStoredDraft(payload.draft, onLoadDraft()));
            setAutosaveUpdatedAt(null);
            setNotice('임시 저장된 내용을 복구했습니다.');
        } else {
            setNotice('복구에 실패했습니다.');
        }
    }, [autosaveKey, onLoadDraft, restoreDraftBaseUpdatedAt, setDraft, setNotice]);

    const discardAutosave = useCallback(() => {
        if (clearAutosave()) setNotice('임시 저장본을 삭제했습니다.');
    }, [clearAutosave, setNotice]);

    return {
        clearAutosave,
        handleRestoreAutosave,
        discardAutosave,
        hasRestorableDraft,
        autosaveUpdatedAt,
        browserSaveStatus,
        browserSavedAt,
        flushAutosave,
        reconcileSavedDraft
    };
};
