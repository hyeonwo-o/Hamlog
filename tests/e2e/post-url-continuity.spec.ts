import { expect, test, type Page } from '@playwright/test';

const fixturePost = (slug: string, category = 'C++') => ({
  id: `fixture-${slug}`, slug, title: `공개 글 ${slug}`, summary: '이전 주소와 분류 이동 검증',
  category, contentHtml: '<h2 id="kept-heading">주소를 유지한 본문</h2><p>공개 본문입니다.</p>',
  publishedAt: '2026-09-22', tags: [], status: 'published', sections: [], views: 0
});

async function mockPublicPosts(page: Page, posts: ReturnType<typeof fixturePost>[], aliases: Record<string, string> = {}) {
  await page.route('**/api/posts**', async route => {
    const request = route.request();
    const path = decodeURIComponent(new URL(request.url()).pathname);
    if (request.method() === 'GET' && path === '/api/posts') {
      return route.fulfill({ json: { posts, total: posts.length } });
    }
    if (request.method() === 'POST' && path.endsWith('/view')) {
      return route.fulfill({ json: { slug: path.split('/')[3], views: 1 } });
    }
    const requested = path.slice('/api/posts/'.length);
    const post = posts.find(post => post.slug === (aliases[requested] ?? requested));
    return route.fulfill(post ? { json: post } : { status: 404, json: { message: '포스트를 찾을 수 없습니다.' } });
  });
  await page.route('**/api/categories', route => route.fulfill({ json: { categories: [], total: 0 } }));
  await page.route('**/api/comments**', route => route.fulfill({ json: { comments: [] } }));
}

async function navigateWithState(page: Page, url: string, returnTo: string) {
  return page.evaluate(({ url, returnTo }) => {
    history.pushState({ usr: { returnTo }, key: 'alias-test', idx: (history.state?.idx ?? 0) + 1 }, '', url);
    window.dispatchEvent(new PopStateEvent('popstate'));
    return history.length;
  }, { url, returnTo });
}

test('an old Korean SPA URL replaces its history entry while preserving query, hash and safe list return', async ({ page }) => {
  const canonical = fixturePost('새로운-한글-주소');
  const other = fixturePost('different-document');
  await mockPublicPosts(page, [canonical, other], { '이전-주소': canonical.slug });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '전체 글', exact: true })).toBeVisible();
  const returnTo = '/?category=C%2B%2B&keep=reader-context';
  const expectedLength = await navigateWithState(page, `/posts/${encodeURIComponent('이전-주소')}?source=old%26link#kept-heading`, returnTo);
  await expect(page).toHaveURL(new RegExp(`/posts/${encodeURIComponent(canonical.slug)}\\?source=old%26link#kept-heading$`));
  await expect(page.getByRole('heading', { level: 1, name: canonical.title })).toBeVisible();
  await expect(page.getByRole('link', { name: '메인화면으로 돌아가기', exact: true })).toHaveAttribute('href', returnTo);
  expect(await page.evaluate(() => history.length)).toBe(expectedLength);
  // A later document navigation must not be mistaken for the old alias response.
  await navigateWithState(page, `/posts/${other.slug}`, '/');
  await expect(page).toHaveURL(new RegExp(`/posts/${other.slug}$`));
  await expect(page.getByRole('heading', { level: 1, name: other.title })).toBeVisible();
});

test('alias canonicalization discards an unsafe return target and never follows it', async ({ page }) => {
  const canonical = fixturePost('safe-current');
  await mockPublicPosts(page, [canonical], { 'old-safe': canonical.slug });
  await page.goto('/');
  const origin = new URL(page.url()).origin;
  await navigateWithState(page, '/posts/old-safe?returnTo=https%3A%2F%2Fevil.invalid#kept-heading', '//evil.invalid/escape');
  await expect(page.getByRole('heading', { level: 1, name: canonical.title })).toBeVisible();
  // Rendering the resolved post precedes the redirect effect. Wait for the
  // canonical navigation instead of sampling the URL during that transition.
  await expect(page).toHaveURL(url => url.origin === origin && url.pathname === '/posts/safe-current');
  expect(new URL(page.url()).origin).toBe(origin);
  expect(new URL(page.url()).pathname).toBe('/posts/safe-current');
  await expect(page.getByRole('link', { name: '메인화면으로 돌아가기', exact: true })).toHaveAttribute('href', '/');
});

test('an unavailable old URL remains not found without revealing a private canonical slug', async ({ page }) => {
  await mockPublicPosts(page, []);
  await page.goto('/posts/old-private-url');
  await expect(page.getByRole('heading', { name: '해당 글이 존재하지 않습니다.' })).toBeVisible();
  await expect(page).toHaveURL(/\/posts\/old-private-url$/);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow');
});

for (const category of ['C++', 'C#', '운영 & 개발']) {
  test(`article category navigation preserves ${category} as one query value`, async ({ page }) => {
    const post = fixturePost('category-encoding', category);
    await mockPublicPosts(page, [post]);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/posts/${post.slug}`);
    await expect(page.getByRole('heading', { level: 1, name: post.title })).toBeVisible();
    await page.locator('article header').getByRole('button', { name: category, exact: true }).click();
    await expect(page).toHaveURL(url => url.pathname === '/' && url.searchParams.get('category') === category);
    expect(new URL(page.url()).hash).toBe('');
    expect(Array.from(new URL(page.url()).searchParams.keys())).toEqual(['category']);
    await expect(page.locator(`a[href="/posts/${post.slug}"]`).first()).toBeVisible();
  });
}

test('desktop category sidebar also encodes reserved query characters', async ({ page }) => {
  const current = fixturePost('category-source', '기타');
  const target = fixturePost('category-target', 'C++ & C#');
  await mockPublicPosts(page, [current, target]);
  await page.setViewportSize({ width: 1700, height: 1000 });
  await page.goto(`/posts/${current.slug}`);
  await expect(page.getByRole('heading', { level: 1, name: current.title })).toBeVisible();
  await page.getByRole('button', { name: /C\+\+ & C#/ }).click();
  await expect(page).toHaveURL(url => url.pathname === '/' && url.searchParams.get('category') === target.category);
  expect(new URL(page.url()).hash).toBe('');
});
