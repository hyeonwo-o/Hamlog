interface PostEditorHeaderProps {
  activeId: string | null;
  title: string;
  onTitleChange: (value: string) => void;
}

export default function PostEditorHeader({
  activeId,
  title,
  onTitleChange
}: PostEditorHeaderProps) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
          {activeId ? '글 편집' : '새 글'}
        </span>
        <span className="text-[11px] text-[var(--text-muted)]">
          저장 `Ctrl/Cmd + S`
        </span>
      </div>
      <input
        value={title}
        onChange={event => onTitleChange(event.target.value)}
        placeholder="제목을 입력하세요"
        className="w-full bg-transparent text-3xl font-semibold leading-tight text-[var(--text)] placeholder-[var(--text-muted)] focus:outline-none lg:text-[2.5rem]"
      />
    </div>
  );
}
