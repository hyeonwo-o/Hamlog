import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { BookOpen, Calendar, ChevronLeft } from 'lucide-react';
import ErrorBoundary from '../components/ErrorBoundary';
import LoadingSpinner from '../components/LoadingSpinner';
import PostContent from '../components/PostContent';
import PostCard from '../components/PostCard';
import { HomeFooter } from '../components/HomeFooter';
import { SiteHeader } from '../components/SiteHeader';
import { usePostStore } from '../store/postStore';
import { formatDate } from '../utils/formatDate';
import { isPostVisible } from '../utils/postStatus';
import { Comments } from '../components/Comments';
import { CategorySidebar } from '../components/CategorySidebar';
import { fetchCategories } from '../api/categoryApi';
import { fetchProfile } from '../api/profileApi';
import type { Category } from '../types/category';
import type { SiteMeta } from '../types/blog';
import { DEFAULT_CATEGORY, normalizeCategoryKey } from '../utils/category';
import { buildCategoryTree, getCategoryPathLabel } from '../utils/categoryTree';
import { useSeo } from '../hooks/useSeo';
import { useSchema } from '../hooks/useSchema';
import { siteMeta } from '../data/blogData';
import { fetchPostBySlug } from '../api/postApi';
import { ApiError } from '../api/client';
import type { Post } from '../types/blog';
import { TableOfContents } from '../components/TableOfContents';

const normalizePageProfile = (profile: SiteMeta) => ({
  ...siteMeta,
  ...profile,
  social: {
    ...siteMeta.social,
    ...(profile.social ?? {})
  },
  stack: profile.stack ?? [],
  display: {
    ...siteMeta.display,
    ...(profile.display ?? {})
  }
});

const PostPage: React.FC = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const posts = usePostStore(state => state.posts);
  const loading = usePostStore(state => state.loading);
  const error = usePostStore(state => state.error);
  const hasLoaded = usePostStore(state => state.hasLoaded);
  const loadedMode = usePostStore(state => state.loadedMode);
  const fetchPosts = usePostStore(state => state.fetchPosts);
  const recordPostView = usePostStore(state => state.recordPostView);
  const [categories, setCategories] = useState<Category[]>([]);
  const [profile, setProfile] = useState<SiteMeta>(siteMeta);
  const [post, setPost] = useState<Post | null>(null);
  const [detailLoading, setDetailLoading] = useState(true);
  const [detailError, setDetailError] = useState('');
  const recordedViewSlugRef = useRef<string | null>(null);
  const loadRequestIdRef = useRef(0);

  const loadPost = useCallback(async () => {
    const requestId = loadRequestIdRef.current + 1;
    loadRequestIdRef.current = requestId;
    setPost(null);

    if (!slug) {
      setDetailError('');
      setDetailLoading(false);
      return;
    }

    setDetailLoading(true);
    setDetailError('');
    try {
      const nextPost = await fetchPostBySlug(slug);
      if (loadRequestIdRef.current !== requestId) return;
      setPost(nextPost);
    } catch (loadError) {
      if (loadRequestIdRef.current !== requestId) return;
      if (!(loadError instanceof ApiError && loadError.status === 404)) {
        setDetailError(
          loadError instanceof Error && loadError.message
            ? loadError.message
            : '글을 불러오지 못했습니다.'
        );
      }
    } finally {
      if (loadRequestIdRef.current === requestId) {
        setDetailLoading(false);
      }
    }
  }, [slug]);

  useEffect(() => {
    void loadPost();
    return () => {
      loadRequestIdRef.current += 1;
    };
  }, [loadPost]);

  useEffect(() => {
    fetchCategories().then(setCategories).catch(console.error);
  }, []);

  useEffect(() => {
    let isActive = true;

    fetchProfile()
      .then(nextProfile => {
        if (isActive) {
          setProfile(normalizePageProfile(nextProfile));
        }
      })
      .catch(console.error);

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    if (loadedMode === 'none' && !loading) {
      void fetchPosts('summary');
    }
  }, [fetchPosts, loadedMode, loading]);

  const visiblePosts = useMemo(() => posts.filter(post => isPostVisible(post)), [posts]);

  useEffect(() => {
    if (!post?.slug) return;
    if (typeof window === 'undefined') return;
    if (recordedViewSlugRef.current === post.slug) return;

    const storageKey = `hamlog:viewed:${post.slug}`;
    try {
      if (window.sessionStorage.getItem(storageKey)) return;
      window.sessionStorage.setItem(storageKey, '1');
    } catch {
      // If sessionStorage is unavailable, still record the page view once for this mount.
    }

    recordedViewSlugRef.current = post.slug;
    void recordPostView(post.slug).catch(error => {
      console.error('Failed to record post view', error);
    });
  }, [post?.slug, recordPostView]);

  const categoryTree = useMemo(
    () =>
      buildCategoryTree({
        categories,
        posts: visiblePosts,
        defaultCategory: DEFAULT_CATEGORY
      }),
    [categories, visiblePosts]
  );

  const categoryPathLabel = useMemo(() => {
    const categoryName = post?.category ?? DEFAULT_CATEGORY;
    const node = categoryTree.nodesByKey.get(normalizeCategoryKey(categoryName));
    return node ? getCategoryPathLabel(node, categoryTree.nodesById) : categoryName;
  }, [categoryTree, post?.category]);

  const siteTitle = profile.title.trim() || 'Hamlog';
  const configuredFavicon = profile.favicon?.trim();
  const pageFavicon = !configuredFavicon || configuredFavicon === '/avatar.jpg'
    ? '/favicon.svg'
    : configuredFavicon;
  const fallbackImage = profile.profileImage?.trim() || '/avatar.jpg';
  const isUnavailable = !detailLoading && !post;
  const unavailableTitle = detailError || error
    ? `글을 불러오지 못했습니다 | ${siteTitle}`
    : `페이지를 찾을 수 없습니다 | ${siteTitle}`;

  useSeo({
    title: post
      ? post.seo?.title || post.title
      : isUnavailable
        ? unavailableTitle
        : `글을 불러오는 중 | ${siteTitle}`,
    description: post
      ? post.seo?.description || post.summary
      : isUnavailable
        ? '요청한 글을 표시할 수 없습니다.'
        : '글 정보를 불러오는 중입니다.',
    image: post?.seo?.ogImage || post?.cover || fallbackImage,
    keywords: post ? (post.seo?.keywords?.length ? post.seo.keywords : post.tags) : [],
    url: post
      ? post.seo?.canonicalUrl
        || `${typeof window !== 'undefined' ? window.location.origin : siteMeta.siteUrl}/posts/${post.slug}`
      : typeof window !== 'undefined'
        ? window.location.href
        : siteMeta.siteUrl,
    type: post ? 'article' : 'website',
    favicon: pageFavicon,
    twitterHandle: profile.social.twitter,
    robots: post
      ? 'index, follow'
      : isUnavailable
        ? 'noindex, nofollow'
        : undefined,
    preserveExisting: detailLoading && !post
  });

  useSchema({
    post: post ?? undefined,
    profile,
    preserveExisting: detailLoading && !post
  });

  if (detailLoading || (!hasLoaded && posts.length === 0)) {
    return (
      <ErrorBoundary>
        <div className="public-site min-h-screen text-[var(--text)]">
          <SiteHeader profile={profile} eyebrow="Loading" contextTitle="글을 불러오는 중" />
          <div className="mx-auto max-w-3xl px-4 py-20">
            <LoadingSpinner message="글 불러오는 중..." />
          </div>
          <HomeFooter profile={profile} />
        </div>
      </ErrorBoundary>
    );
  }

  if ((detailError || error) && !post) {
    return (
      <ErrorBoundary>
        <div className="public-site min-h-screen text-[var(--text)]">
          <SiteHeader profile={profile} eyebrow="Error" contextTitle="글을 불러오지 못했습니다" />
          <div className="mx-auto max-w-3xl px-4 py-20 text-center">
            <p className="text-sm text-[var(--text-muted)]">{detailError || error}</p>
            <button
              type="button"
              onClick={() => void loadPost()}
              className="mt-4 rounded-lg border border-[color:var(--border)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text)]"
            >
              다시 시도
            </button>
          </div>
          <HomeFooter profile={profile} />
        </div>
      </ErrorBoundary>
    );
  }

  if (!post) {
    return (
      <ErrorBoundary>
        <div className="public-site min-h-screen text-[var(--text)]">
          <SiteHeader profile={profile} eyebrow="Not Found" contextTitle="해당 글을 찾을 수 없습니다" />
          <div className="mx-auto max-w-3xl px-4 py-20">
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">
              찾을 수 없음
            </p>
            <h1 className="mt-4 font-display text-3xl font-semibold">
              해당 글이 존재하지 않습니다.
            </h1>
            <p className="mt-3 text-sm text-[var(--text-muted)]">
              글 목록으로 돌아가세요.
            </p>
            <Link
              to="/"
              className="mt-6 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent-strong)]"
            >
              목록으로 돌아가기
              <span aria-hidden="true">&rarr;</span>
            </Link>
          </div>
          <HomeFooter profile={profile} />
        </div>
      </ErrorBoundary>
    );
  }

  const morePosts = visiblePosts
    .filter(item => item.slug !== post.slug)
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
    .slice(0, 2);

  return (
    <ErrorBoundary>
      <div className="public-site min-h-screen text-[var(--text)]">
        <SiteHeader
          profile={profile}
          eyebrow={categoryPathLabel}
          contextTitle={post.title}
        />

        <div className="mx-auto max-w-6xl px-4 py-10 xl:py-12 2xl:max-w-[1480px]">
          <div className="grid gap-6 xl:gap-8 2xl:grid-cols-[200px_minmax(0,960px)_220px]">
            <aside className="hidden 2xl:block relative">
              <div className="sticky top-8 space-y-8">
                <CategorySidebar
                  categoryTree={categoryTree}
                  selectedCategory={post.category ?? null}
                  onSelectCategory={(category) => {
                    if (category) {
                      navigate(`/?category=${category}`);
                    } else {
                      navigate('/');
                    }
                  }}
                />
              </div>
            </aside>

            <main className="mx-auto w-full min-w-0 max-w-[960px] space-y-8 2xl:mx-0 2xl:max-w-none">
              <Link
                to="/"
                className="group inline-flex items-center gap-2 text-sm font-medium text-[var(--text-muted)] transition-colors hover:text-[var(--accent)]"
              >
                <ChevronLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
                메인화면으로 돌아가기
              </Link>

              <article className="space-y-8">
                <header className="angular-panel rounded-2xl border border-[color:var(--border)] bg-[var(--surface)] p-5 sm:p-6 lg:p-7">
                  <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--text-muted)] sm:gap-4">
                    <button
                      type="button"
                      onClick={() => navigate(`/?category=${post.category ?? DEFAULT_CATEGORY}`)}
                      className="inline-flex items-center rounded-full border border-[color:var(--border)] bg-[var(--surface-muted)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text)] transition hover:border-[color:var(--accent)] hover:text-[var(--accent-strong)]"
                    >
                      {post.category ?? '미분류'}
                    </button>
                    <span className="inline-flex items-center gap-1.5">
                      <Calendar className="h-4 w-4" />
                      {formatDate(post.publishedAt)}
                    </span>
                    {post.series && (
                      <>
                        <span className="opacity-30">|</span>
                        <span className="inline-flex items-center gap-1.5 font-medium text-[var(--text)]">
                          <BookOpen className="h-4 w-4" />
                          {post.series}
                        </span>
                      </>
                    )}
                  </div>

                  <h1 className="mt-4 break-keep font-display text-[1.02rem] font-semibold leading-[1.45] tracking-[-0.025em] text-[var(--text)] sm:text-[1.35rem] lg:text-[1.75rem]">
                    {post.title}
                  </h1>

                  <p className="mt-3 max-w-[68ch] text-sm leading-7 text-[var(--text-muted)]">
                    {post.summary}
                  </p>

                  {post.tags.length > 0 && (
                    <div className="mt-5 flex flex-wrap gap-x-4 gap-y-2 text-xs text-[var(--text-muted)]">
                      {post.tags.map(tag => (
                        <span key={tag} className="inline-flex items-center">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                </header>

                <div className="angular-panel rounded-2xl border border-[color:var(--border)] bg-[var(--surface)] p-5 sm:p-7 lg:p-8 xl:px-10">
                  <div className="post-content prose prose-lg max-w-none w-full">
                    <PostContent contentHtml={post.contentHtml} />
                  </div>
                </div>

                <div className="angular-panel rounded-2xl border border-[color:var(--border)] bg-[var(--surface)] p-5 sm:p-7 lg:p-8">
                  <Comments postId={post.id} />
                </div>
              </article>

              {morePosts.length > 0 && (
                <section className="mt-20 border-t border-[color:var(--border)] pt-12">
                  <div className="mb-8 flex items-center justify-between">
                    <h2 className="font-display text-2xl font-bold">다른 글 읽기</h2>
                    <Link
                      to="/"
                      className="text-sm font-semibold text-[var(--accent-strong)] hover:underline"
                    >
                      전체 보기 &rarr;
                    </Link>
                  </div>
                  <div className="grid gap-6 sm:grid-cols-2">
                    {morePosts.map((item, index) => (
                      <PostCard key={item.id} post={item} variant="compact" index={index} />
                    ))}
                  </div>
                </section>
              )}
            </main>

            <aside className="hidden 2xl:block">
              <div className="sticky top-8 max-h-[calc(100vh-4rem)] overflow-y-auto border border-[color:var(--border)] bg-[var(--surface)] p-4">
                <TableOfContents contentSelector=".post-content" />
              </div>
            </aside>
          </div>
        </div>

        <HomeFooter profile={profile} />
      </div>
    </ErrorBoundary>
  );
};

export default PostPage;
