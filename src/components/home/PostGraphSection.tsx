import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Link } from 'react-router-dom';
import { FileText, Folder, Layers3, Network, RotateCcw, type LucideIcon } from 'lucide-react';
import type { Post } from '../../types/blog';

type GraphNodeType = 'post' | 'category' | 'series';
type GraphFilter = GraphNodeType | 'all';

interface GraphNode {
    id: string;
    type: GraphNodeType;
    label: string;
    x: number;
    y: number;
    radius: number;
    post?: Post;
    relatedPostIds: string[];
}

interface SimulationNode extends GraphNode {
    vx: number;
    vy: number;
    targetX: number;
    targetY: number;
    seed: number;
}

interface GraphEdge {
    id: string;
    source: string;
    target: string;
    type: 'category' | 'series' | 'link';
}

interface GraphData {
    nodes: GraphNode[];
    edges: GraphEdge[];
    nodeById: Map<string, GraphNode>;
    postNodes: GraphNode[];
    relationNodes: GraphNode[];
}

interface PostGraphSectionProps {
    posts: Post[];
}

const GRAPH_WIDTH = 1000;
const GRAPH_HEIGHT = 420;
const GRAPH_PADDING = 42;
const MAX_POST_NODES = 36;
const LAYOUT_ITERATIONS = 76;
const ANIMATION_FRAME_LIMIT = 190;
const ANIMATION_MIN_FRAMES = 72;
const ANIMATION_SETTLE_SPEED = 0.028;
const nodeTypeLabel: Record<GraphNodeType, string> = {
    post: '글',
    category: '카테고리',
    series: '시리즈'
};
const nodeTypeIcon: Record<GraphNodeType, LucideIcon> = {
    post: FileText,
    category: Folder,
    series: Layers3
};
const graphFilterOptions: Array<{ key: GraphFilter; label: string; Icon: LucideIcon }> = [
    { key: 'all', label: '전체', Icon: Network },
    { key: 'post', label: nodeTypeLabel.post, Icon: FileText },
    { key: 'category', label: nodeTypeLabel.category, Icon: Folder },
    { key: 'series', label: nodeTypeLabel.series, Icon: Layers3 }
];
const edgeStroke: Record<GraphEdge['type'], string> = {
    category: 'var(--accent-strong)',
    series: 'var(--text-muted)',
    link: 'var(--accent)'
};

const normalizeKey = (value = '') => value.trim().toLowerCase();
const relationId = (type: Exclude<GraphNodeType, 'post'>, label: string) => `${type}:${normalizeKey(label)}`;
const postId = (post: Post) => `post:${post.slug}`;

const clampLabel = (label: string, maxLength = 18) => (
    label.length > maxLength ? `${label.slice(0, maxLength - 1)}…` : label
);

const hashString = (value: string) => {
    let hash = 0;
    for (let index = 0; index < value.length; index += 1) {
        hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
    }
    return hash;
};

const getPostPosition = (post: Post, index: number, total: number) => {
    const angle = (Math.PI * 2 * index) / Math.max(total, 1) - Math.PI / 2;
    const jitter = ((hashString(post.id) % 17) - 8) / 100;
    const radiusX = total < 6 ? 170 : 255;
    const radiusY = total < 6 ? 95 : 145;

    return {
        x: GRAPH_WIDTH / 2 + Math.cos(angle + jitter) * radiusX,
        y: GRAPH_HEIGHT / 2 + Math.sin(angle + jitter) * radiusY
    };
};

const getRelationPosition = (label: string, index: number, total: number) => {
    const angle = (Math.PI * 2 * index) / Math.max(total, 1) - Math.PI / 2;
    const jitter = ((hashString(label) % 21) - 10) / 130;

    return {
        x: GRAPH_WIDTH / 2 + Math.cos(angle + jitter) * 410,
        y: GRAPH_HEIGHT / 2 + Math.sin(angle + jitter) * 175
    };
};

const clampPosition = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const applyGraphLayout = (nodes: GraphNode[], edges: GraphEdge[]) => {
    const layoutNodes = nodes.map(node => ({
        ...node,
        vx: 0,
        vy: 0,
        anchorX: node.x,
        anchorY: node.y
    }));
    const nodeIndex = new Map(layoutNodes.map((node, index) => [node.id, index]));

    for (let iteration = 0; iteration < LAYOUT_ITERATIONS; iteration += 1) {
        for (let leftIndex = 0; leftIndex < layoutNodes.length; leftIndex += 1) {
            for (let rightIndex = leftIndex + 1; rightIndex < layoutNodes.length; rightIndex += 1) {
                const left = layoutNodes[leftIndex];
                const right = layoutNodes[rightIndex];
                const dx = right.x - left.x || 0.01;
                const dy = right.y - left.y || 0.01;
                const distance = Math.max(30, Math.hypot(dx, dy));
                const force = 2200 / (distance * distance);
                const offsetX = (dx / distance) * force;
                const offsetY = (dy / distance) * force;

                left.vx -= offsetX;
                left.vy -= offsetY;
                right.vx += offsetX;
                right.vy += offsetY;
            }
        }

        edges.forEach(edge => {
            const sourceIndex = nodeIndex.get(edge.source);
            const targetIndex = nodeIndex.get(edge.target);
            if (sourceIndex === undefined || targetIndex === undefined) return;

            const source = layoutNodes[sourceIndex];
            const target = layoutNodes[targetIndex];
            const dx = target.x - source.x || 0.01;
            const dy = target.y - source.y || 0.01;
            const distance = Math.max(20, Math.hypot(dx, dy));
            const preferredDistance = edge.type === 'link' ? 125 : 88;
            const spring = (distance - preferredDistance) * (edge.type === 'link' ? 0.012 : 0.018);
            const offsetX = (dx / distance) * spring;
            const offsetY = (dy / distance) * spring;

            source.vx += offsetX;
            source.vy += offsetY;
            target.vx -= offsetX;
            target.vy -= offsetY;
        });

        layoutNodes.forEach(node => {
            node.vx += (node.anchorX - node.x) * 0.006;
            node.vy += (node.anchorY - node.y) * 0.006;
            node.vx *= 0.78;
            node.vy *= 0.78;
            node.x = clampPosition(node.x + node.vx, GRAPH_PADDING, GRAPH_WIDTH - GRAPH_PADDING);
            node.y = clampPosition(node.y + node.vy, GRAPH_PADDING, GRAPH_HEIGHT - GRAPH_PADDING);
        });
    }

    return layoutNodes.map(node => ({
        id: node.id,
        type: node.type,
        label: node.label,
        x: node.x,
        y: node.y,
        radius: node.radius,
        post: node.post,
        relatedPostIds: node.relatedPostIds
    }));
};

const extractLinkedPostSlugs = (html: string | undefined, availableSlugs: Set<string>) => {
    const linkedSlugs = new Set<string>();
    if (!html) return linkedSlugs;

    const hrefPattern = /href=["']([^"']+)["']/gi;
    let match = hrefPattern.exec(html);

    while (match) {
        const href = match[1] ?? '';
        try {
            const parsed = new URL(href, 'https://tech.hamwoo.co.kr');
            const slug = parsed.pathname.match(/^\/(?:posts|p)\/([^/?#]+)/)?.[1];
            if (slug && availableSlugs.has(slug)) {
                linkedSlugs.add(slug);
            }
        } catch {
            // Ignore malformed links in stored HTML.
        }
        match = hrefPattern.exec(html);
    }

    return linkedSlugs;
};

const getNodeClasses = (node: GraphNode, isActive: boolean, isDimmed: boolean) => {
    const base = 'transition duration-200';
    const opacity = isDimmed ? 'opacity-25' : 'opacity-100';
    const cursor = 'cursor-pointer';

    if (node.type === 'post') {
        return `${base} ${opacity} ${cursor} ${isActive ? 'fill-[var(--accent)]' : 'fill-[var(--text)]'}`;
    }

    return `${base} ${opacity} ${cursor} ${isActive ? 'fill-[var(--accent-soft)]' : 'fill-white'}`;
};

const getNodeStroke = (node: GraphNode, isActive: boolean) => {
    if (isActive) return 'var(--accent)';
    if (node.type === 'post') return 'var(--text)';
    if (node.type === 'category') return 'var(--accent-strong)';
    return 'var(--border-strong)';
};

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

const useAnimatedGraphLayout = (
    graph: GraphData,
    activeFilter: GraphFilter,
    activeNodeId: string | null
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
            const seed = ((hashString(node.id) % 1000) / 1000) - 0.5;

            return {
                ...node,
                x: previous?.x ?? node.x + seed * 18,
                y: previous?.y ?? node.y - seed * 14,
                vx: previous?.vx ?? seed * 0.18,
                vy: previous?.vy ?? -seed * 0.14,
                targetX: node.x,
                targetY: node.y,
                seed
            };
        });

        simulationRef.current = nextSimulationNodes;

        if (prefersReducedMotion || nextSimulationNodes.length < 2) {
            setAnimatedNodes(graph.nodes);
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
    }, [graph, activeFilter, activeNodeId, prefersReducedMotion]);

    const animatedNodeById = useMemo(
        () => new Map(animatedNodes.map(node => [node.id, node])),
        [animatedNodes]
    );

    return { nodes: animatedNodes, nodeById: animatedNodeById };
};

const buildGraphData = (posts: Post[]): GraphData => {
    const graphPosts = posts.slice(0, MAX_POST_NODES);
    const availableSlugs = new Set(graphPosts.map(post => post.slug));
    const relationLabels = new Map<string, { type: Exclude<GraphNodeType, 'post'>; label: string; postIds: Set<string> }>();
    const edges: GraphEdge[] = [];

    const addRelation = (type: Exclude<GraphNodeType, 'post'>, label: string, post: Post) => {
        const normalized = label.trim();
        if (!normalized) return;

        const id = relationId(type, normalized);
        const current = relationLabels.get(id) ?? { type, label: normalized, postIds: new Set<string>() };
        current.postIds.add(post.id);
        relationLabels.set(id, current);

        edges.push({
            id: `${postId(post)}:${id}`,
            source: postId(post),
            target: id,
            type
        });
    };

    graphPosts.forEach(post => {
        addRelation('category', post.category ?? '미분류', post);
        if (post.series) addRelation('series', post.series, post);

        extractLinkedPostSlugs(post.contentHtml, availableSlugs).forEach(slug => {
            if (slug === post.slug) return;
            edges.push({
                id: `${post.slug}->${slug}`,
                source: postId(post),
                target: `post:${slug}`,
                type: 'link'
            });
        });
    });

    const relationEntries = Array.from(relationLabels.entries())
        .sort((left, right) => (
            right[1].postIds.size - left[1].postIds.size
            || left[1].type.localeCompare(right[1].type)
            || left[1].label.localeCompare(right[1].label, 'ko')
        ));

    const postNodes: GraphNode[] = graphPosts.map((post, index) => {
        const position = getPostPosition(post, index, graphPosts.length);
        return {
            id: postId(post),
            type: 'post',
            label: post.title,
            radius: Math.min(18, 9 + Math.sqrt((post.views ?? 0) + 1)),
            relatedPostIds: [post.id],
            post,
            ...position
        };
    });

    const relationNodes: GraphNode[] = relationEntries.map(([id, relation], index) => {
        const position = getRelationPosition(relation.label, index, relationEntries.length);
        return {
            id,
            type: relation.type,
            label: relation.label,
            radius: Math.min(17, 7 + relation.postIds.size * 1.8),
            relatedPostIds: Array.from(relation.postIds),
            ...position
        };
    });

    const layoutNodes = applyGraphLayout([...postNodes, ...relationNodes], edges);
    const nodeById = new Map(layoutNodes.map(node => [node.id, node]));

    return {
        nodes: layoutNodes,
        edges: edges.filter(edge => nodeById.has(edge.source) && nodeById.has(edge.target)),
        nodeById,
        postNodes: layoutNodes.filter(node => node.type === 'post'),
        relationNodes: layoutNodes.filter(node => node.type !== 'post')
    };
};

export const PostGraphSection = ({ posts }: PostGraphSectionProps) => {
    const graph = useMemo(() => buildGraphData(posts), [posts]);
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
    const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
    const [activeFilter, setActiveFilter] = useState<GraphFilter>('all');
    const [showLabels, setShowLabels] = useState(true);
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

    if (graph.nodes.length === 0) return null;

    const fallbackNode = animatedGraph.nodes.find(node => node.type === 'post') ?? animatedGraph.nodes[0] as GraphNode;
    const selectedNode = selectedNodeId
        ? animatedGraph.nodeById.get(selectedNodeId) ?? fallbackNode
        : fallbackNode;
    const activeNeighborIds = new Set<string>();
    const SelectedIcon = nodeTypeIcon[selectedNode.type];

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
        setSelectedNodeId(nodeId);
        setHoveredNodeId(null);
    };

    const resetGraph = () => {
        setSelectedNodeId(null);
        setHoveredNodeId(null);
        setActiveFilter('all');
        setShowLabels(true);
    };

    const handleNodeKeyDown = (event: KeyboardEvent<SVGGElement>, nodeId: string) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        selectNode(nodeId);
    };

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

            <div className="mt-4 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-1 flex-wrap items-center gap-2">
                    <div className="flex flex-wrap gap-1" role="group" aria-label="그래프 노드 필터">
                        {graphFilterOptions.map(({ key, label, Icon }) => {
                            const active = activeFilter === key;

                            return (
                                <button
                                    key={key}
                                    type="button"
                                    aria-pressed={active}
                                    title={`${label} 노드 보기`}
                                    onClick={() => setActiveFilter(key)}
                                    className={`angular-control inline-flex h-9 items-center gap-1.5 border px-2.5 text-xs font-semibold transition ${active
                                        ? 'border-[color:var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-strong)]'
                                        : 'border-[color:var(--border)] bg-[var(--surface)] text-[var(--text-muted)] hover:border-[color:var(--accent)] hover:text-[var(--text)]'
                                    }`}
                                >
                                    <Icon size={14} aria-hidden="true" />
                                    <span>{label}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <label className="angular-control inline-flex h-9 cursor-pointer items-center gap-2 border border-[color:var(--border)] bg-[var(--surface)] px-2.5 text-xs font-semibold text-[var(--text-muted)] transition hover:border-[color:var(--accent)] hover:text-[var(--text)]">
                        <input
                            type="checkbox"
                            checked={showLabels}
                            onChange={event => setShowLabels(event.target.checked)}
                            className="h-3.5 w-3.5 accent-[var(--accent)]"
                        />
                        <span>라벨</span>
                    </label>
                    <button
                        type="button"
                        onClick={resetGraph}
                        className="angular-control inline-flex h-9 items-center gap-1.5 border border-[color:var(--border)] bg-[var(--surface)] px-2.5 text-xs font-semibold text-[var(--text-muted)] transition hover:border-[color:var(--accent)] hover:text-[var(--text)]"
                    >
                        <RotateCcw size={14} aria-hidden="true" />
                        <span>초기화</span>
                    </button>
                </div>
            </div>

            <div className="mt-5 grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
                <div className="angular-panel overflow-hidden border border-[color:var(--border)] bg-[var(--surface)]">
                    <svg
                        viewBox={`0 0 ${GRAPH_WIDTH} ${GRAPH_HEIGHT}`}
                        preserveAspectRatio="xMidYMid meet"
                        className="h-[360px] w-full sm:h-[420px]"
                        role="img"
                        aria-label="글, 카테고리, 시리즈 관계 그래프"
                    >
                        <defs>
                            <pattern id="graph-grid" width="40" height="40" patternUnits="userSpaceOnUse">
                                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="var(--border)" strokeWidth="0.8" opacity="0.35" />
                            </pattern>
                        </defs>
                        <rect width={GRAPH_WIDTH} height={GRAPH_HEIGHT} fill="var(--surface-muted)" />
                        <rect width={GRAPH_WIDTH} height={GRAPH_HEIGHT} fill="url(#graph-grid)" />

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
                                const dimmed = isNodeDimmed(node);
                                const showNodeLabel = showLabels || active || selected;

                                return (
                                    <g
                                        key={node.id}
                                        role="button"
                                        tabIndex={0}
                                        aria-label={`${nodeTypeLabel[node.type]} ${node.label}`}
                                        className="outline-none"
                                        onClick={() => selectNode(node.id)}
                                        onKeyDown={event => handleNodeKeyDown(event, node.id)}
                                        onMouseEnter={() => setHoveredNodeId(node.id)}
                                        onMouseLeave={() => setHoveredNodeId(null)}
                                    >
                                        <circle
                                            cx={node.x}
                                            cy={node.y}
                                            r={selected ? node.radius + 4 : node.radius}
                                            className={getNodeClasses(node, selected || node.id === activeNodeId, dimmed)}
                                            stroke={getNodeStroke(node, selected)}
                                            strokeWidth={selected ? 3 : 1.5}
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

                <aside className="angular-panel border border-[color:var(--border)] bg-[var(--surface)] p-4">
                    <div className="grid grid-cols-2 gap-2">
                        <div className="angular-chip border border-[color:var(--border)] bg-[var(--surface-muted)] px-2.5 py-2">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">글</p>
                            <p className="mt-1 font-display text-lg font-semibold text-[var(--text)]">{graph.postNodes.length}</p>
                        </div>
                        <div className="angular-chip border border-[color:var(--border)] bg-[var(--surface-muted)] px-2.5 py-2">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">관계</p>
                            <p className="mt-1 font-display text-lg font-semibold text-[var(--text)]">{graph.relationNodes.length}</p>
                        </div>
                    </div>

                    <div className="mt-4">
                        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                            <SelectedIcon size={14} aria-hidden="true" />
                            <span>{nodeTypeLabel[selectedNode.type]}</span>
                        </div>
                        <h3 className="mt-1 font-display text-base font-semibold leading-snug text-[var(--text)]">
                            {selectedNode.label}
                        </h3>

                        {selectedNode.post ? (
                            <>
                                <p className="mt-2 line-clamp-3 text-sm leading-6 text-[var(--text-muted)]">
                                    {selectedNode.post.summary}
                                </p>
                                <Link
                                    to={`/posts/${selectedNode.post.slug}`}
                                    className="mt-4 inline-flex items-center gap-1 text-xs font-bold uppercase tracking-[0.2em] text-[var(--accent-strong)]"
                                >
                                    글 읽기
                                    <span aria-hidden="true">&rarr;</span>
                                </Link>
                            </>
                        ) : (
                            <p className="mt-2 text-sm leading-relaxed text-[var(--text-muted)]">
                                연결된 글 {selectedNode.relatedPostIds.length}편
                            </p>
                        )}
                    </div>

                    {relatedPosts.length > 0 && (
                        <div className="mt-4 border-t border-[color:var(--border)] pt-4">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                                연결된 글
                            </p>
                            <div className="mt-2 space-y-2">
                                {relatedPosts.map(post => (
                                    <Link
                                        key={post.id}
                                        to={`/posts/${post.slug}`}
                                        className="block border-l border-[color:var(--border)] pl-3 text-sm leading-snug text-[var(--text)] transition hover:border-[color:var(--accent)] hover:text-[var(--accent-strong)]"
                                    >
                                        {post.title}
                                    </Link>
                                ))}
                            </div>
                        </div>
                    )}

                    {hubNodes.length > 0 && (
                        <div className="mt-4 border-t border-[color:var(--border)] pt-4">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                                허브
                            </p>
                            <div className="mt-2 space-y-1.5">
                                {hubNodes.map(node => {
                                    const HubIcon = nodeTypeIcon[node.type];

                                    return (
                                        <button
                                            key={node.id}
                                            type="button"
                                            onClick={() => selectNode(node.id)}
                                            className="angular-control flex w-full items-center justify-between gap-2 border border-[color:var(--border)] bg-[var(--surface-muted)] px-2.5 py-2 text-left text-xs text-[var(--text)] transition hover:border-[color:var(--accent)]"
                                        >
                                            <span className="flex min-w-0 items-center gap-2">
                                                <HubIcon size={13} className="shrink-0 text-[var(--text-muted)]" aria-hidden="true" />
                                                <span className="truncate">{node.label}</span>
                                            </span>
                                            <span className="shrink-0 text-[10px] font-semibold text-[var(--text-muted)]">
                                                {node.relatedPostIds.length}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </aside>
            </div>
        </section>
    );
};
