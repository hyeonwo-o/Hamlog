import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Editor } from '@tiptap/react';
import { ChevronLeft, ChevronRight, Highlighter, Palette } from 'lucide-react';
import {
  CODE_LANGUAGES,
  HEADING_OPTIONS,
  FONT_SIZES,
  HIGHLIGHT_COLORS,
  TEXT_COLORS
} from '../../utils/editorConstants';
import { CodeLanguageSelector } from './toolbar/CodeLanguageSelector';
import { ToolbarButton } from './toolbar/ToolbarButton';
import { ToolbarDropdown } from './toolbar/ToolbarDropdown';
import { ToolbarPaletteMenu } from './toolbar/ToolbarPaletteMenu';
import {
  buildAlignmentActions,
  buildFormattingActions,
  buildHistoryActions,
  buildInsertActions,
  buildListActions,
  getActiveHighlightColor,
  getActiveTextColor,
  getCodeBlockLanguage,
  getFontSizeValue,
  getHeadingValue,
  type ToolbarActionConfig
} from './toolbar/toolbarActions';

interface EditorToolbarProps {
  editor: Editor | null;
  onLink: () => void;
  onToolbarImageUpload: () => void;
  onInsertImageUrl: () => void;
  uploadingImage: boolean;
}

const toolbarGroupClass = 'flex shrink-0 items-center gap-0.5 border border-[color:var(--border)] bg-white/80 px-1 py-0.5';
const articleHeadingOptions = HEADING_OPTIONS.filter(option => option.value !== 'h1');

function ToolbarGroup({
  children,
  label,
  className = ''
}: {
  children: ReactNode;
  label: string;
  className?: string;
}) {
  return (
    <div className={`${toolbarGroupClass} ${className}`} role="group" aria-label={label}>
      {children}
    </div>
  );
}

function ToolbarActionButtons({ actions }: { actions: ToolbarActionConfig[] }) {
  return (
    <>
      {actions.map(action => (
        <ToolbarButton
          key={action.key}
          label={action.label}
          onClick={action.onClick}
          active={action.active}
          disabled={action.disabled}
          icon={action.icon}
          className={action.className}
        >
          {action.children}
        </ToolbarButton>
      ))}
    </>
  );
}

export function EditorToolbar({
  editor,
  onLink,
  onToolbarImageUpload,
  onInsertImageUrl,
  uploadingImage
}: EditorToolbarProps) {
  const toolbarScrollRef = useRef<HTMLDivElement>(null);
  const [scrollHint, setScrollHint] = useState({ overflow: false, left: false, right: false });
  const headingValue = getHeadingValue(editor);
  const fontSizeValue = getFontSizeValue(editor);
  const activeColor = getActiveTextColor(editor);
  const activeHighlight = getActiveHighlightColor(editor);
  const codeBlockLanguage = getCodeBlockLanguage(editor);
  const isCodeBlockActive = editor?.isActive('codeBlock') ?? false;

  const historyActions = buildHistoryActions(editor);
  const formattingActions = buildFormattingActions(editor);
  const alignmentActions = buildAlignmentActions(editor);
  const listActions = buildListActions(editor);
  const insertActions = buildInsertActions({
    editor,
    onLink,
    onToolbarImageUpload,
    onInsertImageUrl,
    uploadingImage
  });

  useEffect(() => {
    const scrollElement = toolbarScrollRef.current;
    if (!scrollElement) return;

    const updateScrollHint = () => {
      const maxScrollLeft = scrollElement.scrollWidth - scrollElement.clientWidth;
      setScrollHint({
        overflow: maxScrollLeft > 2,
        left: scrollElement.scrollLeft > 2,
        right: maxScrollLeft - scrollElement.scrollLeft > 2
      });
    };

    updateScrollHint();
    scrollElement.addEventListener('scroll', updateScrollHint, { passive: true });
    window.addEventListener('resize', updateScrollHint);

    const resizeObserver = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(updateScrollHint)
      : null;
    resizeObserver?.observe(scrollElement);

    return () => {
      scrollElement.removeEventListener('scroll', updateScrollHint);
      window.removeEventListener('resize', updateScrollHint);
      resizeObserver?.disconnect();
    };
  }, []);

  const scrollToolbar = (direction: -1 | 1) => {
    const scrollElement = toolbarScrollRef.current;
    if (!scrollElement) return;
    scrollElement.scrollBy({
      left: direction * Math.max(180, scrollElement.clientWidth * 0.7),
      behavior: 'smooth'
    });
  };

  return (
    <div className="border-b border-[color:var(--border)] bg-white/95 py-0.5 backdrop-blur" role="toolbar" aria-label="글 편집 도구">
      <div className="flex min-w-0 items-center gap-0.5">
        {scrollHint.overflow && (
          <button
            type="button"
            onClick={() => {
              if (scrollHint.left) scrollToolbar(-1);
            }}
            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[color:var(--border)] bg-white text-[var(--text-muted)] transition hover:text-[var(--text)] ${
              scrollHint.left ? '' : 'cursor-default opacity-40'
            }`}
            aria-label="이전 편집 도구 보기"
            aria-disabled={!scrollHint.left}
          >
            <ChevronLeft size={15} />
          </button>
        )}
        <div
          ref={toolbarScrollRef}
          className="min-w-0 flex-1 overflow-x-auto overscroll-x-contain [scrollbar-width:thin]"
          data-testid="editor-toolbar-scroll"
        >
          <div className="mx-auto flex min-w-max max-w-[1500px] flex-nowrap items-center gap-1 px-0">
            <ToolbarGroup label="실행 기록">
              <ToolbarActionButtons actions={historyActions} />
            </ToolbarGroup>

            <ToolbarGroup label="문단 설정" className="gap-1">
              <ToolbarDropdown
                label="문단"
                value={headingValue}
                width="w-24"
                options={articleHeadingOptions}
                onSelect={value => {
                  if (!editor) return;
                  if (value === 'paragraph') {
                    editor.chain().focus().setParagraph().run();
                    return;
                  }

                  const level = Number(value.replace('h', ''));
                  if (level !== 2 && level !== 3) return;

                  editor
                    .chain()
                    .focus()
                    .toggleHeading({ level })
                    .run();
                }}
                disabled={!editor}
              />
              <ToolbarDropdown
                label="글자 크기"
                value={fontSizeValue}
                width="w-20"
                options={FONT_SIZES}
                onSelect={value => {
                  if (!editor) return;
                  if (value === 'default') {
                    editor.chain().focus().unsetFontSize().run();
                    return;
                  }
                  editor.chain().focus().setFontSize(value).run();
                }}
                disabled={!editor}
              />
            </ToolbarGroup>

            <ToolbarGroup label="텍스트 서식">
              <ToolbarActionButtons actions={formattingActions} />
              <ToolbarPaletteMenu
                label="글자색"
                colors={TEXT_COLORS}
                active={Boolean(activeColor)}
                disabled={!editor}
                buttonIcon={<Palette size={16} />}
                buttonClassName={activeColor ? 'text-[var(--accent-strong)]' : ''}
                indicatorColor={activeColor || undefined}
                clearLabel="색상 제거"
                onSelect={color => editor?.chain().focus().setColor(color).run()}
                onClear={() => editor?.chain().focus().unsetColor().run()}
              />
              <ToolbarPaletteMenu
                label="하이라이트"
                colors={HIGHLIGHT_COLORS}
                active={Boolean(activeHighlight)}
                disabled={!editor}
                buttonIcon={<Highlighter size={16} />}
                buttonClassName={activeHighlight ? 'bg-yellow-100 text-yellow-800' : ''}
                indicatorColor={activeHighlight || undefined}
                clearLabel="형광펜 제거"
                onSelect={color => editor?.chain().focus().toggleHighlight({ color }).run()}
                onClear={() => editor?.chain().focus().unsetHighlight().run()}
              />
            </ToolbarGroup>

            <ToolbarGroup label="정렬">
              <ToolbarActionButtons actions={alignmentActions} />
            </ToolbarGroup>
            <ToolbarGroup label="목록과 인용">
              <ToolbarActionButtons actions={listActions} />
            </ToolbarGroup>
            <ToolbarGroup label="삽입">
              <ToolbarActionButtons actions={insertActions} />
            </ToolbarGroup>
          </div>
        </div>
        {scrollHint.overflow && (
          <button
            type="button"
            onClick={() => {
              if (scrollHint.right) scrollToolbar(1);
            }}
            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[color:var(--border)] bg-white text-[var(--text-muted)] transition hover:text-[var(--text)] ${
              scrollHint.right ? '' : 'cursor-default opacity-40'
            }`}
            aria-label="다음 편집 도구 보기"
            aria-disabled={!scrollHint.right}
          >
            <ChevronRight size={15} />
          </button>
        )}
      </div>

      <CodeLanguageSelector
        active={isCodeBlockActive}
        currentLanguage={codeBlockLanguage}
        options={CODE_LANGUAGES}
        onSelect={language => editor?.chain().focus().setCodeBlock({ language }).run()}
      />
    </div>
  );
}
