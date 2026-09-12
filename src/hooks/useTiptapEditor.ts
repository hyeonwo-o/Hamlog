import type { JSONContent } from '@tiptap/core';
import { useEditor } from '@tiptap/react';
import { useMemo } from 'react';
import type { PostDraft } from '../types/admin';
import type { EditorView } from '@tiptap/pm/view';
import type { Slice } from '@tiptap/pm/model';
import { getEditorExtensions } from '../editor/editorConfig';
import { getEditorContentSnapshot } from '../editor/utils/editorContentSnapshot';

interface UseTiptapEditorProps {
    contentJson?: JSONContent;
    contentHtml: string;
    setDraft: React.Dispatch<React.SetStateAction<PostDraft>>;
    handlePaste: (view: EditorView, event: ClipboardEvent, slice: Slice) => boolean | void;
    handleDrop: (view: EditorView, event: DragEvent, slice: Slice, moved: boolean) => boolean | void;
}

export const useTiptapEditor = ({
    contentJson,
    contentHtml,
    setDraft,
    handlePaste,
    handleDrop
}: UseTiptapEditorProps) => {
    const extensions = useMemo(() => getEditorExtensions(), []);
    const editor = useEditor({
        // Preserve toolbar/selection updates from the v2 editor.
        shouldRerenderOnTransaction: true,
        extensions,
        content: contentJson ?? contentHtml ?? '',
        onCreate: ({ editor }) => {
            const { contentHtml, contentJson } = getEditorContentSnapshot(editor);
            setDraft(prev => ({
                ...prev,
                contentHtml,
                contentJson
            }));
        },
        onUpdate: ({ editor }) => {
            // Capture once, synchronously. React may replay a state updater,
            // which must not serialize a later mutable editor state again.
            const { contentHtml, contentJson } = getEditorContentSnapshot(editor);
            setDraft(prev => ({
                ...prev,
                contentHtml,
                contentJson
            }));
        },
        editorProps: {
            attributes: {
                class: 'tiptap-editor border-none shadow-none outline-none ring-0 focus:ring-0 focus:outline-none'
            },
            handlePaste,
            handleDrop
        }
    });

    return editor;
};
