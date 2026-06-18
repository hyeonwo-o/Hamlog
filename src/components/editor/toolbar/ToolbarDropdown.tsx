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

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(prev => !prev)}
        disabled={disabled}
        className={`flex h-7 items-center justify-between gap-1.5 border border-transparent bg-white px-1.5 text-[11px] font-medium text-[var(--text)] transition-colors hover:border-[color:var(--border)] disabled:opacity-50 ${width}`}
      >
        <span className="truncate">{currentLabel}</span>
        <ChevronDown size={14} className="opacity-50" />
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full z-30 mt-1 max-h-60 min-w-[140px] w-full overflow-y-auto border border-[color:var(--border)] bg-white p-1 ring-1 ring-black/5">
          {options.map(option => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onSelect(option.value);
                setIsOpen(false);
              }}
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
