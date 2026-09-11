import { useId } from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';
import { useTheme } from '../hooks/useTheme';

const options = [
  { value: 'system', label: '기기 설정', Icon: Monitor },
  { value: 'light', label: '라이트', Icon: Sun },
  { value: 'dark', label: '다크', Icon: Moon }
] as const;

export default function ThemeSelect() {
  const { preference, setPreference } = useTheme();
  const name = useId();

  return (
    <div
      role="radiogroup"
      aria-label="화면 테마"
      className="inline-flex shrink-0 rounded-lg border border-[color:var(--border)] bg-[var(--surface-muted)] p-0.5"
    >
      {options.map(({ value, label, Icon }) => (
        <label key={value} className="relative inline-flex cursor-pointer" title={label}>
          <input
            type="radio"
            name={name}
            value={value}
            checked={preference === value}
            onChange={() => setPreference(value)}
            aria-label={label}
            className="peer absolute inset-0 z-10 m-0 h-full w-full cursor-pointer opacity-0"
          />
          <span
            aria-hidden="true"
            className="pointer-events-none inline-flex min-h-11 w-11 items-center justify-center rounded-md text-[var(--text-muted)] transition-colors peer-hover:text-[var(--accent-strong)] peer-checked:bg-[var(--accent-soft)] peer-checked:text-[var(--accent-strong)] peer-checked:shadow-sm peer-focus-visible:ring-2 peer-focus-visible:ring-inset peer-focus-visible:ring-[var(--accent)] sm:min-h-9 sm:w-9"
          >
            <Icon size={16} />
          </span>
        </label>
      ))}
    </div>
  );
}
