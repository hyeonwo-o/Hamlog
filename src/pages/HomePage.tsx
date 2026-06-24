import ErrorBoundary from '../components/ErrorBoundary';
import LoadingSpinner from '../components/LoadingSpinner';
import { HomeHeader } from '../components/HomeHeader';
import { HomeFooter } from '../components/HomeFooter';
import { FeaturedSection } from '../components/home/FeaturedSection';
import { PostListSection } from '../components/home/PostListSection';

import { useSeo } from '../hooks/useSeo';
import { useHomeData } from '../hooks/useHomeData';
import { useHomePostFilter } from '../hooks/useHomePostFilter';

const HomePage = () => {
    // 1. Data Fetching Hook
    const {
        profile,
        managedCategories,
        posts,
        loading,
        error,
        fetchPosts,
        hasLoaded
    } = useHomeData();

    // 2. Filtering & Logic Hook
    const {
        selectedCategory,
        selectCategory,
        searchQuery,
        setSearchQuery,
        sortedPosts,
        popularPosts,
        filteredPosts,
        categoryTree
    } = useHomePostFilter({ posts, managedCategories });

    const homeTitle = profile.title.includes('|')
        ? profile.title
        : `${profile.title} | 클라우드 엔지니어링과 개발 기록`;
    const homeDescription = profile.description?.trim()
        || '클라우드 엔지니어링, 인프라, DevOps, 개발 경험을 기록하는 기술 블로그입니다.';
    const homeKeywords = Array.from(new Set([
        '클라우드 엔지니어링',
        'DevOps',
        '인프라',
        'AWS',
        'GCP',
        'Kubernetes',
        ...profile.stack
    ]));

    // 3. SEO Hook
    useSeo({
        title: homeTitle,
        description: homeDescription,
        keywords: homeKeywords,
        url: profile.siteUrl,
        type: 'website',
        favicon: profile.favicon
    });

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center bg-[var(--bg)]">
                <LoadingSpinner message="블로그 정보 불러오는 중..." />
            </div>
        );
    }

    return (
        <ErrorBoundary>
            <div className="min-h-screen text-[var(--text)]">
                <HomeHeader
                    profile={profile}
                    postCount={sortedPosts.length}
                    categoryCount={categoryTree.allNames.length}
                />

                <main>
                    {!hasLoaded && posts.length === 0 && (
                        <section className="mx-auto max-w-6xl px-4 py-12">
                            <LoadingSpinner message="글 불러오는 중..." />
                        </section>
                    )}

                    {error && posts.length === 0 && (
                        <section className="mx-auto max-w-6xl px-4 py-12">
                            <div className="rounded-xl border border-[color:var(--border)] bg-[var(--surface)] p-6 text-center">
                                <p className="text-sm text-[var(--text-muted)]">{error}</p>
                                <button
                                    type="button"
                                    onClick={() => fetchPosts()}
                                    className="mt-4 rounded-lg border border-[color:var(--border)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text)]"
                                >
                                    다시 시도
                                </button>
                            </div>
                        </section>
                    )}

                    <FeaturedSection posts={popularPosts} />

                    <PostListSection
                        filteredPosts={filteredPosts}
                        categoryTree={categoryTree}
                        selectedCategory={selectedCategory}
                        searchQuery={searchQuery}
                        hasLoaded={hasLoaded}
                        loading={loading}
                        error={error}
                        onSelectCategory={selectCategory}
                        onClearSearch={() => setSearchQuery('')}
                    />
                </main>

                <HomeFooter profile={profile} />
            </div>
        </ErrorBoundary>
    );
};

export default HomePage;
