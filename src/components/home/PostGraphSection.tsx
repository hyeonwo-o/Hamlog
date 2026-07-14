import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    type KeyboardEvent,
    type PointerEvent
} from 'react';
import type { Post } from '../../types/blog';
import { GraphCanvas } from './postGraph/GraphCanvas';
import { GraphDetailPanel } from './postGraph/GraphDetailPanel';
import { GraphToolbar } from './postGraph/GraphToolbar';
import {
    GRAPH_ASPECT_RATIO,
    GRAPH_FOCUS_ZOOM,
    GRAPH_HEIGHT,
    GRAPH_PADDING,
    GRAPH_WIDTH,
    GRAPH_ZOOM_STEP,
    LARGE_GRAPH_ANIMATION_THRESHOLD,
    initialGraphViewport
} from './postGraph/constants';
import { buildGraphData } from './postGraph/graphData';
import {
    clearStoredGraphState,
    readGraphUrlState,
    readStoredGraphState,
    writeGraphUrlState,
    writeStoredGraphState
} from './postGraph/graphState';
import { graphStageStyle } from './postGraph/styles';
import type {
    DraggedGraphNode,
    GraphEdgeFilter,
    GraphFilter,
    GraphNode,
    GraphNodePositions,
    GraphViewport
} from './postGraph/types';
import { useAnimatedGraphLayout } from './postGraph/useAnimatedGraphLayout';
import { usePrefersReducedMotion } from './postGraph/usePrefersReducedMotion';
import { clampPosition, normalizeKey } from './postGraph/utils';
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

const copyText = async (value: string) => {
    if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
        return;
    }

    const textarea = document.createElement('textarea');
    textarea.value = value;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand('copy');
    textarea.remove();
    if (!copied) throw new Error('Clipboard API is unavailable');
};

export const PostGraphSection = ({ posts }: PostGraphSectionProps) => {
    const prefersReducedMotion = usePrefersReducedMotion();
    const initialStateRef = useRef<{
        url: ReturnType<typeof readGraphUrlState>;
        stored: ReturnType<typeof readStoredGraphState>;
    } | null>(null);
    if (initialStateRef.current === null) {
        initialStateRef.current = {
            url: readGraphUrlState(),
            stored: readStoredGraphState()
        };
    }
    const initialState = initialStateRef.current;
    const initialViewport = clampGraphViewport(
        initialState.url.viewport ?? initialState.stored.viewport ?? initialGraphViewport,
        GRAPH_ASPECT_RATIO
    );

    const graph = useMemo(() => buildGraphData(posts), [posts]);
    const postById = useMemo(() => new Map(posts.map(post => [post.id, post])), [posts]);
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(initialState.url.selectedNodeId);
    const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
    const [activeFilter, setActiveFilter] = useState<GraphFilter>(initialState.url.activeFilter);
    const [activeEdgeFilter, setActiveEdgeFilter] = useState<GraphEdgeFilter>(initialState.url.activeEdgeFilter);
    const [showLabels, setShowLabels] = useState(initialState.url.showLabels);
    const [focusMode, setFocusMode] = useState(initialState.url.focusMode);
    const [searchQuery, setSearchQuery] = useState('');
    const [graphViewport, setGraphViewport] = useState<GraphViewport>(initialViewport);
    const [hasCustomViewport, setHasCustomViewport] = useState(Boolean(
        initialState.url.viewport || initialState.stored.viewport
    ));
    const [graphAspectRatio, setGraphAspectRatio] = useState(GRAPH_ASPECT_RATIO);
    const [isPanning, setIsPanning] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [shareStatus, setShareStatus] = useState<'idle' | 'copied' | 'failed'>('idle');
    const [selectionAnimation, setSelectionAnimation] = useState<{
        nodeId: string | null;
        key: number;
    }>({ nodeId: null, key: 0 });
    const [customNodePositions, setCustomNodePositions] = useState<GraphNodePositions>(
        initialState.stored.customNodePositions
    );
    const [draggedNode, setDraggedNode] = useState<DraggedGraphNode | null>(null);
    const sectionRef = useRef<HTMLElement | null>(null);
    const svgRef = useRef<SVGSVGElement | null>(null);
    const searchInputRef = useRef<HTMLInputElement | null>(null);
    const graphViewportRef = useRef(graphViewport);
    const viewportAnimationFrameRef = useRef<number | null>(null);
    const hasCustomViewportRef = useRef(hasCustomViewport);
    const draggedNodeRef = useRef<DraggedGraphNode | null>(null);
    const nativeFullscreenRef = useRef(false);
    const shareStatusTimeoutRef = useRef<number | null>(null);
    const didApplyInitialSelectionRef = useRef(false);
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
    const animateInteractions = !prefersReducedMotion
        && graph.nodes.length < LARGE_GRAPH_ANIMATION_THRESHOLD;
    const activeNodeId = hoveredNodeId ?? (focusMode ? selectedNodeId : null);
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
    const visibleEdges = useMemo(
        () => activeEdgeFilter === 'all'
            ? graph.edges
            : graph.edges.filter(edge => edge.type === activeEdgeFilter),
        [activeEdgeFilter, graph.edges]
    );
    const visibleEdgeIds = useMemo(
        () => new Set(visibleEdges.map(edge => edge.id)),
        [visibleEdges]
    );
    const nodesWithVisibleEdges = useMemo(() => {
        const nodeIds = new Set<string>();
        visibleEdges.forEach(edge => {
            nodeIds.add(edge.source);
            nodeIds.add(edge.target);
        });
        return nodeIds;
    }, [visibleEdges]);
    const activeNeighborIds = useMemo(() => {
        const nodeIds = new Set<string>();
        if (!activeNodeId) return nodeIds;
        visibleEdges.forEach(edge => {
            if (edge.source === activeNodeId) nodeIds.add(edge.target);
            if (edge.target === activeNodeId) nodeIds.add(edge.source);
        });
        return nodeIds;
    }, [activeNodeId, visibleEdges]);
    const selectionNeighborIds = useMemo(() => {
        const nodeIds = new Set<string>();
        if (!selectionAnimation.nodeId) return nodeIds;
        visibleEdges.forEach(edge => {
            if (edge.source === selectionAnimation.nodeId) nodeIds.add(edge.target);
            if (edge.target === selectionAnimation.nodeId) nodeIds.add(edge.source);
        });
        return nodeIds;
    }, [selectionAnimation.nodeId, visibleEdges]);
    const hubNodes = useMemo(() => (
        [...graph.relationNodes]
            .filter(node => activeEdgeFilter === 'all' || node.type === activeEdgeFilter)
            .sort((left, right) => (
                right.relatedPostIds.length - left.relatedPostIds.length
                || left.label.localeCompare(right.label, 'ko')
            ))
            .slice(0, 6)
    ), [activeEdgeFilter, graph.relationNodes]);
    const searchResults = useMemo(() => {
        const query = normalizeKey(searchQuery);
        if (!query) return [];

        const getScore = (node: GraphNode) => {
            const label = normalizeKey(node.label);
            if (label === query) return 0;
            if (label.startsWith(query)) return 1;
            return 2;
        };

        return graph.nodes
            .filter(node => normalizeKey(node.label).includes(query))
            .sort((left, right) => (
                getScore(left) - getScore(right)
                || left.type.localeCompare(right.type)
                || left.label.localeCompare(right.label, 'ko')
            ))
            .slice(0, 8);
    }, [graph.nodes, searchQuery]);

    const markCustomViewport = useCallback((custom: boolean) => {
        hasCustomViewportRef.current = custom;
        setHasCustomViewport(custom);
    }, []);

    const cancelViewportAnimation = useCallback(() => {
        if (viewportAnimationFrameRef.current !== null) {
            window.cancelAnimationFrame(viewportAnimationFrameRef.current);
            viewportAnimationFrameRef.current = null;
        }
    }, []);

    const animateGraphViewport = useCallback((targetViewport: GraphViewport) => {
        cancelViewportAnimation();
        const target = clampGraphViewport(targetViewport, graphAspectRatio);

        if (!animateInteractions) {
            graphViewportRef.current = target;
            setGraphViewport(target);
            return;
        }

        const start = graphViewportRef.current;
        const distance = Math.hypot(target.centerX - start.centerX, target.centerY - start.centerY);
        const zoomDistance = Math.abs(target.zoom - start.zoom);
        if (distance < 0.5 && zoomDistance < 0.005) {
            graphViewportRef.current = target;
            setGraphViewport(target);
            return;
        }

        const duration = Math.min(520, 360 + distance * 0.16);
        let startedAt: number | null = null;

        const tick = (timestamp: number) => {
            startedAt ??= timestamp;
            const progress = Math.min(1, (timestamp - startedAt) / duration);
            const easedProgress = 1 - Math.pow(1 - progress, 3);
            const nextViewport = {
                zoom: start.zoom + (target.zoom - start.zoom) * easedProgress,
                centerX: start.centerX + (target.centerX - start.centerX) * easedProgress,
                centerY: start.centerY + (target.centerY - start.centerY) * easedProgress
            };

            graphViewportRef.current = nextViewport;
            setGraphViewport(nextViewport);

            if (progress < 1) {
                viewportAnimationFrameRef.current = window.requestAnimationFrame(tick);
            } else {
                viewportAnimationFrameRef.current = null;
                graphViewportRef.current = target;
                setGraphViewport(target);
            }
        };

        viewportAnimationFrameRef.current = window.requestAnimationFrame(tick);
    }, [animateInteractions, cancelViewportAnimation, graphAspectRatio]);

    const changeGraphZoom = useCallback((delta: number, anchor?: { x: number; y: number }) => {
        cancelViewportAnimation();
        markCustomViewport(true);
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
    }, [cancelViewportAnimation, graphAspectRatio, markCustomViewport]);

    const focusGraphNode = useCallback((nodeId: string) => {
        const node = animatedGraph.nodeById.get(nodeId) ?? graph.nodeById.get(nodeId);
        if (!node) return;

        setSelectedNodeId(nodeId);
        setHoveredNodeId(null);
        setFocusMode(true);
        setSelectionAnimation(previous => ({ nodeId, key: previous.key + 1 }));
        markCustomViewport(true);
        animateGraphViewport({
            zoom: Math.max(graphViewportRef.current.zoom, GRAPH_FOCUS_ZOOM),
            centerX: node.x,
            centerY: node.y
        });
    }, [animateGraphViewport, animatedGraph.nodeById, graph.nodeById, markCustomViewport]);

    const resetGraph = useCallback(() => {
        cancelViewportAnimation();
        markCustomViewport(false);
        setSelectedNodeId(null);
        setHoveredNodeId(null);
        setActiveFilter('all');
        setActiveEdgeFilter('all');
        setShowLabels(true);
        setFocusMode(true);
        setSearchQuery('');
        setSelectionAnimation(previous => ({ nodeId: null, key: previous.key + 1 }));
        setCustomNodePositions({});
        draggedNodeRef.current = null;
        setDraggedNode(null);
        setGraphViewport(autoFitViewport);
        graphViewportRef.current = autoFitViewport;
        clearStoredGraphState();
        writeGraphUrlState({
            selectedNodeId: null,
            activeFilter: 'all',
            activeEdgeFilter: 'all',
            showLabels: true,
            focusMode: true,
            viewport: null
        });
    }, [autoFitViewport, cancelViewportAnimation, markCustomViewport]);

    const toggleFullscreen = useCallback(async () => {
        const section = sectionRef.current;
        if (!section) return;

        if (isFullscreen) {
            if (nativeFullscreenRef.current && document.fullscreenElement) {
                await document.exitFullscreen().catch(() => undefined);
            } else {
                setIsFullscreen(false);
            }
            return;
        }

        if (typeof section.requestFullscreen === 'function') {
            try {
                await section.requestFullscreen();
                nativeFullscreenRef.current = true;
                setIsFullscreen(true);
                return;
            } catch {
                nativeFullscreenRef.current = false;
            }
        }

        setIsFullscreen(true);
    }, [isFullscreen]);

    const shareGraph = useCallback(async () => {
        const url = writeGraphUrlState({
            selectedNodeId,
            activeFilter,
            activeEdgeFilter,
            showLabels,
            focusMode,
            viewport: graphViewport
        });

        try {
            await copyText(url);
            setShareStatus('copied');
        } catch {
            setShareStatus('failed');
        }

        if (shareStatusTimeoutRef.current !== null) {
            window.clearTimeout(shareStatusTimeoutRef.current);
        }
        shareStatusTimeoutRef.current = window.setTimeout(() => setShareStatus('idle'), 1800);
    }, [activeEdgeFilter, activeFilter, focusMode, graphViewport, selectedNodeId, showLabels]);

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
    }, [graph.nodes.length, isFullscreen]);

    useEffect(() => {
        graphViewportRef.current = graphViewport;
    }, [graphViewport]);

    useEffect(() => () => cancelViewportAnimation(), [cancelViewportAnimation]);

    useEffect(() => {
        if (!selectionAnimation.nodeId) return undefined;
        const timeout = window.setTimeout(() => {
            setSelectionAnimation(previous => (
                previous.key === selectionAnimation.key
                    ? { ...previous, nodeId: null }
                    : previous
            ));
        }, 1100);
        return () => window.clearTimeout(timeout);
    }, [selectionAnimation.key, selectionAnimation.nodeId]);

    useEffect(() => {
        if (hasCustomViewportRef.current) return;
        graphViewportRef.current = autoFitViewport;
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
        if (selectedNodeId && !graphNodeIds.has(selectedNodeId)) {
            setSelectedNodeId(null);
        }
    }, [graph.nodes, selectedNodeId]);

    useEffect(() => {
        if (didApplyInitialSelectionRef.current || !selectedNodeId) return;
        if (!graph.nodeById.has(selectedNodeId)) return;
        didApplyInitialSelectionRef.current = true;
        if (!initialState.url.viewport && !initialState.stored.viewport) {
            focusGraphNode(selectedNodeId);
        }
    }, [focusGraphNode, graph.nodeById, initialState.stored.viewport, initialState.url.viewport, selectedNodeId]);

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

    useEffect(() => {
        const timeout = window.setTimeout(() => {
            writeGraphUrlState({
                selectedNodeId,
                activeFilter,
                activeEdgeFilter,
                showLabels,
                focusMode,
                viewport: hasCustomViewport ? graphViewport : null
            });
        }, 180);
        return () => window.clearTimeout(timeout);
    }, [activeEdgeFilter, activeFilter, focusMode, graphViewport, hasCustomViewport, selectedNodeId, showLabels]);

    useEffect(() => {
        const timeout = window.setTimeout(() => {
            writeStoredGraphState({
                viewport: hasCustomViewport ? graphViewport : null,
                customNodePositions
            });
        }, 240);
        return () => window.clearTimeout(timeout);
    }, [customNodePositions, graphViewport, hasCustomViewport]);

    useEffect(() => {
        const handlePopState = () => {
            cancelViewportAnimation();
            const nextState = readGraphUrlState();
            setSelectedNodeId(nextState.selectedNodeId);
            setHoveredNodeId(null);
            setActiveFilter(nextState.activeFilter);
            setActiveEdgeFilter(nextState.activeEdgeFilter);
            setShowLabels(nextState.showLabels);
            setFocusMode(nextState.focusMode);
            if (nextState.viewport) {
                markCustomViewport(true);
                const nextViewport = clampGraphViewport(nextState.viewport, graphAspectRatio);
                graphViewportRef.current = nextViewport;
                setGraphViewport(nextViewport);
            } else {
                markCustomViewport(false);
                graphViewportRef.current = autoFitViewport;
                setGraphViewport(autoFitViewport);
            }
        };

        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, [autoFitViewport, cancelViewportAnimation, graphAspectRatio, markCustomViewport]);

    useEffect(() => {
        const handleFullscreenChange = () => {
            if (!nativeFullscreenRef.current) return;
            const active = document.fullscreenElement === sectionRef.current;
            setIsFullscreen(active);
            if (!active) nativeFullscreenRef.current = false;
        };
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
    }, []);

    useEffect(() => {
        if (!isFullscreen) return undefined;
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = previousOverflow;
        };
    }, [isFullscreen]);

    useEffect(() => {
        const handleKeyboardShortcut = (event: globalThis.KeyboardEvent) => {
            const target = event.target as HTMLElement | null;
            const isTyping = Boolean(target?.closest('input, textarea, select, [contenteditable="true"]'));

            if (event.key === '/' && !isTyping) {
                event.preventDefault();
                searchInputRef.current?.focus();
                return;
            }
            if (event.key === 'Escape' && !isTyping) {
                setSearchQuery('');
                setSelectedNodeId(null);
                setSelectionAnimation(previous => ({ nodeId: null, key: previous.key + 1 }));
                if (isFullscreen && !nativeFullscreenRef.current) setIsFullscreen(false);
                return;
            }
            if (isTyping) return;

            const graphHasFocus = isFullscreen || Boolean(
                sectionRef.current?.contains(document.activeElement)
            );
            if (!graphHasFocus) return;

            if (event.key === '+' || event.key === '=') {
                event.preventDefault();
                changeGraphZoom(GRAPH_ZOOM_STEP);
            } else if (event.key === '-') {
                event.preventDefault();
                changeGraphZoom(-GRAPH_ZOOM_STEP);
            } else if (event.key === '0') {
                event.preventDefault();
                resetGraph();
            } else if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
                event.preventDefault();
                cancelViewportAnimation();
                markCustomViewport(true);
                setGraphViewport(previousViewport => {
                    const dimensions = getGraphViewportDimensions(previousViewport.zoom, graphAspectRatio);
                    const stepX = dimensions.width * 0.08;
                    const stepY = dimensions.height * 0.08;
                    return clampGraphViewport({
                        ...previousViewport,
                        centerX: previousViewport.centerX + (event.key === 'ArrowLeft' ? -stepX : event.key === 'ArrowRight' ? stepX : 0),
                        centerY: previousViewport.centerY + (event.key === 'ArrowUp' ? -stepY : event.key === 'ArrowDown' ? stepY : 0)
                    }, graphAspectRatio);
                });
            }
        };

        window.addEventListener('keydown', handleKeyboardShortcut);
        return () => window.removeEventListener('keydown', handleKeyboardShortcut);
    }, [cancelViewportAnimation, changeGraphZoom, graphAspectRatio, isFullscreen, markCustomViewport, resetGraph]);

    useEffect(() => () => {
        if (shareStatusTimeoutRef.current !== null) {
            window.clearTimeout(shareStatusTimeoutRef.current);
        }
    }, []);

    if (graph.nodes.length === 0) return null;

    const selectedNode = selectedNodeId
        ? animatedGraph.nodeById.get(selectedNodeId) ?? null
        : null;
    const relatedPosts = selectedNode
        ? selectedNode.relatedPostIds
            .map(id => postById.get(id))
            .filter((post): post is Post => Boolean(post))
            .slice(0, 5)
        : [];

    const isNodeDimmed = (node: GraphNode) => {
        const isContextNode = Boolean(activeNodeId) && (
            node.id === activeNodeId || activeNeighborIds.has(node.id)
        );
        const matchesNodeFilter = activeFilter === 'all' || node.type === activeFilter;
        const matchesEdgeFilter = activeEdgeFilter === 'all' || nodesWithVisibleEdges.has(node.id);

        if (isContextNode) return false;
        if (activeNodeId) return true;
        return !matchesNodeFilter || !matchesEdgeFilter;
    };

    const selectNode = (nodeId: string) => {
        if (didPanRef.current || didDragNodeRef.current) return;
        setSelectedNodeId(nodeId);
        setHoveredNodeId(null);
        setFocusMode(true);
        setSelectionAnimation(previous => ({ nodeId: null, key: previous.key + 1 }));
    };

    const handleGraphPointerDown = (event: PointerEvent<SVGSVGElement>) => {
        if (event.pointerType === 'mouse' && event.button !== 0) return;
        if (nodeDragRef.current) return;
        cancelViewportAnimation();

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
        markCustomViewport(true);
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
    return (
        <section
            ref={sectionRef}
            id="graph"
            className={isFullscreen
                ? 'graph-fullscreen-enter fixed inset-0 z-[100] overflow-y-auto bg-[var(--bg)] px-4 py-4 text-[var(--text)]'
                : 'mx-auto max-w-7xl px-4 pb-8 pt-2'}
        >
            <h2 className="sr-only">그래프뷰 탐색</h2>
            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[var(--text-muted)]">
                <span>
                    노드 {graph.nodes.length}개 · 연결 {visibleEdges.length}/{graph.edges.length}개
                </span>
                <span className="hidden sm:inline">
                    노드 크기는 조회수와 연결 수를 반영합니다.
                    {graph.isPostLimitApplied && ` 최신 글 ${graph.postNodes.length}/${graph.totalPostCount}편 표시 중`}
                </span>
            </div>

            <GraphToolbar
                activeFilter={activeFilter}
                activeEdgeFilter={activeEdgeFilter}
                showLabels={showLabels}
                searchQuery={searchQuery}
                searchResults={searchResults}
                searchInputRef={searchInputRef}
                isFullscreen={isFullscreen}
                shareStatus={shareStatus}
                onFilterChange={setActiveFilter}
                onEdgeFilterChange={setActiveEdgeFilter}
                onShowLabelsChange={setShowLabels}
                onSearchQueryChange={setSearchQuery}
                onSearchSubmit={() => {
                    if (searchResults[0]) focusGraphNode(searchResults[0].id);
                }}
                onSearchResultSelect={focusGraphNode}
                onToggleFullscreen={() => void toggleFullscreen()}
                onShare={() => void shareGraph()}
                onReset={resetGraph}
            />

            <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_280px]">
                <GraphCanvas
                    edges={graph.edges}
                    visibleEdgeIds={visibleEdgeIds}
                    animatedGraph={animatedGraph}
                    activeNodeId={activeNodeId}
                    activeNeighborIds={activeNeighborIds}
                    selectionNeighborIds={selectionNeighborIds}
                    selectedNodeId={selectedNodeId}
                    selectionAnimationNodeId={selectionAnimation.nodeId}
                    selectionAnimationKey={selectionAnimation.key}
                    animateInteractions={animateInteractions}
                    zoom={graphViewport.zoom}
                    draggingNodeId={draggedNode?.id ?? null}
                    showLabels={showLabels}
                    isPanning={isPanning}
                    isFullscreen={isFullscreen}
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
                    onZoomChange={changeGraphZoom}
                />

                <GraphDetailPanel
                    selectedNode={selectedNode}
                    relatedPosts={relatedPosts}
                    hubNodes={hubNodes}
                    isFullscreen={isFullscreen}
                    onFocusNode={focusGraphNode}
                    onClearSelection={() => {
                        setSelectedNodeId(null);
                        setHoveredNodeId(null);
                    }}
                />
            </div>
        </section>
    );
};
