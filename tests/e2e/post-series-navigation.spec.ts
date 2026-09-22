import { test, expect, type Page } from '@playwright/test';

const series = 'C++ & 운영 시리즈';
const postFor = (id: string, date: string, patch = {}) => ({
  id, slug: id, title: `연재 ${id}`, summary: '시리즈 탐색 검증', category: '테스트',
  contentHtml: '<h2>공개 본문</h2><p>발행 순서로 읽습니다.</p>',
  status: 'published', publishedAt: date, tags: ['C++', 'C# & GitOps'], series, sections: [], ...patch
});
const members = [
  postFor('series-last', '2026-01-03'),
  postFor('series-middle', '2026-01-02'),
  postFor('series-first', '2026-01-01'),
  postFor('series-private', '2026-01-04', { status: 'draft' }),
  postFor('series-trashed', '2026-01-05', { deletedAt: '2026-01-06T00:00:00.000Z' }),
  postFor('series-purging', '2026-01-06', { purgeRequestedAt: '2026-01-07T00:00:00.000Z' }),
  postFor('different-series', '2026-01-04', { series: '다른 연재' })
];

async function mockReader(page: Page) {
  await page.route('**/api/posts**', async route => {
    const url = new URL(route.request().url());
    if (url.pathname === '/api/posts') return route.fulfill({ json: { posts: members, total: members.length } });
    if (url.pathname.endsWith('/view')) return route.fulfill({ json: { slug: url.pathname.split('/')[3], views: 1 } });
    const post = members.find(item => item.slug === decodeURIComponent(url.pathname.split('/').at(-1) ?? ''));
    return route.fulfill(post ? { json: post } : { status: 404, json: { message: '없는 글' } });
  });
  await page.route('**/api/categories', route => route.fulfill({ json: { categories: [] } }));
  await page.route('**/api/comments**', route => route.fulfill({ json: { comments: [] } }));
  await page.route('**/api/search?**', route => {
    const params = new URL(route.request().url()).searchParams;
    const posts = members.slice(0, 3).filter(post => !params.get('tag') || post.tags.includes(params.get('tag')!));
    return route.fulfill({ json: { posts, total: posts.length, page: 1, pageSize: 25, hasMore: false } });
  });
}

test('series contents and previous/next links show only public members in chronological order', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await mockReader(page);
  await page.goto('/posts/series-middle');
  const nav = page.getByRole('navigation', { name: '시리즈 탐색' });
  const contents = nav.getByRole('list', { name: '시리즈 목차' });
  await expect(contents.getByRole('link')).toHaveText(['연재 series-first', '연재 series-middle · 현재 글', '연재 series-last']);
  await expect(contents.getByRole('link', { name: '연재 series-middle · 현재 글' })).toHaveAttribute('aria-current', 'page');
  await expect(nav).toContainText('발행일 순 · 2/3편');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await nav.getByRole('link', { name: '이전 글 연재 series-first', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: '연재 series-first' })).toBeVisible();
  await expect(nav.getByRole('link', { name: /^이전 글/ })).toHaveCount(0);
  await expect(nav.getByRole('link', { name: '다음 글 연재 series-middle', exact: true })).toHaveAttribute('href', '/posts/series-middle');
  await nav.getByRole('link', { name: '시리즈 전체 글 보기' }).click();
  await expect(page).toHaveURL(url => url.pathname === '/' && url.searchParams.get('series') === series);
  await expect(page.getByRole('heading', { name: '시리즈 글', exact: true })).toBeVisible();
});

test('article tag and series links encode special characters and lead to exact reader filters', async ({ page }) => {
  await mockReader(page);
  await page.goto('/posts/series-middle');
  await page.locator('article header').getByRole('link', { name: '#C# & GitOps', exact: true }).click();
  await expect(page).toHaveURL(url => url.searchParams.get('tag') === 'C# & GitOps');
  await expect(page.getByRole('button', { name: '태그 C# & GitOps 해제', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: '태그 글', exact: true })).toBeVisible();
  await page.goBack();
  await page.locator('article header').getByRole('link', { name: `시리즈 ${series} 전체 글`, exact: true }).click();
  await expect(page).toHaveURL(url => url.searchParams.get('series') === series && !url.searchParams.has('tag'));
  await expect(page.getByRole('button', { name: `시리즈 ${series} 해제`, exact: true })).toBeVisible();
});
