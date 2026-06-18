import { EditorContent } from '@tiptap/react';
import type { Editor } from '@tiptap/react';
import type { ReactNode } from 'react';
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
  children?: ReactNode;
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
  uploadLocalImage,
  children
}: PostEditorCanvasProps) {
  return (
    <>
      <div className={previewMode ? 'pointer-events-none opacity-60' : ''} aria-hidden={previewMode}>
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

      {previewMode && (
        <div className="mx-auto min-h-[720px] w-full max-w-[980px] bg-white px-0 py-10 sm:px-4 lg:px-8">
          {contentHtml.trim() ? (
            <PostContent contentHtml={contentHtml} />
          ) : (
            <p className="text-sm text-[var(--text-muted)]">
              미리볼 내용이 없습니다. 본문을 입력해 주세요.
            </p>
          )}
        </div>
      )}

      <div
        className={`min-h-[720px] bg-white ${previewMode ? 'hidden' : ''}`}
        aria-hidden={previewMode}
      >
        {children}
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
            className="mx-auto w-full max-w-[980px] border-none px-0 shadow-none outline-none ring-0 sm:px-4 lg:px-8 [&_.ProseMirror]:min-h-[520px] [&_.ProseMirror]:bg-white [&_.ProseMirror]:px-0 [&_.ProseMirror]:py-8 [&_.ProseMirror]:shadow-none"
          />
          <TableBubbleMenu editor={editor} enabled={!previewMode} />
          <ColumnBubbleMenu editor={editor} enabled={!previewMode} />
        </EditorActionContext.Provider>
      </div>
    </>
  );
}
