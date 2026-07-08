import { RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';
import {
    GRAPH_MAX_ZOOM,
    GRAPH_MIN_ZOOM,
    GRAPH_ZOOM_STEP,
    graphFilterOptions
} from './constants';
import type { GraphFilter } from './types';

interface GraphToolbarProps {
    activeFilter: GraphFilter;
    showLabels: boolean;
    zoom: number;
    zoomPercent: number;
    onFilterChange: (filter: GraphFilter) => void;
    onShowLabelsChange: (showLabels: boolean) => void;
    onZoomChange: (delta: number) => void;
    onReset: () => void;
}

export const GraphToolbar = ({
    activeFilter,
    showLabels,
    zoom,
    zoomPercent,
    onFilterChange,
    onShowLabelsChange,
    onZoomChange,
    onReset
}: GraphToolbarProps) => (
    <div className="mt-4 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2">
            <div className="flex flex-wrap gap-1" role="group" aria-label="그래프 노드 필터">
                {graphFilterOptions.map(({ key, label, Icon }) => {
                    const active = activeFilter === key;

                    return (
                        <button
                            key={key}
                            type="button"
                            aria-pressed={active}
                            title={`${label} 노드 보기`}
                            onClick={() => onFilterChange(key)}
                            className={`angular-control inline-flex h-9 items-center gap-1.5 border px-2.5 text-xs font-semibold transition ${active
                                ? 'border-[color:var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-strong)]'
                                : 'border-[color:var(--border)] bg-[var(--surface)] text-[var(--text-muted)] hover:border-[color:var(--accent)] hover:text-[var(--text)]'
                            }`}
                        >
                            <Icon size={14} aria-hidden="true" />
                            <span>{label}</span>
                        </button>
                    );
                })}
            </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1" role="group" aria-label="그래프 확대 축소">
                <button
                    type="button"
                    onClick={() => onZoomChange(-GRAPH_ZOOM_STEP)}
                    disabled={zoom <= GRAPH_MIN_ZOOM + 0.01}
                    title="축소"
                    aria-label="그래프 축소"
                    className="angular-control inline-flex h-9 w-9 items-center justify-center border border-[color:var(--border)] bg-[var(--surface)] text-[var(--text-muted)] transition hover:border-[color:var(--accent)] hover:text-[var(--text)] disabled:cursor-not-allowed disabled:opacity-40"
                >
                    <ZoomOut size={14} aria-hidden="true" />
                </button>
                <span className="angular-control inline-flex h-9 w-14 items-center justify-center border border-[color:var(--border)] bg-[var(--surface)] text-xs font-semibold text-[var(--text-muted)]">
                    {zoomPercent}%
                </span>
                <button
                    type="button"
                    onClick={() => onZoomChange(GRAPH_ZOOM_STEP)}
                    disabled={zoom >= GRAPH_MAX_ZOOM - 0.01}
                    title="확대"
                    aria-label="그래프 확대"
                    className="angular-control inline-flex h-9 w-9 items-center justify-center border border-[color:var(--border)] bg-[var(--surface)] text-[var(--text-muted)] transition hover:border-[color:var(--accent)] hover:text-[var(--text)] disabled:cursor-not-allowed disabled:opacity-40"
                >
                    <ZoomIn size={14} aria-hidden="true" />
                </button>
            </div>
            <label className="angular-control inline-flex h-9 cursor-pointer items-center gap-2 border border-[color:var(--border)] bg-[var(--surface)] px-2.5 text-xs font-semibold text-[var(--text-muted)] transition hover:border-[color:var(--accent)] hover:text-[var(--text)]">
                <input
                    type="checkbox"
                    checked={showLabels}
                    onChange={event => onShowLabelsChange(event.target.checked)}
                    className="h-3.5 w-3.5 accent-[var(--accent)]"
                />
                <span>라벨</span>
            </label>
            <button
                type="button"
                onClick={onReset}
                className="angular-control inline-flex h-9 items-center gap-1.5 border border-[color:var(--border)] bg-[var(--surface)] px-2.5 text-xs font-semibold text-[var(--text-muted)] transition hover:border-[color:var(--accent)] hover:text-[var(--text)]"
            >
                <RotateCcw size={14} aria-hidden="true" />
                <span>초기화</span>
            </button>
        </div>
    </div>
);
