type PromptOptions = {
  title: string;
  description?: string;
  placeholder?: string;
  defaultValue?: string;
  confirmText?: string;
  cancelText?: string;
  multiline?: boolean;
};

const applyStyles = (element: HTMLElement, styles: Partial<CSSStyleDeclaration>) => {
  Object.assign(element.style, styles);
};

const ensureToastRoot = () => {
  let root = document.getElementById('hamlog-editor-toast-root') as HTMLDivElement | null;
  if (root) return root;

  root = document.createElement('div');
  root.id = 'hamlog-editor-toast-root';
  applyStyles(root, {
    position: 'fixed',
    right: '16px',
    bottom: '16px',
    zIndex: '10000',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  });
  document.body.appendChild(root);
  return root;
};

export const showEditorToast = (
  message: string,
  tone: 'info' | 'error' = 'info',
  durationMs = 2600
) => {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const root = ensureToastRoot();
  const toast = document.createElement('div');
  toast.textContent = message;
  applyStyles(toast, {
    minWidth: '220px',
    maxWidth: '360px',
    borderRadius: '10px',
    border: '1px solid rgba(0,0,0,0.08)',
    padding: '10px 12px',
    fontSize: '13px',
    lineHeight: '1.4',
    background: tone === 'error' ? '#fff1f2' : '#ffffff',
    color: tone === 'error' ? '#9f1239' : '#1f2937',
    boxShadow: '0 10px 24px rgba(0, 0, 0, 0.12)'
  });

  root.appendChild(toast);
  window.setTimeout(() => {
    toast.remove();
    if (root.childElementCount === 0) {
      root.remove();
    }
  }, durationMs);
};

export const promptForText = ({
  title,
  description,
  placeholder,
  defaultValue = '',
  confirmText = '확인',
  cancelText = '취소',
  multiline = false
}: PromptOptions): Promise<string | null> => {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const overlay = document.createElement('div');
    applyStyles(overlay, {
      position: 'fixed',
      inset: '0',
      zIndex: '9999',
      background: 'rgba(2, 6, 23, 0.45)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    });

    const panel = document.createElement('div');
    const headingId = `hamlog-editor-dialog-${Date.now()}`;
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-labelledby', headingId);
    panel.tabIndex = -1;
    applyStyles(panel, {
      width: multiline ? 'min(720px, 100%)' : 'min(520px, 100%)',
      borderRadius: '14px',
      border: '1px solid rgba(148, 163, 184, 0.4)',
      background: '#ffffff',
      boxShadow: '0 20px 50px rgba(15, 23, 42, 0.2)',
      padding: '16px'
    });

    const heading = document.createElement('h3');
    heading.id = headingId;
    heading.textContent = title;
    applyStyles(heading, {
      margin: '0',
      fontSize: '16px',
      fontWeight: '700',
      color: '#0f172a'
    });

    panel.appendChild(heading);

    if (description) {
      const desc = document.createElement('p');
      desc.textContent = description;
      applyStyles(desc, {
        margin: '8px 0 0',
        fontSize: '13px',
        color: '#475569'
      });
      panel.appendChild(desc);
    }

    const input = multiline
      ? document.createElement('textarea')
      : document.createElement('input');
    input.value = defaultValue;
    input.setAttribute('aria-label', title);
    if (!multiline) {
      (input as HTMLInputElement).type = 'text';
    }
    if (placeholder) {
      input.placeholder = placeholder;
    }

    applyStyles(input, {
      width: '100%',
      marginTop: '12px',
      borderRadius: '10px',
      border: '1px solid #cbd5e1',
      background: '#ffffff',
      color: '#0f172a',
      fontSize: '14px',
      padding: '10px 12px',
      boxSizing: 'border-box'
    });

    if (multiline) {
      input.spellcheck = false;
      applyStyles(input, {
        minHeight: '260px',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
        lineHeight: '1.5',
        resize: 'vertical'
      });
    }

    panel.appendChild(input);

    const actions = document.createElement('div');
    applyStyles(actions, {
      marginTop: '14px',
      display: 'flex',
      justifyContent: 'flex-end',
      gap: '8px'
    });

    const cancelButton = document.createElement('button');
    cancelButton.type = 'button';
    cancelButton.textContent = cancelText;
    applyStyles(cancelButton, {
      borderRadius: '9999px',
      border: '1px solid #cbd5e1',
      background: '#ffffff',
      color: '#334155',
      padding: '7px 14px',
      fontSize: '13px',
      cursor: 'pointer'
    });

    const confirmButton = document.createElement('button');
    confirmButton.type = 'button';
    confirmButton.textContent = confirmText;
    applyStyles(confirmButton, {
      borderRadius: '9999px',
      border: '1px solid transparent',
      background: '#0f172a',
      color: '#ffffff',
      padding: '7px 14px',
      fontSize: '13px',
      cursor: 'pointer'
    });

    actions.appendChild(cancelButton);
    actions.appendChild(confirmButton);
    panel.appendChild(actions);
    overlay.appendChild(panel);
    document.body.appendChild(overlay);
    input.focus();
    input.setSelectionRange?.(defaultValue.length, defaultValue.length);

    const cleanup = () => {
      document.removeEventListener('keydown', onKeyDown);
      overlay.remove();
      previouslyFocused?.focus();
    };

    const cancel = () => {
      cleanup();
      resolve(null);
    };

    const confirm = () => {
      const value = input.value;
      cleanup();
      resolve(value);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        cancel();
        return;
      }

      if (event.key === 'Enter' && (!multiline || event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        confirm();
        return;
      }

      if (event.key === 'Tab') {
        const focusable = [input, cancelButton, confirmButton];
        const currentIndex = focusable.indexOf(document.activeElement as HTMLInputElement);
        if (event.shiftKey && currentIndex <= 0) {
          event.preventDefault();
          confirmButton.focus();
        } else if (!event.shiftKey && currentIndex === focusable.length - 1) {
          event.preventDefault();
          input.focus();
        }
      }
    };

    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) {
        cancel();
      }
    });
    cancelButton.addEventListener('click', cancel);
    confirmButton.addEventListener('click', confirm);
    document.addEventListener('keydown', onKeyDown);
  });
};
