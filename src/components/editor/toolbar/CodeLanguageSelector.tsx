interface CodeLanguageOption {
  value: string;
  label: string;
}

interface CodeLanguageSelectorProps {
  active: boolean;
  currentLanguage: string;
  options: CodeLanguageOption[];
  onSelect: (language: string) => void;
}

export function CodeLanguageSelector({
  active,
  currentLanguage,
  options,
  onSelect
}: CodeLanguageSelectorProps) {
  if (!active) {
    return null;
  }

  return (
    <div className="mt-2 animate-in slide-in-from-top-1 border-t border-[color:var(--border)] pt-2">
      <div className="flex items-center gap-2" role="group" aria-label="코드 언어 선택">
        <span className="text-xs font-medium text-[var(--text-muted)]">코드 언어:</span>
        <div className="flex flex-wrap gap-1">
          {options.map(option => (
            <button
              key={option.value}
              type="button"
              onClick={() => onSelect(option.value)}
              aria-pressed={currentLanguage === option.value}
              className={`rounded-full border px-2 py-0.5 text-[10px] transition-colors ${
                currentLanguage === option.value
                  ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-strong)]'
                  : 'border-[color:var(--border)] hover:bg-[var(--surface-muted)]'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
