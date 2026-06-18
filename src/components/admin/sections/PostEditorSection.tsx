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

  const categoryOptions = categoryTree.allNames.length > 0
    ? categoryTree.allNames
    : [draft.category || '미분류'];

  return (
    <div className="mx-auto max-w-none">
      <div className="sticky top-[73px] z-20 border-b border-[color:var(--border)] bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1500px] flex-col gap-2 px-4 py-2 lg:flex-row lg:items-center lg:justify-between">
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
        </div>
      </div>

      <div className="mx-auto max-w-[1500px] px-4">
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
          <div className="mx-auto w-full max-w-[980px] px-0 pb-6 pt-10 sm:px-4 lg:px-8">
            <select
              value={draft.category}
              onChange={event => updateDraft({ category: event.target.value })}
              className="h-8 w-40 border border-[color:var(--border)] bg-white px-2 text-xs text-[var(--text-muted)] outline-none transition focus:border-[color:var(--accent)]"
            >
              {categoryOptions.map(category => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>

            <PostEditorHeader
              activeId={activeId}
              title={draft.title}
              onTitleChange={onTitleChange}
            />
          </div>
        </PostEditorCanvas>

        <div className="mx-auto flex min-h-[96px] w-full max-w-[980px] items-end px-0 pb-12 pt-4 sm:px-4 lg:px-8">
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

        <details className="mx-auto mb-10 max-w-[1500px] border-t border-[color:var(--border)] pt-5">
          <summary className="cursor-pointer text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
            관리 패널
          </summary>
          <div className="mt-5 grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
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
        </details>
      </div>
    </div>
  );
};

export default PostEditorSection;
