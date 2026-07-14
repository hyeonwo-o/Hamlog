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
  const toolbarStateClass = previewMode ? 'pointer-events-none opacity-60' : '';

  return (
    <>
      <div
        className={`sticky top-[calc(var(--admin-header-offset)+var(--admin-post-command-offset))] z-20 ${toolbarStateClass}`}
        aria-hidden={previewMode}
      >
        <EditorToolbar
          editor={editor}
          onLink={onLink}
          onToolbarImageUpload={onToolbarUpload}
          onInsertImageUrl={onInsertImageUrl}
          uploadingImage={uploadingImage}
        />
      </div>

      {uploadError && (
        <p role="alert" className="text-xs text-red-500">{uploadError}</p>
      )}

      <input
        ref={fileInputRef}
        data-testid="editor-image-input"
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
        <div className="mx-auto min-h-[560px] w-full max-w-[920px] bg-white px-0 py-6 sm:px-3 lg:px-6">
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
        className={`min-h-[560px] bg-white ${previewMode ? 'hidden' : ''}`}
        aria-hidden={previewMode}
      >
        {children}
        <EditorActionContext.Provider
          value={{
            onSetCover: src => onSetCoverFromContent?.(src),
            currentCoverUrl,
            uploadLocalImage
          }}
        >
          <EditorContent
            editor={editor}
            className="mx-auto w-full max-w-[920px] border-none px-0 shadow-none outline-none ring-0 sm:px-3 lg:px-6 [&_.ProseMirror]:min-h-[420px] [&_.ProseMirror]:bg-white [&_.ProseMirror]:px-0 [&_.ProseMirror]:py-5 [&_.ProseMirror]:shadow-none"
          />
          <TableBubbleMenu editor={editor} enabled={!previewMode} />
          <ColumnBubbleMenu editor={editor} enabled={!previewMode} />
        </EditorActionContext.Provider>
      </div>
    </>
  );
}
