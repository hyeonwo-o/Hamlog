
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Editor } from '@tiptap/react';
import { useTiptapEditor } from '../../hooks/useTiptapEditor';
import PostEditorSection from './sections/PostEditorSection';
import { useEditorImageControls } from '../../hooks/useEditorImageControls';
import { uploadLocalImage } from '../../api/uploadApi';
import type { Post } from '../../data/blogData';
import type { CategoryTreeResult } from '../../utils/categoryTree';
import { usePostForm, toDraft } from '../../hooks/usePostForm';
import { useAutosave } from '../../hooks/useAutosave';
import { usePostPersistence } from '../../hooks/usePostPersistence';
import { usePostRevisions } from '../../hooks/usePostRevisions';
import { usePostEditorShortcuts } from '../../hooks/usePostEditorShortcuts';
import { usePostEditorActions } from '../../hooks/usePostEditorActions';
import { usePostStore } from '../../store/postStore';
import PublishDialog from './post/PublishDialog';
import {
    normalizeContentHtmlForDirtyCheck,
    normalizeContentJsonForDirtyCheck,
    stripHtml
} from '../../utils/postContent';
import { closeEditorOverlays } from '../../utils/editorOverlays';
import { slugify } from '../../utils/slugify';
import { getEditorContentSnapshot } from '../../editor/utils/editorContentSnapshot';

const MAX_UPLOAD_MB = 8;

const serializeDraftForDirtyCheck = (draft: ReturnType<typeof toDraft>) => JSON.stringify({
    title: draft.title,
    slug: draft.slug,
    summary: draft.summary,
    category: draft.category,
    contentJson: normalizeContentJsonForDirtyCheck(draft.contentJson),
    contentHtml: normalizeContentHtmlForDirtyCheck(draft.contentHtml),
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

interface PostEditorProps {
    post: Post | null;
    requestedPostId: string | null;
    onSaveSuccess: (post: Post) => void;
    onDeleteSuccess: () => void;
    categoryTree: CategoryTreeResult;
    onLoadCategories: () => void | Promise<void>;
    onDirtyChange?: (dirty: boolean) => void;
    postListOpen?: boolean;
    onTogglePostList?: () => void;
    onNewPost?: () => void;
}

const PostEditor: React.FC<PostEditorProps> = ({
    post,
    requestedPostId,
    onSaveSuccess,
    onDeleteSuccess,
    categoryTree,
    onLoadCategories,
    onDirtyChange,
    postListOpen,
    onTogglePostList,
    onNewPost
}) => {
    const activeId = post?.id || null;
    const applyConfirmedPost = usePostStore(state => state.applyConfirmedPost);
    const posts = usePostStore(state => state.posts);

    // 1. Form Logic (extracted)
    const {
        draft,
        setDraft,
        getCurrentDraft,
        getDraftBaseUpdatedAt,
        restoreDraftBaseUpdatedAt,
        acceptDraftBaseline,
        acceptSavedPost,
        tagInput,
        setTagInput,
        updateDraft,
        handleTitleChange,
        removeTag,
        handleTagKeyDown,
        handleTagBlur
    } = usePostForm(post);

    const [notice, setNotice] = useState('');
    const [previewMode, setPreviewMode] = useState(false);
    const [publishDialogOpen, setPublishDialogOpen] = useState(false);
    const [publishStatus, setPublishStatus] = useState(draft.status);
    const editorRef = useRef<Editor | null>(null);
    const previewToggleTimeoutRef = useRef<number | null>(null);
    const preserveNoticeOnPostChangeRef = useRef(false);
    const isSaveBusyRef = useRef<() => boolean>(() => false);
    const loadDraftSnapshot = useCallback(() => toDraft(post || undefined), [post]);

    // Reset post-scoped UI before autosave checks can surface a restorable draft notice.
    useEffect(() => {
        if (preserveNoticeOnPostChangeRef.current) {
            preserveNoticeOnPostChangeRef.current = false;
        } else {
            setNotice('');
        }
        setPreviewMode(false);
    }, [post]);

    // 2. Auto-save Logic (extracted)
    const {
        handleRestoreAutosave,
        discardAutosave,
        hasRestorableDraft,
        autosaveUpdatedAt,
        browserSaveStatus,
        browserSavedAt,
        reconcileSavedDraft
    } = useAutosave({
        activeId,
        draft,
        setDraft,
        setNotice,
        onLoadDraft: loadDraftSnapshot,
        getDraftBaseUpdatedAt,
        restoreDraftBaseUpdatedAt
    });

    const {
        revisions,
        revisionsLoading,
        restoringRevisionId,
        restoringRef,
        loadRevisions,
        handleRestoreRevision
    } = usePostRevisions({
        activeId,
        expectedUpdatedAt: getDraftBaseUpdatedAt(),
        isBusy: useCallback(() => {
            if (hasRestorableDraft) {
                setNotice('브라우저 임시 저장본을 먼저 복구하거나 삭제해 주세요.');
                return true;
            }
            return isSaveBusyRef.current();
        }, [hasRestorableDraft]),
        captureRestoreGuard: useCallback(() => {
            const before = getCurrentDraft();
            return () => getCurrentDraft() === before;
        }, [getCurrentDraft]),
        setNotice,
        onRestoreWithoutApply: useCallback((restoredPost: Post) => {
            acceptDraftBaseline(restoredPost);
            applyConfirmedPost(restoredPost);
        }, [acceptDraftBaseline, applyConfirmedPost]),
        onAfterRestore: useCallback((restoredPost: Post) => {
            const result = acceptSavedPost(restoredPost, getCurrentDraft());
            reconcileSavedDraft({ previousId: activeId, savedId: restoredPost.id, ...result });
            preserveNoticeOnPostChangeRef.current = true;
            applyConfirmedPost(restoredPost);
            onSaveSuccess(restoredPost);
            onDirtyChange?.(false);
        }, [acceptSavedPost, getCurrentDraft, reconcileSavedDraft, activeId, applyConfirmedPost, onSaveSuccess, onDirtyChange])
    });

    // 3. Persistence Logic (extracted)
    const {
        handleSave,
        handleDelete,
        saving,
        savingRef,
    } = usePostPersistence({
        getCurrentDraft,
        getDraftBaseUpdatedAt,
        activeId,
        documentKey: requestedPostId,
        isBusy: useCallback(() => {
            if (hasRestorableDraft) {
                setNotice('브라우저 임시 저장본을 먼저 복구하거나 삭제해 주세요.');
                return true;
            }
            return restoringRef.current;
        }, [hasRestorableDraft, restoringRef]),
        onSaveSuccess: useCallback((savedPost: Post, submittedDraft: ReturnType<typeof toDraft>) => {
            const result = acceptSavedPost(savedPost, submittedDraft);
            if (result.hasNewerChanges) {
                setNotice('저장 요청한 내용은 서버에 저장했습니다. 이후 입력한 변경사항은 아직 서버에 저장되지 않았습니다.');
            }
            // Recovery errors take precedence over the normal save notice.
            reconcileSavedDraft({ previousId: activeId, savedId: savedPost.id, ...result });
            preserveNoticeOnPostChangeRef.current = true;
            onSaveSuccess(savedPost);
            onDirtyChange?.(result.hasNewerChanges);
            void loadRevisions(savedPost.id);
            void onLoadCategories();
        }, [acceptSavedPost, reconcileSavedDraft, activeId, onSaveSuccess, onDirtyChange, loadRevisions, onLoadCategories]),
        onDeleteSuccess,
        setNotice
    });
    isSaveBusyRef.current = () => savingRef.current;

    const {
        fileInputRef,
        uploadingImage,
        uploadError,
        uploadValidatedImage,
        uploadImageToEditor,
        handlePaste,
        handleDrop,
        handleToolbarImageUpload,
        handleInsertImageUrl
    } = useEditorImageControls({
        editorRef,
        documentKey: activeId || 'new-post',
        maxUploadMb: MAX_UPLOAD_MB,
        uploadLocalImage
    });

    const editor = useTiptapEditor({
        contentJson: draft.contentJson,
        contentHtml: draft.contentHtml || '',
        setDraft,
        handlePaste,
        handleDrop
    });

    const baselineDraftKey = useMemo(
        () => serializeDraftForDirtyCheck(toDraft(post || undefined)),
        [post]
    );
    const currentDraftKey = useMemo(
        () => serializeDraftForDirtyCheck(draft),
        [draft]
    );
    const publishSlugTaken = useMemo(() => {
        const slug = slugify(draft.slug.trim() || draft.title.trim());
        return Boolean(slug && posts.some(item => item.slug === slug && item.id !== activeId));
    }, [activeId, draft.slug, draft.title, posts]);
    const isDirty = currentDraftKey !== baselineDraftKey;

    useEffect(() => {
        editorRef.current = editor;
    }, [editor]);

    useEffect(() => {
        onDirtyChange?.(isDirty);
    }, [isDirty, onDirtyChange]);

    useEffect(() => {
        return () => {
            onDirtyChange?.(false);
        };
    }, [onDirtyChange]);

    useEffect(() => {
        if (!isDirty) return;

        const handleBeforeUnload = (event: BeforeUnloadEvent) => {
            event.preventDefault();
            event.returnValue = '';
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [isDirty]);

    useEffect(() => {
        return () => {
            if (previewToggleTimeoutRef.current !== null) {
                window.clearTimeout(previewToggleTimeoutRef.current);
            }
        };
    }, []);

    const togglePreviewMode = useCallback(() => {
        closeEditorOverlays();
        if (previewToggleTimeoutRef.current !== null) {
            window.clearTimeout(previewToggleTimeoutRef.current);
            previewToggleTimeoutRef.current = null;
        }

        if (!previewMode) {
            editor?.commands.blur();
            previewToggleTimeoutRef.current = window.setTimeout(() => {
                setPreviewMode(true);
                previewToggleTimeoutRef.current = null;
                document.querySelector<HTMLButtonElement>('[data-testid="post-preview-toggle"]')?.focus();
            }, 0);
            return;
        }

        setPreviewMode(false);
        window.requestAnimationFrame(() => {
            document.querySelector<HTMLButtonElement>('[data-testid="post-preview-toggle"]')?.focus();
        });
    }, [editor, previewMode]);

    // Sync editor content when draft changes
    useEffect(() => {
        if (!editor) return;
        const editorSnapshot = getEditorContentSnapshot(editor);
        if (draft.contentJson && draft.contentJson === editorSnapshot.contentJson) return;
        if (draft.contentJson) {
            const editorContentKey = editorSnapshot.contentJsonKey;
            if (editorContentKey !== JSON.stringify(draft.contentJson)) {
                editor.commands.setContent(draft.contentJson, { emitUpdate: false });
            }
            return;
        }

        const safeHtml = draft.contentHtml?.trim() ? draft.contentHtml : '';
        if (editorSnapshot.contentHtml !== safeHtml) {
            editor.commands.setContent(safeHtml, { emitUpdate: false });
        }
    }, [editor, activeId, draft.contentHtml, draft.contentJson]);

    const contentStats = useMemo(() => {
        const plainText = stripHtml(draft.contentHtml || '');
        const words = plainText ? plainText.split(/\s+/).filter(Boolean).length : 0;
        return {
            chars: plainText.length,
            words
        };
    }, [draft.contentHtml]);

    const handleImageUpload = async (file: File) => {
        await uploadImageToEditor(file);
    };
    const { handleCoverUpload, handleSetCoverFromContent, handleLink } = usePostEditorActions({
        editor,
        updateDraft,
        setNotice,
        uploadImage: uploadValidatedImage
    });

    const openPublishDialog = useCallback(() => {
        if (hasRestorableDraft) {
            setNotice('브라우저 임시 저장본을 먼저 복구하거나 삭제해 주세요.');
            return;
        }
        closeEditorOverlays();
        editor?.commands.blur();
        setPublishStatus(draft.status);
        setPublishDialogOpen(true);
    }, [draft.status, editor, hasRestorableDraft]);

    const closePublishDialog = useCallback(() => {
        if (!saving) setPublishDialogOpen(false);
    }, [saving]);

    const confirmPublishDialog = useCallback(async () => {
        if (saving) return;
        const saved = await handleSave(
            publishStatus === 'published'
                ? '발행되었습니다.'
                : publishStatus === 'scheduled'
                    ? '예약 저장되었습니다.'
                    : '비공개로 저장되었습니다.',
            publishStatus
        );
        if (saved) setPublishDialogOpen(false);
    }, [handleSave, publishStatus, saving]);

    usePostEditorShortcuts({
        onSaveDraft: () => {
            if (draft.status === 'draft') {
                void handleSave('초안으로 저장되었습니다.', 'draft');
                return;
            }
            openPublishDialog();
        },
        onSave: () => {
            void handleSave('수동 저장되었습니다.');
        },
        onPublish: openPublishDialog,
        onTogglePreview: togglePreviewMode
    });

    const groupedProps = {
        editorHandlers: {
            onTitleChange: handleTitleChange,
            onSave: handleSave,
            onDelete: () => void handleDelete(),
            onPublish: openPublishDialog,
            onRestoreRevision: (revisionId: string) => void handleRestoreRevision(revisionId),
            updateDraft,
            onTogglePreview: togglePreviewMode,
            onLink: handleLink
        },
        tagHandlers: {
            onInputChange: setTagInput,
            onKeyDown: handleTagKeyDown,
            onBlur: handleTagBlur,
            onRemove: removeTag
        },
        mediaHandlers: {
            onToolbarUpload: handleToolbarImageUpload,
            onInsertImageUrl: handleInsertImageUrl,
            onImageUpload: (file: File) => void handleImageUpload(file),
            fileInputRef,
            onCoverUpload: handleCoverUpload,
            onSetCoverFromContent: handleSetCoverFromContent,
            uploadLocalImage: uploadValidatedImage
        },
        uiState: {
            notice,
            saving,
            activeId,
            tagInput,
            previewMode,
            uploadingImage,
            uploadError,
            isDirty,
            revisionsLoading,
            restoringRevisionId,
            onNoticeClick: notice.includes('복구') ? handleRestoreAutosave : undefined,
            hasRestorableDraft,
            autosaveUpdatedAt,
            browserSaveStatus,
            browserSavedAt,
            serverSavedAt: post?.updatedAt || null,
            onRestoreAutosave: handleRestoreAutosave,
            onDiscardAutosave: discardAutosave
        },
        data: {
            draft,
            categoryTree,
            revisions,
            contentStats,
            currentCoverUrl: draft.cover,
            editor
        }
    };

    return (
        <>
            <PostEditorSection
                {...groupedProps}
                postListOpen={postListOpen}
                onTogglePostList={onTogglePostList}
                onNewPost={onNewPost}
            />
            <PublishDialog
                open={publishDialogOpen}
                draft={draft}
                categoryTree={categoryTree}
                status={publishStatus}
                slugTaken={publishSlugTaken}
                saving={saving}
                tagInput={tagInput}
                onTagInputChange={setTagInput}
                onTagKeyDown={handleTagKeyDown}
                onTagBlur={handleTagBlur}
                onRemoveTag={removeTag}
                onUpdateDraft={updateDraft}
                onClose={closePublishDialog}
                onStatusChange={setPublishStatus}
                onConfirm={confirmPublishDialog}
                onCoverUpload={handleCoverUpload}
            />
        </>
    );
};

export default PostEditor;
