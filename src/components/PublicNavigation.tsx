import { Link } from 'react-router-dom';
import type { SiteMeta } from '../types/blog';
import PublicVisitorStatus from './analytics/PublicVisitorStatus';
import ThemeSelect from './ThemeSelect';

interface PublicNavigationProps {
  profile: SiteMeta;
}

const PublicNavigation = ({ profile }: PublicNavigationProps) => (
  <nav
    className="border-b border-[color:var(--border)] bg-[var(--surface)]/95 backdrop-blur"
    aria-label="주요 메뉴"
  >
    <div className="mx-auto grid min-h-14 max-w-6xl grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 px-4 py-2.5 sm:flex">
      <Link
        to="/"
        className="col-start-1 row-start-1 min-w-0 flex-1 truncate font-display text-base font-semibold text-[var(--text)] transition-colors hover:text-[var(--accent-strong)] md:max-w-[300px] md:flex-none"
        title={profile.title}
      >
        {profile.title}
      </Link>

      <div className="col-span-2 row-start-2 flex min-w-0 sm:ml-auto">
        <PublicVisitorStatus />
      </div>
      <div className="col-start-2 row-start-1 flex shrink-0">
        <ThemeSelect />
      </div>
    </div>
  </nav>
);

export default PublicNavigation;
