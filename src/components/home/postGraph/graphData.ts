import type { Post } from '../../../types/blog';
import {
    GRAPH_HEIGHT,
    GRAPH_PADDING,
    GRAPH_WIDTH,
    LAYOUT_ITERATIONS,
    MAX_POST_NODES
} from './constants';
import type { GraphData, GraphEdge, GraphNode, GraphNodeType } from './types';
import { clampPosition, hashString, postId, relationId } from './utils';

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

export const buildGraphData = (posts: Post[]): GraphData => {
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

        const linkedSlugs = Array.isArray(post.linkedPostSlugs)
            ? post.linkedPostSlugs.filter(slug => availableSlugs.has(slug))
            : Array.from(extractLinkedPostSlugs(post.contentHtml, availableSlugs));

        linkedSlugs.forEach(slug => {
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
