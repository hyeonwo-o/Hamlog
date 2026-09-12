import React from 'react';
import { Eye, EyeOff, List, Plus, Save, Send, SlidersHorizontal, Trash2 } from 'lucide-react';
import type { PostStatus } from '../../../data/blogData';
import type { BrowserSaveStatus } from '../../../hooks/useAutosave';

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
  browserSaveStatus?: BrowserSaveStatus;
  browserSavedAt?: string | null;
  serverSavedAt?: string | null;
  onRestoreAutosave?: () => void;
  onDiscardAutosave?: () => void;
  inspectorOpen: boolean;
  onToggleInspector: () => void;
  postListOpen?: boolean;
  onTogglePostList?: () => void;
  onNewPost?: () => void;
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
  browserSaveStatus = 'idle',
  browserSavedAt,
  serverSavedAt,
  onRestoreAutosave,
  onDiscardAutosave,
  inspectorOpen,
  onToggleInspector,
  postListOpen,
  onTogglePostList,
  onNewPost,
  onTogglePreview,
  onSave,
  onPublish,
  onDelete
}) => {
  const statusLabel = statusLabels[status];
  const saveLabel = status === 'draft' ? '초안 저장' : '변경 저장';
  const formatSavedAt = (value?: string | null) => {
    if (!value || !Number.isFinite(Date.parse(value))) return '';
    return new Date(value).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  };
  const browserStatusLabels: Record<BrowserSaveStatus, string> = {
    idle: '브라우저: 변경 없음',
    pending: '브라우저 임시 저장 대기',
    saved: `브라우저 임시 저장됨 · ${formatSavedAt(browserSavedAt)}`,
    error: '브라우저 임시 저장 실패',
    blocked: '브라우저 복구본 확인 필요'
  };

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
            <span className="rounded-full bg-amber-50 dark:bg-amber-400/10 px-2 py-0.5 font-medium text-amber-700 dark:text-amber-300">
              저장되지 않은 변경
            </span>
          )}
          <span data-testid="browser-save-status" className={browserSaveStatus === 'error' ? 'text-red-600 dark:text-red-300' : ''} title="이 브라우저에만 보관하는 복구용 사본이며, 서버에 저장하거나 발행하지 않습니다. 시각은 한국 시간입니다.">
            {browserStatusLabels[browserSaveStatus]}
          </span>
          <span data-testid="server-save-status" title="서버에서 확인한 저장 시각입니다. 이후 입력은 다시 저장해야 합니다. 시각은 한국 시간입니다.">
            {saving ? '서버 저장 중…' : serverSavedAt ? `서버 저장 · ${formatSavedAt(serverSavedAt)}` : '서버 미저장'}
          </span>
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
                className="border-b border-transparent transition hover:border-red-300 hover:text-red-500 dark:hover:text-red-300"
              >
                삭제
              </button>
            </>
          )}
        </div>
      </div>

      <div className="flex shrink-0 flex-col gap-1.5 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="flex flex-wrap items-center gap-1.5">
          {onTogglePostList && (
            <button
              id="admin-post-list-toggle"
              type="button"
              onClick={onTogglePostList}
              aria-controls="admin-post-list-panel"
              aria-expanded={Boolean(postListOpen)}
              title={postListOpen ? '글 목록 접기' : '글 목록 열기'}
              className="inline-flex min-h-11 items-center gap-1.5 border border-[color:var(--border)] bg-[var(--surface)] px-2.5 text-xs text-[var(--text)] transition hover:border-[color:var(--accent)] hover:text-[var(--accent-strong)] sm:min-h-9"
            >
              <List size={15} />
              목록
            </button>
          )}
          {onNewPost && (
            <button
              type="button"
              onClick={onNewPost}
              disabled={saving || !activeId}
              aria-label="새 글 작성"
              title={activeId ? '새 글 작성' : '새 글을 작성 중입니다'}
              className="inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 border border-[color:var(--border)] bg-[var(--surface)] px-2.5 text-xs text-[var(--text)] transition hover:border-[color:var(--accent)] hover:text-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-9 sm:min-w-0"
            >
              <Plus size={15} />
              <span className="hidden min-[360px]:inline">새 글</span>
            </button>
          )}
          <button
            type="button"
            onClick={onToggleInspector}
            aria-expanded={inspectorOpen}
            aria-controls="post-inspector-panel"
            aria-label={inspectorOpen ? '글 설정 닫기' : '글 설정 열기'}
            title={inspectorOpen ? '글 설정 닫기' : '글 설정 열기'}
            className="inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 border border-[color:var(--border)] bg-[var(--surface)] px-2.5 text-xs text-[var(--text)] transition hover:border-[color:var(--accent)] hover:text-[var(--accent-strong)] sm:min-h-9 sm:min-w-0"
          >
            <SlidersHorizontal size={15} />
            <span className="hidden sm:inline">글 설정</span>
          </button>
          <button
            type="button"
            data-testid="post-preview-toggle"
            onClick={onTogglePreview}
            aria-label={previewMode ? '편집' : '미리보기'}
            title={previewMode ? '편집' : '미리보기'}
            className="inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 border border-[color:var(--border)] bg-[var(--surface)] px-2.5 text-xs text-[var(--text)] transition hover:border-[color:var(--accent)] hover:text-[var(--accent-strong)] sm:min-h-9 sm:min-w-0"
          >
            {previewMode ? <EyeOff size={14} /> : <Eye size={14} />}
            <span className="hidden sm:inline">{previewMode ? '편집' : '미리보기'}</span>
          </button>
          {activeId && (
            <button
              type="button"
              onClick={onDelete}
              disabled={saving}
              aria-label="글 삭제"
              title="삭제"
              className="inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 border border-red-200 dark:border-red-400/30 bg-[var(--surface)] px-2.5 text-xs text-red-500 dark:text-red-300 transition hover:bg-red-50 disabled:opacity-50 dark:hover:bg-red-400/10 sm:min-h-9 sm:min-w-0"
            >
              <Trash2 size={14} />
              <span className="hidden sm:inline">삭제</span>
            </button>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onSave}
            disabled={saving || hasRestorableDraft}
            title={saveLabel}
            className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 border border-[color:var(--border)] bg-[var(--surface)] px-2.5 text-xs text-[var(--text)] transition hover:border-[color:var(--accent)] hover:text-[var(--accent-strong)] disabled:opacity-50 sm:min-h-9 sm:flex-none"
          >
            <Save size={14} />
            {saving ? '저장 중' : saveLabel}
          </button>
          <button
            type="button"
            data-testid="post-publish-button"
            onClick={onPublish}
            disabled={saving || hasRestorableDraft}
            title="발행 설정"
            className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 bg-[var(--text)] px-3 text-xs font-semibold text-[var(--bg)] transition hover:opacity-90 disabled:opacity-50 sm:min-h-9 sm:flex-none"
          >
            <Send size={14} />
            발행 설정
          </button>
        </div>
      </div>
    </div>
  );
};

export default PostCommandBar;
