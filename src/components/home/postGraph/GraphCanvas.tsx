import type { CSSProperties, KeyboardEvent, PointerEvent, RefObject } from 'react';
import { ZoomIn, ZoomOut } from 'lucide-react';
import {
    edgeStroke,
    GRAPH_MAX_ZOOM,
    GRAPH_MIN_ZOOM,
    GRAPH_ZOOM_STEP,
    nodeTypeLabel
} from './constants';
import type { GraphEdge, GraphNode } from './types';
import { clampLabel, getNodeClasses, getNodeStroke } from './utils';

interface GraphCanvasProps {
    edges: GraphEdge[];
    visibleEdgeIds: Set<string>;
    animatedGraph: {
        nodes: GraphNode[];
        nodeById: Map<string, GraphNode>;
    };
    activeNodeId: string | null;
    activeNeighborIds: Set<string>;
    selectionNeighborIds: Set<string>;
    selectedNodeId: string | null;
    selectionAnimationNodeId: string | null;
    selectionAnimationKey: number;
    animateInteractions: boolean;
    zoom: number;
    draggingNodeId: string | null;
    showLabels: boolean;
    isPanning: boolean;
    isFullscreen: boolean;
    viewBox: string;
    stageStyle: CSSProperties;
    svgRef: RefObject<SVGSVGElement>;
    isNodeDimmed: (node: GraphNode) => boolean;
    onSelectNode: (nodeId: string) => void;
    onNodeKeyDown: (event: KeyboardEvent<SVGGElement>, nodeId: string) => void;
    onNodePointerDown: (event: PointerEvent<SVGGElement>, nodeId: string) => void;
    onNodePointerMove: (event: PointerEvent<SVGGElement>) => void;
    onNodePointerUp: (event: PointerEvent<SVGGElement>) => void;
    onNodeEnter: (nodeId: string) => void;
    onNodeLeave: () => void;
    onPointerDown: (event: PointerEvent<SVGSVGElement>) => void;
    onPointerMove: (event: PointerEvent<SVGSVGElement>) => void;
    onPointerUp: (event: PointerEvent<SVGSVGElement>) => void;
    onZoomChange: (delta: number) => void;
}

export const GraphCanvas = ({
    edges,
    visibleEdgeIds,
    animatedGraph,
    activeNodeId,
    activeNeighborIds,
    selectionNeighborIds,
    selectedNodeId,
    selectionAnimationNodeId,
    selectionAnimationKey,
    animateInteractions,
    zoom,
    draggingNodeId,
    showLabels,
    isPanning,
    isFullscreen,
    viewBox,
    stageStyle,
    svgRef,
    isNodeDimmed,
    onSelectNode,
    onNodeKeyDown,
    onNodePointerDown,
    onNodePointerMove,
    onNodePointerUp,
    onNodeEnter,
    onNodeLeave,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onZoomChange
}: GraphCanvasProps) => {
    let revealEdgeOrder = 0;

    return (
    <div
        className="angular-panel relative overflow-hidden border border-[color:var(--border)] bg-[var(--surface-muted)]"
        style={stageStyle}
    >
        <p id="graph-keyboard-help" className="sr-only">
            노드에는 Tab 키로 이동하고 Enter 또는 Space 키로 선택할 수 있습니다. 화살표 키로 화면을 이동하고 더하기와 빼기 키로 확대하거나 축소할 수 있습니다.
        </p>
        <svg
            ref={svgRef}
            viewBox={viewBox}
            preserveAspectRatio="xMidYMid meet"
            className={`block w-full touch-none ${isFullscreen ? 'h-[calc(100vh-280px)] min-h-[360px] lg:h-[calc(100vh-210px)]' : 'h-[360px] sm:h-[520px]'} ${isPanning ? 'cursor-grabbing' : 'cursor-grab'}`}
            role="img"
            aria-label="글, 카테고리, 시리즈 관계 그래프"
            aria-describedby="graph-keyboard-help"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
        >
            <g>
                {edges.map(edge => {
                    const source = animatedGraph.nodeById.get(edge.source);
                    const target = animatedGraph.nodeById.get(edge.target);
                    if (!source || !target) return null;

                    const visible = visibleEdgeIds.has(edge.id);
                    const active = visible && Boolean(activeNodeId)
                        && (edge.source === activeNodeId || edge.target === activeNodeId);
                    const dimmed = isNodeDimmed(source) || isNodeDimmed(target);
                    const opacity = visible ? active ? 0.9 : dimmed ? 0.08 : 0.34 : 0;
                    const reveal = animateInteractions
                        && visible
                        && Boolean(selectionAnimationNodeId)
                        && (edge.source === selectionAnimationNodeId || edge.target === selectionAnimationNodeId);
                    const revealDelay = reveal ? Math.min(revealEdgeOrder++, 8) * 48 : 0;
                    return (
                        <line
                            key={reveal ? `${edge.id}:${selectionAnimationKey}` : edge.id}
                            x1={source.x}
                            y1={source.y}
                            x2={target.x}
                            y2={target.y}
                            stroke={edgeStroke[edge.type]}
                            strokeWidth={active ? 2.8 : edge.type === 'link' ? 1.6 : 1}
                            opacity={opacity}
                            pathLength={1}
                            className={`graph-edge ${reveal ? 'graph-edge-reveal' : ''}`}
                            style={reveal ? {
                                animationDelay: `${revealDelay}ms`,
                                '--graph-edge-opacity': opacity
                            } as CSSProperties : undefined}
                            vectorEffect="non-scaling-stroke"
                        />
                    );
                })}
            </g>

            <g>
                {animatedGraph.nodes.map(node => {
                    const active = Boolean(activeNodeId)
                        && (node.id === activeNodeId || activeNeighborIds.has(node.id));
                    const selected = node.id === selectedNodeId;
                    const dragging = node.id === draggingNodeId;
                    const dimmed = isNodeDimmed(node);
                    const showNodeLabel = showLabels || active || selected;
                    const revealNeighbor = animateInteractions
                        && selectionNeighborIds.has(node.id)
                        && node.id !== selectionAnimationNodeId;

                    return (
                        <g
                            key={revealNeighbor ? `${node.id}:${selectionAnimationKey}` : node.id}
                            role="button"
                            tabIndex={0}
                            aria-pressed={selected}
                            aria-label={`${nodeTypeLabel[node.type]} ${node.label}`}
                            className={`outline-none ${revealNeighbor ? 'graph-neighbor-reveal' : ''}`}
                            onClick={() => onSelectNode(node.id)}
                            onKeyDown={event => onNodeKeyDown(event, node.id)}
                            onPointerDown={event => onNodePointerDown(event, node.id)}
                            onPointerMove={onNodePointerMove}
                            onPointerUp={onNodePointerUp}
                            onPointerCancel={onNodePointerUp}
                            onMouseEnter={() => onNodeEnter(node.id)}
                            onMouseLeave={onNodeLeave}
                            onFocus={() => onNodeEnter(node.id)}
                            onBlur={onNodeLeave}
                        >
                            {animateInteractions && node.id === selectionAnimationNodeId && (
                                <g key={`pulse:${node.id}:${selectionAnimationKey}`} aria-hidden="true" className="pointer-events-none">
                                    <circle
                                        cx={node.x}
                                        cy={node.y}
                                        r={node.radius + 7}
                                        fill="none"
                                        stroke="var(--accent)"
                                        strokeWidth={2}
                                        className="graph-node-pulse"
                                        vectorEffect="non-scaling-stroke"
                                    />
                                    <circle
                                        cx={node.x}
                                        cy={node.y}
                                        r={node.radius + 7}
                                        fill="none"
                                        stroke="var(--accent)"
                                        strokeWidth={1.5}
                                        className="graph-node-pulse graph-node-pulse-delayed"
                                        vectorEffect="non-scaling-stroke"
                                    />
                                </g>
                            )}
                            <circle
                                cx={node.x}
                                cy={node.y}
                                r={selected ? node.radius + 4 : node.radius}
                                className={getNodeClasses(node, selected || node.id === activeNodeId, dimmed, dragging)}
                                stroke={getNodeStroke(node, selected)}
                                strokeWidth={dragging ? 3 : selected ? 3 : 1.5}
                            />
                            {showNodeLabel && (
                                <text
                                    x={node.x}
                                    y={node.y + node.radius + 14}
                                    textAnchor="middle"
                                    className={`pointer-events-none select-none fill-[var(--text)] text-[11px] ${dimmed ? 'opacity-25' : 'opacity-90'}`}
                                >
                                    {clampLabel(node.label)}
                                </text>
                            )}
                        </g>
                    );
                })}
            </g>
        </svg>
        <div
            className="angular-control absolute bottom-3 right-3 flex items-center border border-[color:var(--border)] bg-[var(--surface-overlay)] p-1 backdrop-blur"
            role="group"
            aria-label="그래프 확대 축소"
        >
            <button
                type="button"
                onClick={() => onZoomChange(-GRAPH_ZOOM_STEP)}
                disabled={zoom <= GRAPH_MIN_ZOOM + 0.01}
                aria-label="그래프 축소"
                className="inline-flex h-7 w-7 items-center justify-center text-[var(--text-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--text)] disabled:opacity-30"
            >
                <ZoomOut size={13} aria-hidden="true" />
            </button>
            <span className="w-11 text-center text-[10px] font-semibold text-[var(--text-muted)]">
                {Math.round(zoom * 100)}%
            </span>
            <button
                type="button"
                onClick={() => onZoomChange(GRAPH_ZOOM_STEP)}
                disabled={zoom >= GRAPH_MAX_ZOOM - 0.01}
                aria-label="그래프 확대"
                className="inline-flex h-7 w-7 items-center justify-center text-[var(--text-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--text)] disabled:opacity-30"
            >
                <ZoomIn size={13} aria-hidden="true" />
            </button>
        </div>
    </div>
    );
};
