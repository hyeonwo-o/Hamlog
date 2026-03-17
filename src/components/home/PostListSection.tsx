import PostCard from '../PostCard';
import { CategorySidebar } from '../CategorySidebar';
import type { Post } from '../../types/blog';
import type { CategoryTreeResult } from '../../utils/categoryTree';

interface PostListSectionProps {
    filteredPosts: Post[];
    categoryTree: CategoryTreeResult;
    selectedCategory: string | null;
    selectedTag: string | null;
    searchQuery: string;
    hasLoaded: boolean;
    loading: boolean;
    error: string | null;
    onSelectCategory: (id: string | null) => void;
    onClearTag: () => void;
    onClearSearch: () => void;
}

export const PostListSection = ({
    filteredPosts,
    categoryTree,
    selectedCategory,
    selectedTag,
    searchQuery,
    hasLoaded,
    loading,
    error,
    onSelectCategory,
    onClearTag,
    onClearSearch
}: PostListSectionProps) => {
    return (
        <section id="writing" className="mx-auto max-w-6xl px-4 py-12">
            <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                    <h2 className="mt-2 font-display text-2xl font-semibold">
                        전체 글
                    </h2>
                </div>
                <span className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">
                    {filteredPosts.length}편
                </span>
            </div>
            <div className="mt-8 grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
                <CategorySidebar
                    categoryTree={categoryTree}
                    selectedCategory={selectedCategory}
                    onSelectCategory={onSelectCategory}
                />

                <div className="space-y-5">
                    {filteredPosts.length > 0 && (
                        <div className="grid gap-5">
                            {filteredPosts.map((post, index) => (
                                <PostCard key={post.id} post={post} variant="compact" index={index} />
                            ))}
                        </div>
                    )}

                    {filteredPosts.length === 0 && hasLoaded && !loading && !error && (
                        <div className="angular-panel rounded-xl border border-[color:var(--border)] bg-[var(--surface)] p-8 text-center">
                            <h3 className="font-display text-lg font-semibold">
                                조건에 맞는 글이 없어요
                            </h3>
                            <p className="mt-2 text-sm text-[var(--text-muted)]">
                                태그를 바꾸거나 검색어를 지우고 다시 확인해 보세요.
                            </p>
                            <div className="mt-6 flex flex-wrap justify-center gap-2">
                                {selectedTag && (
                                    <button
                                        type="button"
                                        onClick={onClearTag}
                                        className="angular-control rounded-lg border border-[color:var(--border)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]"
                                    >
                                        태그 해제
                                    </button>
                                )}
                                {selectedCategory && (
                                    <button
                                        type="button"
                                        onClick={() => onSelectCategory(null)}
                                        className="angular-control rounded-lg border border-[color:var(--border)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]"
                                    >
                                        카테고리 해제
                                    </button>
                                )}
                                {searchQuery && (
                                    <button
                                        type="button"
                                        onClick={onClearSearch}
                                        className="angular-control rounded-lg border border-[color:var(--border)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]"
                                    >
                                        검색 초기화
                                    </button>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </section>
    );
};
