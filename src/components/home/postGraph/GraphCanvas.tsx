import type { CSSProperties, KeyboardEvent, PointerEvent, RefObject } from 'react';
import { edgeStroke, nodeTypeLabel } from './constants';
import type { GraphData, GraphNode } from './types';
import { clampLabel, getNodeClasses, getNodeStroke } from './utils';

interface GraphCanvasProps {
    graph: GraphData;
    animatedGraph: {
        nodes: GraphNode[];
        nodeById: Map<string, GraphNode>;
    };
    activeNodeId: string | null;
    activeNeighborIds: Set<string>;
    selectedNodeId: string | null;
    draggingNodeId: string | null;
    showLabels: boolean;
    isPanning: boolean;
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
}

export const GraphCanvas = ({
    graph,
    animatedGraph,
    activeNodeId,
    activeNeighborIds,
    selectedNodeId,
    draggingNodeId,
    showLabels,
    isPanning,
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
    onPointerUp
}: GraphCanvasProps) => (
    <div
        className="angular-panel overflow-hidden border border-[color:var(--border)] bg-[var(--surface-muted)]"
        style={stageStyle}
    >
        <svg
            ref={svgRef}
            viewBox={viewBox}
            preserveAspectRatio="xMidYMid meet"
            className={`block h-[300px] w-full touch-none sm:h-[420px] ${isPanning ? 'cursor-grabbing' : 'cursor-grab'}`}
            role="img"
            aria-label="글, 카테고리, 시리즈 관계 그래프"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
        >
            <g>
                {graph.edges.map(edge => {
                    const source = animatedGraph.nodeById.get(edge.source);
                    const target = animatedGraph.nodeById.get(edge.target);
                    if (!source || !target) return null;

                    const active = Boolean(activeNodeId)
                        && (edge.source === activeNodeId || edge.target === activeNodeId);
                    const dimmed = isNodeDimmed(source) || isNodeDimmed(target);
                    return (
                        <line
                            key={edge.id}
                            x1={source.x}
                            y1={source.y}
                            x2={target.x}
                            y2={target.y}
                            stroke={edgeStroke[edge.type]}
                            strokeWidth={active ? 2.8 : edge.type === 'link' ? 1.6 : 1}
                            opacity={active ? 0.9 : dimmed ? 0.08 : 0.34}
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

                    return (
                        <g
                            key={node.id}
                            role="button"
                            tabIndex={0}
                            aria-label={`${nodeTypeLabel[node.type]} ${node.label}`}
                            className="outline-none"
                            onClick={() => onSelectNode(node.id)}
                            onKeyDown={event => onNodeKeyDown(event, node.id)}
                            onPointerDown={event => onNodePointerDown(event, node.id)}
                            onPointerMove={onNodePointerMove}
                            onPointerUp={onNodePointerUp}
                            onPointerCancel={onNodePointerUp}
                            onMouseEnter={() => onNodeEnter(node.id)}
                            onMouseLeave={onNodeLeave}
                        >
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
    </div>
);
