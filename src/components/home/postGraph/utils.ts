import type { GraphNode, GraphNodeType } from './types';

export const normalizeKey = (value = '') => value.trim().toLowerCase();
export const relationId = (type: Exclude<GraphNodeType, 'post'>, label: string) => `${type}:${normalizeKey(label)}`;
export const postId = (post: { slug: string }) => `post:${post.slug}`;

export const clampLabel = (label: string, maxLength = 18) => (
    label.length > maxLength ? `${label.slice(0, maxLength - 1)}…` : label
);

export const hashString = (value: string) => {
    let hash = 0;
    for (let index = 0; index < value.length; index += 1) {
        hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
    }
    return hash;
};

export const clampPosition = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export const getNodeClasses = (
    node: GraphNode,
    isActive: boolean,
    isDimmed: boolean,
    isDragging = false
) => {
    const base = `graph-node-circle ${isDragging ? '' : 'transition duration-200'}`;
    const opacity = isDimmed ? 'opacity-25' : 'opacity-100';
    const cursor = isDragging ? 'cursor-grabbing' : 'cursor-grab';

    if (node.type === 'post') {
        return `${base} ${opacity} ${cursor} ${isActive ? 'fill-[var(--accent)]' : 'fill-[var(--text)]'}`;
    }

    return `${base} ${opacity} ${cursor} ${isActive ? 'fill-[var(--accent-soft)]' : 'fill-white'}`;
};

export const getNodeStroke = (node: GraphNode, isActive: boolean) => {
    if (isActive) return 'var(--accent)';
    if (node.type === 'post') return 'var(--text)';
    if (node.type === 'category') return 'var(--accent-strong)';
    return 'var(--border-strong)';
};
