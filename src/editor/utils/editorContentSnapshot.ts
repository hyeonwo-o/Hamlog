import type { Editor, JSONContent } from '@tiptap/core';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';

type ContentReader = Pick<Editor, 'state' | 'getHTML' | 'getJSON'>;

export interface EditorContentSnapshot {
  contentHtml: string;
  contentJson: JSONContent;
  readonly contentJsonKey: string;
}

const snapshots = new WeakMap<ContentReader, { doc: ProseMirrorNode; snapshot: EditorContentSnapshot }>();

/** ProseMirror documents are immutable; selection transactions keep the same doc. */
export function getEditorContentSnapshot(editor: ContentReader): EditorContentSnapshot {
  const doc = editor.state.doc;
  const cached = snapshots.get(editor);
  if (cached?.doc === doc) return cached.snapshot;

  const contentHtml = editor.getHTML();
  const contentJson = editor.getJSON();
  let contentJsonKey: string | undefined;
  const snapshot: EditorContentSnapshot = {
    contentHtml,
    contentJson,
    // Normal editor echoes compare JSON identity; serialize only for external resets.
    get contentJsonKey() {
      return contentJsonKey ??= JSON.stringify(contentJson);
    }
  };
  snapshots.set(editor, { doc, snapshot });
  return snapshot;
}
