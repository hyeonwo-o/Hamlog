
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
import { usePostEditorShortcuts } from '../../hooks/usePostEditorShortcuts';
import { usePostEditorActions } from '../../hooks/usePostEditorActions';
import {
    normalizeContentHtmlForDirtyCheck,
    normalizeContentJsonForDirtyCheck
} from '../../utils/postContent';

const MAX_UPLOAD_MB = 8;

const serializeContentJson = (contentJson?: ReturnType<typeof toDraft>['contentJson']) =>
    contentJson ? JSON.stringify(contentJson) : '';

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
    onSaveSuccess: (post: Post) => void;
    onDeleteSuccess: () => void;
    categoryTree: CategoryTreeResult;
    onLoadCategories: () => void | Promise<void>;
    onDirtyChange?: (dirty: boolean) => void;
}

const PostEditor: React.FC<PostEditorProps> = ({
    post,
    onSaveSuccess,
    onDeleteSuccess,
    categoryTree,
    onLoadCategories,
    onDirtyChange
}) => {
    const activeId = post?.id || null;

    // 1. Form Logic (extracted)
    const {
        draft,
        setDraft,
        setSlugTouched,
        tagInput,
        setTagInput,
        updateDraft,
        handleTitleChange,
        handleStatusChange,
        removeTag,
        handleTagKeyDown,
        handleTagBlur
    } = usePostForm(post);

    const [notice, setNotice] = useState('');
    const [previewMode, setPreviewMode] = useState(false);
    const editorRef = useRef<Editor | null>(null);
    const previewToggleTimeoutRef = useRef<number | null>(null);
    const preserveNoticeOnPostChangeRef = useRef(false);
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
        clearAutosave,
        handleRestoreAutosave,
        discardAutosave,
        hasRestorableDraft,
        autosaveUpdatedAt
    } = useAutosave({
        activeId,
        draft,
        setDraft,
        setNotice,
        onLoadDraft: loadDraftSnapshot
    });

    // 3. Persistence Logic (extracted)
    const {
        handleSave,
        handleDelete,
        saving,
    } = usePostPersistence({
        draft,
        activeId,
        onSaveSuccess: useCallback((savedPost: Post) => {
            preserveNoticeOnPostChangeRef.current = true;
            onSaveSuccess(savedPost);
        }, [onSaveSuccess]),
        onDeleteSuccess,
        setNotice,
        onAfterSave: useCallback(() => {
            setSlugTouched(true);
            setTagInput('');
            clearAutosave();
            void onLoadCategories();
        }, [setSlugTouched, setTagInput, clearAutosave, onLoadCategories])
    });

    const {
        fileInputRef,
        uploadingImage,
        uploadError,
        uploadImageToEditor,
        handleSelectionUpdate,
        handlePaste,
        handleDrop,
        handleToolbarImageUpload,
        handleInsertImageUrl
    } = useEditorImageControls({
        editorRef,
        maxUploadMb: MAX_UPLOAD_MB,
        uploadLocalImage
    });

    const editor = useTiptapEditor({
        contentJson: draft.contentJson,
        contentHtml: draft.contentHtml || '',
        setDraft,
        handleSelectionUpdate,
        handlePaste,
        handleDrop
    });

    const draftContentJsonKey = useMemo(
        () => serializeContentJson(draft.contentJson),
        [draft.contentJson]
    );
    const baselineDraftKey = useMemo(
        () => serializeDraftForDirtyCheck(toDraft(post || undefined)),
        [post]
    );
    const currentDraftKey = useMemo(
        () => serializeDraftForDirtyCheck(draft),
        [draft]
    );
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
        if (previewToggleTimeoutRef.current !== null) {
            window.clearTimeout(previewToggleTimeoutRef.current);
            previewToggleTimeoutRef.current = null;
        }

        if (!previewMode) {
            editor?.commands.blur();
            previewToggleTimeoutRef.current = window.setTimeout(() => {
                setPreviewMode(true);
                previewToggleTimeoutRef.current = null;
            }, 0);
            return;
        }

        setPreviewMode(false);
    }, [editor, previewMode]);

    // Sync editor content when draft changes
    useEffect(() => {
        if (!editor) return;
        if (draftContentJsonKey) {
            const editorContentKey = serializeContentJson(editor.getJSON());
            if (editorContentKey !== draftContentJsonKey && draft.contentJson) {
                editor.commands.setContent(draft.contentJson, false);
            }
            return;
        }

        const safeHtml = draft.contentHtml?.trim() ? draft.contentHtml : '';
        if (editor.getHTML() !== safeHtml) {
            editor.commands.setContent(safeHtml, false);
        }
    }, [editor, activeId, draft.contentHtml, draft.contentJson, draftContentJsonKey]);

    const handleImageUpload = async (file: File) => {
        await uploadImageToEditor(file);
    };
    const { handleCoverUpload, handleSetCoverFromContent, handleLink } = usePostEditorActions({
        editor,
        updateDraft,
        setNotice
    });

    usePostEditorShortcuts({
        onSaveDraft: () => {
            void handleSave('초안으로 저장되었습니다.', 'draft');
        },
        onSave: () => {
            void handleSave('수동 저장되었습니다.');
        },
        onPublish: () => {
            void handleSave('발행되었습니다.', 'published');
        },
        onTogglePreview: togglePreviewMode
    });

    const groupedProps = {
        editorHandlers: {
            onTitleChange: handleTitleChange,
            onStatusChange: handleStatusChange,
            onSave: handleSave,
            onDelete: () => void handleDelete(),
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
            uploadLocalImage
        },
        uiState: {
            notice,
            saving,
            activeId,
            tagInput,
            previewMode,
            uploadingImage,
            uploadError,
            onNoticeClick: notice.includes('복구') ? handleRestoreAutosave : undefined,
            hasRestorableDraft,
            autosaveUpdatedAt,
            onRestoreAutosave: handleRestoreAutosave,
            onDiscardAutosave: discardAutosave
        },
        data: {
            draft,
            categoryTree,
            currentCoverUrl: draft.cover,
            editor
        }
    };

    return <PostEditorSection {...groupedProps} />;
};

export default PostEditor;
