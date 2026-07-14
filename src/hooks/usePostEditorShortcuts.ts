import { useEffect } from 'react';

interface UsePostEditorShortcutsOptions {
  onSaveDraft: () => void | Promise<void>;
  onSave: () => void | Promise<void>;
  onPublish: () => void | Promise<void>;
  onTogglePreview: () => void;
}

export const usePostEditorShortcuts = ({
  onSaveDraft,
  onSave,
  onPublish,
  onTogglePreview
}: UsePostEditorShortcutsOptions) => {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || document.querySelector('[role="dialog"][aria-modal="true"]')) {
        return;
      }

      const key = event.key.toLowerCase();

      if ((event.metaKey || event.ctrlKey) && key === 's') {
        event.preventDefault();
        if (event.shiftKey) {
          void onSaveDraft();
          return;
        }
        void onSave();
        return;
      }

      if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
        event.preventDefault();
        void onPublish();
        return;
      }

      if (event.altKey && event.shiftKey && key === 'p') {
        event.preventDefault();
        onTogglePreview();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onPublish, onSave, onSaveDraft, onTogglePreview]);
};
