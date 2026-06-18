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
      className={`inline-flex items-center justify-center border p-1.5 transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
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
