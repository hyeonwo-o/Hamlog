import { FileText, Folder, Layers3, Link2, Network, type LucideIcon } from 'lucide-react';
import type { GraphEdge, GraphEdgeFilter, GraphFilter, GraphNodeType, GraphViewport } from './types';

export const GRAPH_WIDTH = 1000;
export const GRAPH_HEIGHT = 420;
export const GRAPH_PADDING = 42;
export const GRAPH_ASPECT_RATIO = GRAPH_WIDTH / GRAPH_HEIGHT;
export const GRAPH_FIT_PADDING = 132;
export const GRAPH_MIN_ZOOM = 0.72;
export const GRAPH_MAX_ZOOM = 2.4;
export const GRAPH_ZOOM_STEP = 0.18;
export const GRAPH_FOCUS_ZOOM = 1.55;
export const GRAPH_PAN_MARGIN = 140;
export const MAX_POST_NODES = 120;
export const LAYOUT_ITERATIONS = 76;
export const LARGE_GRAPH_ANIMATION_THRESHOLD = 72;
export const ANIMATION_FRAME_LIMIT = 190;
export const ANIMATION_MIN_FRAMES = 72;
export const ANIMATION_SETTLE_SPEED = 0.028;

export const initialGraphViewport: GraphViewport = {
    zoom: 1,
    centerX: GRAPH_WIDTH / 2,
    centerY: GRAPH_HEIGHT / 2
};

export const nodeTypeLabel: Record<GraphNodeType, string> = {
    post: '글',
    category: '카테고리',
    series: '시리즈'
};

export const nodeTypeIcon: Record<GraphNodeType, LucideIcon> = {
    post: FileText,
    category: Folder,
    series: Layers3
};

export const graphFilterOptions: Array<{ key: GraphFilter; label: string; Icon: LucideIcon }> = [
    { key: 'all', label: '전체', Icon: Network },
    { key: 'post', label: nodeTypeLabel.post, Icon: FileText },
    { key: 'category', label: nodeTypeLabel.category, Icon: Folder },
    { key: 'series', label: nodeTypeLabel.series, Icon: Layers3 }
];

export const graphEdgeFilterOptions: Array<{ key: GraphEdgeFilter; label: string; Icon: LucideIcon }> = [
    { key: 'all', label: '모든 관계', Icon: Network },
    { key: 'category', label: '카테고리', Icon: Folder },
    { key: 'series', label: '시리즈', Icon: Layers3 },
    { key: 'link', label: '본문 링크', Icon: Link2 }
];

export const edgeStroke: Record<GraphEdge['type'], string> = {
    category: 'var(--accent-strong)',
    series: 'var(--text-muted)',
    link: 'var(--accent)'
};
