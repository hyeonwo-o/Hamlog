import { expect, test, type Page, type Route } from '@playwright/test';
import { siteMeta } from '../../src/data/blogData';
import type { Post } from '../../src/types/blog';

const fixturePost = (id: string, patch: Partial<Post> = {}): Post => ({
    id, slug: id, title: `검색 결과 ${id}`, summary: '합성 테스트 요약',
    category: 'Backend', tags: ['정확한 태그'], series: '개발 기록',
    status: 'published', publishedAt: '2026-09-01', views: 0,
    contentHtml: '<p>needle 테스트 본문입니다.</p>', ...patch
});
const results = (page: Page) => page.locator('#post-search-results');
const cards = (page: Page) => results(page).locator('a[href^="/posts/"]');
const input = (page: Page) => page.getByRole('searchbox', { name: '글 검색' });
const deferred = () => {
    let resolve = () => {};
    const promise = new Promise<void>(done => { resolve = done; });
    return { promise, resolve };
};
const envelope = (posts: Post[], params: URLSearchParams) => {
    const page = Number(params.get('page') ?? 1);
    const pageSize = Number(params.get('pageSize') ?? 25);
    return { posts: posts.slice((page - 1) * pageSize, page * pageSize), total: posts.length, page, pageSize, hasMore: page * pageSize < posts.length };
};

async function mockReader(page: Page, posts: Post[], onSearch: (route: Route, params: URLSearchParams) => Promise<void>) {
    await page.route('https://fonts.googleapis.com/**', route => route.fulfill({ contentType: 'text/css', body: '' }));
    await page.route(url => url.pathname.startsWith('/api/'), async route => {
        const url = new URL(route.request().url());
        if (url.pathname === '/api/search') return onSearch(route, url.searchParams);
        if (url.pathname === '/api/posts') return route.fulfill({ json: { posts, total: posts.length } });
        if (url.pathname.startsWith('/api/posts/')) {
            const slug = decodeURIComponent(url.pathname.split('/')[3]);
            if (url.pathname.endsWith('/view')) return route.fulfill({ json: { slug, views: 1 } });
            const post = posts.find(item => item.slug === slug);
            return route.fulfill(post ? { json: post } : { status: 404, json: { message: 'Not found' } });
        }
        if (url.pathname === '/api/profile') return route.fulfill({ json: { profile: { ...siteMeta, title: 'Search fixture', siteUrl: 'https://example.test' } } });
        if (url.pathname === '/api/categories') return route.fulfill({ json: { categories: [{ id: 'backend', name: 'Backend', parentId: null, order: 0 }] } });
        if (url.pathname === '/api/comments') return route.fulfill({ json: [] });
        if (url.pathname === '/api/auth/config') return route.fulfill({ json: { mode: 'password' } });
        return route.fulfill({ json: {} });
    });
}

test('paginated search preserves relevance, loads more once, and restores accumulated pages after reading and reload', async ({ page }) => {
    const posts = [fixturePost('exact-title', { title: 'needle', publishedAt: '2020-01-01' }),
        ...Array.from({ length: 30 }, (_, index) => fixturePost(`body-${index}`))];
    const gate = deferred();
    let holdSecondPage = true;
    let secondPageRequests = 0;
    await mockReader(page, posts, async (route, params) => {
        expect(params.get('category')).toBe('Backend');
        expect(params.get('tag')).toBe('정확한 태그');
        expect(params.get('series')).toBe('개발 기록');
        if (params.get('page') === '2') {
            secondPageRequests += 1;
            if (holdSecondPage) await gate.promise;
        }
        await route.fulfill({ json: envelope(posts, params) });
    });
    const filters = new URLSearchParams({ q: 'needle', category: 'Backend', tag: '정확한 태그', series: '개발 기록' });
    await page.goto(`/?${filters}`);
    await expect(cards(page)).toHaveCount(25);
    await expect(cards(page).first()).toContainText('needle');
    await expect(page.locator('#post-search-status')).toHaveText('총 31편 중 25편 표시 · 관련도 순');
    const more = page.getByRole('button', { name: '더 보기', exact: true });
    await more.evaluate(button => { (button as HTMLButtonElement).click(); (button as HTMLButtonElement).click(); });
    await expect.poll(() => secondPageRequests).toBe(1);
    await expect(page.getByRole('button', { name: '불러오는 중…', exact: true })).toBeDisabled();
    await expect(cards(page)).toHaveCount(25);
    holdSecondPage = false;
    gate.resolve();
    await expect(cards(page)).toHaveCount(31);
    await expect(page.locator('#post-search-status')).toHaveText('총 31편 중 31편 표시 · 관련도 순');
    await expect(more).toHaveCount(0);
    expect(new URL(page.url()).searchParams.get('page')).toBe('2');
    await cards(page).last().click();
    await expect(page.getByRole('heading', { level: 1, name: '검색 결과 body-29' })).toBeVisible();
    await page.getByRole('link', { name: '메인화면으로 돌아가기' }).click();
    await expect(cards(page)).toHaveCount(31);
    for (const [key, value] of filters) expect(new URL(page.url()).searchParams.get(key)).toBe(value);
    expect(new URL(page.url()).searchParams.get('page')).toBe('2');
    await page.reload();
    await expect(cards(page)).toHaveCount(31);
    await expect(cards(page).first()).toContainText('needle');
});

test('failed load more retains results and retries only the missing page', async ({ page }) => {
    const posts = Array.from({ length: 27 }, (_, index) => fixturePost(`retry-${index}`));
    const requestedPages: number[] = [];
    await mockReader(page, posts, async (route, params) => {
        const requestedPage = Number(params.get('page'));
        requestedPages.push(requestedPage);
        if (requestedPage === 2 && requestedPages.filter(value => value === 2).length === 1) {
            return route.fulfill({ status: 503, json: { message: '추가 검색 일시 오류' } });
        }
        await route.fulfill({ json: envelope(posts, params) });
    });
    await page.goto('/?q=needle');
    await expect(cards(page)).toHaveCount(25);
    await page.getByRole('button', { name: '더 보기', exact: true }).click();
    await expect(results(page).getByRole('alert')).toContainText('추가 검색 일시 오류');
    await expect(cards(page)).toHaveCount(25);
    expect(new URL(page.url()).searchParams.has('page')).toBe(false);
    await page.getByRole('button', { name: '추가 결과 다시 시도' }).click();
    await expect(cards(page)).toHaveCount(27);
    expect(requestedPages).toEqual([1, 2, 2]);
    await expect(results(page).getByRole('alert')).toHaveCount(0);
});

test('filter changes reset pagination and ignore an obsolete load-more response', async ({ page }) => {
    const older = Array.from({ length: 26 }, (_, index) => fixturePost(`obsolete-${index}`));
    const latest = [fixturePost('fresh', { title: '새 검색 결과' })];
    const gate = deferred();
    const started = deferred();
    const requested: string[] = [];
    await mockReader(page, [...older, ...latest], async (route, params) => {
        requested.push(`${params.get('q')}:${params.get('page')}`);
        if (params.get('q') === 'older' && params.get('page') === '2') {
            started.resolve();
            await gate.promise;
        }
        await route.fulfill({ json: envelope(params.get('q') === 'older' ? older : latest, params) }).catch(() => {});
    });
    try {
        await page.goto('/?q=older');
        await expect(cards(page)).toHaveCount(25);
        await page.getByRole('button', { name: '더 보기', exact: true }).click();
        await started.promise;
        await input(page).fill('latest');
        await expect(cards(page)).toHaveCount(1);
        await expect(cards(page)).toContainText('새 검색 결과');
        gate.resolve();
        await expect(results(page).getByRole('heading', { name: '검색 결과 obsolete-25', exact: true })).toHaveCount(0);
        expect(requested).toContain('latest:1');
        expect(new URL(page.url()).searchParams.has('page')).toBe(false);
    } finally {
        gate.resolve();
    }
});

test('exact tag and series URLs browse without a query, show clear controls, and reset restored pages on filter changes', async ({ page }) => {
    const posts = Array.from({ length: 28 }, (_, index) => fixturePost(`discovery-${index}`));
    const calls: URLSearchParams[] = [];
    await mockReader(page, posts, async (route, params) => {
        calls.push(params);
        const matches = params.get('tag') === 'missing' ? [] : posts;
        await route.fulfill({ json: envelope(matches, params) });
    });
    await page.setViewportSize({ width: 320, height: 720 });
    await page.goto(`/?${new URLSearchParams({ tag: '정확한 태그', series: '개발 기록', page: '2' })}`);
    await expect(cards(page)).toHaveCount(28);
    await expect(page.getByRole('heading', { level: 2, name: '시리즈 글', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: '태그 정확한 태그 해제', exact: true })).toBeVisible();
    await expect(page.locator('#post-search-status')).toHaveText('총 28편 중 28편 표시 · 최신 발행일 순');
    expect(calls.every(params => params.get('q') === '')).toBe(true);
    await page.getByRole('button', { name: '시리즈 개발 기록 해제', exact: true }).click();
    await expect(cards(page)).toHaveCount(25);
    expect(new URL(page.url()).searchParams.has('page')).toBe(false);
    expect(new URL(page.url()).searchParams.get('tag')).toBe('정확한 태그');
    await expect(page.getByRole('heading', { level: 2, name: '태그 글', exact: true })).toBeVisible();
    const sizes = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
    expect(sizes[0]).toBeLessThanOrEqual(sizes[1]);
    await page.goto('/?tag=missing');
    await expect(cards(page)).toHaveCount(0);
    await expect(page.getByRole('heading', { name: '조건에 맞는 글이 없어요' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '전체 글', exact: true })).toHaveCount(0);
});

test('legacy array replies remain usable and never offer repeated pagination', async ({ page }) => {
    const post = fixturePost('legacy-array', { title: '이전 서버 검색 결과' });
    const queries: string[] = [];
    await mockReader(page, [post], async (route, params) => {
        queries.push(params.get('q') ?? '');
        await route.fulfill({ json: [post] });
    });
    await page.goto('/');
    await input(page).dispatchEvent('compositionstart');
    await input(page).fill('ㅎ');
    await input(page).fill('한글');
    await page.waitForTimeout(350);
    expect(queries).toEqual([]);
    await input(page).dispatchEvent('compositionend', { data: '한글' });
    await expect(cards(page)).toHaveCount(1);
    await expect(cards(page)).toContainText('이전 서버 검색 결과');
    await expect(page.getByRole('button', { name: '더 보기', exact: true })).toHaveCount(0);
    await expect(page.locator('#post-search-status')).toHaveText('총 1편 중 1편 표시 · 관련도 순');
    expect(queries).toEqual(['한글']);
});
