import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import type { Post } from '../../types/blog';
import { GraphCanvas } from './postGraph/GraphCanvas';
import { GraphDetailPanel } from './postGraph/GraphDetailPanel';
import { GraphToolbar } from './postGraph/GraphToolbar';
import { GRAPH_HEIGHT, GRAPH_WIDTH, GRAPH_ZOOM_STEP, initialGraphViewport } from './postGraph/constants';
import { buildGraphData } from './postGraph/graphData';
import { graphStageStyle } from './postGraph/styles';
import type { GraphFilter, GraphNode, GraphViewport } from './postGraph/types';
import { useAnimatedGraphLayout } from './postGraph/useAnimatedGraphLayout';
import { clampGraphViewport, clampGraphZoom, getGraphPoint, getGraphViewBox } from './postGraph/viewport';

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
    const [isPanning, setIsPanning] = useState(false);
    const svgRef = useRef<SVGSVGElement | null>(null);
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
    const didPanRef = useRef(false);
    const activeNodeId = hoveredNodeId ?? selectedNodeId;
    const animatedGraph = useAnimatedGraphLayout(graph, activeFilter, activeNodeId);
    const hubNodes = useMemo(() => (
        [...graph.relationNodes]
            .sort((left, right) => (
                right.relatedPostIds.length - left.relatedPostIds.length
                || left.label.localeCompare(right.label, 'ko')
            ))
            .slice(0, 6)
    ), [graph]);

    const changeGraphZoom = useCallback((delta: number, anchor?: { x: number; y: number }) => {
        setGraphViewport(previousViewport => {
            const zoom = clampGraphZoom(previousViewport.zoom + delta);
            const previousViewBoxWidth = GRAPH_WIDTH / previousViewport.zoom;
            const previousViewBoxHeight = GRAPH_HEIGHT / previousViewport.zoom;
            const nextViewBoxWidth = GRAPH_WIDTH / zoom;
            const nextViewBoxHeight = GRAPH_HEIGHT / zoom;
            const zoomAnchor = anchor ?? {
                x: previousViewport.centerX,
                y: previousViewport.centerY
            };
            const relativeX = (zoomAnchor.x - (previousViewport.centerX - previousViewBoxWidth / 2)) / previousViewBoxWidth;
            const relativeY = (zoomAnchor.y - (previousViewport.centerY - previousViewBoxHeight / 2)) / previousViewBoxHeight;

            return clampGraphViewport({
                zoom,
                centerX: zoomAnchor.x - (relativeX - 0.5) * nextViewBoxWidth,
                centerY: zoomAnchor.y - (relativeY - 0.5) * nextViewBoxHeight
            });
        });
    }, []);

    useEffect(() => {
        const svg = svgRef.current;
        if (!svg) return undefined;

        const handleWheel = (event: globalThis.WheelEvent) => {
            event.preventDefault();
            const anchor = getGraphPoint(event.clientX, event.clientY, svg, graphViewport);

            changeGraphZoom(event.deltaY > 0 ? -GRAPH_ZOOM_STEP : GRAPH_ZOOM_STEP, anchor);
        };

        svg.addEventListener('wheel', handleWheel, { passive: false });

        return () => svg.removeEventListener('wheel', handleWheel);
    }, [changeGraphZoom, graphViewport]);

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
        if (didPanRef.current) return;
        setSelectedNodeId(nodeId);
        setHoveredNodeId(null);
    };

    const resetGraph = () => {
        setSelectedNodeId(null);
        setHoveredNodeId(null);
        setActiveFilter('all');
        setShowLabels(true);
        setGraphViewport(initialGraphViewport);
    };

    const handleGraphPointerDown = (event: PointerEvent<SVGSVGElement>) => {
        if (event.pointerType === 'mouse' && event.button !== 0) return;

        dragRef.current = {
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            centerX: graphViewport.centerX,
            centerY: graphViewport.centerY,
            zoom: graphViewport.zoom,
            viewBoxWidth: GRAPH_WIDTH / graphViewport.zoom,
            viewBoxHeight: GRAPH_HEIGHT / graphViewport.zoom
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
        didPanRef.current = true;
        setIsPanning(true);
        setGraphViewport(clampGraphViewport({
            zoom: drag.zoom,
            centerX: drag.centerX - (deltaX / rect.width) * drag.viewBoxWidth,
            centerY: drag.centerY - (deltaY / rect.height) * drag.viewBoxHeight
        }));
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

    const handleNodeKeyDown = (event: KeyboardEvent<SVGGElement>, nodeId: string) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        selectNode(nodeId);
    };

    const graphViewBox = getGraphViewBox(graphViewport);
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
                    showLabels={showLabels}
                    isPanning={isPanning}
                    viewBox={graphViewBox}
                    stageStyle={graphStageStyle}
                    svgRef={svgRef}
                    isNodeDimmed={isNodeDimmed}
                    onSelectNode={selectNode}
                    onNodeKeyDown={handleNodeKeyDown}
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
