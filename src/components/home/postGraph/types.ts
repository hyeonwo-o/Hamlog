import type { Post } from '../../../types/blog';

export type GraphNodeType = 'post' | 'category' | 'series';
export type GraphFilter = GraphNodeType | 'all';

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
    type: 'category' | 'series' | 'link';
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
}
