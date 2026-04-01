import React from 'react';
import { Eye, EyeOff, Save, Send, Trash2 } from 'lucide-react';
import type { PostStatus } from '../../../data/blogData';

interface PostCommandBarProps {
  activeId: string | null;
  status: PostStatus;
  saving: boolean;
  previewMode: boolean;
  notice: string;
  onNoticeClick?: () => void;
  hasRestorableDraft?: boolean;
  autosaveLabel?: string;
  onRestoreAutosave?: () => void;
  onDiscardAutosave?: () => void;
  onStatusChange: (value: PostStatus) => void;
  onTogglePreview: () => void;
  onSave: () => void;
  onPublish: () => void;
  onDelete: () => void;
}

const statusOptions: Array<{ value: PostStatus; label: string }> = [
  { value: 'draft', label: '초안' },
  { value: 'scheduled', label: '예약' },
  { value: 'published', label: '발행' }
];

const PostCommandBar: React.FC<PostCommandBarProps> = ({
  activeId,
  status,
  saving,
  previewMode,
  notice,
  onNoticeClick,
  hasRestorableDraft,
  autosaveLabel,
  onRestoreAutosave,
  onDiscardAutosave,
  onStatusChange,
  onTogglePreview,
  onSave,
  onPublish,
  onDelete
}) => {
  return (
    <div className="angular-control rounded-xl border border-[color:var(--border)] bg-[var(--surface-muted)] px-4 py-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-[var(--text-muted)]">
            <span className="rounded-full border border-[color:var(--border)] bg-[var(--surface)] px-2.5 py-1 font-semibold text-[var(--text)]">
              {activeId ? '편집 중' : '새 초안'}
            </span>
            {notice ? (
              <button
                type="button"
                onClick={() => onNoticeClick?.()}
                className={onNoticeClick ? 'text-[var(--accent-strong)] hover:underline' : ''}
              >
                {notice}
              </button>
            ) : (
              <span>필요한 작업만 빠르게 처리할 수 있습니다.</span>
            )}
          </div>
          {hasRestorableDraft && (
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-[var(--text-muted)]">
              <span>임시 저장본 {autosaveLabel ? `(${autosaveLabel})` : ''}</span>
              <button
                type="button"
                onClick={() => onRestoreAutosave?.()}
                className="angular-control rounded-lg border border-[color:var(--border)] px-2.5 py-1 text-[var(--text)] transition hover:border-[color:var(--accent)]"
              >
                복구
              </button>
              <button
                type="button"
                onClick={() => onDiscardAutosave?.()}
                className="angular-control rounded-lg border border-[color:var(--border)] px-2.5 py-1 transition hover:border-red-300 hover:text-red-500"
              >
                삭제
              </button>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
            상태
          </label>
          <select
            value={status}
            onChange={event => onStatusChange(event.target.value as PostStatus)}
            className="rounded-lg border border-[color:var(--border)] bg-[var(--surface)] px-3 py-2 text-xs font-semibold text-[var(--text)] outline-none transition focus:border-[color:var(--accent)]"
          >
            {statusOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={onTogglePreview}
            className="angular-control inline-flex items-center gap-2 rounded-lg border border-[color:var(--border)] bg-[var(--surface)] px-3 py-2 text-xs font-semibold text-[var(--text)] transition hover:border-[color:var(--accent)] hover:text-[var(--accent-strong)]"
          >
            {previewMode ? <EyeOff size={14} /> : <Eye size={14} />}
            {previewMode ? '편집' : '미리보기'}
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="angular-control inline-flex items-center gap-2 rounded-lg border border-[color:var(--border)] bg-[var(--surface)] px-3 py-2 text-xs font-semibold text-[var(--text)] transition hover:border-[color:var(--accent)] hover:text-[var(--accent-strong)] disabled:opacity-50"
          >
            <Save size={14} />
            {saving ? '저장 중' : '저장'}
          </button>
          <button
            type="button"
            onClick={onPublish}
            disabled={saving}
            className="angular-control inline-flex items-center gap-2 rounded-lg bg-[var(--text)] px-3 py-2 text-xs font-semibold text-[var(--bg)] transition hover:opacity-90 disabled:opacity-50"
          >
            <Send size={14} />
            발행
          </button>
          {activeId && (
            <button
              type="button"
              onClick={onDelete}
              className="angular-control inline-flex items-center gap-2 rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-500 transition hover:bg-red-50"
            >
              <Trash2 size={14} />
              삭제
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default PostCommandBar;
