import React, { useEffect, useMemo, useState } from 'react';
import { getCategoryPathLabel } from '../../../utils/categoryTree';
import { normalizeCategoryKey } from '../../../utils/category';
import { getDescendantIds } from './categoryTreeUtils';
import type { CategoryDetailPanelProps } from './types';

const CategoryDetailPanel: React.FC<CategoryDetailPanelProps> = ({
  activeCategory,
  categoryTree,
  managedCategoryIds,
  parentOptions,
  defaultCategory,
  categorySaving,
  onSelectCategory,
  onAddCategory,
  onUpdateCategory,
  onDeleteCategory
}) => {
  const [detailName, setDetailName] = useState('');
  const [detailParentId, setDetailParentId] = useState('');
  const [detailChildDraft, setDetailChildDraft] = useState('');

  useEffect(() => {
    if (!activeCategory) {
      setDetailName('');
      setDetailParentId('');
      setDetailChildDraft('');
      return;
    }

    setDetailName(activeCategory.name);
    setDetailParentId(activeCategory.parentId ?? '');
    setDetailChildDraft('');
  }, [activeCategory]);

  const activeCategoryPath = activeCategory
    ? getCategoryPathLabel(activeCategory, categoryTree.nodesById)
    : '';

  const canEditActiveCategory = Boolean(
    activeCategory
      && managedCategoryIds.has(activeCategory.id)
      && normalizeCategoryKey(activeCategory.name) !== normalizeCategoryKey(defaultCategory)
  );

  const detailHasChanges = Boolean(
    activeCategory
      && (
        detailName.trim() !== activeCategory.name
        || (detailParentId || null) !== (activeCategory.parentId ?? null)
      )
  );

  const activeDescendantIds = useMemo(
    () => (activeCategory ? getDescendantIds(activeCategory) : new Set<string>()),
    [activeCategory]
  );

  const availableParentOptions = useMemo(() => {
    if (!activeCategory) return parentOptions;
    return parentOptions.filter(
      option => option.id !== activeCategory.id && !activeDescendantIds.has(option.id)
    );
  }, [activeCategory, activeDescendantIds, parentOptions]);

  const saveActiveCategory = async () => {
    if (!activeCategory) return;
    await onUpdateCategory(activeCategory, {
      name: detailName,
      parentId: detailParentId || null
    });
  };

  const addChildFromPanel = async () => {
    if (!activeCategory || !detailChildDraft.trim()) return;
    await onAddCategory(detailChildDraft, activeCategory.id);
    setDetailChildDraft('');
  };

  return (
    <aside className="space-y-3 self-start xl:sticky xl:top-24">
      <div className="rounded-lg border border-[color:var(--border)] bg-[var(--surface)] p-4">
        {activeCategory ? (
          <>
            <div className="space-y-2">
              <div className="space-y-1">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                  선택한 카테고리
                </p>
                <h3 className="text-lg font-semibold text-[var(--text)]">
                  {activeCategory.name}
                </h3>
                <p className="text-[11px] leading-4 text-[var(--text-muted)]">
                  {activeCategoryPath}
                </p>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {normalizeCategoryKey(activeCategory.name) === normalizeCategoryKey(defaultCategory) && (
                  <span className="rounded-md bg-[var(--accent-soft)] px-2 py-0.5 text-[10px] font-semibold text-[var(--accent-strong)]">
                    기본 카테고리
                  </span>
                )}
                {managedCategoryIds.has(activeCategory.id) ? (
                  <span className="rounded-md bg-[var(--surface-muted)] px-2 py-0.5 text-[10px] font-semibold text-[var(--text)]">
                    관리 대상
                  </span>
                ) : (
                  <span className="rounded-md bg-red-100 dark:bg-red-400/10 px-2 py-0.5 text-[10px] font-semibold text-red-600 dark:text-red-300">
                    자동 감지
                  </span>
                )}
              </div>
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2">
              <div className="rounded-lg border border-[color:var(--border)] bg-[var(--surface-muted)] px-2 py-2 text-center">
                <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--text-muted)]">
                  전체
                </div>
                <div className="mt-1 text-base font-semibold text-[var(--text)]">
                  {activeCategory.count}
                </div>
              </div>
              <div className="rounded-lg border border-[color:var(--border)] bg-[var(--surface-muted)] px-2 py-2 text-center">
                <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--text-muted)]">
                  직속
                </div>
                <div className="mt-1 text-base font-semibold text-[var(--text)]">
                  {activeCategory.directCount}
                </div>
              </div>
              <div className="rounded-lg border border-[color:var(--border)] bg-[var(--surface-muted)] px-2 py-2 text-center">
                <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--text-muted)]">
                  하위
                </div>
                <div className="mt-1 text-base font-semibold text-[var(--text)]">
                  {activeCategory.children.length}
                </div>
              </div>
            </div>

            <div className="mt-4 space-y-2.5">
              <div className="space-y-1">
                <label className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                  이름
                </label>
                <input
                  value={detailName}
                  onChange={(event) => setDetailName(event.target.value)}
                  disabled={!canEditActiveCategory || categorySaving}
                  className="w-full rounded-lg border border-[color:var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-sm text-[var(--text)] outline-none transition focus:border-[color:var(--accent)] disabled:cursor-not-allowed disabled:opacity-60"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                  상위 카테고리
                </label>
                <select
                  value={detailParentId}
                  onChange={(event) => setDetailParentId(event.target.value)}
                  disabled={!canEditActiveCategory || categorySaving}
                  className="w-full rounded-lg border border-[color:var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-sm text-[var(--text)] outline-none transition focus:border-[color:var(--accent)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <option value="">최상위</option>
                  {availableParentOptions.map(option => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              {canEditActiveCategory ? (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => void saveActiveCategory()}
                    disabled={!detailHasChanges || categorySaving}
                    className="flex-1 rounded-lg bg-[var(--text)] px-3 py-2 text-sm font-semibold text-[var(--bg)] transition disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    변경 저장
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteCategory(activeCategory)}
                    disabled={categorySaving}
                    className="rounded-lg border border-red-200 dark:border-red-400/30 px-3 py-2 text-sm font-semibold text-red-500 dark:text-red-300 transition hover:bg-red-50 dark:hover:bg-red-400/10 disabled:opacity-40"
                  >
                    삭제
                  </button>
                </div>
              ) : (
                <p className="rounded-lg border border-dashed border-[color:var(--border)] px-3 py-2 text-xs leading-5 text-[var(--text-muted)]">
                  {normalizeCategoryKey(activeCategory.name) === normalizeCategoryKey(defaultCategory)
                    ? '기본 카테고리는 이름과 위치를 수정할 수 없습니다.'
                    : '자동 감지 카테고리는 글 데이터에서 생성된 항목입니다. 이름 변경은 관련 글을 정리한 뒤 반영하는 편이 안전합니다.'}
                </p>
              )}
            </div>

            <div className="mt-4 rounded-lg border border-[color:var(--border)] bg-[var(--surface-muted)] p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                  하위 카테고리
                </p>
                <span className="text-[11px] text-[var(--text-muted)]">
                  {activeCategory.children.length}개
                </span>
              </div>

              {canEditActiveCategory && (
                <div className="mt-2 flex items-center gap-2">
                  <input
                    value={detailChildDraft}
                    onChange={(event) => setDetailChildDraft(event.target.value)}
                    placeholder="바로 하위 카테고리 추가"
                    className="flex-1 rounded-lg border border-[color:var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm text-[var(--text)] outline-none transition focus:border-[color:var(--accent)]"
                  />
                  <button
                    type="button"
                    onClick={() => void addChildFromPanel()}
                    disabled={!detailChildDraft.trim() || categorySaving}
                    className="rounded-lg bg-[var(--accent)] px-3 py-1.5 text-xs font-semibold text-[var(--on-accent)] transition disabled:opacity-50"
                  >
                    추가
                  </button>
                </div>
              )}

              <div className="mt-2 flex flex-wrap gap-1.5">
                {activeCategory.children.length > 0 ? (
                  activeCategory.children.map(child => (
                    <button
                      key={child.id}
                      type="button"
                      onClick={() => onSelectCategory(child.id)}
                      className="rounded-md border border-[color:var(--border)] bg-[var(--surface)] px-2 py-1 text-[11px] text-[var(--text-muted)] transition hover:border-[color:var(--accent)] hover:text-[var(--text)]"
                    >
                      {child.name} · {child.count}
                    </button>
                  ))
                ) : (
                  <p className="text-xs text-[var(--text-muted)]">
                    아직 하위 카테고리가 없습니다.
                  </p>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="rounded-lg border border-dashed border-[color:var(--border)] px-4 py-12 text-center text-sm text-[var(--text-muted)]">
            카테고리를 선택하면 상세 정보가 여기에 표시됩니다.
          </div>
        )}
      </div>
    </aside>
  );
};

export default CategoryDetailPanel;
