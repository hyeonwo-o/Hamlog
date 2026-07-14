import clsx from 'clsx';
import { NavLink } from 'react-router-dom';

const navigationItems = [
    { to: '/', label: '홈', end: true },
    { to: '/graph', label: '그래프뷰', end: true }
];

export const PublicNavigation = () => (
    <nav aria-label="주요 메뉴">
        <ul className="flex flex-wrap items-center gap-2">
            {navigationItems.map(item => (
                <li key={item.to}>
                    <NavLink
                        to={item.to}
                        end={item.end}
                        className={({ isActive }) => clsx(
                            'angular-control inline-flex min-h-9 items-center border px-3 py-2 text-xs font-semibold tracking-[0.08em] transition-colors',
                            isActive
                                ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-strong)]'
                                : 'border-[color:var(--border)] bg-[var(--surface)] text-[var(--text-muted)] hover:border-[var(--text)] hover:text-[var(--text)]'
                        )}
                    >
                        {item.label}
                    </NavLink>
                </li>
            ))}
        </ul>
    </nav>
);
