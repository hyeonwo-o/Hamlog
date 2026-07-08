import { Link } from 'react-router-dom';
import type { Post } from '../../../types/blog';
import { nodeTypeIcon, nodeTypeLabel } from './constants';
import type { GraphData, GraphNode } from './types';

interface GraphDetailPanelProps {
    graph: GraphData;
    selectedNode: GraphNode;
    relatedPosts: Post[];
    hubNodes: GraphNode[];
    onSelectNode: (nodeId: string) => void;
}

export const GraphDetailPanel = ({
    graph,
    selectedNode,
    relatedPosts,
    hubNodes,
    onSelectNode
}: GraphDetailPanelProps) => {
    const SelectedIcon = nodeTypeIcon[selectedNode.type];

    return (
        <aside className="angular-panel border border-[color:var(--border)] bg-[var(--surface)] p-4 lg:max-h-[420px] lg:overflow-y-auto lg:[scrollbar-gutter:stable]">
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
                                    onClick={() => onSelectNode(node.id)}
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
    );
};
