import { EditorContent } from '@tiptap/react';
import type { Editor } from '@tiptap/react';
import PostContent from '../../PostContent';
import { EditorActionContext } from '../../../contexts/EditorActionContext';
import { ColumnBubbleMenu } from '../../editor/extensions/ColumnBubbleMenu';
import { TableBubbleMenu } from '../../editor/extensions/TableBubbleMenu';
import { EditorToolbar } from '../../editor/EditorToolbar';

interface PostEditorCanvasProps {
  editor: Editor | null;
  previewMode: boolean;
  contentHtml: string;
  currentCoverUrl?: string;
  onLink: () => void;
  onToolbarUpload: () => void;
  onInsertImageUrl: () => void;
  uploadingImage: boolean;
  uploadError: string | null;
  fileInputRef: React.RefObject<HTMLInputElement>;
  onImageUpload: (file: File) => void;
  onSetCoverFromContent?: (src?: string) => void;
  uploadLocalImage?: (file: File) => Promise<{ url: string }>;
}

export default function PostEditorCanvas({
  editor,
  previewMode,
  contentHtml,
  currentCoverUrl,
  onLink,
  onToolbarUpload,
  onInsertImageUrl,
  uploadingImage,
  uploadError,
  fileInputRef,
  onImageUpload,
  onSetCoverFromContent,
  uploadLocalImage
}: PostEditorCanvasProps) {
  return (
    <>
      <div className="angular-control rounded-xl border border-[color:var(--border)] bg-[var(--surface-muted)] p-3">
        <EditorToolbar
          editor={editor}
          onLink={onLink}
          onToolbarImageUpload={onToolbarUpload}
          onInsertImageUrl={onInsertImageUrl}
          uploadingImage={uploadingImage}
        />
      </div>

      {uploadError && <p className="text-xs text-red-500">{uploadError}</p>}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={event => {
          const file = event.target.files?.[0];
          if (file) {
            onImageUpload(file);
          }
          event.target.value = '';
        }}
      />

      {previewMode ? (
        <div className="angular-control min-h-[720px] rounded-xl border border-[color:var(--border)] bg-[var(--surface-muted)] p-6">
          {contentHtml.trim() ? (
            <PostContent contentHtml={contentHtml} />
          ) : (
            <p className="text-sm text-[var(--text-muted)]">
              미리볼 내용이 없습니다. 본문을 입력해 주세요.
            </p>
          )}
        </div>
      ) : (
        <div className="angular-control min-h-[720px] rounded-xl border border-[color:var(--border)] bg-[linear-gradient(180deg,var(--surface),var(--surface-muted))] p-4">
          <EditorActionContext.Provider
            value={{
              onSetCover: src => onSetCoverFromContent?.(src),
              currentCoverUrl,
              onToolbarUpload,
              uploadLocalImage
            }}
          >
            <EditorContent
              editor={editor}
              className="border-none shadow-none outline-none ring-0 [&_.ProseMirror]:min-h-[660px] [&_.ProseMirror]:rounded-[3px] [&_.ProseMirror]:bg-[var(--surface)] [&_.ProseMirror]:px-6 [&_.ProseMirror]:py-6 [&_.ProseMirror]:shadow-[0_0_0_1px_rgba(29,25,22,0.08),10px_10px_0_rgba(11,35,32,0.16)]"
            />
            <TableBubbleMenu editor={editor} />
            <ColumnBubbleMenu editor={editor} />
          </EditorActionContext.Provider>
        </div>
      )}
    </>
  );
}
