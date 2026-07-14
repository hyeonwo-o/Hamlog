import type { KeyboardEvent } from 'react';
import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';

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
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
      triggerRef.current?.focus();
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
    triggerRef.current?.focus();
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
        className={`flex h-7 items-center justify-between gap-1.5 border border-transparent bg-white px-1.5 text-[11px] font-medium text-[var(--text)] transition-colors hover:border-[color:var(--border)] disabled:opacity-50 ${width}`}
      >
        <span className="truncate">{currentLabel}</span>
        <ChevronDown size={14} className="opacity-50" />
      </button>

      {isOpen && (
        <div
          className="absolute left-0 top-full z-40 mt-1 max-h-60 w-full min-w-[140px] overflow-y-auto border border-[color:var(--border)] bg-white p-1 ring-1 ring-black/5"
          role="listbox"
          aria-label={label}
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
        </div>
      )}
    </div>
  );
}
