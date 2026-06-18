import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import { Ban } from 'lucide-react';
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

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={containerRef}>
      <ToolbarButton
        label={label}
        onClick={() => !disabled && setIsOpen(prev => !prev)}
        active={active}
        disabled={disabled}
        icon={buttonIcon}
        className={buttonClassName}
      >
        {indicatorColor && (
          <div
            className="absolute bottom-1 right-1 h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: indicatorColor }}
          />
        )}
      </ToolbarButton>

      {isOpen && (
        <div className="absolute left-0 top-full z-20 mt-1 w-44 rounded-xl border border-[color:var(--border)] bg-[var(--surface)] p-2">
          <div className="grid grid-cols-5 gap-1">
            {colors.map(color => (
              <button
                key={color}
                type="button"
                onClick={() => {
                  onSelect(color);
                  setIsOpen(false);
                }}
                className="h-6 w-6 rounded-full border border-[color:var(--border)] transition-transform hover:scale-110"
                style={{ backgroundColor: color }}
                title={color}
              />
            ))}
            <button
              type="button"
              onClick={() => {
                onClear();
                setIsOpen(false);
              }}
              className="flex h-6 w-6 items-center justify-center rounded-full border border-[color:var(--border)] bg-gray-100 text-gray-500 hover:bg-gray-200"
              title={clearLabel}
            >
              <Ban size={12} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
