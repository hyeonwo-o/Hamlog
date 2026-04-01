import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';

interface PostInspectorSectionProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  collapsible?: boolean;
  defaultOpen?: boolean;
}

const PostInspectorSection: React.FC<PostInspectorSectionProps> = ({
  title,
  description,
  action,
  children,
  collapsible = false,
  defaultOpen = true
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <section className="rounded-xl border border-[color:var(--border)] bg-[var(--surface)] p-4 shadow-[0_18px_40px_-28px_rgba(9,42,36,0.45)]">
      {collapsible ? (
        <button
          type="button"
          onClick={() => setIsOpen(open => !open)}
          className="flex w-full items-start justify-between gap-3 text-left"
          aria-expanded={isOpen}
        >
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-[var(--text)]">{title}</h3>
            {isOpen && description && (
              <p className="text-[11px] leading-5 text-[var(--text-muted)]">{description}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {action}
            <ChevronDown
              className={`h-4 w-4 text-[var(--text-muted)] transition-transform ${isOpen ? 'rotate-180' : ''}`}
            />
          </div>
        </button>
      ) : (
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-[var(--text)]">{title}</h3>
            {description && (
              <p className="text-[11px] leading-5 text-[var(--text-muted)]">{description}</p>
            )}
          </div>
          {action}
        </div>
      )}
      {(!collapsible || isOpen) && (
        <div className={collapsible ? 'mt-4' : undefined}>
          {children}
        </div>
      )}
    </section>
  );
};

export default PostInspectorSection;
