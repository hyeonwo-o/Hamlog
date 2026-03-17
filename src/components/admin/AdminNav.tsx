import React from 'react';
import type { AdminSection } from '../../types/admin';

interface AdminNavProps {
  activeSection: AdminSection;
  sections: Array<{ key: AdminSection; label: string }>;
  onChange: (section: AdminSection) => void;
}

const AdminNav: React.FC<AdminNavProps> = ({ activeSection, sections, onChange }) => (
  <div className="angular-panel rounded-xl border border-[color:var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow)]">
    <p className="text-xs uppercase tracking-[0.3em] text-[var(--text-muted)]">
      관리 메뉴
    </p>
    <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
      {sections.map(item => (
        <button
          key={item.key}
          type="button"
          onClick={() => onChange(item.key)}
          className={`angular-control flex items-center justify-center rounded-lg border px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] transition ${activeSection === item.key
              ? 'border-[color:var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-strong)]'
              : 'border-[color:var(--border)] bg-[var(--surface)] text-[var(--text-muted)] hover:border-[color:var(--accent)] hover:text-[var(--text)]'
            }`}
          aria-current={activeSection === item.key ? 'page' : undefined}
        >
          {item.label}
        </button>
      ))}
    </div>
  </div>
);

export default AdminNav;
