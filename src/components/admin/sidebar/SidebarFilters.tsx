import { useEffect, useState } from 'react';
import { normalizeCategoryKey } from '../../../utils/category';
import CategoryPicker from '../category/CategoryPicker';
import type { SidebarFiltersProps } from './types';

export default function SidebarFilters({
  searchQuery,
  onSearchChange,
  filterStatus,
  onFilterStatusChange,
  filterCategory,
  onFilterCategoryChange,
  filterCategoryIncludeDescendants,
  onFilterCategoryIncludeDescendantsChange,
  categoryTree,
  statusFilters,
  quickCategoryNodes
}: SidebarFiltersProps) {
  const activeFilterCount = Number(filterStatus !== 'all') + Number(filterCategory !== 'all');
  const [expanded, setExpanded] = useState(activeFilterCount > 0);

  useEffect(() => {
    if (activeFilterCount > 0) {
      setExpanded(true);
    }
  }, [activeFilterCount]);

  return (
    <div className="space-y-3">
      <div className="relative">
        <input
          type="text"
          placeholder="제목 또는 슬러그 검색"
          value={searchQuery}
          onChange={event => onSearchChange(event.target.value)}
          className="w-full rounded-lg border border-[color:var(--border)] bg-[var(--surface-muted)] px-4 py-2.5 text-sm outline-none transition focus:border-[var(--accent)]"
        />
      </div>

      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setExpanded(value => !value)}
          className="rounded-lg border border-[color:var(--border)] bg-[var(--surface)] px-3 py-2 text-[11px] font-semibold text-[var(--text-muted)] transition hover:border-[color:var(--accent)] hover:text-[var(--text)]"
        >
          {expanded ? '필터 숨기기' : `필터 열기${activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}`}
        </button>
        {activeFilterCount > 0 && (
          <button
            type="button"
            onClick={() => {
              onFilterStatusChange('all');
              onFilterCategoryChange('all');
              onFilterCategoryIncludeDescendantsChange(false);
            }}
            className="text-[11px] font-medium text-[var(--text-muted)] transition hover:text-[var(--text)]"
          >
            필터 초기화
          </button>
        )}
      </div>

      {expanded && (
        <div className="space-y-3 rounded-xl border border-[color:var(--border)] bg-[var(--surface-muted)] p-3">
          <div className="grid grid-cols-2 gap-2">
            {statusFilters.map(option => (
              <button
                key={option.key}
                type="button"
                onClick={() => onFilterStatusChange(option.key)}
                className={`rounded-lg border px-3 py-2 text-left text-xs font-semibold transition ${
                  filterStatus === option.key
                    ? 'border-[color:var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-strong)]'
                    : 'border-[color:var(--border)] bg-[var(--surface)] text-[var(--text-muted)] hover:border-[color:var(--accent)] hover:text-[var(--text)]'
                }`}
              >
                <span>{option.label}</span>
                <span className="ml-1 text-[11px] opacity-80">{option.count}</span>
              </button>
            ))}
          </div>

          <CategoryPicker
            categoryTree={categoryTree}
            value={filterCategory}
            onChange={onFilterCategoryChange}
            defaultOptionLabel="모든 카테고리"
            mode="filter"
            includeDescendants={filterCategoryIncludeDescendants}
            onIncludeDescendantsChange={onFilterCategoryIncludeDescendantsChange}
            recentStorageKey="hamlog:admin:sidebar-categories"
            triggerClassName="flex w-full items-center justify-between rounded-lg border border-[color:var(--border)] bg-[var(--surface)] px-4 py-2.5 text-sm text-[var(--text)] transition hover:border-[color:var(--accent)]"
            panelClassName="relative z-20 w-full rounded-xl border border-[color:var(--border)] bg-[var(--surface)] p-4 shadow-2xl"
          />

          {quickCategoryNodes.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {quickCategoryNodes.map(node => (
                <button
                  key={node.id}
                  type="button"
                  onClick={() => onFilterCategoryChange(node.name)}
                  className={`rounded-lg border px-3 py-1.5 text-[11px] transition ${
                    normalizeCategoryKey(filterCategory) === normalizeCategoryKey(node.name)
                      ? 'border-[color:var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-strong)]'
                      : 'border-[color:var(--border)] bg-[var(--surface)] text-[var(--text-muted)] hover:border-[color:var(--accent)] hover:text-[var(--text)]'
                  }`}
                >
                  {node.name} · {node.count}
                </button>
              ))}
            </div>
          )}

          {(filterStatus !== 'all' || filterCategory !== 'all') && (
            <div className="flex flex-wrap gap-2">
              {filterStatus !== 'all' && (
                <button
                  type="button"
                  onClick={() => onFilterStatusChange('all')}
                  className="rounded-lg border border-[color:var(--border)] bg-[var(--surface)] px-3 py-1 text-[11px] text-[var(--text-muted)] transition hover:border-[color:var(--accent)] hover:text-[var(--text)]"
                >
                  상태 해제
                </button>
              )}
              {filterCategory !== 'all' && (
                <button
                  type="button"
                  onClick={() => onFilterCategoryChange('all')}
                  className="rounded-lg border border-[color:var(--border)] bg-[var(--surface)] px-3 py-1 text-[11px] text-[var(--text-muted)] transition hover:border-[color:var(--accent)] hover:text-[var(--text)]"
                >
                  카테고리 해제
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
