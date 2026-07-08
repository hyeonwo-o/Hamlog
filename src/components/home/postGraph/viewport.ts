import {
    GRAPH_ASPECT_RATIO,
    GRAPH_FIT_PADDING,
    GRAPH_HEIGHT,
    GRAPH_MAX_ZOOM,
    GRAPH_MIN_ZOOM,
    GRAPH_PAN_MARGIN,
    GRAPH_WIDTH
} from './constants';
import type { GraphNode, GraphViewport } from './types';
import { clampPosition } from './utils';

const normalizeAspectRatio = (aspectRatio = GRAPH_ASPECT_RATIO) => (
    Number.isFinite(aspectRatio) && aspectRatio > 0 ? aspectRatio : GRAPH_ASPECT_RATIO
);

export const getGraphViewportDimensions = (zoom: number, aspectRatio = GRAPH_ASPECT_RATIO) => {
    const normalizedAspectRatio = normalizeAspectRatio(aspectRatio);

    if (normalizedAspectRatio >= GRAPH_ASPECT_RATIO) {
        const height = GRAPH_HEIGHT / zoom;
        return {
            width: height * normalizedAspectRatio,
            height
        };
    }

    const width = GRAPH_WIDTH / zoom;
    return {
        width,
        height: width / normalizedAspectRatio
    };
};

export const clampGraphZoom = (zoom: number) => clampPosition(zoom, GRAPH_MIN_ZOOM, GRAPH_MAX_ZOOM);

export const clampGraphViewport = (
    viewport: GraphViewport,
    aspectRatio = GRAPH_ASPECT_RATIO
): GraphViewport => {
    const zoom = clampGraphZoom(viewport.zoom);
    const { width: viewBoxWidth, height: viewBoxHeight } = getGraphViewportDimensions(zoom, aspectRatio);

    return {
        zoom,
        centerX: clampPosition(
            viewport.centerX,
            GRAPH_PAN_MARGIN - viewBoxWidth / 2,
            GRAPH_WIDTH - GRAPH_PAN_MARGIN + viewBoxWidth / 2
        ),
        centerY: clampPosition(
            viewport.centerY,
            GRAPH_PAN_MARGIN - viewBoxHeight / 2,
            GRAPH_HEIGHT - GRAPH_PAN_MARGIN + viewBoxHeight / 2
        )
    };
};

export const getGraphViewBox = (viewport: GraphViewport, aspectRatio = GRAPH_ASPECT_RATIO) => {
    const { width: viewBoxWidth, height: viewBoxHeight } = getGraphViewportDimensions(
        viewport.zoom,
        aspectRatio
    );
    const x = viewport.centerX - viewBoxWidth / 2;
    const y = viewport.centerY - viewBoxHeight / 2;

    return `${x} ${y} ${viewBoxWidth} ${viewBoxHeight}`;
};

export const getGraphPoint = (
    clientX: number,
    clientY: number,
    svg: SVGSVGElement,
    viewport: GraphViewport,
    aspectRatio = GRAPH_ASPECT_RATIO
) => {
    const rect = svg.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
        return {
            x: viewport.centerX,
            y: viewport.centerY
        };
    }

    const { width: viewBoxWidth, height: viewBoxHeight } = getGraphViewportDimensions(
        viewport.zoom,
        aspectRatio
    );

    return {
        x: viewport.centerX - viewBoxWidth / 2 + ((clientX - rect.left) / rect.width) * viewBoxWidth,
        y: viewport.centerY - viewBoxHeight / 2 + ((clientY - rect.top) / rect.height) * viewBoxHeight
    };
};

export const getAutoFitGraphViewport = (
    nodes: GraphNode[],
    aspectRatio = GRAPH_ASPECT_RATIO
): GraphViewport => {
    if (nodes.length === 0) {
        return {
            zoom: 1,
            centerX: GRAPH_WIDTH / 2,
            centerY: GRAPH_HEIGHT / 2
        };
    }

    const bounds = nodes.reduce((currentBounds, node) => ({
        minX: Math.min(currentBounds.minX, node.x - node.radius),
        maxX: Math.max(currentBounds.maxX, node.x + node.radius),
        minY: Math.min(currentBounds.minY, node.y - node.radius),
        maxY: Math.max(currentBounds.maxY, node.y + node.radius)
    }), {
        minX: Number.POSITIVE_INFINITY,
        maxX: Number.NEGATIVE_INFINITY,
        minY: Number.POSITIVE_INFINITY,
        maxY: Number.NEGATIVE_INFINITY
    });

    const normalizedAspectRatio = normalizeAspectRatio(aspectRatio);
    const baseDimensions = getGraphViewportDimensions(1, normalizedAspectRatio);
    const desiredWidth = Math.max(180, bounds.maxX - bounds.minX + GRAPH_FIT_PADDING * 2);
    const desiredHeight = Math.max(150, bounds.maxY - bounds.minY + GRAPH_FIT_PADDING * 1.45);
    const zoom = clampGraphZoom(Math.min(
        baseDimensions.width / desiredWidth,
        baseDimensions.height / desiredHeight
    ));

    return clampGraphViewport({
        zoom,
        centerX: (bounds.minX + bounds.maxX) / 2,
        centerY: (bounds.minY + bounds.maxY) / 2
    }, normalizedAspectRatio);
};
