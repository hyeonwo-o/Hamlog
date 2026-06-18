import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, History, Search } from 'lucide-react';
import type { CategoryNode, CategoryTreeResult } from '../../../utils/categoryTree';
import {
  getCategoryPathLabel,
  collectCategoryNames
} from '../../../utils/categoryTree';
import { DEFAULT_CATEGORY, normalizeCategoryKey } from '../../../utils/category';

const RECENT_LIMIT = 5;

interface CategoryPickerProps {
  categoryTree: CategoryTreeResult;
  value: string;
  onChange: (value: string) => void;
  defaultOptionLabel: string;
  mode?: 'select' | 'filter';
  includeDescendants?: boolean;
  onIncludeDescendantsChange?: (value: boolean) => void;
  recentStorageKey?: string;
  triggerClassName?: string;
  panelClassName?: string;
  searchPlaceholder?: string;
}

const highlightMatch = (text: string, query: string) => {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) return text;

  const lowerText = text.toLowerCase();
  const lowerQuery = normalizedQuery.toLowerCase();
  const index = lowerText.indexOf(lowerQuery);

  if (index === -1) return text;

  return (
    <>
      {text.slice(0, index)}
      <mark className="rounded bg-[var(--accent-soft)] px-0.5 text-[var(--accent-strong)]">
        {text.slice(index, index + normalizedQuery.length)}
      </mark>
      {text.slice(index + normalizedQuery.length)}
    </>
  );
};

const readRecentCategories = (storageKey: string) => {
  if (typeof window === 'undefined') return [];

  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((value): value is string => typeof value === 'string')
      : [];
  } catch {
    return [];
  }
};

const CategoryPicker: React.FC<CategoryPickerProps> = ({
  categoryTree,
  value,
  onChange,
  defaultOptionLabel,
  mode = 'select',
  includeDescendants = false,
  onIncludeDescendantsChange,
  recentStorageKey = 'hamlog:admin:recent-categories',
  triggerClassName,
  panelClassName,
  searchPlaceholder = '카테고리 검색'
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [recentCategories, setRecentCategories] = useState<string[]>(
    () => readRecentCategories(recentStorageKey)
  );
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(
      recentStorageKey,
      JSON.stringify(recentCategories.slice(0, RECENT_LIMIT))
    );
  }, [recentCategories, recentStorageKey]);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [open]);

  const selectedNode = useMemo(() => {
    if (mode === 'filter' && value === 'all') return null;
    const key = normalizeCategoryKey(value || DEFAULT_CATEGORY);
    return categoryTree.nodesByKey.get(key) ?? null;
  }, [categoryTree.nodesByKey, mode, value]);

  const selectedLabel = useMemo(() => {
    if (mode === 'filter' && value === 'all') return defaultOptionLabel;
    if (!selectedNode) return value || defaultOptionLabel;
    return getCategoryPathLabel(selectedNode, categoryTree.nodesById);
  }, [categoryTree.nodesById, defaultOptionLabel, mode, selectedNode, value]);

  const quickPickNodes = useMemo(
    () =>
      [...categoryTree.roots]
        .filter(node => normalizeCategoryKey(node.name) !== normalizeCategoryKey(DEFAULT_CATEGORY))
        .sort((left, right) => {
          if (right.count !== left.count) return right.count - left.count;
          return left.name.localeCompare(right.name, 'ko');
        })
        .slice(0, 5),
    [categoryTree.roots]
  );

  const visibleRecentCategories = useMemo(
    () =>
      recentCategories.filter(category =>
        categoryTree.nodesByKey.has(normalizeCategoryKey(category))
      ),
    [categoryTree.nodesByKey, recentCategories]
  );

  const searchResults = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return [];

    return Array.from(categoryTree.nodesById.values())
      .map(node => ({
        node,
        path: getCategoryPathLabel(node, categoryTree.nodesById)
      }))
      .filter(({ node, path }) => {
        return (
          node.name.toLowerCase().includes(normalizedQuery)
          || path.toLowerCase().includes(normalizedQuery)
        );
      })
      .sort((left, right) => {
        const leftStartsWith = left.node.name.toLowerCase().startsWith(normalizedQuery) ? 1 : 0;
        const rightStartsWith = right.node.name.toLowerCase().startsWith(normalizedQuery) ? 1 : 0;
        if (leftStartsWith !== rightStartsWith) return rightStartsWith - leftStartsWith;
        if (right.node.count !== left.node.count) return right.node.count - left.node.count;
        return left.path.localeCompare(right.path, 'ko');
      });
  }, [categoryTree.nodesById, query]);

  const descendantCount = useMemo(() => {
    if (!selectedNode) return 0;
    return Math.max(0, collectCategoryNames(selectedNode).length - 1);
  }, [selectedNode]);

  const pushRecentCategory = (categoryName: string) => {
    if (mode === 'filter' && categoryName === 'all') return;

    setRecentCategories(current => {
      const deduped = current.filter(
        item => normalizeCategoryKey(item) !== normalizeCategoryKey(categoryName)
      );
      return [categoryName, ...deduped].slice(0, RECENT_LIMIT);
    });
  };

  const handleSelect = (nextValue: string) => {
    onChange(nextValue);
    if (nextValue !== 'all') {
      pushRecentCategory(nextValue);
    }
    setOpen(false);
    setQuery('');
  };

  const toggleExpanded = (nodeId: string) => {
    setExpanded(current => ({
      ...current,
      [nodeId]: current[nodeId] === undefined ? false : !current[nodeId]
    }));
  };

  const renderNode = (node: CategoryNode, depth: number) => {
    const isExpanded = expanded[node.id] ?? true;
    const isSelected = selectedNode
      ? normalizeCategoryKey(selectedNode.name) === normalizeCategoryKey(node.name)
      : false;
    const hasChildren = node.children.length > 0;

    return (
      <li key={node.id} className="space-y-2">
        <div className="flex items-center gap-2" style={{ paddingLeft: depth * 14 }}>
          {hasChildren ? (
            <button
              type="button"
              onClick={() => toggleExpanded(node.id)}
              className="flex h-5 w-5 items-center justify-center rounded-md text-[var(--text-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--text)]"
              aria-label={`${node.name} 토글`}
            >
              <ChevronRight size={12} className={isExpanded ? 'rotate-90 transition-transform' : 'transition-transform'} />
            </button>
          ) : (
            <span className="block h-5 w-5" />
          )}

          <button
            type="button"
            onClick={() => handleSelect(node.name)}
            className={`flex min-w-0 flex-1 items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition ${
              isSelected
                ? 'border-[color:var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-strong)]'
                : 'border-[color:var(--border)] bg-[var(--surface)] text-[var(--text-muted)] hover:border-[color:var(--accent)] hover:text-[var(--text)]'
            }`}
          >
            <span className="truncate">{node.name}</span>
            <span className="ml-3 rounded-md bg-[var(--surface-muted)] px-2 py-0.5 text-[10px] font-medium text-[var(--text-muted)]">
              {node.count}
            </span>
          </button>
        </div>
        {hasChildren && isExpanded && (
          <ul className="space-y-2">
            {node.children.map(child => renderNode(child, depth + 1))}
          </ul>
        )}
      </li>
    );
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(current => !current)}
        className={triggerClassName ?? 'flex w-full items-center justify-between rounded-xl border border-[color:var(--border)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--text)] transition hover:border-[color:var(--accent)]'}
      >
        <span className="min-w-0 truncate text-left">{selectedLabel}</span>
        <ChevronDown
          size={16}
          className={`ml-3 shrink-0 text-[var(--text-muted)] transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div
          className={
            panelClassName
            ?? 'absolute left-0 top-full z-50 mt-2 w-full min-w-[280px] rounded-xl border border-[color:var(--border)] bg-[var(--surface)] p-4'
          }
        >
          <div className="space-y-4">
            <div className="space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">
                {mode === 'filter' ? '카테고리 필터' : '카테고리 선택'}
              </p>
              <p className="text-xs text-[var(--text-muted)]">{selectedLabel}</p>
            </div>

            <label className="relative block">
              <Search
                size={14}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
              />
              <input
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={searchPlaceholder}
                className="w-full rounded-lg border border-[color:var(--border)] bg-[var(--surface-muted)] py-2.5 pl-9 pr-3 text-sm text-[var(--text)] outline-none transition focus:border-[color:var(--accent)]"
              />
            </label>

            <div className="rounded-lg border border-[color:var(--border)] bg-[var(--surface-muted)] p-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-[11px] font-semibold text-[var(--text)]">현재 선택</p>
                  <p className="text-[11px] text-[var(--text-muted)]">
                    {selectedNode
                      ? `${selectedLabel}${mode === 'filter' && includeDescendants && descendantCount > 0 ? ` · 하위 ${descendantCount}개 포함` : ''}`
                      : defaultOptionLabel}
                  </p>
                </div>
                {mode === 'filter' && (
                  <button
                    type="button"
                    onClick={() => handleSelect('all')}
                    className="rounded-lg border border-[color:var(--border)] px-3 py-1 text-[11px] font-medium text-[var(--text-muted)] hover:border-[color:var(--accent)] hover:text-[var(--text)]"
                  >
                    전체 보기
                  </button>
                )}
              </div>

              {mode === 'filter' && value !== 'all' && onIncludeDescendantsChange && (
                <label className="mt-3 flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-[color:var(--border)] bg-[var(--surface)] px-3 py-2 text-xs text-[var(--text)]">
                  <span>하위 카테고리 포함</span>
                  <input
                    type="checkbox"
                    checked={includeDescendants}
                    onChange={(event) => onIncludeDescendantsChange(event.target.checked)}
                    className="h-4 w-4 accent-[var(--accent)]"
                  />
                </label>
              )}
            </div>

            {!query.trim() && quickPickNodes.length > 0 && (
              <div className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                  자주 쓰는 카테고리
                </p>
                <div className="flex flex-wrap gap-2">
                  {quickPickNodes.map(node => (
                    <button
                      key={node.id}
                      type="button"
                      onClick={() => handleSelect(node.name)}
                      className={`rounded-lg border px-3 py-1.5 text-xs transition ${
                        normalizeCategoryKey(value) === normalizeCategoryKey(node.name)
                          ? 'border-[color:var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-strong)]'
                          : 'border-[color:var(--border)] bg-[var(--surface)] text-[var(--text-muted)] hover:border-[color:var(--accent)] hover:text-[var(--text)]'
                      }`}
                    >
                      {node.name} · {node.count}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {!query.trim() && visibleRecentCategories.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                  <History size={12} />
                  최근 선택
                </div>
                <div className="flex flex-wrap gap-2">
                  {visibleRecentCategories.map(category => (
                    <button
                      key={category}
                      type="button"
                      onClick={() => handleSelect(category)}
                      className="rounded-lg border border-[color:var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs text-[var(--text-muted)] transition hover:border-[color:var(--accent)] hover:text-[var(--text)]"
                    >
                      {category}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
              {query.trim() ? (
                searchResults.length > 0 ? (
                  searchResults.map(({ node, path }) => (
                    <button
                      key={node.id}
                      type="button"
                      onClick={() => handleSelect(node.name)}
                      className="flex w-full items-start justify-between gap-3 rounded-lg border border-[color:var(--border)] bg-[var(--surface-muted)] px-3 py-3 text-left transition hover:border-[color:var(--accent)] hover:bg-[var(--surface)]"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-[var(--text)]">
                          {highlightMatch(node.name, query)}
                        </p>
                        <p className="mt-1 truncate text-[11px] text-[var(--text-muted)]">
                          {highlightMatch(path, query)}
                        </p>
                      </div>
                      <span className="rounded-md bg-[var(--surface)] px-2 py-0.5 text-[10px] font-medium text-[var(--text-muted)]">
                        {node.count}
                      </span>
                    </button>
                  ))
                ) : (
                  <p className="rounded-lg border border-dashed border-[color:var(--border)] px-4 py-6 text-center text-xs text-[var(--text-muted)]">
                    검색 결과가 없습니다.
                  </p>
                )
              ) : (
                <>
                  {mode === 'select' && (
                    <button
                      type="button"
                      onClick={() => handleSelect(DEFAULT_CATEGORY)}
                      className={`flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-left text-sm transition ${
                        normalizeCategoryKey(value || DEFAULT_CATEGORY) === normalizeCategoryKey(DEFAULT_CATEGORY)
                          ? 'border-[color:var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-strong)]'
                          : 'border-[color:var(--border)] bg-[var(--surface-muted)] text-[var(--text-muted)] hover:border-[color:var(--accent)] hover:text-[var(--text)]'
                      }`}
                    >
                      <span>{DEFAULT_CATEGORY}</span>
                      <span className="rounded-md bg-[var(--surface)] px-2 py-0.5 text-[10px] font-medium text-[var(--text-muted)]">
                        {categoryTree.nodesByKey.get(normalizeCategoryKey(DEFAULT_CATEGORY))?.count ?? 0}
                      </span>
                    </button>
                  )}
                  <ul className="space-y-2">
                    {categoryTree.roots
                      .filter(node => normalizeCategoryKey(node.name) !== normalizeCategoryKey(DEFAULT_CATEGORY))
                      .map(node => renderNode(node, 0))}
                  </ul>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CategoryPicker;
