import React, { useEffect, useMemo, useState } from 'react';
import { flattenCategoryTree } from '../../../utils/categoryTree';
import { normalizeCategoryKey } from '../../../utils/category';
import CategoryDetailPanel from '../category/CategoryDetailPanel';
import CategorySummaryCards from '../category/CategorySummaryCards';
import CategoryTreePanel from '../category/CategoryTreePanel';
import type { CategorySectionProps } from '../category/types';

const CategorySection: React.FC<CategorySectionProps> = ({
  categoryTree,
  managedCategoryIds,
  categoriesLoading,
  categoriesError,
  parentOptions,
  onAddCategory,
  onUpdateCategory,
  onReorderCategory,
  onDeleteCategory,
  onReload,
  categorySaving,
  defaultCategory
}) => {
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);

  const flattened = useMemo(() => flattenCategoryTree(categoryTree.roots), [categoryTree.roots]);

  const summary = useMemo(() => {
    const defaultNode = categoryTree.nodesByKey.get(normalizeCategoryKey(defaultCategory));
    const managedCount = flattened.filter(({ node }) => managedCategoryIds.has(node.id)).length;
    const autoDetectedCount = flattened.filter(({ node }) => !managedCategoryIds.has(node.id)).length;

    return {
      managedCount,
      autoDetectedCount,
      rootCount: categoryTree.roots.length,
      uncategorizedCount: defaultNode?.count ?? 0
    };
  }, [categoryTree.nodesByKey, categoryTree.roots.length, defaultCategory, flattened, managedCategoryIds]);

  useEffect(() => {
    if (activeCategoryId && categoryTree.nodesById.has(activeCategoryId)) return;

    const defaultNode = categoryTree.nodesByKey.get(normalizeCategoryKey(defaultCategory));
    setActiveCategoryId(defaultNode?.id ?? categoryTree.roots[0]?.id ?? null);
  }, [activeCategoryId, categoryTree.nodesById, categoryTree.nodesByKey, categoryTree.roots, defaultCategory]);

  const activeCategory = useMemo(
    () => (activeCategoryId ? categoryTree.nodesById.get(activeCategoryId) ?? null : null),
    [activeCategoryId, categoryTree.nodesById]
  );

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-[color:var(--border)] bg-[var(--surface)] px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.22em] text-[var(--text-muted)]">
              카테고리 관리
            </p>
            <h2 className="mt-0.5 font-display text-lg font-semibold text-[var(--text)]">
              카테고리 트리
            </h2>
          </div>
          <button
            type="button"
            onClick={onReload}
            disabled={categoriesLoading}
            className="rounded-lg border border-[color:var(--border)] bg-[var(--surface-muted)] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text)] transition hover:border-[color:var(--accent)] hover:text-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            새로고침
          </button>
        </div>

        <CategorySummaryCards summary={summary} />
      </div>

      {categoriesLoading && (
        <p className="mt-4 text-xs text-[var(--text-muted)]">카테고리 불러오는 중...</p>
      )}
      {categoriesError && <p className="mt-4 text-xs text-red-500 dark:text-red-300">{categoriesError}</p>}

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1.45fr)_340px]">
        <CategoryTreePanel
          categoryTree={categoryTree}
          managedCategoryIds={managedCategoryIds}
          activeCategoryId={activeCategoryId}
          parentOptions={parentOptions}
          defaultCategory={defaultCategory}
          categorySaving={categorySaving}
          onSelectCategory={setActiveCategoryId}
          onAddCategory={onAddCategory}
          onUpdateCategory={onUpdateCategory}
          onReorderCategory={onReorderCategory}
          onDeleteCategory={onDeleteCategory}
        />

        <CategoryDetailPanel
          activeCategory={activeCategory}
          categoryTree={categoryTree}
          managedCategoryIds={managedCategoryIds}
          parentOptions={parentOptions}
          defaultCategory={defaultCategory}
          categorySaving={categorySaving}
          onSelectCategory={setActiveCategoryId}
          onAddCategory={onAddCategory}
          onUpdateCategory={onUpdateCategory}
          onDeleteCategory={onDeleteCategory}
        />
      </div>
    </div>
  );
};

export default CategorySection;
