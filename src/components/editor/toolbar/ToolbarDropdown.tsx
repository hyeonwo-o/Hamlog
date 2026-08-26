import type { KeyboardEvent } from 'react';
import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown } from 'lucide-react';
import { useFloatingToolbarMenu } from '../../../hooks/useFloatingToolbarMenu';
import { EDITOR_CLOSE_OVERLAYS_EVENT } from '../../../utils/editorOverlays';

interface ToolbarDropdownOption {
  value: string;
  label: string;
}

interface ToolbarDropdownProps {
  label: string;
  value: string;
  options: ToolbarDropdownOption[];
  onSelect: (value: string) => void;
  width?: string;
  disabled?: boolean;
}

export function ToolbarDropdown({
  label,
  value,
  options,
  onSelect,
  width = 'w-32',
  disabled
}: ToolbarDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const menuId = useId();
  const menuPosition = useFloatingToolbarMenu(isOpen, triggerRef, menuRef);

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
      triggerRef.current?.focus();
    };
    window.addEventListener(EDITOR_CLOSE_OVERLAYS_EVENT, closeMenu);
    return () => window.removeEventListener(EDITOR_CLOSE_OVERLAYS_EVENT, closeMenu);
  }, [isOpen]);

  const currentLabel = options.find(option => option.value === value)?.label || label;
  useEffect(() => {
    if (!isOpen) return;
    const selectedIndex = Math.max(0, options.findIndex(option => option.value === value));
    window.requestAnimationFrame(() => optionRefs.current[selectedIndex]?.focus());
  }, [isOpen, options, value]);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      setIsOpen(false);
      window.requestAnimationFrame(() => triggerRef.current?.focus());
      return;
    }

    if (!isOpen && ['ArrowDown', 'ArrowUp'].includes(event.key)) {
      event.preventDefault();
      setIsOpen(true);
      return;
    }

    if (!isOpen || !['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const currentIndex = optionRefs.current.findIndex(option => option === document.activeElement);
    const lastIndex = options.length - 1;
    const nextIndex = event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? lastIndex
        : event.key === 'ArrowUp'
          ? (currentIndex <= 0 ? lastIndex : currentIndex - 1)
          : (currentIndex >= lastIndex ? 0 : currentIndex + 1);
    optionRefs.current[nextIndex]?.focus();
  };

  const closeAndSelect = (nextValue: string) => {
    onSelect(nextValue);
    setIsOpen(false);
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  };

  useEffect(() => {
    if (disabled && isOpen) {
      setIsOpen(false);
    }
  }, [disabled, isOpen]);

  return (
    <div className="relative" ref={containerRef} onKeyDown={handleKeyDown}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => !disabled && setIsOpen(prev => !prev)}
        disabled={disabled}
        aria-label={`${label}: ${currentLabel}`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={isOpen ? menuId : undefined}
        className={`flex h-7 items-center justify-between gap-1.5 border border-transparent bg-white px-1.5 text-[11px] font-medium text-[var(--text)] transition-colors hover:border-[color:var(--border)] disabled:opacity-50 ${width}`}
      >
        <span className="truncate">{currentLabel}</span>
        <ChevronDown size={14} className="opacity-50" />
      </button>

      {isOpen && typeof document !== 'undefined' && createPortal(
        <div
          ref={menuRef}
          id={menuId}
          className="fixed z-[70] max-h-60 overflow-y-auto border border-[color:var(--border)] bg-white p-1 shadow-lg ring-1 ring-black/5"
          role="listbox"
          aria-label={label}
          style={{
            left: menuPosition?.left ?? -9999,
            top: menuPosition?.top ?? -9999,
            minWidth: Math.max(140, menuPosition?.triggerWidth ?? 0),
            visibility: menuPosition ? 'visible' : 'hidden'
          }}
        >
          {options.map((option, index) => (
            <button
              ref={element => {
                optionRefs.current[index] = element;
              }}
              key={option.value}
              type="button"
              role="option"
              aria-selected={value === option.value}
              onClick={() => closeAndSelect(option.value)}
              className={`flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-xs transition-colors hover:bg-[var(--surface-muted)] ${
                value === option.value
                  ? 'bg-[var(--accent-soft)] font-semibold text-[var(--accent-strong)]'
                  : 'text-[var(--text)]'
              }`}
            >
              {option.label}
              {value === option.value && <Check size={12} />}
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
}
