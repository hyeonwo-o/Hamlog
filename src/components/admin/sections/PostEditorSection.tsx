import React from 'react';
import type { Editor } from '@tiptap/react';
import type { PostRevision, PostStatus } from '../../../data/blogData';
import type { PostDraft } from '../../../types/admin';
import type { CategoryTreeResult } from '../../../utils/categoryTree';
import { useEditorToc } from '../../../hooks/useEditorToc';
import AdminSidebar from '../AdminSidebar';
import PostCommandBar from '../post/PostCommandBar';
import PostEditorCanvas from '../post/PostEditorCanvas';
import PostEditorHeader from '../post/PostEditorHeader';
import PostInspector from '../post/PostInspector';
import type { AdminSidebarProps } from '../sidebar/types';

export interface EditorHandlers {
  onTitleChange: (value: string) => void;
  onStatusChange: (value: PostStatus) => void;
  onSave: (message?: string, statusOverride?: PostStatus) => void;
  onDelete: () => void;
  onRestoreRevision: (revisionId: string) => void;
  updateDraft: (patch: Partial<PostDraft>) => void;
  onTogglePreview: () => void;
  onLink: () => void;
}

export interface TagHandlers {
  onInputChange: (value: string) => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  onBlur: () => void;
  onRemove: (tag: string) => void;
}

export interface MediaHandlers {
  onToolbarUpload: () => void;
  onInsertImageUrl: () => void;
  onImageUpload: (file: File) => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
  onCoverUpload?: (file: File) => Promise<void>;
  onSetCoverFromContent?: (src?: string) => void;
  uploadLocalImage?: (file: File) => Promise<{ url: string }>;
}

export interface UIState {
  notice: string;
  saving: boolean;
  activeId: string | null;
  tagInput: string;
  previewMode: boolean;
  uploadingImage: boolean;
  uploadError: string | null;
  revisionsLoading?: boolean;
  restoringRevisionId?: string | null;
  onNoticeClick?: () => void;
  hasRestorableDraft?: boolean;
  autosaveUpdatedAt?: string | null;
  onRestoreAutosave?: () => void;
  onDiscardAutosave?: () => void;
}

export interface EditorData {
  draft: PostDraft;
  categoryTree: CategoryTreeResult;
  revisions: PostRevision[];
  contentStats: { chars: number; words: number; readingMinutes: number };
  currentCoverUrl?: string;
  editor: Editor | null;
}

interface PostEditorSectionProps {
  sidebarProps: Omit<AdminSidebarProps, 'show'>;
  editorHandlers: EditorHandlers;
  tagHandlers: TagHandlers;
  mediaHandlers: MediaHandlers;
  uiState: UIState;
  data: EditorData;
}

const PostEditorSection: React.FC<PostEditorSectionProps> = ({
  sidebarProps,
  editorHandlers,
  tagHandlers,
  mediaHandlers,
  uiState,
  data
}) => {
  const { draft, categoryTree, revisions, contentStats, currentCoverUrl, editor } = data;
  const {
    notice,
    saving,
    activeId,
    tagInput,
    previewMode,
    uploadingImage,
    uploadError,
    revisionsLoading,
    restoringRevisionId,
    onNoticeClick,
    hasRestorableDraft,
    autosaveUpdatedAt,
    onRestoreAutosave,
    onDiscardAutosave
  } = uiState;
  const {
    onTitleChange,
    onStatusChange,
    onSave,
    onDelete,
    onRestoreRevision,
    updateDraft,
    onTogglePreview,
    onLink
  } = editorHandlers;
  const { onInputChange, onKeyDown, onBlur, onRemove } = tagHandlers;
  const {
    onToolbarUpload,
    onInsertImageUrl,
    onImageUpload,
    fileInputRef,
    onCoverUpload,
    onSetCoverFromContent,
    uploadLocalImage
  } = mediaHandlers;
  const { tocItems, handleTocLinkClick } = useEditorToc(editor);

  const autosaveLabel = (() => {
    if (!autosaveUpdatedAt) return '';
    const timestamp = new Date(autosaveUpdatedAt);
    if (Number.isNaN(timestamp.getTime())) return '';
    return timestamp.toLocaleString('ko-KR', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  })();

  return (
    <div className="mx-auto max-w-[1600px]">
      <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <div className="space-y-4">
          <AdminSidebar
            show
            embedded
            {...sidebarProps}
          />

          <PostInspector
            embedded
            activeId={activeId}
            draft={draft}
            categoryTree={categoryTree}
            revisions={revisions}
            revisionsLoading={revisionsLoading}
            restoringRevisionId={restoringRevisionId}
            contentStats={contentStats}
            tagInput={tagInput}
            onTagInputChange={onInputChange}
            onTagKeyDown={onKeyDown}
            onTagBlur={onBlur}
            onRemoveTag={onRemove}
            onUpdateDraft={updateDraft}
            onCoverUpload={onCoverUpload}
            onRestoreRevision={onRestoreRevision}
            tocItems={tocItems}
            onTocLinkClick={handleTocLinkClick}
          />
        </div>

        <div className="min-w-0 space-y-6">
          <div className="angular-panel rounded-xl border border-[color:var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow)]">
            <div className="space-y-6">
              <PostEditorHeader
                activeId={activeId}
                title={draft.title}
                onTitleChange={onTitleChange}
              />

              <PostCommandBar
                activeId={activeId}
                status={draft.status}
                saving={saving}
                previewMode={previewMode}
                notice={notice}
                onNoticeClick={onNoticeClick}
                hasRestorableDraft={hasRestorableDraft}
                autosaveLabel={autosaveLabel}
                onRestoreAutosave={onRestoreAutosave}
                onDiscardAutosave={onDiscardAutosave}
                onStatusChange={onStatusChange}
                onTogglePreview={onTogglePreview}
                onSave={() => onSave('수동 저장되었습니다.')}
                onPublish={() => onSave('발행되었습니다.', 'published')}
                onDelete={onDelete}
              />

              <PostEditorCanvas
                editor={editor}
                previewMode={previewMode}
                contentHtml={draft.contentHtml}
                currentCoverUrl={currentCoverUrl}
                onLink={onLink}
                onToolbarUpload={onToolbarUpload}
                onInsertImageUrl={onInsertImageUrl}
                uploadingImage={uploadingImage}
                uploadError={uploadError}
                fileInputRef={fileInputRef}
                onImageUpload={onImageUpload}
                onSetCoverFromContent={onSetCoverFromContent}
                uploadLocalImage={uploadLocalImage}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PostEditorSection;
