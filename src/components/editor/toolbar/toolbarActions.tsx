import type { ReactNode } from 'react';
import type { Editor } from '@tiptap/react';
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Code,
  Code2,
  Image as ImageIcon,
  ImageUp,
  Italic,
  Link2,
  List,
  ListOrdered,
  Minus,
  Quote,
  Redo,
  Strikethrough,
  Table as TableIcon,
  Undo,
  Underline
} from 'lucide-react';
import { EDITOR_HEADING_LEVELS } from '../../../utils/editorConstants';

export interface ToolbarActionConfig {
  key: string;
  label: string;
  icon: ReactNode;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  className?: string;
  children?: ReactNode;
}

interface InsertActionOptions {
  editor: Editor | null;
  onLink: () => void;
  onToolbarImageUpload: () => void;
  onInsertImageUrl: () => void;
  uploadingImage: boolean;
}

export function getHeadingValue(editor: Editor | null) {
  const activeLevel = EDITOR_HEADING_LEVELS.find(level => editor?.isActive('heading', { level }));
  return activeLevel ? `h${activeLevel}` : 'paragraph';
}

export function getFontSizeValue(editor: Editor | null) {
  return (editor?.getAttributes('textStyle') as { fontSize?: string })?.fontSize ?? 'default';
}

export function getActiveTextColor(editor: Editor | null) {
  return (editor?.getAttributes('textStyle') as { color?: string })?.color ?? '';
}

export function getActiveHighlightColor(editor: Editor | null) {
  return (editor?.getAttributes('highlight') as { color?: string })?.color ?? '';
}

export function getCodeBlockLanguage(editor: Editor | null) {
  return (editor?.getAttributes('codeBlock') as { language?: string })?.language ?? 'plaintext';
}

export function buildHistoryActions(editor: Editor | null): ToolbarActionConfig[] {
  return [
    {
      key: 'undo',
      label: '실행 취소',
      icon: <Undo size={16} />,
      onClick: () => editor?.chain().focus().undo().run(),
      disabled: !editor
    },
    {
      key: 'redo',
      label: '다시 실행',
      icon: <Redo size={16} />,
      onClick: () => editor?.chain().focus().redo().run(),
      disabled: !editor
    }
  ];
}

export function buildFormattingActions(editor: Editor | null): ToolbarActionConfig[] {
  return [
    {
      key: 'bold',
      label: '굵게',
      icon: <Bold size={16} />,
      onClick: () => editor?.chain().focus().toggleBold().run(),
      active: editor?.isActive('bold'),
      disabled: !editor
    },
    {
      key: 'italic',
      label: '기울임',
      icon: <Italic size={16} />,
      onClick: () => editor?.chain().focus().toggleItalic().run(),
      active: editor?.isActive('italic'),
      disabled: !editor
    },
    {
      key: 'underline',
      label: '밑줄',
      icon: <Underline size={16} />,
      onClick: () => editor?.chain().focus().toggleUnderline().run(),
      active: editor?.isActive('underline'),
      disabled: !editor
    },
    {
      key: 'strike',
      label: '취소선',
      icon: <Strikethrough size={16} />,
      onClick: () => editor?.chain().focus().toggleStrike().run(),
      active: editor?.isActive('strike'),
      disabled: !editor
    },
    {
      key: 'inline-code',
      label: '인라인 코드',
      icon: <Code size={16} />,
      onClick: () => editor?.chain().focus().toggleCode().run(),
      active: editor?.isActive('code'),
      disabled: !editor
    }
  ];
}

export function buildAlignmentActions(editor: Editor | null): ToolbarActionConfig[] {
  return [
    {
      key: 'align-left',
      label: '왼쪽',
      icon: <AlignLeft size={16} />,
      onClick: () => editor?.chain().focus().setTextAlign('left').run(),
      active: editor?.isActive({ textAlign: 'left' }),
      disabled: !editor
    },
    {
      key: 'align-center',
      label: '가운데',
      icon: <AlignCenter size={16} />,
      onClick: () => editor?.chain().focus().setTextAlign('center').run(),
      active: editor?.isActive({ textAlign: 'center' }),
      disabled: !editor
    },
    {
      key: 'align-right',
      label: '오른쪽',
      icon: <AlignRight size={16} />,
      onClick: () => editor?.chain().focus().setTextAlign('right').run(),
      active: editor?.isActive({ textAlign: 'right' }),
      disabled: !editor
    },
    {
      key: 'align-justify',
      label: '양쪽',
      icon: <AlignJustify size={16} />,
      onClick: () => editor?.chain().focus().setTextAlign('justify').run(),
      active: editor?.isActive({ textAlign: 'justify' }),
      disabled: !editor
    }
  ];
}

export function buildListActions(editor: Editor | null): ToolbarActionConfig[] {
  return [
    {
      key: 'bullet-list',
      label: '글머리',
      icon: <List size={16} />,
      onClick: () => editor?.chain().focus().toggleBulletList().run(),
      active: editor?.isActive('bulletList'),
      disabled: !editor
    },
    {
      key: 'ordered-list',
      label: '번호',
      icon: <ListOrdered size={16} />,
      onClick: () => editor?.chain().focus().toggleOrderedList().run(),
      active: editor?.isActive('orderedList'),
      disabled: !editor
    },
    {
      key: 'blockquote',
      label: '인용구',
      icon: <Quote size={16} />,
      onClick: () => editor?.chain().focus().toggleBlockquote().run(),
      active: editor?.isActive('blockquote'),
      disabled: !editor
    }
  ];
}

export function buildInsertActions({
  editor,
  onLink,
  onToolbarImageUpload,
  onInsertImageUrl,
  uploadingImage
}: InsertActionOptions): ToolbarActionConfig[] {
  return [
    {
      key: 'code-block',
      label: '코드 블록',
      icon: <Code2 size={16} />,
      onClick: () => editor?.chain().focus().toggleCodeBlock().run(),
      active: editor?.isActive('codeBlock'),
      disabled: !editor
    },
    {
      key: 'divider',
      label: '구분선',
      icon: <Minus size={16} />,
      onClick: () => editor?.chain().focus().setHorizontalRule().run(),
      disabled: !editor
    },
    {
      key: 'table',
      label: '표',
      icon: <TableIcon size={16} />,
      onClick: () =>
        editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
      disabled: !editor
    },
    {
      key: 'link',
      label: '링크',
      icon: <Link2 size={16} />,
      onClick: onLink,
      active: editor?.isActive('link'),
      disabled: !editor
    },
    {
      key: 'image-upload',
      label: '이미지 업로드',
      icon: <ImageUp size={16} />,
      onClick: onToolbarImageUpload,
      disabled: !editor || uploadingImage,
      className: uploadingImage ? 'animate-pulse' : ''
    },
    {
      key: 'image-url',
      label: '이미지 URL',
      icon: <ImageIcon size={14} />,
      onClick: onInsertImageUrl,
      disabled: !editor,
      children: <span className="ml-0.5 text-[10px]">URL</span>
    }
  ];
}
