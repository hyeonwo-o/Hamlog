import PostCard from '../PostCard';
import { CategorySidebar } from '../CategorySidebar';
import { useLocation } from 'react-router-dom';
import type { SearchPost } from '../../types/search';
import type { CategoryTreeResult } from '../../utils/categoryTree';

interface PostListSectionProps {
    filteredPosts: SearchPost[];
    categoryTree: CategoryTreeResult;
    selectedCategory: string | null;
    searchQuery: string;
    normalizedQuery: string;
    searchLoading: boolean;
    searchError: string;
    hasLoaded: boolean;
    loading: boolean;
    error: string | null;
    onSelectCategory: (id: string | null) => void;
    onSearchChange: (query: string) => void;
    onClearSearch: () => void;
    onSearchCompositionChange: (composing: boolean) => void;
    onRetrySearch: () => void;
}

export const PostListSection = ({
    filteredPosts,
    categoryTree,
    selectedCategory,
    searchQuery,
    normalizedQuery,
    searchLoading,
    searchError,
    hasLoaded,
    loading,
    error,
    onSelectCategory,
    onSearchChange,
    onClearSearch,
    onSearchCompositionChange,
    onRetrySearch
}: PostListSectionProps) => {
    const location = useLocation();
    const returnTo = `${location.pathname}${location.search}#writing`;
    return (
        <section id="writing" className="mx-auto max-w-6xl px-4 py-8">
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                    <h2 className="font-display text-xl font-semibold">
                        전체 글
                    </h2>
                </div>
                <span className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">
                    {searchLoading ? '검색 중' : searchError ? '검색 실패' : `${filteredPosts.length}편`}
                </span>
            </div>
            <div className="mt-4 max-w-xl">
                <label htmlFor="post-search" className="text-xs font-semibold tracking-[0.18em] text-[var(--text-muted)]">글 검색</label>
                <div className="mt-2 flex gap-2">
                    <input
                        id="post-search"
                        type="search"
                        value={searchQuery}
                        maxLength={120}
                        onChange={event => onSearchChange(event.target.value)}
                        onCompositionStart={() => onSearchCompositionChange(true)}
                        onCompositionEnd={event => {
                            onSearchChange(event.currentTarget.value);
                            onSearchCompositionChange(false);
                        }}
                        aria-describedby="post-search-status"
                        aria-controls="post-search-results"
                        placeholder="제목, 본문, 태그, 시리즈로 검색"
                        className="angular-control min-h-11 min-w-0 flex-1 border border-[color:var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--text)] outline-none transition focus:border-[color:var(--accent)]"
                    />
                    {searchQuery && (
                        <button type="button" onClick={onClearSearch} aria-label="검색 초기화"
                            className="min-h-11 shrink-0 rounded border border-[color:var(--border)] px-3 text-xs text-[var(--text-muted)] hover:text-[var(--text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)]">
                            지우기
                        </button>
                    )}
                </div>
                <p id="post-search-status" role="status" aria-live="polite" className="mt-2 text-xs text-[var(--text-muted)]">
                    {searchLoading ? '본문을 포함해 검색하고 있습니다.'
                        : searchError ? '검색을 완료하지 못했습니다. 다시 시도해 주세요.'
                            : normalizedQuery ? `검색 결과 ${filteredPosts.length}편 · 최신 글부터 최대 25편 표시`
                                : '제목뿐 아니라 본문에 있는 명령어와 오류 메시지도 찾을 수 있습니다.'}
                </p>
            </div>
            <div className="mt-5 grid gap-4 lg:grid-cols-[230px_minmax(0,1fr)]">
                <CategorySidebar
                    categoryTree={categoryTree}
                    selectedCategory={selectedCategory}
                    onSelectCategory={onSelectCategory}
                />

                <div id="post-search-results" className="min-w-0 space-y-4" aria-busy={searchLoading}>
                    {searchError && (
                        <div role="alert" className="rounded-lg border border-[color:var(--border)] bg-[var(--surface)] p-6 text-center">
                            <p className="break-words text-sm text-[var(--text-muted)]">{searchError}</p>
                            <button type="button" onClick={onRetrySearch}
                                className="mt-4 min-h-11 rounded border border-[color:var(--border)] px-4 text-sm text-[var(--text)]">
                                검색 다시 시도
                            </button>
                        </div>
                    )}
                    {filteredPosts.length > 0 && (
                        <div className="grid gap-3">
                            {filteredPosts.map((post, index) => (
                                <PostCard key={post.id} post={post} variant="compact" index={index}
                                    searchQuery={normalizedQuery} searchExcerpt={post.searchExcerpt} returnTo={returnTo} />
                            ))}
                        </div>
                    )}

                    {filteredPosts.length === 0 && hasLoaded && !loading && !error && !searchLoading && !searchError && (
                        <div className="angular-panel rounded-lg border border-[color:var(--border)] bg-[var(--surface)] p-6 text-center">
                            <h3 className="font-display text-lg font-semibold">
                                조건에 맞는 글이 없어요
                            </h3>
                            <p className="mt-2 text-sm text-[var(--text-muted)]">
                                카테고리를 바꾸거나 검색어를 지우고 다시 확인해 보세요.
                            </p>
                            <div className="mt-6 flex flex-wrap justify-center gap-2">
                                {selectedCategory && (
                                    <button
                                        type="button"
                                        onClick={() => onSelectCategory(null)}
                                        className="angular-control rounded-lg border border-[color:var(--border)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]"
                                    >
                                        카테고리 해제
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
