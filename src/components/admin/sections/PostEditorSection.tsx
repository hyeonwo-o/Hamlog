import React from 'react';
import type { Editor } from '@tiptap/react';
import type { PostRevision, PostStatus } from '../../../data/blogData';
import type { PostDraft } from '../../../types/admin';
import type { CategoryTreeResult } from '../../../utils/categoryTree';
import PostCommandBar from '../post/PostCommandBar';
import PostEditorCanvas from '../post/PostEditorCanvas';
import PostEditorHeader from '../post/PostEditorHeader';
import { DEFAULT_CATEGORY } from '../../../utils/category';
import CategoryPicker from '../category/CategoryPicker';
import PostInspector from '../post/PostInspector';
import { useEditorToc } from '../../../hooks/useEditorToc';

export interface EditorHandlers {
  onTitleChange: (value: string) => void;
  onStatusChange: (value: PostStatus) => void;
  onSave: (message?: string, statusOverride?: PostStatus) => Promise<boolean>;
  onDelete: () => void;
  onPublish: () => void;
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
  isDirty: boolean;
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
  contentStats: { chars: number; words: number };
  currentCoverUrl?: string;
  editor: Editor | null;
}

interface PostEditorSectionProps {
  editorHandlers: EditorHandlers;
  tagHandlers: TagHandlers;
  mediaHandlers: MediaHandlers;
  uiState: UIState;
  data: EditorData;
}

const PostEditorSection: React.FC<PostEditorSectionProps> = ({
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
    isDirty,
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
    onPublish,
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
    <div className="mx-auto max-w-none">
      <div className="sticky top-[var(--admin-header-offset)] z-20 border-b border-[color:var(--border)] bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1500px] flex-col gap-1.5 px-3 py-1.5 lg:flex-row lg:items-center lg:justify-between">
          <PostCommandBar
            activeId={activeId}
            status={draft.status}
            saving={saving}
            isDirty={isDirty}
            previewMode={previewMode}
            notice={notice}
            onNoticeClick={onNoticeClick}
            hasRestorableDraft={hasRestorableDraft}
            autosaveLabel={autosaveLabel}
            onRestoreAutosave={onRestoreAutosave}
            onDiscardAutosave={onDiscardAutosave}
            onStatusChange={onStatusChange}
            onTogglePreview={onTogglePreview}
            onSave={() => void onSave('수동 저장되었습니다.')}
            onPublish={onPublish}
            onDelete={onDelete}
          />
        </div>
      </div>

      <div className="mx-auto grid max-w-[1500px] gap-4 px-3 2xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0">
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
          >
            <div className="mx-auto w-full max-w-[920px] px-0 pb-3 pt-6 sm:px-3 lg:px-6">
              <CategoryPicker
                categoryTree={categoryTree}
                value={draft.category}
                onChange={(category) => updateDraft({ category })}
                defaultOptionLabel={DEFAULT_CATEGORY}
                recentStorageKey="hamlog:admin:editor-categories"
                triggerClassName="flex h-8 w-full max-w-[260px] items-center justify-between border border-[color:var(--border)] bg-white px-2.5 text-xs text-[var(--text-muted)] transition hover:border-[color:var(--accent)]"
                panelClassName="absolute left-0 top-full z-40 mt-2 w-full min-w-[320px] rounded-lg border border-[color:var(--border)] bg-white p-3 shadow-lg"
              />

              <PostEditorHeader
                activeId={activeId}
                title={draft.title}
                onTitleChange={onTitleChange}
              />
            </div>
          </PostEditorCanvas>

          <div className="mx-auto flex min-h-[54px] w-full max-w-[920px] items-end px-0 pb-7 pt-1 sm:px-3 lg:px-6">
            <div className="flex w-full flex-wrap items-center gap-2">
              {draft.tags.map(tag => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => onRemove(tag)}
                  className="text-xs text-[var(--text-muted)] transition hover:text-red-500"
                  title="태그 삭제"
                >
                  #{tag}
                </button>
              ))}
              <input
                value={tagInput}
                onChange={event => onInputChange(event.target.value)}
                onKeyDown={onKeyDown}
                onBlur={onBlur}
                placeholder="#태그입력"
                className="min-w-[140px] flex-1 bg-transparent text-xs text-[var(--text-muted)] outline-none placeholder:text-[var(--text-muted)]"
              />
            </div>
          </div>

          <div className="h-8" />
        </div>

        <PostInspector
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
    </div>
  );
};

export default PostEditorSection;
