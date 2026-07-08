import type { AdminSection } from '../types/admin';

export const ADMIN_SECTIONS: Array<{ key: AdminSection; label: string }> = [
  { key: 'dashboard', label: '대시보드' },
  { key: 'posts', label: '글 관리' },
  { key: 'categories', label: '카테고리' },
  { key: 'profile', label: '자기소개' }
];

export const DEFAULT_ADMIN_SECTION: AdminSection = 'posts';

const ADMIN_SECTION_KEYS = new Set(ADMIN_SECTIONS.map(section => section.key));

export const parseAdminSection = (value: string | null): AdminSection => (
  value && ADMIN_SECTION_KEYS.has(value as AdminSection)
    ? value as AdminSection
    : DEFAULT_ADMIN_SECTION
);
