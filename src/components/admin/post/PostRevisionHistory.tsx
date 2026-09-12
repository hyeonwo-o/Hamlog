import { useEffect, useMemo, useRef, useState } from 'react';
import type { PostRevision, PostRevisionDetail } from '../../../data/blogData';
import type { PostDraft } from '../../../types/admin';
import { fetchPostRevision } from '../../../api/postApi';
import { toDraft } from '../../../hooks/usePostForm';
import { compareRevisionDrafts } from '../../../utils/revisionComparison';

interface Props {
  activeId: string;
  draft: PostDraft;
  revisions: PostRevision[];
  restoringRevisionId?: string | null;
  onRestoreRevision: (id: string) => void;
}

const eventLabels = { created: '생성', updated: '저장', restored: '복구', baseline: '이전 상태' };
const formatDate = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('ko-KR');
};
const buttonClass = 'rounded-lg border border-[color:var(--border)] px-3 py-1.5 text-[11px] font-semibold text-[var(--text)] transition hover:border-[color:var(--accent)] disabled:opacity-50';

const PostRevisionHistory = ({ activeId, draft, revisions, restoringRevisionId, onRestoreRevision }: Props) => {
  const [showAll, setShowAll] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<PostRevisionDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const selectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDetail(null);
    setError('');
    if (!selectedId) {
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    void fetchPostRevision(activeId, selectedId, controller.signal).then(response => {
      if (!controller.signal.aborted) {
        setDetail(response);
        selectionRef.current?.focus({ preventScroll: true });
      }
    }).catch(reason => {
      if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : '리비전을 불러오지 못했습니다.');
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [activeId, selectedId]);

  const selectedDetail = detail?.id === selectedId && detail.postId === activeId ? detail : null;
  const comparison = useMemo(() => selectedDetail ? compareRevisionDrafts(toDraft(selectedDetail.snapshot), draft) : null, [selectedDetail, draft]);
  const visible = showAll ? revisions : revisions.slice(0, 5);

  return (
    <div className="space-y-3">
      <p className="text-[11px] text-[var(--text-muted)]">미리보기는 읽기 전용입니다. 선택한 저장본과 현재 편집 중인 글을 비교합니다.</p>
      <p className="text-[11px] text-[var(--text-muted)]">서버에 보관된 최근 최대 25개 이력을 확인할 수 있습니다.</p>
      {selectedId && (
        <div ref={selectionRef} tabIndex={-1} aria-label="저장 이력 비교" className="space-y-3 rounded-lg border border-[color:var(--accent)] bg-[var(--surface)] p-3 outline-none">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-xs font-semibold text-[var(--text)]">저장본 → 현재 편집본</h4>
            <button type="button" className={buttonClass} onClick={() => setSelectedId(null)}>비교 닫기</button>
          </div>
          {loading && <p role="status" className="text-xs text-[var(--text-muted)]">저장본을 불러오는 중입니다.</p>}
          {error && <p role="alert" className="text-xs text-red-600 dark:text-red-300">{error}</p>}
          {selectedDetail && comparison && <>
            <p className="text-[11px] text-[var(--text-muted)]">{formatDate(selectedDetail.savedAt)} · {selectedDetail.title}</p>
            <p className="text-xs text-[var(--text)]">메타데이터 {comparison.metadata.length}개 변경 · 문단 추가 {comparison.added.length}개 / 삭제 {comparison.removed.length}개</p>
            {comparison.metadata.length === 0 && !comparison.bodyChanged && <p className="text-xs text-[var(--text-muted)]">현재 편집본과 동일합니다.</p>}
            {comparison.bodyChanged && !comparison.added.length && !comparison.removed.length && <p className="text-xs text-[var(--text-muted)]">본문의 문단 순서, 서식 또는 구성 요소가 변경되었습니다.</p>}
            {comparison.metadata.length > 0 && <dl className="max-h-64 space-y-2 overflow-auto text-[11px]">
              {comparison.metadata.map(change => <div key={change.key} className="break-words rounded border border-[color:var(--border)] p-2">
                <dt className="font-semibold text-[var(--text)]">{change.label}</dt>
                <dd className="mt-1 text-[var(--text-muted)]">이전: {change.before || '(없음)'}</dd>
                <dd className="text-[var(--text)]">현재: {change.after || '(없음)'}</dd>
              </div>)}
            </dl>}
            {(comparison.added.length > 0 || comparison.removed.length > 0) && <div className="max-h-72 space-y-2 overflow-auto text-xs">
              {(['removed', 'added'] as const).map(kind => comparison[kind].slice(0, 100).map((line, index) => <p key={`${kind}-${index}`} className={`whitespace-pre-wrap break-words rounded border p-2 ${kind === 'added' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200' : 'border-red-500/30 bg-red-500/10 text-red-800 dark:text-red-200'}`}>
                <span className="mr-1 font-semibold">{kind === 'added' ? '+ 추가' : '− 삭제'}</span> {line.length > 1000 ? `${line.slice(0, 1000)}…` : line}
              </p>))}
              {(comparison.added.length > 100 || comparison.removed.length > 100) && <p className="text-[var(--text-muted)]">추가·삭제 문단은 각각 100개까지만 표시합니다. 전체 내용은 아래 미리보기에서 확인하세요.</p>}
            </div>}
            <details className="text-xs text-[var(--text)]"><summary className="cursor-pointer font-semibold">저장본 전체 텍스트 미리보기</summary><pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap break-words rounded bg-[var(--surface-muted)] p-3 font-sans text-xs leading-6">{comparison.previousText || '(본문 없음)'}</pre><p className="mt-2 text-[11px] text-[var(--text-muted)]">외부 영상·스크립트는 실행하지 않으며, 서식은 텍스트로 표시합니다.</p></details>
            <button type="button" className={buttonClass} disabled={Boolean(restoringRevisionId)} onClick={() => onRestoreRevision(selectedDetail.id)}>{restoringRevisionId === selectedDetail.id ? '복구 중...' : '이 리비전 복구'}</button>
          </>}
        </div>
      )}
      {revisions.length > 5 && <button type="button" className={buttonClass} aria-expanded={showAll} onClick={() => setShowAll(value => !value)}>{showAll ? '최근 5개만 보기' : `전체 이력 보기 (${revisions.length}개)`}</button>}
      <div className={showAll ? 'max-h-[32rem] space-y-3 overflow-y-auto pr-1' : 'space-y-3'}>
        {visible.map(revision => <div key={revision.id} className="rounded-lg border border-[color:var(--border)] bg-[var(--surface-muted)] p-3">
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-[var(--text-muted)]"><span className="rounded bg-[var(--surface)] px-2 py-0.5 font-semibold text-[var(--accent-strong)]">{eventLabels[revision.event]}</span><span>{formatDate(revision.savedAt)}</span></div>
          <p className="mt-2 truncate text-sm font-medium text-[var(--text)]">{revision.title}</p>
          <p className="truncate text-[11px] text-[var(--text-muted)]">/{revision.slug}</p>
          <button type="button" className={`mt-3 ${buttonClass}`} onClick={() => setSelectedId(revision.id)} aria-pressed={selectedId === revision.id}>미리보기 및 비교</button>
        </div>)}
      </div>
    </div>
  );
};

export default PostRevisionHistory;
