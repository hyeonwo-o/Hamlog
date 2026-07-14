import { GRAPH_HEIGHT, GRAPH_PADDING, GRAPH_WIDTH } from './constants';
import type {
    GraphEdgeFilter,
    GraphFilter,
    GraphNodePositions,
    GraphViewport
} from './types';
import { clampPosition } from './utils';

const GRAPH_STORAGE_KEY = 'hamlog_graph_state_v1';
const graphFilters = new Set<GraphFilter>(['all', 'post', 'category', 'series']);
const graphEdgeFilters = new Set<GraphEdgeFilter>(['all', 'category', 'series', 'link']);

export interface GraphUrlState {
    selectedNodeId: string | null;
    activeFilter: GraphFilter;
    activeEdgeFilter: GraphEdgeFilter;
    showLabels: boolean;
    focusMode: boolean;
    viewport: GraphViewport | null;
}

export interface StoredGraphState {
    viewport: GraphViewport | null;
    customNodePositions: GraphNodePositions;
}

const toFiniteNumber = (value: string | null) => {
    if (value === null || value.trim() === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
};

const isGraphViewport = (value: unknown): value is GraphViewport => {
    if (!value || typeof value !== 'object') return false;
    const viewport = value as Partial<GraphViewport>;
    return [viewport.zoom, viewport.centerX, viewport.centerY]
        .every(item => typeof item === 'number' && Number.isFinite(item));
};

const parseViewport = (params: URLSearchParams) => {
    const zoom = toFiniteNumber(params.get('z'));
    const centerX = toFiniteNumber(params.get('x'));
    const centerY = toFiniteNumber(params.get('y'));

    if (zoom === null || centerX === null || centerY === null) return null;
    return { zoom, centerX, centerY };
};

export const readGraphUrlState = (): GraphUrlState => {
    if (typeof window === 'undefined') {
        return {
            selectedNodeId: null,
            activeFilter: 'all',
            activeEdgeFilter: 'all',
            showLabels: true,
            focusMode: true,
            viewport: null
        };
    }

    const params = new URLSearchParams(window.location.search);
    const filter = params.get('nodeType') as GraphFilter | null;
    const edgeFilter = params.get('relation') as GraphEdgeFilter | null;

    return {
        selectedNodeId: params.get('node'),
        activeFilter: filter && graphFilters.has(filter) ? filter : 'all',
        activeEdgeFilter: edgeFilter && graphEdgeFilters.has(edgeFilter) ? edgeFilter : 'all',
        showLabels: params.get('labels') !== '0',
        focusMode: params.get('focus') !== '0',
        viewport: parseViewport(params)
    };
};

export const writeGraphUrlState = (state: GraphUrlState) => {
    if (typeof window === 'undefined') return '';

    const url = new URL(window.location.href);
    const setOrDelete = (key: string, value: string | null) => {
        if (value === null) url.searchParams.delete(key);
        else url.searchParams.set(key, value);
    };

    setOrDelete('node', state.selectedNodeId);
    setOrDelete('nodeType', state.activeFilter === 'all' ? null : state.activeFilter);
    setOrDelete('relation', state.activeEdgeFilter === 'all' ? null : state.activeEdgeFilter);
    setOrDelete('labels', state.showLabels ? null : '0');
    setOrDelete('focus', state.focusMode ? null : '0');

    if (state.viewport) {
        setOrDelete('z', state.viewport.zoom.toFixed(2));
        setOrDelete('x', state.viewport.centerX.toFixed(1));
        setOrDelete('y', state.viewport.centerY.toFixed(1));
    } else {
        ['z', 'x', 'y'].forEach(key => url.searchParams.delete(key));
    }

    const nextUrl = `${url.pathname}${url.search}${url.hash}`;
    window.history.replaceState(window.history.state, '', nextUrl);
    return url.toString();
};

export const readStoredGraphState = (): StoredGraphState => {
    const fallback = { viewport: null, customNodePositions: {} };
    if (typeof window === 'undefined') return fallback;

    try {
        const raw = window.localStorage.getItem(GRAPH_STORAGE_KEY);
        if (!raw) return fallback;
        const parsed = JSON.parse(raw) as {
            viewport?: unknown;
            customNodePositions?: unknown;
        };
        const customNodePositions: GraphNodePositions = {};
        if (parsed.customNodePositions && typeof parsed.customNodePositions === 'object') {
            Object.entries(parsed.customNodePositions).forEach(([nodeId, value]) => {
                const position = value as { x?: unknown; y?: unknown } | null;
                if (
                    !position
                    || typeof position.x !== 'number'
                    || !Number.isFinite(position.x)
                    || typeof position.y !== 'number'
                    || !Number.isFinite(position.y)
                ) return;

                customNodePositions[nodeId] = {
                    x: clampPosition(position.x, GRAPH_PADDING, GRAPH_WIDTH - GRAPH_PADDING),
                    y: clampPosition(position.y, GRAPH_PADDING, GRAPH_HEIGHT - GRAPH_PADDING)
                };
            });
        }

        return {
            viewport: isGraphViewport(parsed.viewport) ? parsed.viewport : null,
            customNodePositions
        };
    } catch {
        try {
            window.localStorage.removeItem(GRAPH_STORAGE_KEY);
        } catch {
            // Ignore unavailable storage.
        }
        return fallback;
    }
};

export const writeStoredGraphState = (state: StoredGraphState) => {
    if (typeof window === 'undefined') return;
    try {
        if (!state.viewport && Object.keys(state.customNodePositions).length === 0) {
            window.localStorage.removeItem(GRAPH_STORAGE_KEY);
            return;
        }
        window.localStorage.setItem(GRAPH_STORAGE_KEY, JSON.stringify(state));
    } catch {
        // Storage can be unavailable in private or restricted browser contexts.
    }
};

export const clearStoredGraphState = () => {
    if (typeof window !== 'undefined') {
        try {
            window.localStorage.removeItem(GRAPH_STORAGE_KEY);
        } catch {
            // Storage can be unavailable in private or restricted browser contexts.
        }
    }
};
