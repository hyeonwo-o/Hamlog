import { Link } from 'react-router-dom';
import type { SiteMeta } from '../types/blog';
import PublicVisitorStatus from './analytics/PublicVisitorStatus';

interface PublicNavigationProps {
  profile: SiteMeta;
}

const PublicNavigation = ({ profile }: PublicNavigationProps) => (
  <nav
    className="border-b border-[color:var(--border)] bg-[var(--surface)]/95 backdrop-blur"
    aria-label="주요 메뉴"
  >
    <div className="mx-auto flex min-h-14 max-w-6xl items-center gap-3 px-4 py-2.5">
      <Link
        to="/"
        className="min-w-0 flex-1 truncate font-display text-base font-semibold text-[var(--text)] transition-colors hover:text-[var(--accent-strong)] md:max-w-[300px] md:flex-none"
        title={profile.title}
      >
        {profile.title}
      </Link>

      <div className="ml-auto shrink-0">
        <PublicVisitorStatus />
      </div>
    </div>
  </nav>
);

export default PublicNavigation;
