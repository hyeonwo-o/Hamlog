import React, { useCallback } from 'react';
import { BubbleMenu } from '@tiptap/react/menus';
import type { Editor } from '@tiptap/react';
import { NodeSelection } from '@tiptap/pm/state';
import {
    Columns, Ungroup, LayoutTemplate, ArrowLeft, ArrowRight
} from 'lucide-react';

interface ColumnBubbleMenuProps {
    editor: Editor | null;
    enabled?: boolean;
}

const menuOptions = { placement: 'top' as const, offset: 8 };

const MenuButton = ({
    onClick,
    icon,
    label,
    active = false,
    danger = false,
    disabled = false
}: {
    onClick: () => void;
    icon: React.ReactNode;
    label: string;
    active?: boolean;
    danger?: boolean;
    disabled?: boolean;
}) => (
    <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        title={label}
        className={`inline-flex items-center justify-center rounded-lg border p-1.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${active
            ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-strong)]'
            : danger
                ? 'border-transparent text-red-500 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-400/10 hover:text-red-600 dark:hover:text-red-300'
                : 'border-transparent text-[var(--text-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--text)]'
            }`}
    >
        {icon}
    </button>
);

export const ColumnBubbleMenu: React.FC<ColumnBubbleMenuProps> = ({ editor, enabled = true }) => {
    // v3 dispatches a transaction when menu options change; keep props stable
    // so transaction-driven React renders do not trigger an update loop.
    const shouldShow = useCallback<NonNullable<React.ComponentProps<typeof BubbleMenu>['shouldShow']>>(
        ({ editor, state }) => enabled
            && editor.isActive('columns')
            && !(state.selection instanceof NodeSelection && state.selection.node.type.name === 'image'),
        [enabled]
    );
    if (!editor) return null;

    // Check current layout to highlight active button
    const isTwoColumn = editor.isActive('columns', { layout: 'two-column' });
    const isThreeColumn = editor.isActive('columns', { layout: 'three-column' });

    return (
        <BubbleMenu
            editor={editor}
            pluginKey="columnBubbleMenu"
            options={menuOptions}
            style={{ maxWidth: 400, zIndex: 50 }}
            shouldShow={shouldShow}
            className="flex flex-wrap items-center gap-1 rounded-xl border border-[color:var(--border)] bg-[var(--surface)] p-1.5 animate-in fade-in zoom-in-95 duration-200"
        >
            <div className="flex items-center gap-0.5">
                <MenuButton
                    onClick={() => editor.chain().focus().setColumnsLayout('two-column').run()}
                    icon={<Columns size={16} />}
                    label="2단 레이아웃"
                    active={isTwoColumn}
                />
                <MenuButton
                    onClick={() => editor.chain().focus().setColumnsLayout('three-column').run()}
                    icon={<LayoutTemplate size={16} />}
                    label="3단 레이아웃"
                    active={isThreeColumn}
                />

                <div className="mx-1 h-4 w-px bg-[var(--border)]" />

                <MenuButton
                    onClick={() => editor.chain().focus().moveColumnLeft().run()}
                    icon={<ArrowLeft size={16} />}
                    label="왼쪽으로 이동"
                    disabled={!editor.can().moveColumnLeft()}
                />
                <MenuButton
                    onClick={() => editor.chain().focus().moveColumnRight().run()}
                    icon={<ArrowRight size={16} />}
                    label="오른쪽으로 이동"
                    disabled={!editor.can().moveColumnRight()}
                />

                <div className="mx-1 h-4 w-px bg-[var(--border)]" />

                <MenuButton
                    onClick={() => editor.chain().focus().unsetColumns().run()}
                    icon={<Ungroup size={16} />}
                    label="레이아웃 해제"
                />
            </div>
        </BubbleMenu>
    );
};
