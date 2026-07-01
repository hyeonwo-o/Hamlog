import type { ReactNode } from 'react';

interface ToolbarButtonProps {
  label: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  icon?: ReactNode;
  children?: ReactNode;
  className?: string;
}

export function ToolbarButton({
  label,
  onClick,
  active,
  disabled,
  icon,
  children,
  className
}: ToolbarButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      aria-pressed={active === undefined ? undefined : active}
      className={`relative inline-flex h-7 w-7 shrink-0 items-center justify-center border p-1 transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
        active
          ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-strong)]'
          : 'border-transparent text-[var(--text-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--text)]'
      } ${className || ''}`}
    >
      {icon}
      {children}
    </button>
  );
}
