import { useCallback, useEffect } from 'react';
import { useBlocker } from 'react-router-dom';
import type { AdminSection } from '../types/admin';

const UNSAVED_CHANGES_MESSAGE = '저장하지 않은 변경사항이 있습니다. 이동할까요?';

interface UseAdminDirtyNavigationOptions {
  activeSection: AdminSection;
  editorDirty: boolean;
}

export const useAdminDirtyNavigation = ({
  activeSection,
  editorDirty
}: UseAdminDirtyNavigationOptions) => {
  const confirmEditorNavigation = useCallback(() => {
    if (activeSection !== 'posts' || !editorDirty) return true;
    return window.confirm(UNSAVED_CHANGES_MESSAGE);
  }, [activeSection, editorDirty]);

  const historyBlocker = useBlocker(({ historyAction }) => (
    activeSection === 'posts' && editorDirty && historyAction === 'POP'
  ));

  useEffect(() => {
    if (historyBlocker.state !== 'blocked') return;

    if (window.confirm(UNSAVED_CHANGES_MESSAGE)) {
      historyBlocker.proceed();
      return;
    }

    historyBlocker.reset();
  }, [historyBlocker]);

  return confirmEditorNavigation;
};
