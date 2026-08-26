import React from 'react';
import { Eye, EyeOff, List, Save, Send, SlidersHorizontal, Trash2 } from 'lucide-react';
import type { PostStatus } from '../../../data/blogData';

interface PostCommandBarProps {
  activeId: string | null;
  status: PostStatus;
  saving: boolean;
  isDirty: boolean;
  previewMode: boolean;
  notice: string;
  onNoticeClick?: () => void;
  hasRestorableDraft?: boolean;
  autosaveLabel?: string;
  onRestoreAutosave?: () => void;
  onDiscardAutosave?: () => void;
  inspectorOpen: boolean;
  onToggleInspector: () => void;
  postListOpen?: boolean;
  onOpenPostList?: () => void;
  onTogglePreview: () => void;
  onSave: () => void;
  onPublish: () => void;
  onDelete: () => void;
}

const statusLabels: Record<PostStatus, string> = {
  draft: '초안',
  scheduled: '예약',
  published: '발행'
};

const PostCommandBar: React.FC<PostCommandBarProps> = ({
  activeId,
  status,
  saving,
  isDirty,
  previewMode,
  notice,
  onNoticeClick,
  hasRestorableDraft,
  autosaveLabel,
  onRestoreAutosave,
  onDiscardAutosave,
  inspectorOpen,
  onToggleInspector,
  postListOpen,
  onOpenPostList,
  onTogglePreview,
  onSave,
  onPublish,
  onDelete
}) => {
  const statusLabel = statusLabels[status];
  const saveLabel = status === 'draft' ? '초안 저장' : '변경 저장';

  return (
    <div data-testid="post-command-bar" className="flex w-full flex-col gap-1.5 lg:flex-row lg:items-center lg:justify-between">
      <div className="min-w-0">
        <div
          className="flex flex-wrap items-center gap-1.5 text-[11px] leading-6 text-[var(--text-muted)]"
          aria-live="polite"
        >
          <span className="font-medium text-[var(--text)]">
            {activeId ? '편집 중' : '새 초안'}
          </span>
          <span
            aria-label={`현재 글 상태: ${statusLabel}`}
            className="rounded-full border border-[color:var(--border)] bg-[var(--surface-muted)] px-2 py-0.5 font-medium text-[var(--text-muted)]"
            title="상태 변경은 발행 설정에서 할 수 있습니다."
          >
            현재: {statusLabel}
          </span>
          {isDirty && (
            <span className="rounded-full bg-amber-50 px-2 py-0.5 font-medium text-amber-700">
              저장되지 않은 변경
            </span>
          )}
          {notice ? (
            <button
              type="button"
              onClick={() => onNoticeClick?.()}
              className={onNoticeClick ? 'text-[var(--accent-strong)] hover:underline' : ''}
            >
              {notice}
            </button>
          ) : null}
          {hasRestorableDraft && (
            <>
              <span>임시 저장본 {autosaveLabel ? `(${autosaveLabel})` : ''}</span>
              <button
                type="button"
                onClick={() => onRestoreAutosave?.()}
                className="border-b border-[color:var(--border)] text-[var(--text)] transition hover:border-[color:var(--accent)]"
              >
                복구
              </button>
              <button
                type="button"
                onClick={() => onDiscardAutosave?.()}
                className="border-b border-transparent transition hover:border-red-300 hover:text-red-500"
              >
                삭제
              </button>
            </>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {onOpenPostList && (
          <button
            id="admin-post-list-toggle"
            type="button"
            onClick={onOpenPostList}
            aria-controls="admin-post-list-panel"
            aria-expanded={Boolean(postListOpen)}
            className="inline-flex min-h-9 items-center gap-1.5 border border-[color:var(--border)] bg-white px-2.5 text-xs text-[var(--text)] transition hover:border-[color:var(--accent)] hover:text-[var(--accent-strong)] 2xl:hidden"
          >
            <List size={15} />
            목록
          </button>
        )}
        <button
          type="button"
          onClick={onToggleInspector}
          aria-expanded={inspectorOpen}
          aria-controls="post-inspector-panel"
          aria-label={inspectorOpen ? '글 설정 닫기' : '글 설정 열기'}
          title={inspectorOpen ? '글 설정 닫기' : '글 설정 열기'}
          className="inline-flex min-h-9 items-center gap-1.5 border border-[color:var(--border)] bg-white px-2.5 text-xs text-[var(--text)] transition hover:border-[color:var(--accent)] hover:text-[var(--accent-strong)] lg:hidden"
        >
          <SlidersHorizontal size={15} />
          <span className="hidden sm:inline">{inspectorOpen ? '설정 닫기' : '글 설정'}</span>
        </button>
        <button
          type="button"
          data-testid="post-preview-toggle"
          onClick={onTogglePreview}
          aria-label={previewMode ? '편집' : '미리보기'}
          title={previewMode ? '편집' : '미리보기'}
          className="inline-flex min-h-9 items-center gap-1.5 border border-[color:var(--border)] bg-white px-2.5 text-xs text-[var(--text)] transition hover:border-[color:var(--accent)] hover:text-[var(--accent-strong)]"
        >
          {previewMode ? <EyeOff size={14} /> : <Eye size={14} />}
          <span className="hidden sm:inline">{previewMode ? '편집' : '미리보기'}</span>
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          title={saveLabel}
          className="inline-flex min-h-9 items-center gap-1.5 border border-[color:var(--border)] bg-white px-2.5 text-xs text-[var(--text)] transition hover:border-[color:var(--accent)] hover:text-[var(--accent-strong)] disabled:opacity-50"
        >
          <Save size={14} />
          {saving ? '저장 중' : saveLabel}
        </button>
        <button
          type="button"
          data-testid="post-publish-button"
          onClick={onPublish}
          disabled={saving}
          title="발행 설정"
          className="inline-flex min-h-9 items-center gap-1.5 bg-[var(--text)] px-3 text-xs font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
        >
          <Send size={14} />
          발행 설정
        </button>
        {activeId && (
          <button
            type="button"
            onClick={onDelete}
            aria-label="글 삭제"
            title="삭제"
            className="inline-flex min-h-9 items-center gap-1.5 border border-red-200 bg-white px-2.5 text-xs text-red-500 transition hover:bg-red-50"
          >
            <Trash2 size={14} />
            <span className="hidden sm:inline">삭제</span>
          </button>
        )}
      </div>
    </div>
  );
};

export default PostCommandBar;
