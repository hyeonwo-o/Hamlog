import {
    forwardRef,
    useEffect,
    useImperativeHandle,
    useState,
} from 'react';
import type { SlashCommandItem } from '../../editor/slashCommands/types';

export interface SlashCommandListProps {
    items: SlashCommandItem[];
    command: (item: SlashCommandItem) => void;
}

export interface SlashCommandListHandle {
    onKeyDown: ({ event }: { event: KeyboardEvent }) => boolean;
}

export const SlashCommandList = forwardRef<SlashCommandListHandle, SlashCommandListProps>((props, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0);

    const selectItem = (index: number) => {
        const item = props.items[index];
        if (item) {
            props.command(item);
        }
    };

    const upHandler = () => {
        if (props.items.length === 0) return;
        setSelectedIndex(prev => (prev + props.items.length - 1) % props.items.length);
    };

    const downHandler = () => {
        if (props.items.length === 0) return;
        setSelectedIndex(prev => (prev + 1) % props.items.length);
    };

    const enterHandler = () => {
        if (props.items.length === 0) return;
        selectItem(selectedIndex);
    };

    useEffect(() => {
        setSelectedIndex(0);
    }, [props.items]);

    useImperativeHandle(ref, () => ({
        onKeyDown: ({ event }: { event: KeyboardEvent }) => {
            if (event.key === 'ArrowUp') {
                upHandler();
                return true;
            }

            if (event.key === 'ArrowDown') {
                downHandler();
                return true;
            }

            if (event.key === 'Enter') {
                enterHandler();
                return true;
            }

            return false;
        },
    }));

    return (
        <div className="z-50 min-w-[300px] overflow-hidden rounded-lg bg-[var(--surface)] p-1 border border-[color:var(--border)] text-[var(--text)]">
            {props.items.length ? (
                props.items.map((item, index) => (
                    <button
                        type="button"
                        className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm text-left ${index === selectedIndex ? 'bg-[var(--surface-muted)] text-[var(--accent)]' : ''
                            }`}
                        key={index}
                        onClick={() => selectItem(index)}
                    >
                        {item.element || (
                            <>
                                {item.icon && <div className="flex h-5 w-5 items-center justify-center rounded border border-[color:var(--border)] bg-[var(--bg)]">{item.icon}</div>}
                                <div className="flex flex-col">
                                    <span className="font-medium">{item.title}</span>
                                    {item.description && <span className="text-[10px] text-[var(--text-muted)]">{item.description}</span>}
                                </div>
                            </>
                        )}
                    </button>
                ))
            ) : (
                <div className="px-2 py-1 text-sm text-[var(--text-muted)]">결과 없음</div>
            )}
        </div>
    );
});

SlashCommandList.displayName = 'SlashCommandList';
