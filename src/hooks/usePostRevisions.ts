import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchPostRevisions, restorePostRevision } from '../api/postApi';
import type { Post, PostRevision } from '../data/blogData';

interface UsePostRevisionsOptions {
  activeId: string | null;
  expectedUpdatedAt: string | undefined;
  isBusy?: () => boolean;
  captureRestoreGuard?: () => () => boolean;
  setNotice: (message: string) => void;
  onAfterRestore: (post: Post) => Promise<void> | void;
  onRestoreWithoutApply?: (post: Post) => Promise<void> | void;
}

export const usePostRevisions = ({
  activeId,
  expectedUpdatedAt,
  isBusy,
  captureRestoreGuard,
  setNotice,
  onAfterRestore,
  onRestoreWithoutApply
}: UsePostRevisionsOptions) => {
  const [revisions, setRevisions] = useState<PostRevision[]>([]);
  const [revisionsLoading, setRevisionsLoading] = useState(false);
  const [restoringRevisionId, setRestoringRevisionId] = useState<string | null>(null);
  const documentRef = useRef({ id: activeId, generation: 0 });
  if (documentRef.current.id !== activeId) {
    documentRef.current = { id: activeId, generation: documentRef.current.generation + 1 };
  }
  const mountedRef = useRef(true);
  const requestRef = useRef<AbortController | null>(null);
  const restoringRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      requestRef.current?.abort();
    };
  }, []);

  const loadRevisions = useCallback(async (postId: string) => {
    if (documentRef.current.id !== postId) return;
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    const document = documentRef.current;
    const isCurrent = () => mountedRef.current && !controller.signal.aborted
      && documentRef.current === document;
    setRevisionsLoading(true);
    try {
      const nextRevisions = await fetchPostRevisions(postId, controller.signal);
      if (isCurrent()) setRevisions(nextRevisions);
    } catch (error) {
      if (!isCurrent()) return;
      console.error(error);
      setNotice('리비전 내역을 불러오지 못했습니다.');
    } finally {
      if (isCurrent()) setRevisionsLoading(false);
    }
  }, [setNotice]);

  useEffect(() => {
    requestRef.current?.abort();
    setRevisions([]);
    setRestoringRevisionId(null);
    if (!activeId) {
      setRevisions([]);
      setRevisionsLoading(false);
      return;
    }

    void loadRevisions(activeId);
  }, [activeId, loadRevisions]);

  const handleRestoreRevision = useCallback(async (revisionId: string) => {
    if (!activeId || restoringRef.current || isBusy?.()) return;
    if (expectedUpdatedAt === undefined) {
      setNotice('복구한 임시본의 서버 기준 버전이 없습니다. 내용을 검토해 서버에 저장한 뒤 이력을 복구해 주세요.');
      return;
    }

    const confirmed = window.confirm('선택한 리비전으로 복구할까요? 현재 서버 저장본은 새 리비전으로 보관되지만, 저장하지 않은 편집 내용은 교체됩니다.');
    if (!confirmed) return;

    const document = documentRef.current;
    const canApplyRestore = captureRestoreGuard?.() ?? (() => true);
    const isCurrent = () => mountedRef.current && documentRef.current === document;
    restoringRef.current = true;
    setRestoringRevisionId(revisionId);
    setNotice('');

    try {
      const restoredPost = await restorePostRevision(activeId, revisionId, expectedUpdatedAt);
      if (!isCurrent()) return;
      if (!canApplyRestore()) {
        await onRestoreWithoutApply?.(restoredPost);
        if (!isCurrent()) return;
        await loadRevisions(activeId);
        if (isCurrent()) setNotice('서버의 저장본은 복구했지만 새 입력은 덮어쓰지 않았습니다. 최신 저장본을 확인해 주세요.');
        return;
      }
      await onAfterRestore(restoredPost);
      if (!isCurrent()) return;
      await loadRevisions(restoredPost.id);
      if (isCurrent()) setNotice('리비전을 복구했습니다.');
    } catch (error) {
      if (!isCurrent()) return;
      console.error(error);
      if (error instanceof Error && error.message) {
        setNotice(error.message);
      } else {
        setNotice('리비전 복구에 실패했습니다.');
      }
    } finally {
      restoringRef.current = false;
      if (isCurrent()) setRestoringRevisionId(null);
    }
  }, [activeId, expectedUpdatedAt, isBusy, captureRestoreGuard, loadRevisions, onAfterRestore, onRestoreWithoutApply, setNotice]);

  return {
    revisions,
    revisionsLoading,
    restoringRevisionId,
    restoringRef,
    loadRevisions,
    handleRestoreRevision
  };
};
