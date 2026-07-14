import { useEffect, useRef, useState, type RefObject } from 'react';
import {
    Check,
    Copy,
    Filter,
    Maximize2,
    Minimize2,
    MoreHorizontal,
    RotateCcw,
    Search,
    Share2,
    X
} from 'lucide-react';
import {
    graphEdgeFilterOptions,
    graphFilterOptions,
    nodeTypeLabel
} from './constants';
import type { GraphEdgeFilter, GraphFilter, GraphNode } from './types';

interface GraphToolbarProps {
    activeFilter: GraphFilter;
    activeEdgeFilter: GraphEdgeFilter;
    showLabels: boolean;
    searchQuery: string;
    searchResults: GraphNode[];
    searchInputRef: RefObject<HTMLInputElement>;
    isFullscreen: boolean;
    shareStatus: 'idle' | 'copied' | 'failed';
    onFilterChange: (filter: GraphFilter) => void;
    onEdgeFilterChange: (filter: GraphEdgeFilter) => void;
    onShowLabelsChange: (showLabels: boolean) => void;
    onSearchQueryChange: (query: string) => void;
    onSearchSubmit: () => void;
    onSearchResultSelect: (nodeId: string) => void;
    onToggleFullscreen: () => void;
    onShare: () => void;
    onReset: () => void;
}

type OpenPanel = 'filters' | 'more' | null;

const iconButtonClassName = 'angular-control inline-flex h-9 items-center justify-center gap-1.5 border border-transparent px-2.5 text-xs font-semibold text-[var(--text-muted)] transition hover:border-[color:var(--border)] hover:bg-[var(--surface-muted)] hover:text-[var(--text)]';

export const GraphToolbar = ({
    activeFilter,
    activeEdgeFilter,
    showLabels,
    searchQuery,
    searchResults,
    searchInputRef,
    isFullscreen,
    shareStatus,
    onFilterChange,
    onEdgeFilterChange,
    onShowLabelsChange,
    onSearchQueryChange,
    onSearchSubmit,
    onSearchResultSelect,
    onToggleFullscreen,
    onShare,
    onReset
}: GraphToolbarProps) => {
    const [openPanel, setOpenPanel] = useState<OpenPanel>(null);
    const toolbarRef = useRef<HTMLDivElement | null>(null);
    const activeFilterCount = Number(activeFilter !== 'all') + Number(activeEdgeFilter !== 'all');

    useEffect(() => {
        const closeOnOutsideClick = (event: PointerEvent) => {
            if (!toolbarRef.current?.contains(event.target as Node)) {
                setOpenPanel(null);
            }
        };
        const closeOnEscape = (event: globalThis.KeyboardEvent) => {
            if (event.key === 'Escape') setOpenPanel(null);
        };

        document.addEventListener('pointerdown', closeOnOutsideClick);
        window.addEventListener('keydown', closeOnEscape);
        return () => {
            document.removeEventListener('pointerdown', closeOnOutsideClick);
            window.removeEventListener('keydown', closeOnEscape);
        };
    }, []);

    const selectSearchResult = (nodeId: string) => {
        onSearchResultSelect(nodeId);
        onSearchQueryChange('');
    };

    return (
        <div
            ref={toolbarRef}
            className="mt-2 flex flex-col gap-2 border-y border-[color:var(--border)] py-2 sm:flex-row sm:items-center"
            role="region"
            aria-label="그래프 탐색 도구"
        >
            <form
                role="search"
                className="relative min-w-0 flex-1 sm:max-w-lg"
                onSubmit={event => {
                    event.preventDefault();
                    if (searchResults[0]) {
                        onSearchSubmit();
                        onSearchQueryChange('');
                    }
                }}
            >
                <Search
                    size={14}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
                    aria-hidden="true"
                />
                <input
                    ref={searchInputRef}
                    type="search"
                    value={searchQuery}
                    onChange={event => onSearchQueryChange(event.target.value)}
                    placeholder="글·카테고리·시리즈 검색"
                    aria-label="그래프 노드 검색"
                    aria-controls="graph-search-results"
                    aria-expanded={Boolean(searchQuery.trim())}
                    className="angular-control h-9 w-full border border-[color:var(--border)] bg-[var(--surface)] pl-9 pr-9 text-sm text-[var(--text)] outline-none transition placeholder:text-[var(--text-muted)] focus:border-[var(--accent)]"
                />
                {searchQuery && (
                    <button
                        type="button"
                        onClick={() => onSearchQueryChange('')}
                        aria-label="그래프 검색어 지우기"
                        className="absolute right-1.5 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center text-[var(--text-muted)] hover:text-[var(--text)]"
                    >
                        <X size={14} aria-hidden="true" />
                    </button>
                )}

                {searchQuery.trim() && (
                    <div
                        id="graph-search-results"
                        className="absolute inset-x-0 top-full z-40 mt-1 max-h-72 overflow-y-auto border border-[color:var(--border)] bg-[var(--surface)] p-1 shadow-lg"
                        role="listbox"
                        aria-label="그래프 검색 결과"
                    >
                        {searchResults.length > 0 ? searchResults.map(node => (
                            <button
                                key={node.id}
                                type="button"
                                role="option"
                                aria-selected="false"
                                onClick={() => selectSearchResult(node.id)}
                                className="angular-control flex w-full items-center gap-2 px-2.5 py-2 text-left text-xs text-[var(--text)] transition hover:bg-[var(--surface-muted)]"
                            >
                                <span className="w-12 shrink-0 text-[10px] font-semibold text-[var(--text-muted)]">
                                    {nodeTypeLabel[node.type]}
                                </span>
                                <span className="truncate">{node.label}</span>
                            </button>
                        )) : (
                            <p className="px-3 py-4 text-center text-xs text-[var(--text-muted)]">
                                일치하는 노드가 없습니다.
                            </p>
                        )}
                    </div>
                )}
            </form>

            <div className="flex items-center justify-end gap-1">
                <div className="relative">
                    <button
                        type="button"
                        onClick={() => setOpenPanel(current => current === 'filters' ? null : 'filters')}
                        aria-expanded={openPanel === 'filters'}
                        aria-controls="graph-filter-panel"
                        className={`${iconButtonClassName} ${activeFilterCount > 0 ? 'bg-[var(--accent-soft)] text-[var(--accent-strong)]' : ''}`}
                    >
                        <Filter size={14} aria-hidden="true" />
                        <span>필터</span>
                        {activeFilterCount > 0 && (
                            <span className="inline-flex h-4 min-w-4 items-center justify-center bg-[var(--accent)] px-1 text-[9px] text-white">
                                {activeFilterCount}
                            </span>
                        )}
                    </button>

                    {openPanel === 'filters' && (
                        <div
                            id="graph-filter-panel"
                            className="absolute right-0 z-40 mt-1 w-[min(19rem,calc(100vw-2rem))] border border-[color:var(--border)] bg-[var(--surface)] p-3 shadow-lg sm:left-0 sm:right-auto"
                        >
                            <fieldset>
                                <legend className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
                                    노드
                                </legend>
                                <div className="mt-2 flex flex-wrap gap-1" role="group" aria-label="그래프 노드 필터">
                                    {graphFilterOptions.map(({ key, label }) => (
                                        <button
                                            key={key}
                                            type="button"
                                            aria-pressed={activeFilter === key}
                                            onClick={() => onFilterChange(key)}
                                            className={`angular-control border px-2.5 py-1.5 text-xs transition ${activeFilter === key
                                                ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-strong)]'
                                                : 'border-[color:var(--border)] text-[var(--text-muted)] hover:text-[var(--text)]'}`}
                                        >
                                            {label}
                                        </button>
                                    ))}
                                </div>
                            </fieldset>

                            <fieldset className="mt-3 border-t border-[color:var(--border)] pt-3">
                                <legend className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
                                    연결
                                </legend>
                                <div className="mt-2 flex flex-wrap gap-1" role="group" aria-label="그래프 관계 필터">
                                    {graphEdgeFilterOptions.map(({ key, label }) => (
                                        <button
                                            key={key}
                                            type="button"
                                            aria-pressed={activeEdgeFilter === key}
                                            onClick={() => onEdgeFilterChange(key)}
                                            className={`angular-control border px-2.5 py-1.5 text-xs transition ${activeEdgeFilter === key
                                                ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-strong)]'
                                                : 'border-[color:var(--border)] text-[var(--text-muted)] hover:text-[var(--text)]'}`}
                                        >
                                            {label}
                                        </button>
                                    ))}
                                </div>
                            </fieldset>
                        </div>
                    )}
                </div>

                <button
                    type="button"
                    onClick={onToggleFullscreen}
                    aria-pressed={isFullscreen}
                    aria-label={isFullscreen ? '전체 화면 종료' : '전체 화면'}
                    title={isFullscreen ? '전체 화면 종료' : '전체 화면'}
                    className={`${iconButtonClassName} w-9 px-0`}
                >
                    {isFullscreen ? <Minimize2 size={15} aria-hidden="true" /> : <Maximize2 size={15} aria-hidden="true" />}
                </button>

                <div className="relative">
                    <button
                        type="button"
                        onClick={() => setOpenPanel(current => current === 'more' ? null : 'more')}
                        aria-expanded={openPanel === 'more'}
                        aria-controls="graph-more-panel"
                        aria-label="추가 설정"
                        title="추가 설정"
                        className={`${iconButtonClassName} w-9 px-0`}
                    >
                        <MoreHorizontal size={16} aria-hidden="true" />
                    </button>

                    {openPanel === 'more' && (
                        <div
                            id="graph-more-panel"
                            className="absolute right-0 z-40 mt-1 w-56 border border-[color:var(--border)] bg-[var(--surface)] p-1.5 shadow-lg"
                        >
                            <button
                                type="button"
                                onClick={() => {
                                    onShare();
                                    setOpenPanel(null);
                                }}
                                className="angular-control flex w-full items-center gap-2 px-2.5 py-2 text-left text-xs text-[var(--text)] hover:bg-[var(--surface-muted)]"
                            >
                                {shareStatus === 'copied' ? <Check size={14} aria-hidden="true" /> : shareStatus === 'failed' ? <Copy size={14} aria-hidden="true" /> : <Share2 size={14} aria-hidden="true" />}
                                <span>{shareStatus === 'copied' ? '링크 복사됨' : '현재 상태 공유'}</span>
                            </button>
                            <label className="angular-control flex cursor-pointer items-center justify-between gap-3 px-2.5 py-2 text-xs text-[var(--text)] hover:bg-[var(--surface-muted)]">
                                <span>라벨 표시</span>
                                <input
                                    type="checkbox"
                                    checked={showLabels}
                                    onChange={event => onShowLabelsChange(event.target.checked)}
                                    className="h-3.5 w-3.5 accent-[var(--accent)]"
                                />
                            </label>
                            <button
                                type="button"
                                onClick={() => {
                                    onReset();
                                    setOpenPanel(null);
                                }}
                                className="angular-control mt-1 flex w-full items-center gap-2 border-t border-[color:var(--border)] px-2.5 py-2 text-left text-xs text-[var(--text-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--text)]"
                            >
                                <RotateCcw size={14} aria-hidden="true" />
                                <span>그래프 초기화</span>
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <p className="sr-only" aria-live="polite">
                {shareStatus === 'copied' ? '현재 그래프 링크를 복사했습니다.' : shareStatus === 'failed' ? '링크를 복사하지 못했습니다.' : ''}
            </p>
        </div>
    );
};
