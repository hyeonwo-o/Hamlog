import type { ReactNode } from 'react';

interface SectionCardProps {
  eyebrow: string;
  title: string;
  description?: string;
  className?: string;
  children: ReactNode;
}

interface FieldProps {
  label: string;
  hint?: string;
  className?: string;
  children: ReactNode;
}

export const inputClassName =
  'mt-2 w-full rounded-lg border border-[color:var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-sm text-[var(--text)] outline-none transition focus:border-[color:var(--accent)] focus:ring-2 focus:ring-[color:var(--accent)]/20';

export const textareaClassName = `${inputClassName} resize-y`;

export const SectionCard = ({
  eyebrow,
  title,
  description,
  className = '',
  children
}: SectionCardProps) => (
  <section
    className={`rounded-xl border border-[color:var(--border)] bg-[var(--surface)] p-6 ${className}`}
  >
    <div className="mb-5 space-y-2">
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--text-muted)]">
        {eyebrow}
      </p>
      <div>
        <h3 className="font-display text-xl font-semibold text-[var(--text)]">{title}</h3>
        {description && <p className="mt-1 text-sm text-[var(--text-muted)]">{description}</p>}
      </div>
    </div>
    {children}
  </section>
);

export const Field = ({ label, hint, className = '', children }: FieldProps) => (
  <label className={`block text-xs uppercase tracking-[0.18em] text-[var(--text-muted)] ${className}`}>
    <span>{label}</span>
    {hint && <span className="mt-1 block text-[11px] normal-case tracking-normal">{hint}</span>}
    {children}
  </label>
);
