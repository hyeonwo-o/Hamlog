import { Monitor, Moon, Sun } from 'lucide-react';
import { parseThemePreference } from '../contexts/ThemeContext';
import { useTheme } from '../hooks/useTheme';

const labels = { system: '기기 설정', light: '라이트', dark: '다크' };

export default function ThemeSelect() {
  const { preference, setPreference } = useTheme();
  const Icon = preference === 'system' ? Monitor : preference === 'dark' ? Moon : Sun;

  return (
    <label className="relative inline-flex shrink-0 items-center" title={`화면 테마: ${labels[preference]}`}>
      <Icon className="pointer-events-none absolute left-3.5 sm:left-3" size={16} aria-hidden="true" />
      <span className="sr-only">화면 테마</span>
      <select
        value={preference}
        onChange={event => setPreference(parseThemePreference(event.target.value))}
        className="h-11 w-11 cursor-pointer appearance-none rounded-lg border border-[color:var(--border)] bg-[var(--surface)] text-transparent outline-none transition-colors hover:border-[color:var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--accent)] sm:w-auto sm:pl-9 sm:pr-3 sm:text-xs sm:text-[var(--text)]"
      >
        <option className="text-[var(--text)]" value="system">기기 설정</option>
        <option className="text-[var(--text)]" value="light">라이트</option>
        <option className="text-[var(--text)]" value="dark">다크</option>
      </select>
    </label>
  );
}
