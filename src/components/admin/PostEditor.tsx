
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Editor } from '@tiptap/react';
import type { JSONContent } from '@tiptap/core';
import { useTiptapEditor } from '../../hooks/useTiptapEditor';
import PostEditorSection from './sections/PostEditorSection';
import { useEditorImageControls } from '../../hooks/useEditorImageControls';
import { uploadLocalImage } from '../../api/uploadApi';
import type { Post, PostStatus } from '../../data/blogData';
import type { CategoryTreeResult } from '../../utils/categoryTree';
import { usePostForm, toDraft } from '../../hooks/usePostForm';
import { useAutosave } from '../../hooks/useAutosave';
import { usePostPersistence } from '../../hooks/usePostPersistence';
import { usePostEditorShortcuts } from '../../hooks/usePostEditorShortcuts';
import { usePostEditorActions } from '../../hooks/usePostEditorActions';

const MAX_UPLOAD_MB = 8;

const serializeContentJson = (contentJson?: JSONContent) =>
    contentJson ? JSON.stringify(contentJson) : '';

interface PostEditorProps {
    post: Post | null;
    onSaveSuccess: (post: Post) => void;
    onDeleteSuccess: () => void;
    categoryTree: CategoryTreeResult;
    onLoadCategories: () => void | Promise<void>;
}

const PostEditor: React.FC<PostEditorProps> = ({
    post,
    onSaveSuccess,
    onDeleteSuccess,
    categoryTree,
    onLoadCategories
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
    const loadDraftSnapshot = useCallback(() => toDraft(post || undefined), [post]);

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

    // Reset UI on post change
    useEffect(() => {
        setNotice('');
        setPreviewMode(false);
    }, [post]);

    // 3. Persistence Logic (extracted)
    const {
        handleSave,
        handleDelete,
        saving,
    } = usePostPersistence({
        draft,
        activeId,
        onSaveSuccess: useCallback((savedPost: Post) => {
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

    // Reset notice when post changes
    useEffect(() => {
        setNotice('');
    }, [post, setNotice]);

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

    useEffect(() => {
        editorRef.current = editor;
    }, [editor]);

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
        onSaveDraft: () => handleSave('초안으로 저장되었습니다.', 'draft'),
        onSave: () => handleSave('수동 저장되었습니다.'),
        onPublish: () => handleSave('발행되었습니다.', 'published'),
        onTogglePreview: togglePreviewMode
    });

    const groupedProps = {
        editorHandlers: {
            onTitleChange: handleTitleChange,
            onStatusChange: handleStatusChange,
            onSave: (message?: string, statusOverride?: PostStatus) => void handleSave(message, statusOverride),
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
