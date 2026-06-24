import React from 'react';
import type { Editor } from '@tiptap/react';
import type { PostStatus } from '../../../data/blogData';
import type { PostDraft } from '../../../types/admin';
import type { CategoryTreeResult } from '../../../utils/categoryTree';
import PostCommandBar from '../post/PostCommandBar';
import PostEditorCanvas from '../post/PostEditorCanvas';
import PostEditorHeader from '../post/PostEditorHeader';
import { slugify } from '../../../utils/slugify';
import { DEFAULT_CATEGORY } from '../../../utils/category';
import CategoryPicker from '../category/CategoryPicker';

export interface EditorHandlers {
  onTitleChange: (value: string) => void;
  onStatusChange: (value: PostStatus) => void;
  onSave: (message?: string, statusOverride?: PostStatus) => Promise<boolean>;
  onDelete: () => void;
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
  onNoticeClick?: () => void;
  hasRestorableDraft?: boolean;
  autosaveUpdatedAt?: string | null;
  onRestoreAutosave?: () => void;
  onDiscardAutosave?: () => void;
}

export interface EditorData {
  draft: PostDraft;
  categoryTree: CategoryTreeResult;
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

interface PublishDialogProps {
  open: boolean;
  draft: PostDraft;
  categoryTree: CategoryTreeResult;
  status: PostStatus;
  saving: boolean;
  tagInput: string;
  onTagInputChange: (value: string) => void;
  onTagKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  onTagBlur: () => void;
  onRemoveTag: (tag: string) => void;
  onUpdateDraft: (patch: Partial<PostDraft>) => void;
  onClose: () => void;
  onStatusChange: (status: PostStatus) => void;
  onConfirm: () => void | Promise<void>;
  onCoverUpload?: (file: File) => Promise<void>;
}

const resolvePostUrl = (slug: string) => {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/posts/${slug || 'post-url'}`;
};

const PublishDialog: React.FC<PublishDialogProps> = ({
  open,
  draft,
  categoryTree,
  status,
  saving,
  tagInput,
  onTagInputChange,
  onTagKeyDown,
  onTagBlur,
  onRemoveTag,
  onUpdateDraft,
  onClose,
  onStatusChange,
  onConfirm,
  onCoverUpload
}) => {
  const coverInputRef = React.useRef<HTMLInputElement>(null);

  if (!open) return null;

  const isPrivate = status === 'draft';
  const isScheduled = status === 'scheduled';
  const slug = slugify(draft.slug.trim() || draft.title.trim());
  const postUrl = resolvePostUrl(slug);
  const confirmLabel = saving
    ? '저장 중...'
    : isPrivate
      ? '비공개 저장'
      : isScheduled
        ? '예약 저장'
        : '공개 발행';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 px-4 py-6">
      <div className="max-h-[calc(100vh-3rem)] w-full max-w-[820px] overflow-y-auto border border-[color:var(--border)] bg-white">
        <div className="flex items-center justify-between border-b border-black px-6 py-4">
          <h2 className="text-sm font-semibold text-[var(--text)]">발행 설정</h2>
          <span className="text-xs text-[var(--text-muted)]">저장 전 메타데이터 확인</span>
        </div>

        <div className="grid gap-8 px-6 py-8 md:grid-cols-[minmax(0,1fr)_180px]">
          <div className="min-w-0 space-y-1">
            <p className="truncate text-xl font-semibold text-[var(--text)]">
              {draft.title.trim() || '제목 없음'}
            </p>

            <div className="grid grid-cols-[64px_minmax(0,1fr)] items-center border-b border-[color:var(--border)] py-5 text-sm">
              <span className="font-semibold text-[var(--text)]">상태</span>
              <div className="flex flex-wrap items-center gap-4 text-sm text-[var(--text-muted)]">
                <label className="inline-flex items-center gap-1.5">
                  <input
                    type="radio"
                    checked={status === 'published'}
                    onChange={() => onStatusChange('published')}
                  />
                  공개
                </label>
                <label className="inline-flex items-center gap-1.5">
                  <input
                    type="radio"
                    checked={isScheduled}
                    onChange={() => onStatusChange('scheduled')}
                  />
                  예약
                </label>
                <label className="inline-flex items-center gap-1.5 text-[var(--text)]">
                  <input
                    type="radio"
                    checked={isPrivate}
                    onChange={() => onStatusChange('draft')}
                  />
                  비공개
                </label>
              </div>
            </div>

            <div className="grid grid-cols-[64px_minmax(0,1fr)] items-center border-b border-[color:var(--border)] py-3 text-sm">
              <span className="font-semibold text-[var(--text-muted)]">카테고리</span>
              <CategoryPicker
                categoryTree={categoryTree}
                value={draft.category || DEFAULT_CATEGORY}
                onChange={(category) => onUpdateDraft({ category })}
                defaultOptionLabel={DEFAULT_CATEGORY}
                recentStorageKey="hamlog:admin:editor-categories"
                triggerClassName="flex h-9 w-full items-center justify-between border border-[color:var(--border)] bg-white px-3 text-sm text-[var(--text)] transition hover:border-[color:var(--accent)]"
                panelClassName="absolute left-0 top-full z-[60] mt-2 w-full min-w-[280px] border border-[color:var(--border)] bg-white p-4"
              />
            </div>

            <div className="grid grid-cols-[64px_minmax(0,1fr)] items-center border-b border-[color:var(--border)] py-3 text-sm">
              <span className="font-semibold text-[var(--text-muted)]">발행일</span>
              <input
                type="date"
                value={draft.publishedAt}
                onChange={event => onUpdateDraft({ publishedAt: event.target.value })}
                className="h-9 w-full border border-transparent bg-transparent text-sm text-[var(--text)] outline-none transition focus:border-[color:var(--border)] focus:px-2"
              />
            </div>

            {isScheduled && (
              <div className="grid grid-cols-[64px_minmax(0,1fr)] items-center border-b border-[color:var(--border)] py-3 text-sm">
                <span className="font-semibold text-[var(--text-muted)]">예약일</span>
                <input
                  type="datetime-local"
                  value={draft.scheduledAt}
                  onChange={event => onUpdateDraft({ scheduledAt: event.target.value })}
                  className="h-9 w-full border border-transparent bg-transparent text-sm text-[var(--text)] outline-none transition focus:border-[color:var(--border)] focus:px-2"
                />
              </div>
            )}

            <div className="grid grid-cols-[64px_minmax(0,1fr)] items-center border-b border-[color:var(--border)] py-3 text-sm">
              <span className="font-semibold text-[var(--text-muted)]">URL</span>
              <div className="min-w-0">
                <input
                  value={draft.slug}
                  onChange={event => onUpdateDraft({ slug: event.target.value })}
                  placeholder={slug}
                  className="h-8 w-full border border-transparent bg-transparent text-sm text-[var(--text)] outline-none transition placeholder:text-[var(--text-muted)] focus:border-[color:var(--border)] focus:px-2"
                />
                <p className="truncate text-[11px] text-[var(--text-muted)]">{postUrl}</p>
              </div>
            </div>

            <div className="grid grid-cols-[64px_minmax(0,1fr)] border-b border-[color:var(--border)] py-3 text-sm">
              <span className="pt-2 font-semibold text-[var(--text-muted)]">요약</span>
              <textarea
                value={draft.summary}
                onChange={event => onUpdateDraft({ summary: event.target.value })}
                rows={2}
                placeholder="목록과 SEO에 사용할 짧은 설명"
                className="w-full resize-none border border-transparent bg-transparent px-0 py-2 text-sm text-[var(--text)] outline-none transition placeholder:text-[var(--text-muted)] focus:border-[color:var(--border)] focus:px-2"
              />
            </div>

            <div className="grid grid-cols-[64px_minmax(0,1fr)] items-center border-b border-[color:var(--border)] py-3 text-sm">
              <span className="font-semibold text-[var(--text-muted)]">태그</span>
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                {draft.tags.map(tag => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => onRemoveTag(tag)}
                    className="text-xs text-[var(--text-muted)] transition hover:text-red-500"
                    title="태그 삭제"
                  >
                    #{tag}
                  </button>
                ))}
                <input
                  value={tagInput}
                  onChange={event => onTagInputChange(event.target.value)}
                  onKeyDown={onTagKeyDown}
                  onBlur={onTagBlur}
                  placeholder="#태그입력"
                  className="min-w-[120px] flex-1 bg-transparent text-xs text-[var(--text-muted)] outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-[64px_minmax(0,1fr)] items-center py-3 text-sm">
              <span className="font-semibold text-[var(--text-muted)]">옵션</span>
              <div className="flex flex-wrap items-center gap-4 text-xs text-[var(--text-muted)]">
                <label className="inline-flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={draft.featured}
                    onChange={event => onUpdateDraft({ featured: event.target.checked })}
                  />
                  인기글
                </label>
              </div>
            </div>
          </div>

          <div>
            <button
              type="button"
              onClick={() => coverInputRef.current?.click()}
              className="flex aspect-square w-full flex-col items-center justify-center gap-3 border border-[color:var(--border)] bg-[#fafafa] text-sm text-[var(--text-muted)] transition hover:border-[color:var(--accent)] hover:text-[var(--accent-strong)]"
            >
              {draft.cover ? (
                <img src={draft.cover} alt="대표 이미지" className="h-full w-full object-cover" />
              ) : (
                <>
                  <span className="text-3xl font-light">+</span>
                  <span>대표이미지 추가</span>
                </>
              )}
            </button>
            <input
              ref={coverInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={event => {
                const file = event.target.files?.[0];
                if (file) {
                  void onCoverUpload?.(file);
                }
                event.target.value = '';
              }}
            />
          </div>
        </div>

        <div className="flex justify-center gap-2 px-6 pb-6">
          <button
            type="button"
            onClick={onClose}
            className="h-11 min-w-20 rounded-full border border-[color:var(--border)] px-6 text-sm text-[var(--text)] transition hover:bg-[var(--surface-muted)]"
          >
            취소
          </button>
          <button
            type="button"
            onClick={() => void onConfirm()}
            disabled={saving}
            className="h-11 min-w-36 rounded-full bg-black px-7 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

const PostEditorSection: React.FC<PostEditorSectionProps> = ({
  editorHandlers,
  tagHandlers,
  mediaHandlers,
  uiState,
  data
}) => {
  const { draft, categoryTree, currentCoverUrl, editor } = data;
  const [publishDialogOpen, setPublishDialogOpen] = React.useState(false);
  const [publishStatus, setPublishStatus] = React.useState<PostStatus>(draft.status);
  const {
    notice,
    saving,
    activeId,
    tagInput,
    previewMode,
    uploadingImage,
    uploadError,
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

  const openPublishDialog = () => {
    setPublishStatus(draft.status);
    setPublishDialogOpen(true);
  };

  const confirmPublishDialog = async () => {
    if (saving) return;
    onStatusChange(publishStatus);
    const saved = await onSave(
      publishStatus === 'published'
        ? '발행되었습니다.'
        : publishStatus === 'scheduled'
          ? '예약 저장되었습니다.'
          : '비공개로 저장되었습니다.',
      publishStatus
    );
    if (saved) {
      setPublishDialogOpen(false);
    }
  };

  return (
    <div className="mx-auto max-w-none">
      <div className="sticky top-[var(--admin-header-offset)] z-20 border-b border-[color:var(--border)] bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1500px] flex-col gap-1.5 px-3 py-1.5 lg:flex-row lg:items-center lg:justify-between">
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
            onSave={() => void onSave('수동 저장되었습니다.')}
            onPublish={openPublishDialog}
            onDelete={onDelete}
          />
        </div>
      </div>

      <div className="mx-auto max-w-[1500px] px-3">
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

      <PublishDialog
        open={publishDialogOpen}
        draft={draft}
        categoryTree={categoryTree}
        status={publishStatus}
        saving={saving}
        tagInput={tagInput}
        onTagInputChange={onInputChange}
        onTagKeyDown={onKeyDown}
        onTagBlur={onBlur}
        onRemoveTag={onRemove}
        onUpdateDraft={updateDraft}
        onClose={() => setPublishDialogOpen(false)}
        onStatusChange={setPublishStatus}
        onConfirm={confirmPublishDialog}
        onCoverUpload={onCoverUpload}
      />
    </div>
  );
};

export default PostEditorSection;
