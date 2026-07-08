import React from 'react';
import { Link } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import AdminNav from './AdminNav';
import type { AdminSection } from '../../types/admin';

interface AdminHeaderProps {
  activeSection: AdminSection;
  sections: Array<{ key: AdminSection; label: string }>;
  logoutError: string;
  isLoggingOut: boolean;
  onSectionChange: (section: AdminSection) => void;
  onLogout: () => void;
  onBeforeNavigateHome: () => boolean;
}

const AdminHeader: React.FC<AdminHeaderProps> = ({
  activeSection,
  sections,
  logoutError,
  isLoggingOut,
  onSectionChange,
  onLogout,
  onBeforeNavigateHome
}) => (
  <header className="sticky top-0 z-10 border-b border-[color:var(--border)] bg-[var(--surface-overlay)] backdrop-blur-md">
    <div className="mx-auto flex max-w-[1700px] flex-wrap items-center justify-between gap-3 px-4 py-3">
      {logoutError && (
        <p className="min-w-[160px] text-xs text-[var(--accent-strong)]">{logoutError}</p>
      )}
      <AdminNav
        activeSection={activeSection}
        sections={sections}
        onChange={onSectionChange}
      />
      <div className="flex items-center gap-2">
        <button
          onClick={onLogout}
          disabled={isLoggingOut}
          className="inline-flex items-center gap-2 rounded-lg border border-[color:var(--border)] bg-[var(--surface)] px-3 py-2 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <LogOut size={16} />
          {isLoggingOut ? '로그아웃 중...' : '로그아웃'}
        </button>
        <Link
          to="/"
          onClick={(event) => {
            if (!onBeforeNavigateHome()) {
              event.preventDefault();
            }
          }}
          className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] hover:text-[var(--accent)]"
        >
          사이트로 돌아가기
        </Link>
      </div>
    </div>
  </header>
);

export default AdminHeader;
