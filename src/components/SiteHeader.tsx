import type { SiteMeta } from '../types/blog';
import PublicNavigation from './PublicNavigation';

interface SiteHeaderProps {
  profile: SiteMeta;
  eyebrow?: string;
  contextTitle?: string;
}

export const SiteHeader = ({
  profile,
  eyebrow = 'Article',
  contextTitle
}: SiteHeaderProps) => {
  const subline = [profile.name, profile.role].filter(Boolean).join(' · ');

  return (
    <header>
      <PublicNavigation profile={profile} />
      <div className="border-b border-[color:var(--border)] bg-[var(--surface-muted)]/70">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          {subline && (
            <p className="truncate text-[11px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
              {subline}
            </p>
          )}
          <div className="min-w-0 text-left sm:ml-auto sm:text-right">
            <div className="min-w-0">
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
        </div>
      </div>
    </header>
  );
};
