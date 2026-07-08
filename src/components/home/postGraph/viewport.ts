import {
    GRAPH_HEIGHT,
    GRAPH_MAX_ZOOM,
    GRAPH_MIN_ZOOM,
    GRAPH_PAN_MARGIN,
    GRAPH_WIDTH
} from './constants';
import type { GraphViewport } from './types';
import { clampPosition } from './utils';

export const clampGraphZoom = (zoom: number) => clampPosition(zoom, GRAPH_MIN_ZOOM, GRAPH_MAX_ZOOM);

export const clampGraphViewport = (viewport: GraphViewport): GraphViewport => {
    const zoom = clampGraphZoom(viewport.zoom);
    const viewBoxWidth = GRAPH_WIDTH / zoom;
    const viewBoxHeight = GRAPH_HEIGHT / zoom;

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

export const getGraphViewBox = (viewport: GraphViewport) => {
    const viewBoxWidth = GRAPH_WIDTH / viewport.zoom;
    const viewBoxHeight = GRAPH_HEIGHT / viewport.zoom;
    const x = viewport.centerX - viewBoxWidth / 2;
    const y = viewport.centerY - viewBoxHeight / 2;

    return `${x} ${y} ${viewBoxWidth} ${viewBoxHeight}`;
};

export const getGraphPoint = (clientX: number, clientY: number, svg: SVGSVGElement, viewport: GraphViewport) => {
    const rect = svg.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
        return {
            x: viewport.centerX,
            y: viewport.centerY
        };
    }

    const viewBoxWidth = GRAPH_WIDTH / viewport.zoom;
    const viewBoxHeight = GRAPH_HEIGHT / viewport.zoom;

    return {
        x: viewport.centerX - viewBoxWidth / 2 + ((clientX - rect.left) / rect.width) * viewBoxWidth,
        y: viewport.centerY - viewBoxHeight / 2 + ((clientY - rect.top) / rect.height) * viewBoxHeight
    };
};
