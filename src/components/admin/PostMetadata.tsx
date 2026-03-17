import React, { useRef } from 'react';
import type { PostDraft } from '../../types/admin';
import type { CategoryTreeResult } from '../../utils/categoryTree';
import { DEFAULT_CATEGORY } from '../../utils/category';
import CategoryPicker from './category/CategoryPicker';

interface PostMetadataProps {
    draft: PostDraft;
    updateDraft: (patch: Partial<PostDraft>) => void;
    categoryTree: CategoryTreeResult;
    onCoverUpload?: (file: File) => Promise<void>;
    variant?: 'editor' | 'inspector';
}

export const PostMetadata: React.FC<PostMetadataProps> = ({
    draft,
    updateDraft,
    categoryTree,
    onCoverUpload,
    variant = 'editor'
}) => {
    const coverInputRef = useRef<HTMLInputElement>(null);
    const isInspector = variant === 'inspector';

    return (
        <div className={`${isInspector ? 'grid gap-4' : 'mt-6 grid gap-4 border-t border-[color:var(--border)] pt-6 md:grid-cols-12 bg-transparent'}`}>
            {/* Category - Col 6 */}
            <div className={`${isInspector ? 'relative' : 'md:col-span-6 relative group'}`}>
                <label className="mb-1 block text-[10px] text-[var(--text-muted)]">카테고리</label>
                <CategoryPicker
                    categoryTree={categoryTree}
                    value={draft.category || DEFAULT_CATEGORY}
                    onChange={(category) => updateDraft({ category })}
                    defaultOptionLabel={DEFAULT_CATEGORY}
                    recentStorageKey="hamlog:admin:editor-categories"
                    triggerClassName={`angular-control flex w-full items-center justify-between rounded-xl border border-[color:var(--border)] ${isInspector ? 'bg-[var(--surface)]' : 'bg-[var(--surface-muted)]'} px-3 py-2 text-sm text-[var(--text)] transition-colors hover:border-[color:var(--accent)]`}
                    panelClassName="angular-panel absolute left-0 top-full z-50 mt-2 w-full min-w-[280px] rounded-xl border border-[color:var(--border)] bg-[var(--surface)] p-4 shadow-2xl"
                />
            </div>

            {/* Date/Schedule - Col 6 */}
            <div className={isInspector ? '' : 'md:col-span-6'}>
                <label className="block text-[10px] text-[var(--text-muted)] mb-1">
                    {draft.status === 'scheduled' ? '예약 시간' : '발행일'}
                </label>
                {draft.status === 'scheduled' ? (
                    <input
                        type="datetime-local"
                        value={draft.scheduledAt}
                        onChange={(e) => updateDraft({ scheduledAt: e.target.value })}
                        className={`angular-control w-full rounded-xl border border-[color:var(--border)] ${isInspector ? 'bg-[var(--surface)]' : 'bg-[var(--surface-muted)]'} px-3 py-2 text-sm text-[var(--text)] focus:border-[color:var(--accent)] focus:outline-none`}
                    />
                ) : (
                    <input
                        type="date"
                        value={draft.publishedAt}
                        onChange={(e) => updateDraft({ publishedAt: e.target.value })}
                        className={`angular-control w-full rounded-xl border border-[color:var(--border)] ${isInspector ? 'bg-[var(--surface)]' : 'bg-[var(--surface-muted)]'} px-3 py-2 text-sm text-[var(--text)] focus:border-[color:var(--accent)] focus:outline-none`}
                    />
                )}
            </div>

            {/* Cover Image - Col 12 */}
            <div className={isInspector ? '' : 'md:col-span-12'}>
                <label className="block text-[10px] text-[var(--text-muted)] mb-1">대표 이미지 (URL)</label>
                <div className="flex gap-2">
                    <input
                        value={draft.cover}
                        onChange={(e) => updateDraft({ cover: e.target.value })}
                        placeholder="https://..."
                        className={`angular-control flex-1 rounded-xl border border-[color:var(--border)] ${isInspector ? 'bg-[var(--surface)]' : 'bg-[var(--surface-muted)]'} px-3 py-2 text-sm text-[var(--text)] focus:border-[color:var(--accent)] focus:outline-none`}
                    />
                    <input
                        ref={coverInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file && onCoverUpload) {
                                void onCoverUpload(file);
                            }
                            e.target.value = '';
                        }}
                    />
                    <button
                        type="button"
                        onClick={() => coverInputRef.current?.click()}
                        className={`angular-control rounded-xl border border-[color:var(--border)] ${isInspector ? 'bg-[var(--surface-muted)]' : 'bg-[var(--surface)]'} px-3 py-2 text-sm font-medium hover:bg-[var(--surface-muted)]`}
                        title="이미지 업로드"
                    >
                        📁
                    </button>
                </div>
            </div>

            {/* Summary - Full Width */}
            <div className={isInspector ? '' : 'md:col-span-12'}>
                <label className="block text-[10px] text-[var(--text-muted)] mb-1">요약 / Featured</label>
                <div className="flex gap-2">
                    <textarea
                        value={draft.summary}
                        onChange={(e) => updateDraft({ summary: e.target.value })}
                        rows={1}
                        className={`angular-control flex-1 rounded-xl border border-[color:var(--border)] ${isInspector ? 'bg-[var(--surface)]' : 'bg-[var(--surface-muted)]'} px-3 py-2 text-sm text-[var(--text)] focus:border-[color:var(--accent)] focus:outline-none resize-none`}
                        placeholder="글 요약..."
                    />
                    <label className={`angular-control flex cursor-pointer items-center gap-2 rounded-xl border px-3 transition-colors ${draft.featured ? 'border-[color:var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-strong)]' : `border-[color:var(--border)] ${isInspector ? 'bg-[var(--surface)]' : 'bg-[var(--surface-muted)]'} text-[var(--text-muted)]`}`}>
                        <input type="checkbox" checked={draft.featured} onChange={(e) => updateDraft({ featured: e.target.checked })} className="hidden" />
                        <span className="text-xs font-bold">추천</span>
                    </label>
                </div>
            </div>
        </div>
    );
};
