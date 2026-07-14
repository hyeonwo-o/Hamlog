import { X } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Post } from '../../../types/blog';
import { nodeTypeIcon, nodeTypeLabel } from './constants';
import type { GraphNode } from './types';

interface GraphDetailPanelProps {
    selectedNode: GraphNode | null;
    relatedPosts: Post[];
    hubNodes: GraphNode[];
    isFullscreen: boolean;
    onFocusNode: (nodeId: string) => void;
    onClearSelection: () => void;
}

export const GraphDetailPanel = ({
    selectedNode,
    relatedPosts,
    hubNodes,
    isFullscreen,
    onFocusNode,
    onClearSelection
}: GraphDetailPanelProps) => {
    if (!selectedNode) {
        return (
            <aside className="angular-panel hidden min-h-48 items-center justify-center border border-dashed border-[color:var(--border)] bg-[var(--surface)] p-5 text-center lg:flex">
                <div>
                    <p className="text-sm font-medium text-[var(--text)]">노드를 선택하세요</p>
                    <p className="mt-1 text-xs leading-relaxed text-[var(--text-muted)]">
                        선택한 항목의 연결된 글을 여기에 표시합니다.
                    </p>
                </div>
            </aside>
        );
    }

    const SelectedIcon = nodeTypeIcon[selectedNode.type];

    return (
        <aside className={`angular-panel fixed inset-x-3 bottom-3 z-40 max-h-[48vh] overflow-y-auto border border-[color:var(--border)] bg-[var(--surface)] p-4 shadow-xl lg:static lg:inset-auto lg:z-auto lg:shadow-none lg:[scrollbar-gutter:stable] ${isFullscreen ? 'lg:max-h-[calc(100vh-180px)]' : 'lg:max-h-[520px]'}`}>
            <button
                type="button"
                onClick={onClearSelection}
                aria-label="상세 패널 닫기"
                className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center text-[var(--text-muted)] hover:text-[var(--text)] lg:hidden"
            >
                <X size={15} aria-hidden="true" />
            </button>

            <div className="pr-8 lg:pr-0">
                <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
                    <SelectedIcon size={13} aria-hidden="true" />
                    <span>{nodeTypeLabel[selectedNode.type]}</span>
                </div>
                <h2 className="mt-1 font-display text-base font-semibold leading-snug text-[var(--text)]">
                    {selectedNode.label}
                </h2>
            </div>

            {selectedNode.post ? (
                <div className="mt-3">
                    <p className="line-clamp-2 text-xs leading-5 text-[var(--text-muted)]">
                        {selectedNode.post.summary}
                    </p>
                    <Link
                        to={`/posts/${selectedNode.post.slug}`}
                        className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[var(--accent-strong)]"
                    >
                        글 읽기
                        <span aria-hidden="true">&rarr;</span>
                    </Link>
                </div>
            ) : (
                <p className="mt-2 text-xs text-[var(--text-muted)]">
                    연결된 글 {selectedNode.relatedPostIds.length}편
                </p>
            )}

            {relatedPosts.length > 0 && (
                <div className="mt-4 border-t border-[color:var(--border)] pt-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
                        연결된 글
                    </p>
                    <div className="mt-2 space-y-1.5">
                        {relatedPosts.map(post => (
                            <Link
                                key={post.id}
                                to={`/posts/${post.slug}`}
                                className="block truncate border-l border-[color:var(--border)] py-0.5 pl-2.5 text-xs text-[var(--text)] transition hover:border-[color:var(--accent)] hover:text-[var(--accent-strong)]"
                            >
                                {post.title}
                            </Link>
                        ))}
                    </div>
                </div>
            )}

            {hubNodes.length > 0 && (
                <details className="mt-4 border-t border-[color:var(--border)] pt-3">
                    <summary className="cursor-pointer text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
                        주요 허브 {hubNodes.length}개
                    </summary>
                    <div className="mt-2 space-y-1">
                        {hubNodes.map(node => (
                            <button
                                key={node.id}
                                type="button"
                                onClick={() => onFocusNode(node.id)}
                                className="angular-control flex w-full items-center justify-between gap-2 px-2 py-1.5 text-left text-xs text-[var(--text)] transition hover:bg-[var(--surface-muted)]"
                            >
                                <span className="truncate">{node.label}</span>
                                <span className="shrink-0 text-[10px] text-[var(--text-muted)]">
                                    {node.relatedPostIds.length}
                                </span>
                            </button>
                        ))}
                    </div>
                </details>
            )}
        </aside>
    );
};
