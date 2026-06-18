import React from 'react';

interface ImageBubbleMenuProps {
    width: string | null;
    src: string;
    onResize: (width: string) => void;
    onSetCover?: (src: string) => void;
    isCover?: boolean;
}

export const ImageBubbleMenu: React.FC<ImageBubbleMenuProps> = ({
    width,
    src,
    onResize,
    onSetCover,
    isCover
}) => {
    return (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 z-20">
            {/* Size Controls */}
            <div className="flex items-center gap-1 rounded-full bg-[var(--surface-overlay)] border border-[color:var(--border)] p-1 backdrop-blur-sm animate-fade-in">
                {['25%', '50%', '75%', '100%'].map((w) => (
                    <button
                        key={w}
                        type="button"
                        onClick={(e) => {
                            e.preventDefault();
                            onResize(w);
                        }}
                        className={`rounded-full px-3 py-1 text-[10px] font-bold transition-colors ${(width === w || (!width && w === '100%'))
                            ? 'bg-[var(--accent)] text-white'
                            : 'text-[var(--text-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--text)]'
                            }`}
                    >
                        {w}
                    </button>
                ))}
            </div>

            {/* Set Cover Button */}
            {onSetCover && (
                <button
                    type="button"
                    onClick={() => {
                        if (src && onSetCover) onSetCover(src);
                    }}
                    className={`mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${isCover
                        ? 'bg-[var(--accent)] text-white cursor-default'
                        : 'bg-[var(--surface)] text-[var(--text)] hover:bg-[var(--surface-muted)] border border-[color:var(--border)]'
                        }`}
                    disabled={isCover}
                >
                    {isCover ? (
                        <>
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                            대표 이미지
                        </>
                    ) : (
                        <>
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                            대표 이미지로 설정
                        </>
                    )}
                </button>
            )}
        </div>
    );
};
