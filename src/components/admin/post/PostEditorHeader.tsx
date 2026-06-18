interface PostEditorHeaderProps {
  activeId: string | null;
  title: string;
  onTitleChange: (value: string) => void;
}

export default function PostEditorHeader({
  title,
  onTitleChange
}: PostEditorHeaderProps) {
  return (
    <div className="border-b border-[color:var(--border)] py-5">
      <input
        value={title}
        onChange={event => onTitleChange(event.target.value)}
        placeholder="제목을 입력하세요"
        className="w-full bg-transparent text-[2rem] font-normal leading-tight text-[var(--text)] outline-none placeholder:text-[#8b949e] sm:text-[2.4rem]"
      />
    </div>
  );
}
