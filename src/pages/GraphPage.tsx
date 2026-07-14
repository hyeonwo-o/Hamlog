import { useMemo } from 'react';
import ErrorBoundary from '../components/ErrorBoundary';
import LoadingSpinner from '../components/LoadingSpinner';
import { SiteHeader } from '../components/SiteHeader';
import { PostGraphSection } from '../components/home/PostGraphSection';
import { useHomeData } from '../hooks/useHomeData';
import { useSeo } from '../hooks/useSeo';
import { isPostVisible } from '../utils/postStatus';

const GRAPH_DESCRIPTION = '글과 카테고리, 시리즈, 본문 링크의 관계를 한 화면에서 탐색합니다.';

const GraphPage = () => {
    const {
        profile,
        posts,
        loading,
        error,
        fetchPosts,
        hasLoaded
    } = useHomeData();
    const visiblePosts = useMemo(
        () => posts
            .filter(post => isPostVisible(post))
            .sort((left, right) => (
                new Date(right.publishedAt).getTime() - new Date(left.publishedAt).getTime()
            )),
        [posts]
    );
    const graphUrl = `${profile.siteUrl.replace(/\/+$/, '')}/graph`;

    useSeo({
        title: `그래프뷰 | ${profile.title}`,
        description: GRAPH_DESCRIPTION,
        url: graphUrl,
        type: 'website',
        favicon: profile.favicon
    });

    return (
        <ErrorBoundary>
            <div className="flex min-h-screen flex-col text-[var(--text)]">
                <SiteHeader profile={profile} showContext={false} wide />

                <main className="flex-1">
                    <section className="mx-auto max-w-7xl px-4 pb-1 pt-5">
                        <h1 className="font-display text-xl font-bold tracking-tight sm:text-2xl">
                            그래프뷰
                        </h1>
                        <p className="mt-1 break-keep text-xs leading-relaxed text-[var(--text-muted)] sm:text-sm">
                            글과 분류의 연결을 탐색합니다. 노드를 선택하면 관련 글을 확인할 수 있습니다.
                        </p>
                    </section>

                    {loading && visiblePosts.length === 0 && (
                        <section className="mx-auto max-w-7xl px-4 py-12">
                            <LoadingSpinner message="그래프 불러오는 중..." />
                        </section>
                    )}

                    {error && visiblePosts.length === 0 && (
                        <section className="mx-auto max-w-7xl px-4 py-8">
                            <div className="border border-[color:var(--border)] bg-[var(--surface)] p-6 text-center">
                                <p role="alert" className="text-sm text-[var(--text-muted)]">{error}</p>
                                <button
                                    type="button"
                                    onClick={() => void fetchPosts()}
                                    className="angular-control mt-4 border border-[color:var(--border)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent-strong)]"
                                >
                                    다시 시도
                                </button>
                            </div>
                        </section>
                    )}

                    {hasLoaded && !loading && !error && visiblePosts.length === 0 && (
                        <section className="mx-auto max-w-7xl px-4 py-8">
                            <div className="border border-dashed border-[color:var(--border)] bg-[var(--surface)] p-8 text-center">
                                <h2 className="font-display text-lg font-semibold">표시할 관계가 없습니다</h2>
                                <p className="mt-2 text-sm text-[var(--text-muted)]">
                                    공개된 글이 추가되면 카테고리와 시리즈 관계가 여기에 표시됩니다.
                                </p>
                            </div>
                        </section>
                    )}

                    {visiblePosts.length > 0 && <PostGraphSection posts={visiblePosts} />}
                </main>
            </div>
        </ErrorBoundary>
    );
};

export default GraphPage;
