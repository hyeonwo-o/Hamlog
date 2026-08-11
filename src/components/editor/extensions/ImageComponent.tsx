import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react';
import { useEditorAction } from '../../../contexts/EditorActionContext';
import { createDefaultImageAlt } from '../../../editor/utils/imageAlt';
import { ImageBubbleMenu } from './ImageBubbleMenu';
import { ImagePlaceholder } from './ImagePlaceholder';


export const ImageComponent = ({ node, updateAttributes, selected }: NodeViewProps) => {
    const { src, alt, width, style, caption } = node.attrs;

    // Safely consume context - might be null if used outside provider (e.g. preview)
    let onSetCover: ((src: string) => void) | undefined;
    let currentCoverUrl: string | undefined;
    let uploadLocalImage: ((file: File) => Promise<{ url: string }>) | undefined;

    try {
        const ctx = useEditorAction();
        onSetCover = ctx.onSetCover;
        currentCoverUrl = ctx.currentCoverUrl;
        uploadLocalImage = ctx.uploadLocalImage;
    } catch {
        // Ignore context error if not available
    }

    // Normalize logic for comparison (handle potential relative vs absolute or query params if improved later)
    // For now, strict string equality is likely sufficient if urls come from same source
    const isCover = currentCoverUrl && src && currentCoverUrl === src;

    const handleResize = (newWidth: string) => {
        updateAttributes({
            width: newWidth,
            style: `width: ${newWidth}`
        });
    };

    // If no src, Render Placeholder
    if (!src) {
        return (
            <ImagePlaceholder
                onUpload={async (file) => {
                    if (uploadLocalImage) {
                        try {
                            const { url } = await uploadLocalImage(file);
                            updateAttributes({
                                src: url,
                                alt: createDefaultImageAlt(file.name)
                            });
                        } catch (error) {
                            console.error('Failed to upload dropped image', error);
                            alert('이미지 업로드에 실패했습니다.');
                        }
                    }
                }}
            />
        );
    }

    // Ensure style is a valid object
    const safeStyle = (style && typeof style === 'object' && !Array.isArray(style)) ? style : {};

    // Combine width into style explicitly for WYSIWYG
    const imgStyle = {
        ...safeStyle,
        width: width || '100%',
        height: 'auto'
    };

    return (
        <NodeViewWrapper className="image-component relative group flex flex-col items-center my-6">
            <figure className="relative max-w-full group-hover:cursor-default">
                <div className="relative inline-block">
                    <img
                        src={src}
                        alt={alt || ''}
                        style={imgStyle}
                        className={`rounded-lg transition-all ${selected ? 'ring-2 ring-[var(--accent)]' : ''}`}
                        loading="lazy"
                        decoding="async"
                        fetchPriority="low"
                    />

                    {selected && (
                        <ImageBubbleMenu
                            width={width}
                            src={src}
                            onResize={handleResize}
                            onSetCover={onSetCover}
                            isCover={isCover}
                        />
                    )}
                </div>

                <div className="mt-3 grid w-full gap-2 sm:grid-cols-2" onClick={(e) => e.stopPropagation()}>
                    <label className="block text-left">
                        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
                            대체 텍스트
                        </span>
                        <input
                            type="text"
                            placeholder="이미지 내용을 간결히 설명"
                            value={alt || ''}
                            onChange={(e) => updateAttributes({ alt: e.target.value.slice(0, 180) })}
                            maxLength={180}
                            className="mt-1 w-full rounded-lg border border-[color:var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-sm text-[var(--text)] focus:border-[color:var(--accent)] focus:outline-none"
                            aria-label="이미지 대체 텍스트"
                        />
                        <span className="mt-1 block text-[10px] leading-relaxed text-[var(--text-muted)]">
                            장식용 이미지는 비워둘 수 있습니다.
                        </span>
                    </label>
                    <label className="block text-left">
                        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
                            캡션
                        </span>
                        <input
                            type="text"
                            placeholder="본문에 표시할 이미지 설명"
                            value={caption || ''}
                            onChange={(e) => updateAttributes({ caption: e.target.value })}
                            className="mt-1 w-full rounded-lg border border-[color:var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-sm text-[var(--text)] focus:border-[color:var(--accent)] focus:outline-none"
                            aria-label="이미지 캡션"
                        />
                    </label>
                </div>
            </figure>
        </NodeViewWrapper>
    );
};
