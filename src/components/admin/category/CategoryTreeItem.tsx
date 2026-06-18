import React, { useMemo, useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ChevronRight, Edit2, GripVertical, Plus, Trash2 } from 'lucide-react';
import { normalizeCategoryKey } from '../../../utils/category';
import { getDescendantIds } from './categoryTreeUtils';
import type { CategoryTreeItemProps } from './types';

const CategoryTreeItem: React.FC<CategoryTreeItemProps> = ({
  node,
  depth,
  activeCategoryId,
  managedCategoryIds,
  defaultCategory,
  categorySaving,
  parentOptions,
  onSelectCategory,
  onUpdateCategory,
  onAddCategory,
  onDeleteCategory,
  children
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editingName, setEditingName] = useState('');
  const [editingParentId, setEditingParentId] = useState('');
  const [isAddingChild, setIsAddingChild] = useState(false);
  const [childDraft, setChildDraft] = useState('');

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: node.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.45 : 1,
    paddingLeft: depth * 16
  };

  const hasChildren = node.children.length > 0;
  const isManaged = managedCategoryIds.has(node.id);
  const isDefault = normalizeCategoryKey(node.name) === normalizeCategoryKey(defaultCategory);
  const isActive = activeCategoryId === node.id;
  const descendantIds = useMemo(
    () => (isEditing ? getDescendantIds(node) : new Set<string>()),
    [isEditing, node]
  );

  const startEdit = () => {
    setIsEditing(true);
    setEditingName(node.name);
    setEditingParentId(node.parentId ?? '');
    onSelectCategory(node.id);
  };

  const saveEdit = async () => {
    try {
      await onUpdateCategory(node, {
        name: editingName,
        parentId: editingParentId || null
      });
      setIsEditing(false);
    } catch {
      // Keep edit state on failure.
    }
  };

  const submitAddChild = async () => {
    if (!childDraft.trim()) {
      setIsAddingChild(false);
      return;
    }

    try {
      await onAddCategory(childDraft, node.id);
      setChildDraft('');
      setIsAddingChild(false);
      setIsExpanded(true);
    } catch {
      // Keep input for retry.
    }
  };

  const handleChildKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      void submitAddChild();
      return;
    }

    if (event.key === 'Escape') {
      setIsAddingChild(false);
      setChildDraft('');
    }
  };

  return (
    <div ref={setNodeRef} style={style} className="touch-none">
      <div className="mb-2 flex items-start gap-2">
        {hasChildren ? (
          <button
            type="button"
            onClick={() => setIsExpanded(prev => !prev)}
            className="mt-2 flex h-6 w-6 items-center justify-center rounded-lg text-[var(--text-muted)] transition hover:bg-[var(--surface-muted)] hover:text-[var(--text)]"
            aria-label={`${node.name} 토글`}
          >
            <ChevronRight
              size={14}
              className={`transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}
            />
          </button>
        ) : (
          <span className="mt-2 block h-6 w-6 flex-shrink-0" />
        )}

        <div
          className={`group flex flex-1 items-start justify-between gap-3 rounded-lg border p-3 transition-all ${
            isActive
              ? 'border-[color:var(--accent)] bg-[var(--surface)] ring-1 ring-[color:var(--accent-soft)]'
              : 'border-[color:var(--border)] bg-[var(--surface-muted)] hover:border-[color:var(--accent)] hover:bg-[var(--surface)]'
          }`}
          onClick={() => onSelectCategory(node.id)}
          role="button"
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              onSelectCategory(node.id);
            }
          }}
        >
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              {isManaged && !isDefault && !categorySaving && (
                <div
                  {...attributes}
                  {...listeners}
                  className="cursor-grab rounded-lg border border-[color:var(--border)] p-1 text-[var(--text-muted)] transition hover:text-[var(--text)] active:cursor-grabbing"
                  onClick={(event) => event.stopPropagation()}
                >
                  <GripVertical size={14} />
                </div>
              )}
              <p className="truncate text-sm font-semibold text-[var(--text)]">{node.name}</p>
              {isDefault && (
                <span className="rounded-lg bg-[var(--accent-soft)] px-2 py-0.5 text-[10px] font-semibold text-[var(--accent-strong)]">
                  기본
                </span>
              )}
              {!isManaged && (
                <span className="rounded-lg bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-600">
                  자동 감지
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-[var(--text-muted)]">
              <span className="rounded-lg bg-[var(--surface)] px-2 py-1">
                전체 {node.count}개 글
              </span>
              <span className="rounded-lg bg-[var(--surface)] px-2 py-1">
                직속 {node.directCount}
              </span>
              <span className="rounded-lg bg-[var(--surface)] px-2 py-1">
                하위 {node.children.length}
              </span>
            </div>
          </div>

          <div className={`flex items-center gap-1 transition-opacity ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                setIsAddingChild(true);
                setIsExpanded(true);
                onSelectCategory(node.id);
              }}
              disabled={!isManaged || isDefault || categorySaving}
              className="rounded-lg p-1.5 text-[var(--text-muted)] transition hover:bg-[var(--surface)] hover:text-[var(--accent)] disabled:opacity-40"
              title="하위 카테고리 추가"
            >
              <Plus size={16} />
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                startEdit();
              }}
              disabled={!isManaged || isDefault || categorySaving}
              className="rounded-lg p-1.5 text-[var(--text-muted)] transition hover:bg-[var(--surface)] hover:text-[var(--accent)] disabled:opacity-40"
              title="수정"
            >
              <Edit2 size={15} />
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onDeleteCategory(node);
              }}
              disabled={!isManaged || isDefault || categorySaving}
              className="rounded-lg p-1.5 text-[var(--text-muted)] transition hover:bg-[var(--surface)] hover:text-red-500 disabled:opacity-40"
              title="삭제"
            >
              <Trash2 size={15} />
            </button>
          </div>
        </div>
      </div>

      {isEditing && (
        <div className="mb-3 ml-8 rounded-lg border border-dashed border-[color:var(--border)] bg-[var(--surface)] p-4">
          <div className="grid gap-3 md:grid-cols-[1.4fr_1fr_auto]">
            <div className="space-y-1">
              <label className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                이름 수정
              </label>
              <input
                value={editingName}
                onChange={(event) => setEditingName(event.target.value)}
                className="w-full rounded-xl border border-[color:var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-xs text-[var(--text)] outline-none transition focus:border-[color:var(--accent)]"
                autoFocus
                onKeyDown={(event) => {
                  if (event.key === 'Enter') void saveEdit();
                  if (event.key === 'Escape') setIsEditing(false);
                }}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                상위 변경
              </label>
              <select
                value={editingParentId}
                onChange={(event) => setEditingParentId(event.target.value)}
                className="w-full rounded-xl border border-[color:var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-xs text-[var(--text)] outline-none transition focus:border-[color:var(--accent)]"
              >
                <option value="">최상위</option>
                {parentOptions
                  .filter(option => option.id !== node.id && !descendantIds.has(option.id))
                  .map(option => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
              </select>
            </div>
            <div className="flex items-end gap-2">
              <button
                type="button"
                onClick={saveEdit}
                disabled={categorySaving}
                className="rounded-xl bg-[var(--accent)] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[var(--accent-strong)] disabled:opacity-50"
              >
                저장
              </button>
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="rounded-xl border border-[color:var(--border)] px-3 py-2 text-xs font-semibold text-[var(--text-muted)] transition hover:bg-[var(--surface-muted)]"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      <div className={`overflow-hidden transition-all ${isExpanded ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'}`}>
        {children}

        {isAddingChild && (
          <div className="mb-2 flex items-center gap-2" style={{ paddingLeft: (depth + 1) * 16 }}>
            <span className="block h-6 w-6 flex-shrink-0" />
            <div className="flex flex-1 items-center gap-2 rounded-lg border border-dashed border-[color:var(--accent)] bg-[var(--surface)] p-3">
              <span className="text-[var(--accent)]">
                <Plus size={14} />
              </span>
              <input
                value={childDraft}
                onChange={(event) => setChildDraft(event.target.value)}
                onKeyDown={handleChildKeyDown}
                className="flex-1 bg-transparent text-sm text-[var(--text)] outline-none placeholder:text-[var(--text-muted)]"
                placeholder="새 하위 카테고리 이름"
                autoFocus
              />
              <button
                type="button"
                onClick={() => void submitAddChild()}
                className="rounded-lg bg-[var(--accent-soft)] px-3 py-1 text-[11px] font-semibold text-[var(--accent-strong)]"
              >
                추가
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CategoryTreeItem;
