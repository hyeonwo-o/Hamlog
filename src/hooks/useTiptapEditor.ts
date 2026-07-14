import type { JSONContent } from '@tiptap/core';
import { useEditor } from '@tiptap/react';
import type { PostDraft } from '../types/admin';
import type { EditorView } from '@tiptap/pm/view';
import type { Slice } from '@tiptap/pm/model';
import { getEditorExtensions } from '../editor/editorConfig';

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
    const editor = useEditor({
        extensions: getEditorExtensions(),
        content: contentJson ?? contentHtml ?? '',
        onCreate: ({ editor }) => {
            setDraft(prev => ({
                ...prev,
                contentHtml: editor.getHTML(),
                contentJson: editor.getJSON()
            }));
        },
        onUpdate: ({ editor }) => {
            setDraft(prev => ({
                ...prev,
                contentHtml: editor.getHTML(),
                contentJson: editor.getJSON()
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
