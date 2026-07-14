import { useCallback } from 'react';
import type { Editor } from '@tiptap/react';
import type { PostDraft } from '../types/admin';
import { promptForText } from '../utils/editorDialog';

interface UsePostEditorActionsOptions {
  editor: Editor | null;
  updateDraft: (patch: Partial<PostDraft>) => void;
  setNotice: (message: string) => void;
  uploadImage: (file: File) => Promise<{ url: string }>;
}

export const usePostEditorActions = ({
  editor,
  updateDraft,
  setNotice,
  uploadImage
}: UsePostEditorActionsOptions) => {
  const handleCoverUpload = useCallback(async (file: File) => {
    try {
      setNotice('업로드 중...');
      const { url } = await uploadImage(file);
      updateDraft({ cover: url });
      setNotice('대표 이미지가 업로드되었습니다.');
    } catch (error) {
      console.error(error);
      setNotice('이미지 업로드에 실패했습니다.');
    }
  }, [setNotice, updateDraft, uploadImage]);

  const handleSetCoverFromContent = useCallback((srcOverride?: string) => {
    if (srcOverride) {
      updateDraft({ cover: srcOverride });
      setNotice('선택한 이미지가 대표 이미지로 설정되었습니다.');
      return;
    }

    if (!editor) return;
    const { selection } = editor.state;

    if (selection.empty) {
      setNotice('이미지를 선택해주세요.');
      return;
    }

    const node = editor.state.doc.nodeAt(selection.from);
    if (node && node.type.name === 'image') {
      const src = node.attrs.src;
      if (src) {
        updateDraft({ cover: src });
        setNotice('선택한 이미지가 대표 이미지로 설정되었습니다.');
      } else {
        setNotice('이미지 주소를 찾을 수 없습니다.');
      }
    } else {
      setNotice('이미지가 선택되지 않았습니다.');
    }
  }, [editor, setNotice, updateDraft]);

  const handleLink = useCallback(() => {
    if (!editor) return;
    const previousUrl = editor.getAttributes('link').href as string | undefined;

    void (async () => {
      const rawUrl = await promptForText({
        title: '링크 URL 입력',
        defaultValue: previousUrl ?? '',
        placeholder: 'https://'
      });

      if (rawUrl === null) return;

      const url = rawUrl.trim();
      if (!url) {
        editor.chain().focus().extendMarkRange('link').unsetLink().run();
        return;
      }

      editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
    })();
  }, [editor]);

  return {
    handleCoverUpload,
    handleSetCoverFromContent,
    handleLink
  };
};
