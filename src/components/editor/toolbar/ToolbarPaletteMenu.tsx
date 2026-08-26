import type { KeyboardEvent, ReactNode } from 'react';
import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Ban } from 'lucide-react';
import { useFloatingToolbarMenu } from '../../../hooks/useFloatingToolbarMenu';
import { EDITOR_CLOSE_OVERLAYS_EVENT } from '../../../utils/editorOverlays';
import { ToolbarButton } from './ToolbarButton';

interface ToolbarPaletteMenuProps {
  label: string;
  colors: string[];
  active: boolean;
  disabled?: boolean;
  buttonClassName?: string;
  buttonIcon: ReactNode;
  indicatorColor?: string;
  clearLabel: string;
  onSelect: (color: string) => void;
  onClear: () => void;
}

const PALETTE_COLUMN_COUNT = 5;

const movePaletteFocusByRow = (
  currentIndex: number,
  itemCount: number,
  direction: -1 | 1
) => {
  if (currentIndex < 0) return 0;
  const rowCount = Math.ceil(itemCount / PALETTE_COLUMN_COUNT);
  const currentRow = Math.floor(currentIndex / PALETTE_COLUMN_COUNT);
  const currentColumn = currentIndex % PALETTE_COLUMN_COUNT;

  for (let offset = 1; offset <= rowCount; offset += 1) {
    const nextRow = (
      currentRow + (direction * offset) + rowCount
    ) % rowCount;
    const nextIndex = (nextRow * PALETTE_COLUMN_COUNT) + currentColumn;
    if (nextIndex < itemCount) return nextIndex;
  }

  return currentIndex;
};

export function ToolbarPaletteMenu({
  label,
  colors,
  active,
  disabled,
  buttonClassName,
  buttonIcon,
  indicatorColor,
  clearLabel,
  onSelect,
  onClear
}: ToolbarPaletteMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuItemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const menuId = useId();
  const menuPosition = useFloatingToolbarMenu(isOpen, containerRef, menuRef);

  const focusTrigger = () => {
    containerRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
  };

  const closeAndRestoreFocus = () => {
    setIsOpen(false);
    window.requestAnimationFrame(focusTrigger);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        containerRef.current
        && !containerRef.current.contains(target)
        && !menuRef.current?.contains(target)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const closeMenu = () => {
      setIsOpen(false);
      containerRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
    };
    window.addEventListener(EDITOR_CLOSE_OVERLAYS_EVENT, closeMenu);
    return () => window.removeEventListener(EDITOR_CLOSE_OVERLAYS_EVENT, closeMenu);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const activeIndex = indicatorColor
      ? colors.findIndex(color => color.toLowerCase() === indicatorColor.toLowerCase())
      : -1;
    const animationFrame = window.requestAnimationFrame(() => {
      menuItemRefs.current[Math.max(0, activeIndex)]?.focus();
    });
    return () => window.cancelAnimationFrame(animationFrame);
  }, [colors, indicatorColor, isOpen]);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeAndRestoreFocus();
      return;
    }

    if (!isOpen || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) {
      return;
    }

    event.preventDefault();
    const itemCount = colors.length + 1;
    const currentIndex = menuItemRefs.current.findIndex(item => item === document.activeElement);
    const lastIndex = itemCount - 1;
    const nextIndex = event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? lastIndex
        : event.key === 'ArrowLeft'
          ? (currentIndex <= 0 ? lastIndex : currentIndex - 1)
          : event.key === 'ArrowRight'
            ? (currentIndex < 0 || currentIndex >= lastIndex ? 0 : currentIndex + 1)
            : event.key === 'ArrowUp'
              ? movePaletteFocusByRow(currentIndex, itemCount, -1)
              : movePaletteFocusByRow(currentIndex, itemCount, 1);
    menuItemRefs.current[nextIndex]?.focus();
  };

  return (
    <div className="relative" ref={containerRef} onKeyDown={handleKeyDown}>
      <ToolbarButton
        label={label}
        onClick={() => !disabled && setIsOpen(prev => !prev)}
        active={active}
        disabled={disabled}
        icon={buttonIcon}
        className={buttonClassName}
        ariaControls={isOpen ? menuId : undefined}
        ariaExpanded={isOpen}
        ariaHasPopup="menu"
      >
        {indicatorColor && (
          <div
            className="absolute bottom-1 right-1 h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: indicatorColor }}
          />
        )}
      </ToolbarButton>

      {isOpen && typeof document !== 'undefined' && createPortal(
        <div
          ref={menuRef}
          id={menuId}
          className="fixed z-[70] w-44 rounded-xl border border-[color:var(--border)] bg-[var(--surface)] p-2 shadow-lg"
          role="menu"
          aria-label={label}
          style={{
            left: menuPosition?.left ?? -9999,
            top: menuPosition?.top ?? -9999,
            visibility: menuPosition ? 'visible' : 'hidden'
          }}
        >
          <div className="grid grid-cols-5 gap-1">
            {colors.map((color, index) => (
              <button
                ref={element => {
                  menuItemRefs.current[index] = element;
                }}
                key={color}
                type="button"
                role="menuitem"
                onClick={() => {
                  onSelect(color);
                  closeAndRestoreFocus();
                }}
                className="h-6 w-6 rounded-full border border-[color:var(--border)] transition-transform hover:scale-110"
                style={{ backgroundColor: color }}
                title={color}
                aria-label={`${label} ${color}`}
              />
            ))}
            <button
              ref={element => {
                menuItemRefs.current[colors.length] = element;
              }}
              type="button"
              role="menuitem"
              onClick={() => {
                onClear();
                closeAndRestoreFocus();
              }}
              className="flex h-6 w-6 items-center justify-center rounded-full border border-[color:var(--border)] bg-gray-100 text-gray-500 hover:bg-gray-200"
              title={clearLabel}
              aria-label={clearLabel}
            >
              <Ban size={12} />
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
