import { useCallback, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';
import type { Editor } from '@tiptap/react';
import type { EditorView } from '@tiptap/pm/view';
import { detectImageDropZone } from '../editor/utils/dragDropUtils';
import { promptForText } from '../utils/editorDialog';

interface UseEditorImageControlsProps {
  editorRef: MutableRefObject<Editor | null>;
  maxUploadMb: number;
  uploadLocalImage: (file: File) => Promise<{ url: string }>;
}

export const useEditorImageControls = ({
  editorRef,
  maxUploadMb,
  uploadLocalImage
}: UseEditorImageControlsProps) => {
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const validateImageFile = useCallback((file: File) => {
    if (file.size <= maxUploadMb * 1024 * 1024) return true;
    setUploadError(`이미지는 ${maxUploadMb}MB 이하만 가능합니다.`);
    return false;
  }, [maxUploadMb]);

  const getImageFileFromTransfer = useCallback((transfer?: DataTransfer | null) => {
    if (!transfer) return null;
    const files = Array.from(transfer.files ?? []);
    return files.find(file => file.type.startsWith('image/')) ?? null;
  }, []);

  const uploadValidatedImage = useCallback(async (file: File) => {
    setUploadError('');
    if (!validateImageFile(file)) {
      throw new Error(`이미지는 ${maxUploadMb}MB 이하만 가능합니다.`);
    }

    setUploadingImage(true);
    try {
      return await uploadLocalImage(file);
    } catch (error) {
      const message = error instanceof Error && error.message
        ? error.message
        : '이미지 업로드에 실패했습니다.';
      setUploadError(message);
      throw error;
    } finally {
      setUploadingImage(false);
    }
  }, [maxUploadMb, uploadLocalImage, validateImageFile]);

  const uploadImageToEditor = useCallback(
    async (file: File) => {
      const currentEditor = editorRef.current;
      if (!currentEditor) return;
      try {
        const { url } = await uploadValidatedImage(file);
        const imageAttrs = { src: url, alt: file.name, size: 'full' };
        currentEditor.chain().focus().setImage(imageAttrs).run();
      } catch {
        // uploadValidatedImage reports the user-facing error.
      }
    },
    [editorRef, uploadValidatedImage]
  );

  const handlePaste = useCallback(
    (_view: unknown, event: ClipboardEvent) => {
      const file = getImageFileFromTransfer(event.clipboardData);
      if (!file) return false;
      event.preventDefault();
      void uploadImageToEditor(file);
      return true;
    },
    [getImageFileFromTransfer, uploadImageToEditor]
  );

  const handleDrop = useCallback(
    (view: EditorView, event: DragEvent, _slice: unknown, moved: boolean) => {
      if (moved) return false;
      const file = getImageFileFromTransfer(event.dataTransfer);
      if (!file) return false;

      event.preventDefault();
      setUploadError('');

      const clientX = event.clientX;
      const clientY = event.clientY;


      const handleUploadAndInsert = async () => {
        try {
          const { url } = await uploadValidatedImage(file);
          let grouped = false;

          // STRATEGY: Edge Detection for Columns
          // Find all images in the editor DOM
          const editorDom = view.dom as HTMLElement;

          // Use extracted utility
          const { targetImage, dropSide, parentColumns } = detectImageDropZone(editorDom, clientX, clientY);

          if (targetImage && dropSide) {
            const wrapper = targetImage.closest('.image-component') || targetImage;
            const domPos = view.posAtDOM(wrapper, 0);

            if (typeof domPos === 'number') {
              // Try to resolve the node at this position
              let node = view.state.doc.nodeAt(domPos);
              if (!node || node.type.name !== 'image') {
                const $pos = view.state.doc.resolve(domPos);
                node = $pos.nodeAfter || $pos.nodeBefore;
              }

              if (node && node.type.name === 'image') {
                // LOGIC: Check for existing columns
                if (parentColumns) {
                  // We are dropping onto an image that is ALREADY IN A COLUMN.
                  // Check current layout
                  const layout = parentColumns.getAttribute('data-layout');

                  if (layout === 'two-column') {
                    // EXPAND TO 3 COLUMNS
                    const columnsPos = view.posAtDOM(parentColumns, 0);
                    const columnsNode = view.state.doc.nodeAt(columnsPos);

                    // Let's implement robust "Expand 2 to 3"
                    if (columnsNode && columnsNode.type.name === 'columns') {

                      // Simple Heuristic: 
                      // If dropSide is LEFT of the LEFTMOST image -> Prepend
                      // If dropSide is RIGHT of the RIGHTMOST image -> Append

                      const allImagesInRow = Array.from(parentColumns.querySelectorAll('.image-component img'));
                      const targetIndex = allImagesInRow.indexOf(targetImage as HTMLImageElement);

                      if (targetIndex !== -1) {
                        const isLeftCol = targetIndex === 0;
                        const isRightCol = targetIndex === 1;

                        let insertIndex = -1;

                        if (isLeftCol && dropSide === 'left') insertIndex = 0;
                        if (isLeftCol && dropSide === 'right') insertIndex = 1; // Middle
                        if (isRightCol && dropSide === 'left') insertIndex = 1; // Middle
                        if (isRightCol && dropSide === 'right') insertIndex = 2;

                        if (insertIndex !== -1) {
                          // Construct new 3-column node using existing contents
                          // We need to access the actual nodes from the document
                          // columnsNode.content is a Fragment, child(i) gives the node

                          const col1 = columnsNode.child(0);
                          const col2 = columnsNode.child(1);

                          // Create new column node with the uploaded image
                          const newSchema = view.state.schema;
                          const newImageNode = newSchema.nodes.image.create({ src: url, size: 'full' });
                          const newColumn = newSchema.nodes.column.create(null, [newImageNode]);

                          const newCols = [col1, col2];
                          newCols.splice(insertIndex, 0, newColumn);

                          const newColumnsNode = newSchema.nodes.columns.create(
                            { layout: 'three-column' },
                            newCols
                          );

                          editorRef.current?.chain()
                            .deleteRange({ from: columnsPos, to: columnsPos + columnsNode.nodeSize })
                            .insertContentAt(columnsPos, newColumnsNode.toJSON())
                            .run();

                          grouped = true;
                        }
                      }
                    }
                  } else {
                    // Already 3 columns or unknown. Prevent nesting.
                    console.warn("Max columns reached or unknown layout.");
                    grouped = true;
                  }
                } else {
                  // ORIGINAL LOGIC: Create 2-Column from scratch
                  // Re-resolve node if needed, though we know we are at the same position
                  // node is let-scoped in if-block, need to re-access or rely on closure if hoisted (which failed).
                  // Safest: Re-resolve since we are in the same scope context as `domPos`.

                  let fallbackNode = view.state.doc.nodeAt(domPos as number);
                  if (!fallbackNode || fallbackNode.type.name !== 'image') {
                    const $pos = view.state.doc.resolve(domPos as number);
                    fallbackNode = $pos.nodeAfter || $pos.nodeBefore;
                  }

                  if (fallbackNode) {
                    const newImageNode = { type: 'image', attrs: { src: url, size: 'full' } };
                    const existingImageNode = { type: 'image', attrs: { ...fallbackNode.attrs } };
                    const leftContent = dropSide === 'left' ? newImageNode : existingImageNode;
                    const rightContent = dropSide === 'left' ? existingImageNode : newImageNode;

                    const columnsNode = {
                      type: 'columns',
                      attrs: { layout: 'two-column' },
                      content: [
                        { type: 'column', content: [leftContent] },
                        { type: 'column', content: [rightContent] }
                      ]
                    };

                    editorRef.current?.chain()
                      .deleteRange({ from: domPos as number, to: (domPos as number) + fallbackNode.nodeSize })
                      .insertContentAt(domPos as number, columnsNode)
                      .run();

                    grouped = true;
                  }
                }
              }
            }
          }

          if (!grouped) {
            // Fallback: Standard insert at coords
            const freshCoords = view.posAtCoords({ left: clientX, top: clientY });
            if (freshCoords) {
              editorRef.current?.chain().focus().setTextSelection(freshCoords.pos).setImage({ src: url }).run();
            } else {
              editorRef.current?.chain().focus().setImage({ src: url }).run();
            }
          }
        } catch (error) {
          console.error(error);
        }
      };

      void handleUploadAndInsert();
      return true;
    },
    [editorRef, getImageFileFromTransfer, uploadValidatedImage]
  );

  const handleToolbarImageUpload = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleInsertImageUrl = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;

    void (async () => {
      const rawUrl = await promptForText({
        title: '이미지 URL 입력',
        placeholder: 'https://'
      });
      const url = rawUrl?.trim();
      if (!url) return;
      const imageAttrs = { src: url, size: 'full' };
      editor.chain().focus().setImage(imageAttrs).run();
    })();
  }, [editorRef]);

  return {
    fileInputRef,
    uploadingImage,
    uploadError,
    uploadValidatedImage,
    uploadImageToEditor,
    handlePaste,
    handleDrop,
    handleToolbarImageUpload,
    handleInsertImageUrl
  };
};
