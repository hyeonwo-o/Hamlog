import { useCallback, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';
import type { Editor } from '@tiptap/react';
import type { EditorView } from '@tiptap/pm/view';
import { deleteUnusedUploads } from '../api/uploadApi';
import {
  detectImageDropZone,
  getImagePositionFromElement
} from '../editor/utils/dragDropUtils';
import { createDefaultImageAlt } from '../editor/utils/imageAlt';
import { insertImageBeside } from '../editor/utils/imageLayout';
import { promptForText } from '../utils/editorDialog';

interface UseEditorImageControlsProps {
  editorRef: MutableRefObject<Editor | null>;
  documentKey: string;
  maxUploadMb: number;
  uploadLocalImage: (file: File) => Promise<{ url: string; filename?: string }>;
}

export const useEditorImageControls = ({
  editorRef,
  documentKey,
  maxUploadMb,
  uploadLocalImage
}: UseEditorImageControlsProps) => {
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const documentKeyRef = useRef(documentKey);
  documentKeyRef.current = documentKey;

  const cleanupCancelledUpload = useCallback(async (uploaded: { filename?: string }) => {
    if (!uploaded.filename) return;
    try {
      await deleteUnusedUploads([uploaded.filename]);
    } catch {
      // A later unused-upload scan can recover a best-effort cleanup failure.
    }
  }, []);

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
    const uploadDocumentKey = documentKeyRef.current;
    try {
      const uploaded = await uploadLocalImage(file);
      if (documentKeyRef.current !== uploadDocumentKey) {
        await cleanupCancelledUpload(uploaded);
        const message = '업로드 중 편집 중인 글이 바뀌어 이미지를 삽입하지 않았습니다. 다시 시도해 주세요.';
        setUploadError(message);
        throw new Error(message);
      }
      return uploaded;
    } catch (error) {
      const message = error instanceof Error && error.message
        ? error.message
        : '이미지 업로드에 실패했습니다.';
      setUploadError(message);
      throw error;
    } finally {
      setUploadingImage(false);
    }
  }, [cleanupCancelledUpload, maxUploadMb, uploadLocalImage, validateImageFile]);

  const uploadImageToEditor = useCallback(
    async (file: File) => {
      const currentEditor = editorRef.current;
      if (!currentEditor) return;
      try {
        const uploaded = await uploadValidatedImage(file);
        if (editorRef.current !== currentEditor) {
          await cleanupCancelledUpload(uploaded);
          setUploadError('에디터가 변경되어 이미지를 삽입하지 않았습니다. 다시 시도해 주세요.');
          return;
        }
        const { url } = uploaded;
        const imageAttrs = { src: url, alt: createDefaultImageAlt(file.name), size: 'full' };
        currentEditor.chain().focus().setImage(imageAttrs).run();
      } catch {
        // uploadValidatedImage reports the user-facing error.
      }
    },
    [cleanupCancelledUpload, editorRef, uploadValidatedImage]
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
      const dropEditor = editorRef.current;
      const dropDocument = view.state.doc;
      const dropDetection = detectImageDropZone(view.dom, clientX, clientY);
      const dropTargetPos = getImagePositionFromElement(view, dropDetection.targetImage);
      const fallbackPosition = view.posAtCoords({ left: clientX, top: clientY })?.pos ?? null;

      const handleUploadAndInsert = async () => {
        try {
          const uploaded = await uploadValidatedImage(file);
          const currentEditor = editorRef.current;
          if (
            !currentEditor
            || currentEditor !== dropEditor
            || currentEditor.state.doc !== dropDocument
          ) {
            await cleanupCancelledUpload(uploaded);
            setUploadError('업로드 중 글 내용이 변경되어 이미지를 삽입하지 않았습니다. 다시 시도해 주세요.');
            return;
          }
          const { url } = uploaded;
          let grouped = false;

          if (dropTargetPos !== null && dropDetection.dropSide) {
            const newImageNode = currentEditor.state.schema.nodes.image.create({
              src: url,
              alt: createDefaultImageAlt(file.name),
              size: 'full'
            });
            grouped = insertImageBeside(
              currentEditor,
              dropTargetPos,
              dropDetection.dropSide,
              newImageNode
            );
          }

          if (!grouped) {
            // Fallback: Standard insert at coords
            if (fallbackPosition !== null && fallbackPosition <= currentEditor.state.doc.content.size) {
              currentEditor.chain().focus().setTextSelection(fallbackPosition).setImage({
                src: url,
                alt: createDefaultImageAlt(file.name)
              }).run();
            } else {
              currentEditor.chain().focus().setImage({
                src: url,
                alt: createDefaultImageAlt(file.name)
              }).run();
            }
          }
        } catch (error) {
          console.error(error);
        }
      };

      void handleUploadAndInsert();
      return true;
    },
    [cleanupCancelledUpload, editorRef, getImageFileFromTransfer, uploadValidatedImage]
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
      const rawAlt = await promptForText({
        title: '이미지 대체 텍스트',
        description: '이미지가 전달하는 내용을 간결히 적어 주세요. 장식용 이미지라면 비워둘 수 있습니다.',
        placeholder: '예: Kubernetes 배포 흐름도',
        defaultValue: createDefaultImageAlt(url)
      });
      if (rawAlt === null) return;
      const imageAttrs = { src: url, alt: rawAlt.trim().slice(0, 180), size: 'full' };
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
