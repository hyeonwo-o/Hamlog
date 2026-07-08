import { useEffect, useMemo, useRef, useState } from 'react';
import {
    ANIMATION_FRAME_LIMIT,
    ANIMATION_MIN_FRAMES,
    ANIMATION_SETTLE_SPEED,
    GRAPH_HEIGHT,
    GRAPH_PADDING,
    GRAPH_WIDTH
} from './constants';
import type {
    DraggedGraphNode,
    GraphData,
    GraphFilter,
    GraphNode,
    GraphNodePositions,
    SimulationNode
} from './types';
import { clampPosition, hashString } from './utils';

const toGraphNode = (node: SimulationNode): GraphNode => ({
    id: node.id,
    type: node.type,
    label: node.label,
    x: node.x,
    y: node.y,
    radius: node.radius,
    post: node.post,
    relatedPostIds: node.relatedPostIds
});

const usePrefersReducedMotion = () => {
    const [prefersReducedMotion, setPrefersReducedMotion] = useState(() => (
        typeof window !== 'undefined'
            && typeof window.matchMedia === 'function'
            && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ));

    useEffect(() => {
        if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;

        const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
        const handleChange = () => setPrefersReducedMotion(mediaQuery.matches);

        handleChange();
        mediaQuery.addEventListener('change', handleChange);

        return () => mediaQuery.removeEventListener('change', handleChange);
    }, []);

    return prefersReducedMotion;
};

export const useAnimatedGraphLayout = (
    graph: GraphData,
    activeFilter: GraphFilter,
    activeNodeId: string | null,
    customNodePositions: GraphNodePositions,
    draggedNode: DraggedGraphNode | null
) => {
    const prefersReducedMotion = usePrefersReducedMotion();
    const [animatedNodes, setAnimatedNodes] = useState<GraphNode[]>(graph.nodes);
    const simulationRef = useRef<SimulationNode[]>([]);
    const frameRef = useRef<number | null>(null);

    useEffect(() => {
        if (frameRef.current !== null) {
            window.cancelAnimationFrame(frameRef.current);
            frameRef.current = null;
        }

        if (graph.nodes.length === 0) {
            simulationRef.current = [];
            setAnimatedNodes([]);
            return undefined;
        }

        const previousNodes = new Map(simulationRef.current.map(node => [node.id, node]));
        const nextSimulationNodes: SimulationNode[] = graph.nodes.map(node => {
            const previous = previousNodes.get(node.id);
            const customPosition = customNodePositions[node.id];
            const dragPosition = draggedNode?.id === node.id ? draggedNode : null;
            const targetX = dragPosition?.x ?? customPosition?.x ?? node.x;
            const targetY = dragPosition?.y ?? customPosition?.y ?? node.y;
            const seed = ((hashString(node.id) % 1000) / 1000) - 0.5;

            return {
                ...node,
                x: dragPosition?.x ?? previous?.x ?? targetX + seed * 18,
                y: dragPosition?.y ?? previous?.y ?? targetY - seed * 14,
                vx: dragPosition ? 0 : previous?.vx ?? seed * 0.18,
                vy: dragPosition ? 0 : previous?.vy ?? -seed * 0.14,
                targetX,
                targetY,
                seed
            };
        });

        simulationRef.current = nextSimulationNodes;

        if (prefersReducedMotion || nextSimulationNodes.length < 2) {
            setAnimatedNodes(nextSimulationNodes.map(toGraphNode));
            return undefined;
        }

        const nodeIndex = new Map(nextSimulationNodes.map((node, index) => [node.id, index]));
        let frame = 0;

        const tick = () => {
            frame += 1;
            const nodes = simulationRef.current;
            let totalSpeed = 0;

            for (let leftIndex = 0; leftIndex < nodes.length; leftIndex += 1) {
                for (let rightIndex = leftIndex + 1; rightIndex < nodes.length; rightIndex += 1) {
                    const left = nodes[leftIndex];
                    const right = nodes[rightIndex];
                    const dx = right.x - left.x || 0.01;
                    const dy = right.y - left.y || 0.01;
                    const distance = Math.max(14, Math.hypot(dx, dy));
                    const collisionDistance = left.radius + right.radius + 32;
                    const repulsion = Math.min(0.56, 1500 / (distance * distance));
                    const collision = Math.max(0, collisionDistance - distance) * 0.032;
                    const force = repulsion + collision;
                    const offsetX = (dx / distance) * force;
                    const offsetY = (dy / distance) * force;

                    left.vx -= offsetX;
                    left.vy -= offsetY;
                    right.vx += offsetX;
                    right.vy += offsetY;
                }
            }

            graph.edges.forEach(edge => {
                const sourceIndex = nodeIndex.get(edge.source);
                const targetIndex = nodeIndex.get(edge.target);
                if (sourceIndex === undefined || targetIndex === undefined) return;

                const source = nodes[sourceIndex];
                const target = nodes[targetIndex];
                const dx = target.x - source.x || 0.01;
                const dy = target.y - source.y || 0.01;
                const distance = Math.max(18, Math.hypot(dx, dy));
                const preferredDistance = edge.type === 'link' ? 136 : 92;
                const spring = (distance - preferredDistance) * (edge.type === 'link' ? 0.008 : 0.012);
                const offsetX = (dx / distance) * spring;
                const offsetY = (dy / distance) * spring;

                source.vx += offsetX;
                source.vy += offsetY;
                target.vx -= offsetX;
                target.vy -= offsetY;
            });

            nodes.forEach(node => {
                if (draggedNode?.id === node.id) {
                    node.x = draggedNode.x;
                    node.y = draggedNode.y;
                    node.vx = 0;
                    node.vy = 0;
                    return;
                }

                const isActiveNode = activeNodeId === node.id;
                const isFilteredOut = activeFilter !== 'all' && node.type !== activeFilter;
                const anchorStrength = isActiveNode ? 0.013 : isFilteredOut ? 0.018 : 0.009;
                const driftStrength = isFilteredOut ? 0.002 : 0.012;
                const driftPhase = frame * 0.058 + node.seed * Math.PI * 2;

                node.vx += (node.targetX - node.x) * anchorStrength;
                node.vy += (node.targetY - node.y) * anchorStrength;
                node.vx += Math.sin(driftPhase) * driftStrength;
                node.vy += Math.cos(driftPhase * 0.9) * driftStrength;
                node.vx *= 0.86;
                node.vy *= 0.86;
                node.x = clampPosition(node.x + node.vx, GRAPH_PADDING, GRAPH_WIDTH - GRAPH_PADDING);
                node.y = clampPosition(node.y + node.vy, GRAPH_PADDING, GRAPH_HEIGHT - GRAPH_PADDING);
                totalSpeed += Math.hypot(node.vx, node.vy);
            });

            setAnimatedNodes(nodes.map(toGraphNode));

            const averageSpeed = totalSpeed / Math.max(nodes.length, 1);
            if (frame < ANIMATION_MIN_FRAMES || (frame < ANIMATION_FRAME_LIMIT && averageSpeed > ANIMATION_SETTLE_SPEED)) {
                frameRef.current = window.requestAnimationFrame(tick);
            } else {
                frameRef.current = null;
            }
        };

        frameRef.current = window.requestAnimationFrame(tick);

        return () => {
            if (frameRef.current !== null) {
                window.cancelAnimationFrame(frameRef.current);
                frameRef.current = null;
            }
        };
    }, [graph, activeFilter, activeNodeId, customNodePositions, draggedNode, prefersReducedMotion]);

    const animatedNodeById = useMemo(
        () => new Map(animatedNodes.map(node => [node.id, node])),
        [animatedNodes]
    );

    return { nodes: animatedNodes, nodeById: animatedNodeById };
};
