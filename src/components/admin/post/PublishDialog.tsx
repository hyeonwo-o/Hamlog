import React from 'react';
import { AlertTriangle, Check } from 'lucide-react';
import type { PostStatus } from '../../../data/blogData';
import type { PostDraft } from '../../../types/admin';
import type { CategoryTreeResult } from '../../../utils/categoryTree';
import { DEFAULT_CATEGORY } from '../../../utils/category';
import { slugify } from '../../../utils/slugify';
import {
  auditPostQuality,
  SEO_DESCRIPTION_MAX_LENGTH,
  SEO_DESCRIPTION_MIN_LENGTH
} from '../../../utils/postQuality';
import CategoryPicker from '../category/CategoryPicker';

interface PublishDialogProps {
  open: boolean;
  draft: PostDraft;
  categoryTree: CategoryTreeResult;
  status: PostStatus;
  slugTaken: boolean;
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
  slugTaken,
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
  const dialogRef = React.useRef<HTMLDivElement>(null);
  const qualityAudit = React.useMemo(() => (
    open
      ? auditPostQuality(draft, status, { slugTaken })
      : { items: [], warningCount: 0, requiredCount: 0 }
  ), [draft, open, slugTaken, status]);

  React.useEffect(() => {
    if (!open) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusAnimationFrame = window.requestAnimationFrame(() => {
      dialogRef.current?.focus({ preventScroll: true });
      if (dialogRef.current) dialogRef.current.scrollTop = 0;
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
      ));
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (document.activeElement === dialogRef.current) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.cancelAnimationFrame(focusAnimationFrame);
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus();
    };
  }, [onClose, open]);

  if (!open) return null;

  const isPrivate = status === 'draft';
  const isScheduled = status === 'scheduled';
  const slug = slugify(draft.slug.trim() || draft.title.trim());
  const postUrl = resolvePostUrl(slug);
  const summaryLength = Array.from(draft.summary.trim()).length;
  const summaryNeedsWork = !isPrivate && (
    summaryLength < SEO_DESCRIPTION_MIN_LENGTH
    || summaryLength > SEO_DESCRIPTION_MAX_LENGTH
  );
  const summaryGuidance = summaryLength < SEO_DESCRIPTION_MIN_LENGTH
    ? '글 목록 요약으로 쓰기에는 짧습니다.'
    : summaryLength > SEO_DESCRIPTION_MAX_LENGTH
      ? '글 목록 요약으로 쓰기에는 깁니다.'
      : '글 목록 요약으로 사용됩니다.';
  const confirmLabel = saving
    ? '저장 중...'
    : isPrivate
      ? '비공개 저장'
      : isScheduled
        ? '예약 저장'
        : '공개 발행';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 px-4 py-6"
      onMouseDown={event => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="publish-dialog-title"
        tabIndex={-1}
        className="max-h-[calc(100vh-3rem)] w-full max-w-[820px] overflow-y-auto border border-[color:var(--border)] bg-white"
      >
        <div className="flex items-center justify-between border-b border-black px-6 py-4">
          <h2 id="publish-dialog-title" className="text-sm font-semibold text-[var(--text)]">발행 설정</h2>
          <span className="text-xs text-[var(--text-muted)]">저장 전 메타데이터 확인</span>
        </div>

        <section
          aria-labelledby="publish-quality-title"
          className="mx-6 mt-6 border border-[color:var(--border)] bg-[var(--surface-muted)] p-4"
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 id="publish-quality-title" className="text-sm font-semibold text-[var(--text)]">
                발행 전 점검
              </h3>
              <p className="mt-1 text-[11px] leading-relaxed text-[var(--text-muted)]">
                필수 항목은 저장할 때 적용되며 권장 항목은 발행을 막지 않습니다.
              </p>
            </div>
            <span
              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                qualityAudit.requiredCount > 0
                  ? 'bg-red-100 text-red-700'
                  : qualityAudit.warningCount > 0
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-emerald-100 text-emerald-800'
              }`}
              aria-live="polite"
            >
              {qualityAudit.requiredCount > 0
                ? `${qualityAudit.requiredCount}개 필수 확인`
                : qualityAudit.warningCount > 0
                  ? `${qualityAudit.warningCount}개 확인 권장`
                  : '발행 준비 완료'}
            </span>
          </div>

          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {qualityAudit.items.map(item => {
              const warning = item.status === 'warning';
              const required = item.status === 'required';
              return (
                <li
                  key={item.id}
                  data-quality-id={item.id}
                  className="flex min-w-0 items-start gap-2 border-t border-[color:var(--border)] pt-2"
                >
                  <span
                    className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${
                      required
                        ? 'bg-red-100 text-red-700'
                        : warning
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-emerald-100 text-emerald-700'
                    }`}
                    aria-hidden="true"
                  >
                    {required || warning ? <AlertTriangle size={10} /> : <Check size={10} />}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-xs font-semibold text-[var(--text)]">
                      {required ? '필수 · ' : warning ? '권장 · ' : '완료 · '}{item.label}
                    </span>
                    <span className="mt-0.5 block text-[11px] leading-relaxed text-[var(--text-muted)]">
                      {item.detail}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        </section>

        <div className="grid gap-8 px-6 py-6 md:grid-cols-[minmax(0,1fr)_180px]">
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
                  aria-label="글 URL"
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
                placeholder="목록과 검색 결과에서 글의 핵심을 설명하는 구체적인 1~2문장"
                aria-describedby="publish-summary-guidance"
                className="w-full resize-none border border-transparent bg-transparent px-0 py-2 text-sm text-[var(--text)] outline-none transition placeholder:text-[var(--text-muted)] focus:border-[color:var(--border)] focus:px-2"
              />
              <p
                id="publish-summary-guidance"
                className={`col-start-2 flex justify-between gap-3 pb-1 text-[11px] ${summaryNeedsWork ? 'text-amber-700' : 'text-[var(--text-muted)]'}`}
              >
                <span>{summaryNeedsWork
                  ? summaryGuidance
                  : draft.seoDescription.trim()
                    ? '글 목록 요약으로 사용됩니다.'
                    : '글 목록과 검색 설명 기본값으로 사용됩니다.'}</span>
                <span>{summaryLength}자</span>
              </p>
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

export default PublishDialog;
