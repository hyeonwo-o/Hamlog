import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';

interface PostEditorHeaderProps {
  title: string;
  onTitleChange: (value: string) => void;
}

export default function PostEditorHeader({
  title,
  onTitleChange
}: PostEditorHeaderProps) {
  const titleRef = useRef<HTMLTextAreaElement>(null);

  const resizeTitle = useCallback(() => {
    const element = titleRef.current;
    if (!element) return;
    element.style.height = '0px';
    const maxHeight = Number.parseFloat(window.getComputedStyle(element).maxHeight);
    const nextHeight = Number.isFinite(maxHeight)
      ? Math.min(element.scrollHeight, maxHeight)
      : element.scrollHeight;
    element.style.height = `${nextHeight}px`;
    element.style.overflowY = element.scrollHeight > nextHeight + 1 ? 'auto' : 'hidden';
  }, []);

  useLayoutEffect(() => {
    resizeTitle();
  }, [resizeTitle, title]);

  useEffect(() => {
    const element = titleRef.current;
    const container = element?.parentElement;
    if (!element || !container || typeof ResizeObserver === 'undefined') return;

    let previousWidth = container.getBoundingClientRect().width;
    const resizeObserver = new ResizeObserver(entries => {
      const nextWidth = entries[0]?.contentRect.width ?? previousWidth;
      if (Math.abs(nextWidth - previousWidth) < 0.5) return;
      previousWidth = nextWidth;
      resizeTitle();
    });
    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, [resizeTitle]);

  return (
    <div className="border-b border-[color:var(--border)] py-3">
      <textarea
        ref={titleRef}
        value={title}
        rows={1}
        onChange={event => onTitleChange(event.target.value.replace(/[\r\n]+/g, ' '))}
        onKeyDown={event => {
          if (event.key === 'Enter' && !event.nativeEvent.isComposing) event.preventDefault();
        }}
        placeholder="제목을 입력하세요"
        aria-label="글 제목"
        className="block min-h-[2.25rem] max-h-36 w-full resize-none overflow-x-hidden break-words bg-transparent text-[1.7rem] font-normal leading-tight text-[var(--text)] outline-none placeholder:text-[#8b949e] sm:min-h-[2.5rem] sm:max-h-40 sm:text-[2rem]"
      />
    </div>
  );
}
