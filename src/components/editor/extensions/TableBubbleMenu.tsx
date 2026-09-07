import React, { useCallback } from 'react';
import { BubbleMenu } from '@tiptap/react/menus';
import type { Editor } from '@tiptap/react';
import {
    ArrowUp, ArrowDown, ArrowLeft, ArrowRight,
    Trash2, Merge, Split, PanelTop, X
} from 'lucide-react';

interface TableBubbleMenuProps {
    editor: Editor | null;
    enabled?: boolean;
}

const menuOptions = { placement: 'top' as const, offset: 8 };

const MenuButton = ({
    onClick,
    icon,
    label,
    active = false,
    disabled = false,
    danger = false
}: {
    onClick: () => void;
    icon: React.ReactNode;
    label: string;
    active?: boolean;
    disabled?: boolean;
    danger?: boolean;
}) => (
    <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        title={label}
        className={`inline-flex items-center justify-center rounded-lg border p-1.5 transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${active
                ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-strong)]'
                : danger
                    ? 'border-transparent text-red-500 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-400/10 hover:text-red-600 dark:hover:text-red-300'
                    : 'border-transparent text-[var(--text-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--text)]'
            }`}
    >
        {icon}
    </button>
);

export const TableBubbleMenu: React.FC<TableBubbleMenuProps> = ({ editor, enabled = true }) => {
    const shouldShow = useCallback<NonNullable<React.ComponentProps<typeof BubbleMenu>['shouldShow']>>(
        ({ editor }) => enabled && editor.isActive('table'),
        [enabled]
    );
    if (!editor) return null;

    return (
        <BubbleMenu
            editor={editor}
            pluginKey="tableBubbleMenu"
            options={menuOptions}
            style={{ maxWidth: 600, zIndex: 50 }}
            shouldShow={shouldShow}
            className="flex flex-wrap items-center gap-1 rounded-xl border border-[color:var(--border)] bg-[var(--surface)] p-1.5 animate-in fade-in zoom-in-95 duration-200"
        >
            {/* Row Operations */}
            <div className="flex items-center gap-0.5">
                <MenuButton
                    onClick={() => editor.chain().focus().addRowBefore().run()}
                    icon={<ArrowUp size={16} />}
                    label="위에 행 추가"
                />
                <MenuButton
                    onClick={() => editor.chain().focus().addRowAfter().run()}
                    icon={<ArrowDown size={16} />}
                    label="아래에 행 추가"
                />
                <MenuButton
                    onClick={() => editor.chain().focus().deleteRow().run()}
                    icon={<Trash2 size={16} />}
                    label="행 삭제"
                    danger
                />
            </div>

            <div className="mx-1 h-4 w-px bg-[var(--border)]" />

            {/* Column Operations */}
            <div className="flex items-center gap-0.5">
                <MenuButton
                    onClick={() => editor.chain().focus().addColumnBefore().run()}
                    icon={<ArrowLeft size={16} />}
                    label="왼쪽에 열 추가"
                />
                <MenuButton
                    onClick={() => editor.chain().focus().addColumnAfter().run()}
                    icon={<ArrowRight size={16} />}
                    label="오른쪽에 열 추가"
                />
                <MenuButton
                    onClick={() => editor.chain().focus().deleteColumn().run()}
                    icon={<Trash2 size={16} />}
                    label="열 삭제"
                    danger
                />
            </div>

            <div className="mx-1 h-4 w-px bg-[var(--border)]" />

            {/* Cell Operations */}
            <div className="flex items-center gap-0.5">
                <MenuButton
                    onClick={() => editor.chain().focus().mergeCells().run()}
                    icon={<Merge size={16} />}
                    label="셀 병합"
                    disabled={!editor.can().mergeCells()}
                />
                <MenuButton
                    onClick={() => editor.chain().focus().splitCell().run()}
                    icon={<Split size={16} />}
                    label="셀 분할"
                    disabled={!editor.can().splitCell()}
                />
                <MenuButton
                    onClick={() => editor.chain().focus().toggleHeaderCell().run()}
                    icon={<PanelTop size={16} />}
                    label="헤더 토글"
                />
            </div>

            <div className="mx-1 h-4 w-px bg-[var(--border)]" />

            {/* Table Operations */}
            <div className="flex items-center gap-0.5">
                <MenuButton
                    onClick={() => editor.chain().focus().deleteTable().run()}
                    icon={<X size={16} />}
                    label="표 삭제"
                    danger
                />
            </div>
        </BubbleMenu>
    );
};
