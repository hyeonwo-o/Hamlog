
import type { EditorView } from '@tiptap/pm/view';

export type DropSide = 'left' | 'right' | null;

export const getImagePositionFromElement = (view: EditorView, element: Element | null) => {
    const wrapper = element?.closest<HTMLElement>('.image-component');
    if (!wrapper) return null;
    try {
        const domPosition = view.posAtDOM(wrapper, 0);
        const candidates = [domPosition, domPosition - 1, domPosition + 1];
        return candidates.find(position => (
            position >= 0 && view.state.doc.nodeAt(position)?.type.name === 'image'
        )) ?? null;
    } catch {
        return null;
    }
};

interface ImageDetectionResult {
    targetImage: Element | null;
    dropSide: DropSide;
    parentColumn?: Element | null;
    parentColumns?: Element | null;
}

interface ImageDropDetectionOptions {
    exclude?: Element | null;
}

interface ImageRect {
    left: number;
    right: number;
    top: number;
    bottom: number;
    width: number;
}

interface HorizontalDropCandidate {
    side: Exclude<DropSide, null>;
    distance: number;
}

export const getHorizontalImageDropCandidate = (
    rect: ImageRect,
    clientX: number,
    clientY: number,
    scanDistance = 100
): HorizontalDropCandidate | null => {
    if (clientY < rect.top || clientY > rect.bottom || rect.width <= 0) return null;
    if (clientX < rect.left - scanDistance || clientX > rect.right + scanDistance) return null;

    if (clientX <= rect.left + (rect.width * 0.3)) {
        return { side: 'left', distance: Math.abs(clientX - rect.left) };
    }
    if (clientX >= rect.right - (rect.width * 0.3)) {
        return { side: 'right', distance: Math.abs(clientX - rect.right) };
    }
    return null;
};

export const detectImageDropZone = (
    editorDom: HTMLElement,
    clientX: number,
    clientY: number,
    options: ImageDropDetectionOptions = {}
): ImageDetectionResult => {
    // Improved selector to catch images inside NodeViews (ImageComponent) and standard images
    const images = Array.from(editorDom.querySelectorAll('.image-component img, img.post-image, img[data-type="custom-image"]'));

    let targetImage: Element | null = null;
    let dropSide: DropSide = null;
    let parentColumn: Element | null = null;
    let parentColumns: Element | null = null;
    let closestDistance = Number.POSITIVE_INFINITY;

    // Find the closest image vertically that we are horizontally within range of
    for (const img of images) {
        const imageComponent = img.closest('.image-component');
        if (img === options.exclude || imageComponent === options.exclude) continue;
        const rect = img.getBoundingClientRect();
        const candidate = getHorizontalImageDropCandidate(rect, clientX, clientY);
        if (!candidate || candidate.distance >= closestDistance) continue;
        targetImage = img;
        dropSide = candidate.side;
        closestDistance = candidate.distance;
    }

    if (targetImage) {
        // Detect if inside a column
        const imageComponent = targetImage.closest('.image-component');
        const leafNode = imageComponent || targetImage;
        parentColumn = leafNode.closest('[data-type="column"]');
        parentColumns = leafNode.closest('[data-type="columns"]');
    }

    return { targetImage, dropSide, parentColumn, parentColumns };
};
