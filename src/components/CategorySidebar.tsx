import React, { useState } from 'react';
import type { CategoryNode } from '../utils/categoryTree';
import { normalizeCategoryKey } from '../utils/category';

interface CategorySidebarProps {
    categoryTree: {
        roots: CategoryNode[];
        allNames: string[];
        totalCount: number;
        hasNew: boolean;
        nodesByKey: Map<string, CategoryNode>;
    };
    selectedCategory: string | null;
    onSelectCategory: (category: string | null) => void;
}

export const CategorySidebar: React.FC<CategorySidebarProps> = ({
    categoryTree,
    selectedCategory,
    onSelectCategory,
}) => {
    const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});

    const toggleCategory = (id: string) => {
        setExpandedCategories(prev => {
            const current = prev[id];
            return { ...prev, [id]: current === undefined ? true : !current };
        });
    };

    const renderCategoryNode = (node: CategoryNode, depth: number) => {
        const hasChildren = node.children.length > 0;
        const isExpanded = expandedCategories[node.id] ?? false;
        const isActive =
            selectedCategory &&
            normalizeCategoryKey(selectedCategory) === normalizeCategoryKey(node.name);
        const paddingLeft = depth * 14;

        return (
            <li key={node.id}>
                <div className="flex items-center gap-2" style={{ paddingLeft }}>
                    {hasChildren ? (
                        <button
                            type="button"
                            onClick={() => toggleCategory(node.id)}
                            className="flex h-4 w-4 items-center justify-center rounded-sm text-[var(--text-muted)]"
                            aria-label={`${node.name} 토글`}
                        >
                            <svg
                                className={`h-3 w-3 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                            >
                                <path d="M9 6l6 6-6 6" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        </button>
                    ) : (
                        <span className="h-4 w-4" />
                    )}
                    <button
                        type="button"
                        onClick={() => onSelectCategory(isActive ? null : node.name)}
                        className={`angular-control flex flex-1 items-center justify-between rounded-lg border px-3 py-2 text-sm transition ${isActive
                            ? 'border-[color:var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-strong)]'
                            : 'border-[color:var(--border)] bg-[var(--surface-muted)] text-[var(--text-muted)] hover:border-[color:var(--accent)] hover:text-[var(--text)]'
                            }`}
                    >
                        <span className="flex min-w-0 items-center gap-2">
                            <span className="truncate">{node.name}</span>
                            {node.hasNew && (
                                <span className="angular-chip inline-flex h-4 w-4 items-center justify-center rounded-md bg-[var(--accent)] text-[10px] font-semibold text-white">
                                    N
                                </span>
                            )}
                        </span>
                        <span className="text-xs">{node.count}</span>
                    </button>
                </div>
                {hasChildren && isExpanded && (
                    <ul className="mt-2 space-y-2">
                        {node.children.map(child => renderCategoryNode(child, depth + 1))}
                    </ul>
                )}
            </li>
        );
    };

    return (
        <aside className="space-y-4">
            <div className="angular-panel rounded-xl border border-[color:var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow)] lg:sticky lg:top-6">
                <div className="flex items-center justify-between">
                    <p className="text-xs uppercase tracking-[0.3em] text-[var(--text-muted)]">
                        카테고리
                    </p>
                    <span className="text-xs text-[var(--text-muted)]">
                        {categoryTree.allNames.length}개
                    </span>
                </div>
                <div className="mt-4 space-y-3">
                    <button
                        type="button"
                        onClick={() => onSelectCategory(null)}
                        className={`angular-control flex w-full items-center justify-between rounded-lg border px-4 py-2 text-sm transition ${selectedCategory === null
                            ? 'border-[color:var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-strong)]'
                            : 'border-[color:var(--border)] bg-[var(--surface-muted)] text-[var(--text-muted)] hover:border-[color:var(--accent)] hover:text-[var(--text)]'
                            }`}
                    >
                        <span className="flex items-center gap-2">
                            <span>분류 전체보기</span>
                            {categoryTree.hasNew && (
                                <span className="angular-chip inline-flex h-4 w-4 items-center justify-center rounded-md bg-[var(--accent)] text-[10px] font-semibold text-white">
                                    N
                                </span>
                            )}
                        </span>
                        <span className="text-xs">{categoryTree.totalCount}</span>
                    </button>
                    {categoryTree.roots.length > 0 ? (
                        <ul className="space-y-2">
                            {categoryTree.roots.map(node => renderCategoryNode(node, 0))}
                        </ul>
                    ) : (
                        <p className="text-xs text-[var(--text-muted)]">
                            등록된 카테고리가 없습니다.
                        </p>
                    )}
                </div>
            </div>
        </aside>
    );
};
