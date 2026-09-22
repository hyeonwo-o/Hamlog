import { useCallback, useEffect, useRef, useState } from 'react';
import { deleteModeratedComment, fetchModerationComments, setCommentHidden } from '../../../api/commentModerationApi';
import type { CommentModerationPage, CommentVisibilityFilter, ModeratedComment } from '../../../types/comment';

const postStatusLabels: Record<ModeratedComment['post']['status'], string> = {
  draft: '비공개 초안', scheduled: '예약 글', published: '발행 글', trashed: '휴지통', missing: '원문 없음'
};
const buttonClass = 'min-h-11 rounded-lg border border-[color:var(--border)] px-3 py-2 text-sm text-[var(--text)] transition hover:border-[color:var(--accent)] disabled:cursor-not-allowed disabled:opacity-50';

export default function CommentModerationSection() {
  const [query, setQuery] = useState<{ page: number; visibility: CommentVisibilityFilter }>({ page: 1, visibility: 'all' });
  const [result, setResult] = useState<CommentModerationPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [needsRefresh, setNeedsRefresh] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ModeratedComment | null>(null);
  const busyRef = useRef(false);
  const requestRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const deleteTriggerRef = useRef<HTMLButtonElement | null>(null);

  const refresh = useCallback(async () => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setLoading(true);
    setError('');
    try {
      const next = await fetchModerationComments(query, controller.signal);
      if (controller.signal.aborted) return false;
      const lastPage = Math.max(1, Math.ceil(next.total / next.pageSize));
      setResult(next);
      setNeedsRefresh(false);
      if (query.page > lastPage) setQuery(current => ({ ...current, page: lastPage }));
      return true;
    } catch (reason) {
      if (!controller.signal.aborted) {
        setNeedsRefresh(true);
        setError(reason instanceof Error ? reason.message : '댓글 목록을 불러오지 못했습니다.');
      }
      return false;
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    mountedRef.current = true;
    void refresh();
    return () => {
      mountedRef.current = false;
      requestRef.current?.abort();
    };
  }, [refresh]);

  useEffect(() => {
    if (deleteTarget) cancelRef.current?.focus();
  }, [deleteTarget]);

  const act = async (comment: ModeratedComment, remove = false) => {
    if (busyRef.current || loading || needsRefresh) return;
    busyRef.current = true;
    setBusyId(comment.id);
    setError('');
    setNotice('');
    try {
      if (remove) await deleteModeratedComment(comment);
      else await setCommentHidden(comment, !comment.moderation.hidden);
      if (!mountedRef.current) return;
      setDeleteTarget(null);
      setNotice(remove
        ? '댓글을 영구삭제했습니다.'
        : comment.moderation.hidden
          ? '댓글 숨김을 해제했습니다. 원문이 공개된 경우에만 방문자에게 보입니다.'
          : '댓글을 숨겼습니다. 공개 댓글 목록에서는 보이지 않습니다.');
      await refresh();
      if (mountedRef.current) headingRef.current?.focus();
    } catch (reason) {
      if (!mountedRef.current) return;
      const message = reason instanceof Error ? reason.message : '댓글 관리 작업에 실패했습니다.';
      // A failed response may still have committed. Re-read the version before
      // permitting another explicit action; never automatically repeat a write.
      setDeleteTarget(null);
      setNeedsRefresh(true);
      const refreshed = await refresh();
      if (mountedRef.current) {
        setError(`${message}${refreshed ? ' 최신 목록을 확인한 뒤 다시 시도해 주세요.' : ' 목록을 다시 불러온 뒤 진행해 주세요.'}`);
        headingRef.current?.focus();
      }
    } finally {
      busyRef.current = false;
      if (mountedRef.current) setBusyId('');
    }
  };

  const busy = Boolean(busyId);
  const actionsDisabled = busy || loading || needsRefresh;
  const totalPages = Math.max(1, Math.ceil((result?.total ?? 0) / (result?.pageSize ?? 20)));

  return (
    <section aria-labelledby="comment-moderation-title" className="min-w-0 space-y-5 rounded-xl border border-[color:var(--border)] bg-[var(--surface)] p-4 text-[var(--text)] sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-2">
          <h2 ref={headingRef} id="comment-moderation-title" tabIndex={-1} className="font-display text-xl font-semibold outline-none">댓글 관리</h2>
          <p className="max-w-3xl text-sm leading-6 text-[var(--text-muted)]">숨김은 되돌릴 수 있습니다. 영구삭제는 작성자 비밀번호 없이 처리되며 복구할 수 없습니다. 비공개 글과 휴지통의 댓글도 여기에서 확인할 수 있습니다.</p>
        </div>
        <button type="button" onClick={() => { setDeleteTarget(null); void refresh(); }} disabled={loading || busy} className={buttonClass}>댓글 새로고침</button>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <label className="flex min-w-0 flex-col gap-1 text-sm">
          댓글 표시 상태
          <select value={query.visibility} disabled={busy} className="min-h-11 rounded-lg border border-[color:var(--border)] bg-[var(--surface-muted)] px-3 text-[var(--text)]"
            onChange={event => {
              setDeleteTarget(null);
              setNotice('');
              setQuery({ page: 1, visibility: event.target.value as CommentVisibilityFilter });
            }}>
            <option value="all">전체 댓글</option>
            <option value="visible">숨기지 않은 댓글</option>
            <option value="hidden">숨긴 댓글</option>
          </select>
        </label>
        <p className="text-sm text-[var(--text-muted)]">{result ? `총 ${result.total}개` : '댓글 목록'}</p>
      </div>

      {error && <div className="space-y-2 rounded-lg border border-red-300 p-3">
        <p role="alert" className="break-words text-sm text-red-600 dark:text-red-300">{error}</p>
        <button type="button" onClick={() => void refresh()} disabled={loading || busy} className={buttonClass}>댓글 목록 다시 시도</button>
      </div>}
      {notice && <p role="status" className="break-words text-sm text-[var(--accent-strong)]">{notice}</p>}
      {loading && <p role="status" className="text-sm text-[var(--text-muted)]">댓글 목록을 불러오는 중입니다.</p>}
      {!loading && !error && result?.comments.length === 0 && <p className="py-6 text-sm text-[var(--text-muted)]">선택한 조건에 맞는 댓글이 없습니다.</p>}

      <ul aria-label="관리할 댓글" aria-busy={loading || busy} className="space-y-4">
        {result?.comments.map(comment => <li key={comment.id} data-testid={`moderation-comment-${comment.id}`} className="min-w-0 space-y-3 rounded-lg border border-[color:var(--border)] p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0 space-y-1">
              <h3 className="break-words text-sm font-semibold [overflow-wrap:anywhere]">{comment.post.title || '제목 없는 글'}</h3>
              <p className="text-xs text-[var(--text-muted)]">{postStatusLabels[comment.post.status]} · {comment.post.publicVisible ? '원문 공개' : '원문 비공개'}</p>
            </div>
            <span className="rounded-md bg-[var(--surface-muted)] px-2 py-1 text-xs font-semibold">{comment.moderation.hidden ? '숨김' : '숨기지 않음'}</span>
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-[var(--text-muted)]">
            <span className="break-words font-semibold [overflow-wrap:anywhere]">{comment.author}</span>
            <time dateTime={comment.createdAt}>{new Date(comment.createdAt).toLocaleString('ko-KR')}</time>
          </div>
          <p className="whitespace-pre-wrap break-words text-sm leading-6 [overflow-wrap:anywhere]">{comment.content}</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={actionsDisabled} onClick={() => void act(comment)} className={buttonClass}>
              {busyId === comment.id ? '처리 중...' : comment.moderation.hidden ? '숨김 해제' : '댓글 숨기기'}
            </button>
            <button type="button" disabled={actionsDisabled} className={`${buttonClass} !text-red-600 dark:!text-red-300`}
              onClick={event => { deleteTriggerRef.current = event.currentTarget; setDeleteTarget(comment); }}>
              댓글 영구삭제
            </button>
          </div>
          {deleteTarget?.id === comment.id && <div role="group" aria-label="댓글 영구삭제 확인" className="space-y-3 border-t border-[color:var(--border)] pt-3"
            onKeyDown={event => {
              if (event.key === 'Escape' && !busyRef.current) {
                event.stopPropagation(); setDeleteTarget(null); deleteTriggerRef.current?.focus();
              }
            }}>
            <p className="text-sm text-red-600 dark:text-red-300">위 댓글을 영구삭제할까요? 삭제하면 복구할 수 없으며 다른 댓글과 원문은 유지됩니다.</p>
            <div className="flex flex-wrap gap-2">
              <button ref={cancelRef} type="button" disabled={busy} className={buttonClass}
                onClick={() => { setDeleteTarget(null); deleteTriggerRef.current?.focus(); }}>삭제 취소</button>
              <button type="button" disabled={actionsDisabled} onClick={() => void act(deleteTarget, true)} className={`${buttonClass} !text-red-600 dark:!text-red-300`}>댓글 영구삭제 확인</button>
            </div>
          </div>}
        </li>)}
      </ul>

      <nav aria-label="댓글 페이지" className="flex flex-wrap items-center justify-center gap-3 border-t border-[color:var(--border)] pt-4">
        <button type="button" disabled={loading || busy || query.page <= 1} className={buttonClass}
          onClick={() => { setDeleteTarget(null); setQuery(current => ({ ...current, page: current.page - 1 })); }}>이전 댓글</button>
        <span className="text-sm" aria-live="polite">{query.page} / {totalPages} 페이지</span>
        <button type="button" disabled={loading || busy || !result?.hasMore} className={buttonClass}
          onClick={() => { setDeleteTarget(null); setQuery(current => ({ ...current, page: current.page + 1 })); }}>다음 댓글</button>
      </nav>
    </section>
  );
}
