import type { Post } from '../../../types/blog';

export type GraphNodeType = 'post' | 'category' | 'series';
export type GraphFilter = GraphNodeType | 'all';
export type GraphEdgeType = 'category' | 'series' | 'link';
export type GraphEdgeFilter = GraphEdgeType | 'all';

export interface GraphNode {
    id: string;
    type: GraphNodeType;
    label: string;
    x: number;
    y: number;
    radius: number;
    post?: Post;
    relatedPostIds: string[];
}

export interface GraphNodePosition {
    x: number;
    y: number;
}

export type GraphNodePositions = Record<string, GraphNodePosition>;

export interface DraggedGraphNode extends GraphNodePosition {
    id: string;
}

export interface SimulationNode extends GraphNode {
    vx: number;
    vy: number;
    targetX: number;
    targetY: number;
    seed: number;
}

export interface GraphEdge {
    id: string;
    source: string;
    target: string;
    type: GraphEdgeType;
}

export interface GraphViewport {
    zoom: number;
    centerX: number;
    centerY: number;
}

export interface GraphData {
    nodes: GraphNode[];
    edges: GraphEdge[];
    nodeById: Map<string, GraphNode>;
    postNodes: GraphNode[];
    relationNodes: GraphNode[];
    totalPostCount: number;
    isPostLimitApplied: boolean;
}
