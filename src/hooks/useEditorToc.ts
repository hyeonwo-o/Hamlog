import { useCallback, useEffect, useState } from 'react';
import type { Editor, EditorEvents } from '@tiptap/react';
import type { TocItem } from '../components/TableOfContents';
import { collectEditorToc, updateEditorToc } from '../editor/utils/editorToc';

export function useEditorToc(editor: Editor | null) {
  const [tocItems, setTocItems] = useState<TocItem[]>([]);

  useEffect(() => {
    if (!editor) {
      setTocItems([]);
      return;
    }

    let index = collectEditorToc(editor.state.doc);
    setTocItems(index.items);
    const updateToc = ({ transaction, appendedTransactions }: EditorEvents['transaction']) => {
      const next = updateEditorToc(index, [transaction, ...appendedTransactions], editor.state.doc);
      if (next.items !== index.items) setTocItems(next.items);
      index = next;
    };

    // The transaction event also covers setContent({ emitUpdate: false }).
    editor.on('transaction', updateToc);

    return () => {
      editor.off('transaction', updateToc);
    };
  }, [editor]);

  const handleTocLinkClick = useCallback(
    (id: string) => {
      const pos = Number.parseInt(id.replace('heading-', ''), 10);
      if (Number.isNaN(pos) || !editor) return;
      editor.commands.focus(pos);
      const element = editor.view.nodeDOM(pos) as HTMLElement | null;
      element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    },
    [editor]
  );

  return {
    tocItems,
    handleTocLinkClick
  };
}
