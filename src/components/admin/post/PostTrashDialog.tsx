import { useCallback, useEffect, useRef, useState } from 'react';
import type { Post } from '../../../types/blog';
import { fetchTrashedPosts, permanentlyDeletePost, restoreTrashedPost } from '../../../api/postApi';

interface Props {
  onClose: () => void;
  onRestored: (post: Post) => void;
  onDeleted: (id: string) => void;
}

export default function PostTrashDialog({ onClose, onRestored, onDeleted }: Props) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const busyRef = useRef(false);
  const requestRef = useRef<AbortController | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Post | null>(null);
  const [confirmation, setConfirmation] = useState('');
  const refresh = useCallback(async () => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setLoading(true);
    setError('');
    try {
      const next = await fetchTrashedPosts(controller.signal);
      if (!controller.signal.aborted) setPosts(next);
    } catch (reason) {
      if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : '휴지통을 불러오지 못했습니다.');
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const previous = document.activeElement as HTMLElement | null;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialogRef.current?.focus();
    return () => {
      requestRef.current?.abort();
      document.body.style.overflow = oldOverflow;
      if (previous?.isConnected) previous.focus();
    };
  }, [refresh]);

  const act = async (post: Post, permanent = false) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusyId(post.id);
    setError('');
    setNotice('');
    try {
      if (permanent) {
        await permanentlyDeletePost(post, confirmation);
        onDeleted(post.id);
        setNotice('글과 댓글·수정 이력·조회수를 영구삭제했습니다. 첨부 이미지는 별도 이미지 정리에서 관리합니다.');
      } else {
        const restored = await restoreTrashedPost(post);
        onRestored(restored);
        setNotice('글을 비공개 초안으로 복원했습니다. 글 목록에서 확인한 뒤 발행해 주세요.');
      }
      setPosts(current => current.filter(item => item.id !== post.id));
      setDeleteTarget(null);
      setConfirmation('');
      // The action button disappears with its row; keep keyboard focus in the dialog.
      dialogRef.current?.focus();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '휴지통 작업에 실패했습니다.');
    } finally {
      busyRef.current = false;
      setBusyId('');
    }
  };
  const buttonClass = 'min-h-11 rounded-lg border border-[color:var(--border)] px-3 py-2 text-sm text-[var(--text)] disabled:opacity-50';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-3" onClick={event => {
      if (event.target === event.currentTarget && !busyRef.current) onClose();
    }}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="post-trash-title" tabIndex={-1}
        className="max-h-[90dvh] w-full max-w-2xl space-y-4 overflow-y-auto rounded-xl border border-[color:var(--border)] bg-[var(--surface)] p-4 text-[var(--text)] shadow-xl outline-none sm:p-6"
        onKeyDown={event => {
          if (event.key === 'Escape' && !busyRef.current) { event.stopPropagation(); onClose(); }
          if (event.key !== 'Tab') return;
          const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), [tabindex="0"]') ?? []);
          const first = focusable[0];
          const last = focusable.at(-1);
          if (!first) { event.preventDefault(); return; }
          if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) {
            event.preventDefault(); last?.focus();
          } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
        }}>
        <div className="flex items-center justify-between gap-3">
          <h2 id="post-trash-title" className="text-lg font-semibold">글 휴지통</h2>
          <button type="button" className={buttonClass} onClick={onClose} disabled={Boolean(busyId)}>닫기</button>
        </div>
        <p className="text-sm leading-6 text-[var(--text-muted)]">휴지통의 글은 공개되지 않습니다. 자동으로 삭제하지 않으며, 복원하면 비공개 초안으로 돌아옵니다. 댓글·수정 이력·조회수와 이미지도 보존합니다.</p>
        <button type="button" onClick={() => void refresh()} disabled={loading || Boolean(busyId)} className={buttonClass}>휴지통 새로고침</button>
        {error && <p role="alert" className="break-words text-sm text-red-600 dark:text-red-300">{error}</p>}
        {notice && <p role="status" className="text-sm text-[var(--accent-strong)]">{notice}</p>}
        {loading ? <p role="status">휴지통을 불러오는 중입니다.</p> : posts.length === 0 && !error ? <p className="py-5 text-sm text-[var(--text-muted)]">휴지통이 비어 있습니다.</p> : (
          <ul className="space-y-3">
            {posts.map(post => <li key={post.id} className="space-y-3 rounded-lg border border-[color:var(--border)] p-3">
              <h3 className="break-words text-sm font-semibold">{post.title}</h3>
              <p className="text-xs text-[var(--text-muted)]">휴지통 이동: {post.deletedAt ? new Date(post.deletedAt).toLocaleString('ko-KR') : '알 수 없음'}</p>
              <div className="flex flex-wrap gap-2">
                <button type="button" disabled={Boolean(busyId)} onClick={() => void act(post)} className={buttonClass}>초안으로 복원</button>
                <button type="button" disabled={Boolean(busyId)} onClick={() => { setDeleteTarget(post); setConfirmation(''); }} className={`${buttonClass} !text-red-600 dark:!text-red-300`}>영구삭제</button>
              </div>
              {deleteTarget?.id === post.id && <div className="space-y-2 border-t border-[color:var(--border)] pt-3">
                <p className="text-sm text-red-600 dark:text-red-300">본문·댓글·조회수·수정 이력이 삭제되며 되돌릴 수 없습니다. 확인하려면 위 글 제목을 정확히 입력해 주세요.</p>
                <input aria-label="영구삭제 확인 제목" value={confirmation} onChange={event => setConfirmation(event.target.value)} disabled={Boolean(busyId)}
                  className="min-h-11 w-full rounded border border-[color:var(--border)] bg-[var(--surface-muted)] px-3 text-sm" />
                <div className="flex gap-2">
                  <button type="button" disabled={Boolean(busyId) || confirmation !== post.title} onClick={() => void act(post, true)} className={`${buttonClass} !text-red-600 dark:!text-red-300`}>영구삭제 확인</button>
                  <button type="button" disabled={Boolean(busyId)} onClick={() => setDeleteTarget(null)} className={buttonClass}>취소</button>
                </div>
              </div>}
            </li>)}
          </ul>
        )}
      </div>
    </div>
  );
}
