import { useState, useCallback, useEffect, useRef } from 'react';
import type { PostDraft } from '../types/admin';
import type { Post, PostStatus } from '../data/blogData';
import type { SavePostInput } from '../api/postApi';
import { usePostStore } from '../store/postStore';
import { slugify } from '../utils/slugify';
import { hasDocumentContent, stripHtml } from '../utils/postContent';
import { normalizePostStatus } from '../utils/postStatus';
import { toIsoDateTime } from '../utils/adminDate';
import { normalizeDraftCategory, DEFAULT_CATEGORY } from '../utils/category';
import { isAuthenticationError } from '../api/client';

interface UsePostPersistenceProps {
    getCurrentDraft: () => PostDraft;
    getDraftBaseUpdatedAt: () => string | undefined;
    activeId: string | null;
    documentKey: string | null;
    onSaveSuccess: (post: Post, submittedDraft: PostDraft) => void;
    onDeleteSuccess: () => void;
    setNotice: (message: string) => void;
    isBusy?: () => boolean;
}

export const usePostPersistence = ({
    getCurrentDraft,
    getDraftBaseUpdatedAt,
    activeId,
    documentKey,
    onSaveSuccess,
    onDeleteSuccess,
    setNotice,
    isBusy
}: UsePostPersistenceProps) => {
    const [saving, setSaving] = useState(false);
    const savingRef = useRef(false);
    const mountedRef = useRef(true);
    const documentRef = useRef({ id: documentKey, generation: 0 });
    if (documentRef.current.id !== documentKey) {
        documentRef.current = { id: documentKey, generation: documentRef.current.generation + 1 };
    }
    useEffect(() => {
        mountedRef.current = true;
        return () => { mountedRef.current = false; };
    }, []);

    const posts = usePostStore(state => state.posts);
    const addPost = usePostStore(state => state.addPost);
    const updatePost = usePostStore(state => state.updatePost);
    const deletePost = usePostStore(state => state.deletePost);

    const handleSave = useCallback(async (successMessage?: string, statusOverride?: PostStatus) => {
        // State alone cannot guard two shortcuts fired before React commits a render.
        if (savingRef.current || isBusy?.()) return false;
        const document = documentRef.current;
        const isCurrentDocument = () => mountedRef.current && documentRef.current === document;
        const draft: PostDraft = JSON.parse(JSON.stringify(getCurrentDraft()));
        setNotice('');
        const title = draft.title.trim();
        const slug = slugify(draft.slug.trim() || title);
        const contentHtml = draft.contentHtml?.trim() || '';
        const contentText = stripHtml(contentHtml);
        const hasContentJson = hasDocumentContent(draft.contentJson);
        const status = normalizePostStatus(statusOverride ?? draft.status);
        const scheduledAtIso =
            status === 'scheduled' && draft.scheduledAt ? toIsoDateTime(draft.scheduledAt) : '';

        if (!title) {
            setNotice('제목을 입력하세요.');
            return false;
        }

        if (!slug) {
            setNotice('슬러그를 입력하세요.');
            return false;
        }

        if (status !== 'draft' && !contentText && !hasContentJson) {
            setNotice('본문 내용을 입력하세요.');
            return false;
        }

        if (status === 'scheduled' && !scheduledAtIso) {
            setNotice('예약 발행 날짜를 입력하세요.');
            return false;
        }

        const slugTaken = posts.some(p => p.slug === slug && p.id !== activeId);
        if (slugTaken) {
            setNotice('슬러그가 이미 존재합니다.');
            return false;
        }

        const tags = draft.tags
            .map(tag => tag.trim())
            .filter(Boolean)
            .filter((tag, index, list) => list.indexOf(tag) === index);

        const seoKeywords = draft.seoKeywords
            .split(',')
            .map(keyword => keyword.trim())
            .filter(Boolean);
        const seo = {
            title: draft.seoTitle.trim() || undefined,
            description: draft.seoDescription.trim() || undefined,
            ogImage: draft.seoOgImage.trim() || undefined,
            canonicalUrl: draft.seoCanonicalUrl.trim() || undefined,
            keywords: seoKeywords.length ? seoKeywords : undefined
        };
        const publishedAt =
            status === 'scheduled' && scheduledAtIso
                ? scheduledAtIso.slice(0, 10)
                : draft.publishedAt || new Date().toISOString().slice(0, 10);

        let expectedUpdatedAt = activeId ? getDraftBaseUpdatedAt() : undefined;
        if (activeId && expectedUpdatedAt === undefined) {
            const verifiedPost = posts.find(post => post.id === activeId);
            if (!verifiedPost || usePostStore.getState().loadedMode !== 'full') {
                setNotice('임시 저장본의 기준 버전을 확인할 수 없습니다. 최신 서버 저장본을 불러온 뒤 다시 확인해 주세요.');
                return false;
            }
            const confirmed = window.confirm('이 임시 저장본에는 서버 기준 버전 정보가 없습니다. 저장하면 현재 확인한 서버 저장본을 복구한 내용으로 교체합니다. 최신 내용을 검토했으며 덮어쓰시겠습니까?');
            if (!confirmed) {
                setNotice('서버 저장을 취소했습니다. 복구한 내용은 편집기에 유지됩니다.');
                return false;
            }
            // Only an explicit overwrite choice may adopt this known server
            // version. A later concurrent edit still fails the server lock.
            expectedUpdatedAt = verifiedPost.updatedAt ?? '';
        }

        const payload: SavePostInput = {
            slug,
            title,
            summary: draft.summary.trim() || '요약이 없습니다.',
            category: normalizeDraftCategory(draft.category, DEFAULT_CATEGORY),
            contentJson: draft.contentJson,
            contentHtml: hasContentJson ? undefined : contentHtml || undefined,
            publishedAt,
            tags,
            series: draft.series.trim() || undefined,
            featured: draft.featured,
            cover: draft.cover.trim() || undefined,
            status,
            scheduledAt: status === 'scheduled' ? scheduledAtIso || undefined : '',
            seo:
                seo.title || seo.description || seo.ogImage || seo.canonicalUrl || seo.keywords
                    ? seo
                    : undefined,
            sections: [],
            expectedUpdatedAt
        };

        savingRef.current = true;
        setSaving(true);
        try {
            const saved = activeId
                ? await updatePost(activeId, payload)
                : await addPost(payload);

            // Saving still updates the store, but must never navigate back to an old
            // document or overwrite the draft that the user switched to.
            if (!isCurrentDocument()) return false;

            const fallbackMessage = activeId ? '글이 저장되었습니다.' : '새 글이 생성되었습니다.';
            setNotice(successMessage ?? fallbackMessage);

            // Notify Parent
            onSaveSuccess(saved, draft);
            return true;

        } catch (error) {
            if (!isCurrentDocument()) return false;
            if (isAuthenticationError(error)) {
                window.location.assign('/admin?auth=required');
                return false;
            }

            if (error instanceof Error && error.message) {
                setNotice(error.message);
            } else {
                setNotice('저장에 실패했습니다.');
            }
            return false;
        } finally {
            savingRef.current = false;
            if (mountedRef.current) setSaving(false);
        }
    }, [getCurrentDraft, getDraftBaseUpdatedAt, posts, activeId, updatePost, addPost, onSaveSuccess, setNotice, isBusy]);

    const handleDelete = async () => {
        if (!activeId || savingRef.current || isBusy?.()) return;
        const document = documentRef.current;
        const isCurrentDocument = () => mountedRef.current && documentRef.current === document;
        const draft = getCurrentDraft();
        const confirmed = window.confirm(`"${draft.title}" 글을 삭제할까요? 되돌릴 수 없습니다.`);
        if (!confirmed) return;

        savingRef.current = true;
        setSaving(true);
        try {
            await deletePost(activeId);
            if (!isCurrentDocument()) return;
            setNotice('글이 삭제되었습니다.');
            onDeleteSuccess();
        } catch (error) {
            if (!isCurrentDocument()) return;
            if (isAuthenticationError(error)) {
                window.location.assign('/admin?auth=required');
                return;
            }

            if (error instanceof Error && error.message) {
                setNotice(error.message);
            } else {
                setNotice('삭제에 실패했습니다.');
            }
        } finally {
            savingRef.current = false;
            if (mountedRef.current) setSaving(false);
        }
    };

    return {
        handleSave,
        handleDelete,
        saving,
        savingRef
    };
};
