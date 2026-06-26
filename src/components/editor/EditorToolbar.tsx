import type { Editor } from '@tiptap/react';
import { Highlighter, Palette } from 'lucide-react';
import {
  CODE_LANGUAGES,
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

function ToolbarDivider() {
  return <div className="mx-0.5 h-4 w-px bg-[var(--border)]" />;
}

function ToolbarActionGroup({ actions }: { actions: ToolbarActionConfig[] }) {
  return (
    <div className="flex items-center gap-0.5">
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
    </div>
  );
}

export function EditorToolbar({
  editor,
  onLink,
  onToolbarImageUpload,
  onInsertImageUrl,
  uploadingImage
}: EditorToolbarProps) {
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

  return (
    <div className="border-b border-[color:var(--border)] bg-white/95 py-0.5 backdrop-blur">
      <div className="mx-auto flex max-w-[1500px] flex-wrap items-center gap-0.5 px-0">
        <ToolbarActionGroup actions={historyActions} />
        <ToolbarDivider />

        <div className="flex items-center gap-1">
          <ToolbarDropdown
            label="본문"
            value={headingValue}
            width="w-24"
            options={[
              { value: 'paragraph', label: '본문' },
              { value: 'h1', label: '제목 1' },
              { value: 'h2', label: '제목 2' },
              { value: 'h3', label: '제목 3' }
            ]}
            onSelect={value => {
              if (!editor) return;
              if (value === 'paragraph') {
                editor.chain().focus().setParagraph().run();
                return;
              }

              editor
                .chain()
                .focus()
                .toggleHeading({ level: Number(value.replace('h', '')) as 1 | 2 | 3 })
                .run();
            }}
            disabled={!editor}
          />

          <ToolbarDropdown
            label="크기"
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
        </div>

        <ToolbarDivider />

        <div className="flex items-center gap-0.5">
          <ToolbarActionGroup actions={formattingActions} />
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
            clearLabel="형광펜 제거"
            onSelect={color => editor?.chain().focus().toggleHighlight({ color }).run()}
            onClear={() => editor?.chain().focus().unsetHighlight().run()}
          />
        </div>

        <ToolbarDivider />
        <ToolbarActionGroup actions={alignmentActions} />
        <ToolbarDivider />
        <ToolbarActionGroup actions={listActions} />
        <ToolbarDivider />
        <ToolbarActionGroup actions={insertActions} />
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
