import { useState, useCallback } from 'react';
import type { PostDraft } from '../types/admin';
import type { Post, PostStatus } from '../data/blogData';
import type { SavePostInput } from '../api/postApi';
import { usePostStore } from '../store/postStore';
import { slugify } from '../utils/slugify';
import { stripHtml } from '../utils/postContent';
import { normalizePostStatus } from '../utils/postStatus';
import { toIsoDateTime } from '../utils/adminDate';
import { normalizeDraftCategory, DEFAULT_CATEGORY } from '../utils/category';
import { isAuthenticationError } from '../api/client';

const hasMeaningfulContentNode = (node: unknown): boolean => {
    if (!node || typeof node !== 'object') return false;

    const typedNode = node as {
        type?: string;
        text?: string;
        attrs?: Record<string, unknown>;
        content?: unknown[];
    };

    if (typedNode.type === 'text') {
        return typeof typedNode.text === 'string' && typedNode.text.trim().length > 0;
    }

    if (typedNode.type === 'hardBreak' || typedNode.type === 'horizontalRule') {
        return true;
    }

    if (typedNode.type === 'image') {
        return typeof typedNode.attrs?.src === 'string' && typedNode.attrs.src.trim().length > 0;
    }

    if (typedNode.type === 'linkCard') {
        return typeof typedNode.attrs?.url === 'string' && typedNode.attrs.url.trim().length > 0;
    }

    if (typedNode.type === 'youtube') {
        return typeof typedNode.attrs?.src === 'string' && typedNode.attrs.src.trim().length > 0;
    }

    if (typedNode.type === 'math') {
        return typeof typedNode.attrs?.latex === 'string' && typedNode.attrs.latex.trim().length > 0;
    }

    if (typedNode.type === 'table' || typedNode.type === 'imageGallery' || typedNode.type === 'columns') {
        return true;
    }

    if (Array.isArray(typedNode.content)) {
        return typedNode.content.some(child => hasMeaningfulContentNode(child));
    }

    return false;
};

const hasDocumentContent = (contentJson: PostDraft['contentJson']) =>
    Boolean(contentJson && hasMeaningfulContentNode(contentJson));

interface UsePostPersistenceProps {
    draft: PostDraft;
    activeId: string | null;
    onSaveSuccess: (post: Post) => void;
    onDeleteSuccess: () => void;
    onAfterSave: () => void;
    setNotice: (message: string) => void;
}

export const usePostPersistence = ({
    draft,
    activeId,
    onSaveSuccess,
    onDeleteSuccess,
    onAfterSave,
    setNotice
}: UsePostPersistenceProps) => {
    const [saving, setSaving] = useState(false);

    const posts = usePostStore(state => state.posts);
    const addPost = usePostStore(state => state.addPost);
    const updatePost = usePostStore(state => state.updatePost);
    const deletePost = usePostStore(state => state.deletePost);

    const handleSave = useCallback(async (successMessage?: string, statusOverride?: PostStatus) => {
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
            return;
        }

        if (!slug) {
            setNotice('슬러그를 입력하세요.');
            return;
        }

        if (status !== 'draft' && !contentText && !hasContentJson) {
            setNotice('본문 내용을 입력하세요.');
            return;
        }

        if (status === 'scheduled' && !scheduledAtIso) {
            setNotice('예약 발행 날짜를 입력하세요.');
            return;
        }

        const slugTaken = posts.some(p => p.slug === slug && p.id !== activeId);
        if (slugTaken) {
            setNotice('슬러그가 이미 존재합니다.');
            return;
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

        const existingPost = activeId ? posts.find(post => post.id === activeId) : null;
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
            expectedUpdatedAt: activeId ? existingPost?.updatedAt ?? '' : undefined
        };

        setSaving(true);
        try {
            const saved = activeId
                ? await updatePost(activeId, payload)
                : await addPost(payload);

            const fallbackMessage = activeId ? '글이 저장되었습니다.' : '새 글이 생성되었습니다.';
            setNotice(successMessage ?? fallbackMessage);

            // Notify Parent
            onSaveSuccess(saved);
            onAfterSave();

        } catch (error) {
            if (isAuthenticationError(error)) {
                window.location.assign('/admin?auth=required');
                return;
            }

            if (error instanceof Error && error.message) {
                setNotice(error.message);
            } else {
                setNotice('저장에 실패했습니다.');
            }
        } finally {
            setSaving(false);
        }
    }, [draft, posts, activeId, updatePost, addPost, onSaveSuccess, onAfterSave, setNotice]);

    const handleDelete = async () => {
        if (!activeId) return;
        const confirmed = window.confirm(`"${draft.title}" 글을 삭제할까요? 되돌릴 수 없습니다.`);
        if (!confirmed) return;

        setSaving(true);
        try {
            await deletePost(activeId);
            setNotice('글이 삭제되었습니다.');
            onDeleteSuccess();
        } catch (error) {
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
            setSaving(false);
        }
    };

    return {
        handleSave,
        handleDelete,
        saving,
        setSaving
    };
};
