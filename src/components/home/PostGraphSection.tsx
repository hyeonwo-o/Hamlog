import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import type { Post } from '../../types/blog';
import { GraphCanvas } from './postGraph/GraphCanvas';
import { GraphDetailPanel } from './postGraph/GraphDetailPanel';
import { GraphToolbar } from './postGraph/GraphToolbar';
import {
    GRAPH_ASPECT_RATIO,
    GRAPH_HEIGHT,
    GRAPH_PADDING,
    GRAPH_WIDTH,
    GRAPH_ZOOM_STEP,
    initialGraphViewport
} from './postGraph/constants';
import { buildGraphData } from './postGraph/graphData';
import { graphStageStyle } from './postGraph/styles';
import type { DraggedGraphNode, GraphFilter, GraphNode, GraphNodePositions, GraphViewport } from './postGraph/types';
import { useAnimatedGraphLayout } from './postGraph/useAnimatedGraphLayout';
import { clampPosition } from './postGraph/utils';
import {
    clampGraphViewport,
    clampGraphZoom,
    getAutoFitGraphViewport,
    getGraphPoint,
    getGraphViewBox,
    getGraphViewportDimensions
} from './postGraph/viewport';

interface PostGraphSectionProps {
    posts: Post[];
}

export const PostGraphSection = ({ posts }: PostGraphSectionProps) => {
    const graph = useMemo(() => buildGraphData(posts), [posts]);
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
    const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
    const [activeFilter, setActiveFilter] = useState<GraphFilter>('all');
    const [showLabels, setShowLabels] = useState(true);
    const [graphViewport, setGraphViewport] = useState<GraphViewport>(initialGraphViewport);
    const [graphAspectRatio, setGraphAspectRatio] = useState(GRAPH_ASPECT_RATIO);
    const [isPanning, setIsPanning] = useState(false);
    const [customNodePositions, setCustomNodePositions] = useState<GraphNodePositions>({});
    const [draggedNode, setDraggedNode] = useState<DraggedGraphNode | null>(null);
    const svgRef = useRef<SVGSVGElement | null>(null);
    const hasCustomViewportRef = useRef(false);
    const draggedNodeRef = useRef<DraggedGraphNode | null>(null);
    const dragRef = useRef<{
        pointerId: number;
        startX: number;
        startY: number;
        centerX: number;
        centerY: number;
        zoom: number;
        viewBoxWidth: number;
        viewBoxHeight: number;
    } | null>(null);
    const nodeDragRef = useRef<{
        pointerId: number;
        nodeId: string;
        startX: number;
        startY: number;
        offsetX: number;
        offsetY: number;
    } | null>(null);
    const didPanRef = useRef(false);
    const didDragNodeRef = useRef(false);
    const activeNodeId = hoveredNodeId ?? selectedNodeId;
    const animatedGraph = useAnimatedGraphLayout(
        graph,
        activeFilter,
        activeNodeId,
        customNodePositions,
        draggedNode
    );
    const autoFitViewport = useMemo(
        () => getAutoFitGraphViewport(graph.nodes, graphAspectRatio),
        [graph.nodes, graphAspectRatio]
    );
    const hubNodes = useMemo(() => (
        [...graph.relationNodes]
            .sort((left, right) => (
                right.relatedPostIds.length - left.relatedPostIds.length
                || left.label.localeCompare(right.label, 'ko')
            ))
            .slice(0, 6)
    ), [graph]);

    const changeGraphZoom = useCallback((delta: number, anchor?: { x: number; y: number }) => {
        hasCustomViewportRef.current = true;
        setGraphViewport(previousViewport => {
            const zoom = clampGraphZoom(previousViewport.zoom + delta);
            const previousDimensions = getGraphViewportDimensions(previousViewport.zoom, graphAspectRatio);
            const nextDimensions = getGraphViewportDimensions(zoom, graphAspectRatio);
            const zoomAnchor = anchor ?? {
                x: previousViewport.centerX,
                y: previousViewport.centerY
            };
            const relativeX = (
                zoomAnchor.x - (previousViewport.centerX - previousDimensions.width / 2)
            ) / previousDimensions.width;
            const relativeY = (
                zoomAnchor.y - (previousViewport.centerY - previousDimensions.height / 2)
            ) / previousDimensions.height;

            return clampGraphViewport({
                zoom,
                centerX: zoomAnchor.x - (relativeX - 0.5) * nextDimensions.width,
                centerY: zoomAnchor.y - (relativeY - 0.5) * nextDimensions.height
            }, graphAspectRatio);
        });
    }, [graphAspectRatio]);

    useEffect(() => {
        const svg = svgRef.current;
        if (!svg) return undefined;

        const updateAspectRatio = () => {
            const rect = svg.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
                setGraphAspectRatio(rect.width / rect.height);
            }
        };

        updateAspectRatio();

        if (typeof ResizeObserver === 'undefined') {
            window.addEventListener('resize', updateAspectRatio);
            return () => window.removeEventListener('resize', updateAspectRatio);
        }

        const resizeObserver = new ResizeObserver(updateAspectRatio);
        resizeObserver.observe(svg);

        return () => resizeObserver.disconnect();
    }, [graph.nodes.length]);

    useEffect(() => {
        if (hasCustomViewportRef.current) return;
        setGraphViewport(autoFitViewport);
    }, [autoFitViewport]);

    useEffect(() => {
        const graphNodeIds = new Set(graph.nodes.map(node => node.id));
        setCustomNodePositions(previousPositions => {
            const nextPositions = Object.fromEntries(
                Object.entries(previousPositions).filter(([nodeId]) => graphNodeIds.has(nodeId))
            );
            return Object.keys(nextPositions).length === Object.keys(previousPositions).length
                ? previousPositions
                : nextPositions;
        });
        setDraggedNode(currentDraggedNode => (
            currentDraggedNode && graphNodeIds.has(currentDraggedNode.id)
                ? currentDraggedNode
                : null
        ));
        if (draggedNodeRef.current && !graphNodeIds.has(draggedNodeRef.current.id)) {
            draggedNodeRef.current = null;
        }
    }, [graph.nodes]);

    useEffect(() => {
        const svg = svgRef.current;
        if (!svg) return undefined;

        const handleWheel = (event: globalThis.WheelEvent) => {
            event.preventDefault();
            const anchor = getGraphPoint(event.clientX, event.clientY, svg, graphViewport, graphAspectRatio);

            changeGraphZoom(event.deltaY > 0 ? -GRAPH_ZOOM_STEP : GRAPH_ZOOM_STEP, anchor);
        };

        svg.addEventListener('wheel', handleWheel, { passive: false });

        return () => svg.removeEventListener('wheel', handleWheel);
    }, [changeGraphZoom, graphAspectRatio, graphViewport]);

    if (graph.nodes.length === 0) return null;

    const fallbackNode = animatedGraph.nodes.find(node => node.type === 'post') ?? animatedGraph.nodes[0] as GraphNode;
    const selectedNode = selectedNodeId
        ? animatedGraph.nodeById.get(selectedNodeId) ?? fallbackNode
        : fallbackNode;
    const activeNeighborIds = new Set<string>();

    if (activeNodeId) {
        graph.edges.forEach(edge => {
            if (edge.source === activeNodeId) activeNeighborIds.add(edge.target);
            if (edge.target === activeNodeId) activeNeighborIds.add(edge.source);
        });
    }

    const relatedPosts = selectedNode.relatedPostIds
        .map(id => posts.find(post => post.id === id))
        .filter((post): post is Post => Boolean(post))
        .slice(0, 5);

    const isNodeDimmed = (node: GraphNode) => {
        const isContextNode = Boolean(activeNodeId) && (
            node.id === activeNodeId || activeNeighborIds.has(node.id)
        );
        const matchesFilter = activeFilter === 'all' || node.type === activeFilter;

        if (isContextNode) return false;
        if (activeNodeId) return true;
        return !matchesFilter;
    };

    const selectNode = (nodeId: string) => {
        if (didPanRef.current || didDragNodeRef.current) return;
        setSelectedNodeId(nodeId);
        setHoveredNodeId(null);
    };

    const resetGraph = () => {
        hasCustomViewportRef.current = false;
        setSelectedNodeId(null);
        setHoveredNodeId(null);
        setActiveFilter('all');
        setShowLabels(true);
        setCustomNodePositions({});
        draggedNodeRef.current = null;
        setDraggedNode(null);
        setGraphViewport(autoFitViewport);
    };

    const handleGraphPointerDown = (event: PointerEvent<SVGSVGElement>) => {
        if (event.pointerType === 'mouse' && event.button !== 0) return;
        if (nodeDragRef.current) return;

        const viewportDimensions = getGraphViewportDimensions(graphViewport.zoom, graphAspectRatio);

        dragRef.current = {
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            centerX: graphViewport.centerX,
            centerY: graphViewport.centerY,
            zoom: graphViewport.zoom,
            viewBoxWidth: viewportDimensions.width,
            viewBoxHeight: viewportDimensions.height
        };
        didPanRef.current = false;
        event.currentTarget.setPointerCapture(event.pointerId);
    };

    const handleGraphPointerMove = (event: PointerEvent<SVGSVGElement>) => {
        const drag = dragRef.current;
        if (!drag || drag.pointerId !== event.pointerId) return;

        const deltaX = event.clientX - drag.startX;
        const deltaY = event.clientY - drag.startY;
        if (Math.hypot(deltaX, deltaY) < 3) return;

        const rect = event.currentTarget.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;

        event.preventDefault();
        hasCustomViewportRef.current = true;
        didPanRef.current = true;
        setIsPanning(true);
        setGraphViewport(clampGraphViewport({
            zoom: drag.zoom,
            centerX: drag.centerX - (deltaX / rect.width) * drag.viewBoxWidth,
            centerY: drag.centerY - (deltaY / rect.height) * drag.viewBoxHeight
        }, graphAspectRatio));
    };

    const releaseGraphPointer = (event: PointerEvent<SVGSVGElement>) => {
        const drag = dragRef.current;
        if (!drag || drag.pointerId !== event.pointerId) return;

        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
        }

        dragRef.current = null;
        setIsPanning(false);
        window.setTimeout(() => {
            didPanRef.current = false;
        }, 0);
    };

    const handleNodePointerDown = (event: PointerEvent<SVGGElement>, nodeId: string) => {
        if (event.pointerType === 'mouse' && event.button !== 0) return;

        const svg = svgRef.current;
        const node = animatedGraph.nodeById.get(nodeId);
        if (!svg || !node) return;

        event.preventDefault();
        event.stopPropagation();

        const graphPoint = getGraphPoint(event.clientX, event.clientY, svg, graphViewport, graphAspectRatio);
        nodeDragRef.current = {
            pointerId: event.pointerId,
            nodeId,
            startX: event.clientX,
            startY: event.clientY,
            offsetX: node.x - graphPoint.x,
            offsetY: node.y - graphPoint.y
        };
        didDragNodeRef.current = false;
        setHoveredNodeId(nodeId);
        event.currentTarget.setPointerCapture(event.pointerId);
    };

    const handleNodePointerMove = (event: PointerEvent<SVGGElement>) => {
        const nodeDrag = nodeDragRef.current;
        const svg = svgRef.current;
        if (!nodeDrag || nodeDrag.pointerId !== event.pointerId || !svg) return;

        const deltaX = event.clientX - nodeDrag.startX;
        const deltaY = event.clientY - nodeDrag.startY;
        if (Math.hypot(deltaX, deltaY) < 3) return;

        event.preventDefault();
        event.stopPropagation();

        const graphPoint = getGraphPoint(event.clientX, event.clientY, svg, graphViewport, graphAspectRatio);
        didDragNodeRef.current = true;
        setSelectedNodeId(nodeDrag.nodeId);
        setHoveredNodeId(null);
        const nextDraggedNode = {
            id: nodeDrag.nodeId,
            x: clampPosition(graphPoint.x + nodeDrag.offsetX, GRAPH_PADDING, GRAPH_WIDTH - GRAPH_PADDING),
            y: clampPosition(graphPoint.y + nodeDrag.offsetY, GRAPH_PADDING, GRAPH_HEIGHT - GRAPH_PADDING)
        };
        draggedNodeRef.current = nextDraggedNode;
        setDraggedNode(nextDraggedNode);
    };

    const releaseNodePointer = (event: PointerEvent<SVGGElement>) => {
        const nodeDrag = nodeDragRef.current;
        if (!nodeDrag || nodeDrag.pointerId !== event.pointerId) return;

        event.stopPropagation();

        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
        }

        const currentDraggedNode = draggedNodeRef.current;
        if (currentDraggedNode?.id === nodeDrag.nodeId && didDragNodeRef.current) {
            setCustomNodePositions(previousPositions => ({
                ...previousPositions,
                [currentDraggedNode.id]: {
                    x: currentDraggedNode.x,
                    y: currentDraggedNode.y
                }
            }));
        } else if (!didDragNodeRef.current) {
            setSelectedNodeId(nodeDrag.nodeId);
            setHoveredNodeId(null);
        }

        draggedNodeRef.current = null;
        setDraggedNode(null);
        nodeDragRef.current = null;
        window.setTimeout(() => {
            didDragNodeRef.current = false;
        }, 0);
    };

    const handleNodeKeyDown = (event: KeyboardEvent<SVGGElement>, nodeId: string) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        selectNode(nodeId);
    };

    const graphViewBox = getGraphViewBox(graphViewport, graphAspectRatio);
    const graphZoomPercent = Math.round(graphViewport.zoom * 100);

    return (
        <section id="graph" className="mx-auto max-w-6xl px-4 py-8">
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                    <h2 className="font-display text-xl font-semibold">그래프 뷰</h2>
                </div>
                <span className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">
                    {graph.nodes.length} nodes · {graph.edges.length} links
                </span>
            </div>

            <GraphToolbar
                activeFilter={activeFilter}
                showLabels={showLabels}
                zoom={graphViewport.zoom}
                zoomPercent={graphZoomPercent}
                onFilterChange={setActiveFilter}
                onShowLabelsChange={setShowLabels}
                onZoomChange={changeGraphZoom}
                onReset={resetGraph}
            />

            <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
                <GraphCanvas
                    graph={graph}
                    animatedGraph={animatedGraph}
                    activeNodeId={activeNodeId}
                    activeNeighborIds={activeNeighborIds}
                    selectedNodeId={selectedNodeId}
                    draggingNodeId={draggedNode?.id ?? null}
                    showLabels={showLabels}
                    isPanning={isPanning}
                    viewBox={graphViewBox}
                    stageStyle={graphStageStyle}
                    svgRef={svgRef}
                    isNodeDimmed={isNodeDimmed}
                    onSelectNode={selectNode}
                    onNodeKeyDown={handleNodeKeyDown}
                    onNodePointerDown={handleNodePointerDown}
                    onNodePointerMove={handleNodePointerMove}
                    onNodePointerUp={releaseNodePointer}
                    onNodeEnter={setHoveredNodeId}
                    onNodeLeave={() => setHoveredNodeId(null)}
                    onPointerDown={handleGraphPointerDown}
                    onPointerMove={handleGraphPointerMove}
                    onPointerUp={releaseGraphPointer}
                />

                <GraphDetailPanel
                    graph={graph}
                    selectedNode={selectedNode}
                    relatedPosts={relatedPosts}
                    hubNodes={hubNodes}
                    onSelectNode={selectNode}
                />
            </div>
        </section>
    );
};
