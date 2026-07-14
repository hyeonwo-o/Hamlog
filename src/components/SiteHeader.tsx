import { Link } from 'react-router-dom';
import type { SiteMeta } from '../types/blog';
import { PublicNavigation } from './PublicNavigation';

interface SiteHeaderProps {
  profile: SiteMeta;
  eyebrow?: string;
  contextTitle?: string;
  showContext?: boolean;
  wide?: boolean;
}

export const SiteHeader = ({
  profile,
  eyebrow = 'Article',
  contextTitle,
  showContext = true,
  wide = false
}: SiteHeaderProps) => {
  const subline = [profile.name, profile.role].filter(Boolean).join(' · ');

  return (
    <header className="border-b border-[color:var(--border)] bg-[var(--surface)]/90 backdrop-blur">
      <div className={`mx-auto flex px-4 py-4 ${showContext ? 'flex-col gap-3 sm:flex-row sm:items-center sm:justify-between' : 'items-center justify-between gap-2'} ${wide ? 'max-w-7xl' : 'max-w-6xl'}`}>
        <div className="min-w-0">
          <Link
            to="/"
            className="block truncate font-display text-lg font-semibold text-[var(--text)] transition-colors hover:text-[var(--accent-strong)]"
          >
            {profile.title}
          </Link>
          {subline && (
            <p className={`mt-1 text-xs uppercase tracking-[0.18em] text-[var(--text-muted)] ${showContext ? '' : 'hidden sm:block'}`}>
              {subline}
            </p>
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-3 text-left sm:items-end sm:text-right">
          <PublicNavigation />
          {showContext && <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.28em] text-[var(--text-muted)]">
              {eyebrow}
            </p>
            {contextTitle && (
              <p className="mt-1 truncate text-sm font-medium text-[var(--text)]">
                {contextTitle}
              </p>
            )}
          </div>}
        </div>
      </div>
    </header>
  );
};
