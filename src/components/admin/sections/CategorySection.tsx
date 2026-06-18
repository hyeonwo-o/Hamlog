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
    <div className="rounded-xl border border-[color:var(--border)] bg-[var(--surface)] p-6">
      <div className="overflow-hidden rounded-xl border border-[color:var(--border)] bg-[linear-gradient(135deg,rgba(6,55,48,0.08),rgba(255,255,255,0)_55%),linear-gradient(180deg,var(--surface),var(--surface))] p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-3">
            <p className="text-xs uppercase tracking-[0.32em] text-[var(--text-muted)]">
              카테고리 관리
            </p>
            <div className="space-y-2">
              <h2 className="font-display text-2xl font-semibold text-[var(--text)]">
                트리와 상세 패널로 정리하는 카테고리 운영
              </h2>
              <p className="max-w-2xl text-sm leading-6 text-[var(--text-muted)]">
                검색, 드래그 정렬, 상세 편집을 한 화면에 모아 운영 흐름이 바로 보이도록
                정리했습니다. 선택한 카테고리의 글 수와 하위 구조도 우측 패널에서 바로
                확인할 수 있습니다.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onReload}
            disabled={categoriesLoading}
            className="rounded-lg border border-[color:var(--border)] bg-[var(--surface)] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--text)] transition hover:border-[color:var(--accent)] hover:text-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            새로고침
          </button>
        </div>

        <CategorySummaryCards summary={summary} />
      </div>

      {categoriesLoading && (
        <p className="mt-4 text-xs text-[var(--text-muted)]">카테고리 불러오는 중...</p>
      )}
      {categoriesError && <p className="mt-4 text-xs text-red-500">{categoriesError}</p>}

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_360px]">
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
