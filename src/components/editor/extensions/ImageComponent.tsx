import { useCallback, useEffect, useRef, useState } from 'react';
import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react';
import { useEditorAction } from '../../../contexts/EditorActionContext';
import { createDefaultImageAlt } from '../../../editor/utils/imageAlt';
import {
    IMAGE_MAX_WIDTH_PERCENT,
    IMAGE_MIN_WIDTH_PERCENT,
    calculateImageWidthPercent,
    getKeyboardImageWidthPercent,
    parseImageWidthPercent
} from '../../../editor/utils/imageResize';
import {
    canPlaceImageBeside,
    getImageLayoutControlState,
    moveImageColumn,
    placeImageBeside,
    resolveImageLayoutContext,
    unwrapImageLayout
} from '../../../editor/utils/imageLayout';
import {
    detectImageDropZone,
    getImagePositionFromElement,
    type DropSide
} from '../../../editor/utils/dragDropUtils';
import { ImageBubbleMenu } from './ImageBubbleMenu';
import { ImagePlaceholder } from './ImagePlaceholder';

interface ActiveResize {
    handle: HTMLButtonElement;
    pointerId: number;
    startX: number;
    startWidthPx: number;
    containerWidthPx: number;
    latestPercent: number;
    previousCursor: string;
    previousUserSelect: string;
}

interface ActiveLayoutDrag {
    handle: HTMLElement;
    pointerId: number;
    startX: number;
    startY: number;
    started: boolean;
    sourceComponent: HTMLElement | null;
    sourceDecoration: HTMLElement | null;
    targetImage: Element | null;
    targetDecoration: HTMLElement | null;
    targetPos: number | null;
    side: DropSide;
    previousCursor: string;
    previousUserSelect: string;
}

const IMAGE_LAYOUT_DRAG_THRESHOLD_PX = 6;
const IMAGE_LAYOUT_AUTO_SCROLL_EDGE_PX = 72;
const IMAGE_LAYOUT_AUTO_SCROLL_STEP_PX = 18;

export const ImageComponent = ({ node, updateAttributes, selected, editor, getPos }: NodeViewProps) => {
    const { src, alt, dataWidth, width, style, caption } = node.attrs;
    const figureRef = useRef<HTMLElement | null>(null);
    const imageFrameRef = useRef<HTMLDivElement | null>(null);
    const activeResizeRef = useRef<ActiveResize | null>(null);
    const activeLayoutDragRef = useRef<ActiveLayoutDrag | null>(null);
    const [previewWidthPercent, setPreviewWidthPercent] = useState<number | null>(null);
    const [layoutDragActive, setLayoutDragActive] = useState(false);
    const [layoutDragMessage, setLayoutDragMessage] = useState('');

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

    const handleResize = useCallback((newWidth: string) => {
        updateAttributes({
            size: 'custom',
            dataWidth: newWidth,
            width: null,
            style: null
        });
    }, [updateAttributes]);

    const currentWidthPercent = previewWidthPercent ?? parseImageWidthPercent(dataWidth || width);

    const getImagePosition = useCallback(() => {
        try {
            const position = getPos();
            return typeof position === 'number' ? position : null;
        } catch {
            return null;
        }
    }, [getPos]);

    const imagePosition = getImagePosition();
    const imageLayoutContext = imagePosition === null
        ? null
        : resolveImageLayoutContext(editor.state.doc, imagePosition);
    const canDragLayout = Boolean(
        imageLayoutContext
        && !imageLayoutContext.insideImageGallery
        && imageLayoutContext.autoLayoutEligible
    );
    const resolvedLayoutControlState = !canDragLayout || imagePosition === null
        ? null
        : getImageLayoutControlState(editor.state.doc, imagePosition);
    const layoutControlState = selected ? resolvedLayoutControlState : null;
    const hasLayoutControls = Boolean(layoutControlState && (
        layoutControlState.inLayout
        || layoutControlState.previousImagePos !== null
        || layoutControlState.nextImagePos !== null
    ));
    const canPointerDragLayout = Boolean(resolvedLayoutControlState && (
        resolvedLayoutControlState.canMoveLeft
        || resolvedLayoutControlState.canMoveRight
        || resolvedLayoutControlState.previousImagePos !== null
        || resolvedLayoutControlState.nextImagePos !== null
    ));

    const restoreImageLayoutFocus = useCallback(() => {
        window.requestAnimationFrame(() => {
            editor.view.focus();
        });
    }, [editor]);

    const handleMoveColumn = useCallback((direction: 'left' | 'right') => {
        const position = getImagePosition();
        if (position !== null && moveImageColumn(editor, position, direction)) {
            restoreImageLayoutFocus();
        }
    }, [editor, getImagePosition, restoreImageLayoutFocus]);

    const handleUngroupLayout = useCallback(() => {
        const position = getImagePosition();
        if (position !== null && unwrapImageLayout(editor, position)) {
            restoreImageLayoutFocus();
        }
    }, [editor, getImagePosition, restoreImageLayoutFocus]);

    const handlePlaceWithAdjacent = useCallback((direction: 'previous' | 'next') => {
        const position = getImagePosition();
        if (position === null) return;
        const controls = getImageLayoutControlState(editor.state.doc, position);
        const targetPos = direction === 'previous'
            ? controls.previousImagePos
            : controls.nextImagePos;
        if (targetPos === null) return;
        const placed = placeImageBeside(
            editor,
            position,
            targetPos,
            direction === 'previous' ? 'right' : 'left'
        );
        if (placed) restoreImageLayoutFocus();
    }, [editor, getImagePosition, restoreImageLayoutFocus]);

    const resetLayoutDragDom = useCallback((active: ActiveLayoutDrag) => {
        active.targetDecoration?.classList.remove('image-layout-drop-target');
        active.targetDecoration?.removeAttribute('data-image-drop-side');
        active.sourceDecoration?.classList.remove('image-layout-drag-source');
        try {
            if (active.handle.hasPointerCapture(active.pointerId)) {
                active.handle.releasePointerCapture(active.pointerId);
            }
        } catch {
            // The NodeView may already have been replaced by the layout transaction.
        }
        document.body.style.cursor = active.previousCursor;
        document.body.style.userSelect = active.previousUserSelect;
    }, []);

    const finishLayoutPointerDrag = useCallback((commit: boolean) => {
        const active = activeLayoutDragRef.current;
        if (!active) return;

        const sourcePos = getImagePosition();
        const targetPos = active.targetImage
            ? getImagePositionFromElement(editor.view, active.targetImage)
            : active.targetPos;
        const side = active.side;

        activeLayoutDragRef.current = null;
        resetLayoutDragDom(active);
        setLayoutDragActive(false);

        let placed = false;
        if (
            commit
            && active.started
            && sourcePos !== null
            && targetPos !== null
            && side
            && canPlaceImageBeside(editor.state.doc, sourcePos, targetPos)
        ) {
            placed = placeImageBeside(editor, sourcePos, targetPos, side);
            if (placed) {
                restoreImageLayoutFocus();
            }
        }
        setLayoutDragMessage(
            placed
                ? '이미지 배치를 완료했습니다.'
                : active.started
                    ? '이미지 배치를 취소했습니다.'
                    : ''
        );
    }, [editor, getImagePosition, resetLayoutDragDom, restoreImageLayoutFocus]);

    useEffect(() => {
        if (!layoutDragActive) return undefined;

        const beginVisualDrag = (active: ActiveLayoutDrag) => {
            if (active.started) return;
            active.started = true;
            active.sourceDecoration?.classList.add('image-layout-drag-source');
            document.body.style.cursor = 'grabbing';
            document.body.style.userSelect = 'none';
        };

        const handlePointerMove = (event: PointerEvent) => {
            const active = activeLayoutDragRef.current;
            if (!active || event.pointerId !== active.pointerId) return;

            if (!active.started) {
                const distance = Math.hypot(
                    event.clientX - active.startX,
                    event.clientY - active.startY
                );
                if (distance < IMAGE_LAYOUT_DRAG_THRESHOLD_PX) return;
                beginVisualDrag(active);
            }

            event.preventDefault();
            if (event.clientY < IMAGE_LAYOUT_AUTO_SCROLL_EDGE_PX) {
                window.scrollBy(0, -IMAGE_LAYOUT_AUTO_SCROLL_STEP_PX);
            } else if (event.clientY > window.innerHeight - IMAGE_LAYOUT_AUTO_SCROLL_EDGE_PX) {
                window.scrollBy(0, IMAGE_LAYOUT_AUTO_SCROLL_STEP_PX);
            }
            const detection = detectImageDropZone(
                editor.view.dom,
                event.clientX,
                event.clientY,
                { exclude: active.sourceComponent }
            );
            const targetPos = getImagePositionFromElement(editor.view, detection.targetImage);
            const allowed = Boolean(
                targetPos !== null
                && detection.dropSide
                && canPlaceImageBeside(editor.state.doc, getImagePosition() ?? -1, targetPos)
            );
            const targetDecoration = allowed
                ? detection.targetImage?.closest<HTMLElement>('.node-image')
                    ?? detection.targetImage?.closest<HTMLElement>('.image-component')
                    ?? null
                : null;

            if (active.targetDecoration !== targetDecoration) {
                active.targetDecoration?.classList.remove('image-layout-drop-target');
                active.targetDecoration?.removeAttribute('data-image-drop-side');
            }

            active.targetImage = allowed ? detection.targetImage : null;
            active.targetDecoration = targetDecoration;
            active.targetPos = allowed ? targetPos : null;
            active.side = allowed ? detection.dropSide : null;

            if (targetDecoration && detection.dropSide) {
                targetDecoration.classList.add('image-layout-drop-target');
                targetDecoration.setAttribute('data-image-drop-side', detection.dropSide);
            }
            setLayoutDragMessage(
                allowed
                    ? `이미지를 대상 사진 ${detection.dropSide === 'left' ? '앞' : '뒤'}에 배치합니다.`
                    : detection.targetImage
                        ? '이 위치에는 배치할 수 없습니다. 사진은 최대 3열까지 배치할 수 있습니다.'
                        : '다른 사진의 앞이나 뒤 테두리로 이동하세요.'
            );
            document.body.style.cursor = detection.targetImage && !allowed ? 'not-allowed' : 'grabbing';
        };

        const handlePointerUp = (event: PointerEvent) => {
            if (event.pointerId !== activeLayoutDragRef.current?.pointerId) return;
            if (activeLayoutDragRef.current.started) event.preventDefault();
            finishLayoutPointerDrag(true);
        };
        const handlePointerCancel = (event: PointerEvent) => {
            if (event.pointerId !== activeLayoutDragRef.current?.pointerId) return;
            finishLayoutPointerDrag(false);
        };
        const handleEscape = (event: KeyboardEvent) => {
            if (event.key !== 'Escape' || !activeLayoutDragRef.current) return;
            event.preventDefault();
            finishLayoutPointerDrag(false);
        };
        const handleBlur = () => finishLayoutPointerDrag(false);

        window.addEventListener('pointermove', handlePointerMove, { passive: false });
        window.addEventListener('pointerup', handlePointerUp, { passive: false });
        window.addEventListener('pointercancel', handlePointerCancel);
        window.addEventListener('keydown', handleEscape);
        window.addEventListener('blur', handleBlur);

        return () => {
            window.removeEventListener('pointermove', handlePointerMove);
            window.removeEventListener('pointerup', handlePointerUp);
            window.removeEventListener('pointercancel', handlePointerCancel);
            window.removeEventListener('keydown', handleEscape);
            window.removeEventListener('blur', handleBlur);
            const active = activeLayoutDragRef.current;
            if (active) {
                activeLayoutDragRef.current = null;
                resetLayoutDragDom(active);
            }
        };
    }, [editor, finishLayoutPointerDrag, getImagePosition, layoutDragActive, resetLayoutDragDom]);

    const handleLayoutPointerDown = useCallback((
        event: React.PointerEvent<HTMLElement>,
        immediate = false
    ) => {
        if (!event.isPrimary || activeLayoutDragRef.current || !canPointerDragLayout) return;
        if (event.pointerType === 'mouse' && event.button !== 0) return;
        const sourcePos = getImagePosition();
        if (sourcePos === null) return;

        if (immediate) {
            event.preventDefault();
            event.stopPropagation();
        }
        event.currentTarget.setPointerCapture(event.pointerId);
        const sourceComponent = figureRef.current?.closest<HTMLElement>('.image-component') ?? null;
        const sourceDecoration = sourceComponent?.closest<HTMLElement>('.node-image') ?? sourceComponent;
        activeLayoutDragRef.current = {
            handle: event.currentTarget,
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            started: immediate,
            sourceComponent,
            sourceDecoration,
            targetImage: null,
            targetDecoration: null,
            targetPos: null,
            side: null,
            previousCursor: document.body.style.cursor,
            previousUserSelect: document.body.style.userSelect
        };
        if (immediate) {
            sourceDecoration?.classList.add('image-layout-drag-source');
            document.body.style.cursor = 'grabbing';
            document.body.style.userSelect = 'none';
        }
        setLayoutDragMessage('다른 사진의 앞이나 뒤 테두리로 이동하세요.');
        setLayoutDragActive(true);
    }, [canPointerDragLayout, getImagePosition]);

    const handleLayoutPointerCaptureLost = useCallback((event: React.PointerEvent<HTMLElement>) => {
        if (event.pointerId !== activeLayoutDragRef.current?.pointerId) return;
        finishLayoutPointerDrag(false);
    }, [finishLayoutPointerDrag]);

    const focusLayoutOptions = useCallback(() => {
        const firstAction = imageFrameRef.current?.querySelector<HTMLButtonElement>(
            '[role="group"][aria-label="이미지 배치"] button:not(:disabled)'
        );
        firstAction?.focus();
    }, []);

    const handleLayoutHandleKeyDown = useCallback((event: React.KeyboardEvent<HTMLButtonElement>) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        event.stopPropagation();
        focusLayoutOptions();
    }, [focusLayoutOptions]);

    const finishPointerResize = useCallback((commit: boolean) => {
        const activeResize = activeResizeRef.current;
        if (!activeResize) return;

        activeResizeRef.current = null;
        if (activeResize.handle.hasPointerCapture(activeResize.pointerId)) {
            activeResize.handle.releasePointerCapture(activeResize.pointerId);
        }
        document.body.style.cursor = activeResize.previousCursor;
        document.body.style.userSelect = activeResize.previousUserSelect;

        if (commit) {
            handleResize(`${activeResize.latestPercent}%`);
        }
        setPreviewWidthPercent(null);
    }, [handleResize]);

    useEffect(() => {
        if (!selected) return undefined;

        const handlePointerMove = (event: PointerEvent) => {
            const activeResize = activeResizeRef.current;
            if (!activeResize || event.pointerId !== activeResize.pointerId) return;

            event.preventDefault();
            const nextPercent = calculateImageWidthPercent({
                startWidthPx: activeResize.startWidthPx,
                deltaX: event.clientX - activeResize.startX,
                containerWidthPx: activeResize.containerWidthPx
            });
            activeResize.latestPercent = nextPercent;
            setPreviewWidthPercent(nextPercent);
        };

        const handlePointerUp = (event: PointerEvent) => {
            if (event.pointerId !== activeResizeRef.current?.pointerId) return;
            finishPointerResize(true);
        };

        const handlePointerCancel = (event: PointerEvent) => {
            if (event.pointerId !== activeResizeRef.current?.pointerId) return;
            finishPointerResize(false);
        };

        const handleResizeEscape = (event: KeyboardEvent) => {
            if (event.key !== 'Escape' || !activeResizeRef.current) return;
            event.preventDefault();
            finishPointerResize(false);
        };

        const handleWindowBlur = () => finishPointerResize(false);

        window.addEventListener('pointermove', handlePointerMove, { passive: false });
        window.addEventListener('pointerup', handlePointerUp);
        window.addEventListener('pointercancel', handlePointerCancel);
        window.addEventListener('keydown', handleResizeEscape);
        window.addEventListener('blur', handleWindowBlur);

        return () => {
            window.removeEventListener('pointermove', handlePointerMove);
            window.removeEventListener('pointerup', handlePointerUp);
            window.removeEventListener('pointercancel', handlePointerCancel);
            window.removeEventListener('keydown', handleResizeEscape);
            window.removeEventListener('blur', handleWindowBlur);
            const activeResize = activeResizeRef.current;
            if (activeResize) {
                activeResizeRef.current = null;
                document.body.style.cursor = activeResize.previousCursor;
                document.body.style.userSelect = activeResize.previousUserSelect;
                setPreviewWidthPercent(null);
            }
        };
    }, [finishPointerResize, selected]);

    const handleResizePointerDown = useCallback((event: React.PointerEvent<HTMLButtonElement>) => {
        if (!event.isPrimary || activeResizeRef.current) return;
        if (event.pointerType === 'mouse' && event.button !== 0) return;

        const figure = figureRef.current;
        const imageFrame = imageFrameRef.current;
        if (!figure || !imageFrame) return;

        const containerWidthPx = figure.getBoundingClientRect().width;
        const startWidthPx = imageFrame.getBoundingClientRect().width;
        if (containerWidthPx <= 0 || startWidthPx <= 0) return;

        event.preventDefault();
        event.stopPropagation();
        event.currentTarget.setPointerCapture(event.pointerId);
        activeResizeRef.current = {
            handle: event.currentTarget,
            pointerId: event.pointerId,
            startX: event.clientX,
            startWidthPx,
            containerWidthPx,
            latestPercent: currentWidthPercent,
            previousCursor: document.body.style.cursor,
            previousUserSelect: document.body.style.userSelect
        };
        document.body.style.cursor = 'nwse-resize';
        document.body.style.userSelect = 'none';
        setPreviewWidthPercent(currentWidthPercent);
    }, [currentWidthPercent]);

    const handleResizePointerCaptureLost = useCallback((event: React.PointerEvent<HTMLButtonElement>) => {
        if (event.pointerId !== activeResizeRef.current?.pointerId) return;
        finishPointerResize(false);
    }, [finishPointerResize]);

    const handleResizeKeyDown = useCallback((event: React.KeyboardEvent<HTMLButtonElement>) => {
        const nextPercent = getKeyboardImageWidthPercent(
            currentWidthPercent,
            event.key,
            event.shiftKey
        );

        if (nextPercent === null) return;
        event.preventDefault();
        event.stopPropagation();
        handleResize(`${nextPercent}%`);
    }, [currentWidthPercent, handleResize]);

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
        width: '100%',
        height: 'auto'
    };

    const imageFrameStyle = {
        width: `${currentWidthPercent}%`,
        maxWidth: '100%'
    };

    return (
        <NodeViewWrapper
            className="image-component relative group flex flex-col items-center my-6"
        >
            <figure ref={figureRef} className="relative w-full max-w-full group-hover:cursor-default">
                <div
                    ref={imageFrameRef}
                    className="image-resize-frame relative mx-auto"
                    style={imageFrameStyle}
                    data-image-width={currentWidthPercent}
                >
                    <img
                        src={src}
                        alt={alt || ''}
                        style={imgStyle}
                        loading="lazy"
                        decoding="async"
                        fetchPriority="low"
                        draggable={false}
                        onPointerDown={handleLayoutPointerDown}
                        onLostPointerCapture={handleLayoutPointerCaptureLost}
                        className={canPointerDragLayout
                            ? 'cursor-grab rounded-lg active:cursor-grabbing'
                            : 'rounded-lg'}
                        title={canPointerDragLayout ? '드래그하여 다른 사진 옆에 배치' : undefined}
                    />

                    {selected && (
                        <>
                            <span className="sr-only" role="status" aria-live="polite">
                                {layoutDragMessage}
                            </span>
                            <span
                                className="pointer-events-none absolute inset-0 rounded-lg ring-2 ring-[var(--accent)]"
                                aria-hidden="true"
                            />
                            <button
                                type="button"
                                role="slider"
                                aria-label="이미지 너비 조절"
                                aria-valuemin={IMAGE_MIN_WIDTH_PERCENT}
                                aria-valuemax={IMAGE_MAX_WIDTH_PERCENT}
                                aria-valuenow={currentWidthPercent}
                                aria-valuetext={`${currentWidthPercent}%`}
                                aria-orientation="horizontal"
                                title="드래그하거나 방향키로 이미지 너비 조절"
                                onPointerDown={handleResizePointerDown}
                                onLostPointerCapture={handleResizePointerCaptureLost}
                                onKeyDown={handleResizeKeyDown}
                                className="image-resize-handle absolute bottom-2 right-2 z-30 flex h-10 w-10 touch-none cursor-nwse-resize items-center justify-center rounded-full border-2 border-white bg-[var(--accent)] shadow-md outline-none transition-transform hover:scale-105 focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
                                contentEditable={false}
                            >
                                <span className="h-3 w-3 rounded-sm border-b-2 border-r-2 border-white" aria-hidden="true" />
                            </button>
                            {canPointerDragLayout && (
                                <button
                                    type="button"
                                    aria-label="이미지 배치 옵션 또는 드래그"
                                    title="누르면 배치 옵션으로 이동하고, 끌면 다른 사진 옆에 배치합니다"
                                    onPointerDown={event => handleLayoutPointerDown(event, true)}
                                    onLostPointerCapture={handleLayoutPointerCaptureLost}
                                    onKeyDown={handleLayoutHandleKeyDown}
                                    onClick={event => {
                                        event.preventDefault();
                                        event.stopPropagation();
                                        focusLayoutOptions();
                                    }}
                                    className="image-layout-drag-handle absolute left-2 top-2 z-30 grid h-11 w-11 touch-none cursor-grab place-items-center rounded-full border-2 border-white bg-[var(--accent)] text-white shadow-md outline-none transition-transform hover:scale-105 active:cursor-grabbing focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
                                    contentEditable={false}
                                >
                                    <span className="grid grid-cols-2 gap-1" aria-hidden="true">
                                        {Array.from({ length: 6 }, (_, index) => (
                                            <span key={index} className="h-1 w-1 rounded-full bg-current" />
                                        ))}
                                    </span>
                                </button>
                            )}
                        </>
                    )}

                    {selected && (
                        <ImageBubbleMenu
                            width={`${currentWidthPercent}%`}
                            src={src}
                            onResize={handleResize}
                            onSetCover={onSetCover}
                            isCover={isCover}
                            layoutActions={hasLayoutControls && layoutControlState ? {
                                inLayout: layoutControlState.inLayout,
                                canMoveLeft: layoutControlState.canMoveLeft,
                                canMoveRight: layoutControlState.canMoveRight,
                                canPlaceWithPrevious: layoutControlState.previousImagePos !== null,
                                canPlaceWithNext: layoutControlState.nextImagePos !== null,
                                onMoveLeft: () => handleMoveColumn('left'),
                                onMoveRight: () => handleMoveColumn('right'),
                                onPlaceWithPrevious: () => handlePlaceWithAdjacent('previous'),
                                onPlaceWithNext: () => handlePlaceWithAdjacent('next'),
                                onUngroup: handleUngroupLayout
                            } : undefined}
                        />
                    )}
                </div>

                <div className="image-metadata-fields mt-3 grid w-full gap-2 sm:grid-cols-2" onClick={(e) => e.stopPropagation()}>
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
