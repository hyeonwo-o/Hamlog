import { Monitor, Moon, Sun } from 'lucide-react';
import { parseThemePreference } from '../contexts/ThemeContext';
import { useTheme } from '../hooks/useTheme';

const labels = { system: '기기 설정', light: '라이트', dark: '다크' };

export default function ThemeSelect() {
  const { preference, setPreference } = useTheme();
  const Icon = preference === 'system' ? Monitor : preference === 'dark' ? Moon : Sun;

  return (
    <label
      className="relative inline-flex h-11 min-h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-[color:var(--border)] bg-[var(--surface)] text-[var(--text)] transition-colors hover:border-[color:var(--accent)] focus-within:ring-2 focus-within:ring-[var(--accent)] sm:min-h-0 sm:w-auto sm:px-3"
      title={`화면 테마: ${labels[preference]}`}
    >
      <span className="pointer-events-none inline-flex items-center gap-2" aria-hidden="true">
        <Icon size={16} />
        <span className="hidden text-xs sm:inline">{labels[preference]}</span>
      </span>
      <span className="sr-only">화면 테마</span>
      <select
        value={preference}
        onChange={event => setPreference(parseThemePreference(event.target.value))}
        className="absolute -inset-px h-[calc(100%+2px)] w-[calc(100%+2px)] cursor-pointer bg-[var(--surface)] text-[var(--text)] opacity-0"
      >
        <option className="text-[var(--text)]" value="system">기기 설정</option>
        <option className="text-[var(--text)]" value="light">라이트</option>
        <option className="text-[var(--text)]" value="dark">다크</option>
      </select>
    </label>
  );
}
