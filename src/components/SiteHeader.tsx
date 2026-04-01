import { Link } from 'react-router-dom';
import type { SiteMeta } from '../types/blog';

interface SiteHeaderProps {
  profile: SiteMeta;
  eyebrow?: string;
  contextTitle?: string;
}

export const SiteHeader = ({ profile, eyebrow = 'Article', contextTitle }: SiteHeaderProps) => {
  const subline = [profile.name, profile.role].filter(Boolean).join(' · ');

  return (
    <header className="border-b border-[color:var(--border)] bg-[var(--surface)]/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <Link
            to="/"
            className="font-display text-lg font-semibold text-[var(--text)] transition-colors hover:text-[var(--accent-strong)]"
          >
            {profile.title}
          </Link>
          {subline && (
            <p className="mt-1 text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">
              {subline}
            </p>
          )}
        </div>

        <div className="min-w-0 text-left sm:text-right">
          <p className="text-[11px] uppercase tracking-[0.28em] text-[var(--text-muted)]">
            {eyebrow}
          </p>
          {contextTitle && (
            <p className="mt-1 truncate text-sm font-medium text-[var(--text)]">
              {contextTitle}
            </p>
          )}
        </div>
      </div>
    </header>
  );
};
