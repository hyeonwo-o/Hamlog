import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

const backendOrigin = `http://127.0.0.1:${process.env.E2E_API_PORT ?? process.env.PORT ?? '4100'}`;
const selectors = ['meta[name="description"]', 'meta[property="og:description"]', 'meta[name="twitter:description"]'];
const body = '홈 서버에 가상 머신을 구성하고 네트워크 연결과 자동 백업을 검증한 과정을 기록합니다. '.repeat(5);

const articleDescriptions = (page: Page) => page.evaluate(() => (
  Array.from(document.querySelectorAll('script[type="application/ld+json"]'))
    .map(script => JSON.parse(script.textContent ?? '{}'))
    .filter(schema => schema['@type'] === 'BlogPosting')
    .map(schema => schema.description)
));

async function expectDescription(page: Page, description: string) {
  for (const selector of selectors) {
    await expect(page.locator(selector)).toHaveCount(1);
    await expect(page.locator(selector)).toHaveAttribute('content', description);
  }
  await expect.poll(() => articleDescriptions(page)).toEqual([description]);
}

async function createFixture(request: APIRequestContext, explicit = false) {
  const login = await request.post(`${backendOrigin}/api/auth/login`, {
    data: { password: process.env.ADMIN_PASSWORD ?? 'e2e-password' }
  });
  expect(login.ok()).toBe(true);
  const cookie = login.headers()['set-cookie']?.split(';', 1)[0] ?? '';
  expect(cookie).not.toBe('');
  const slug = `seo-description-${explicit ? 'explicit' : 'generated'}-${Date.now()}`;
  const response = await request.post(`${backendOrigin}/api/posts`, {
    headers: { Cookie: cookie, Origin: backendOrigin },
    data: {
      slug, title: slug, summary: '홈 랩 구축기', category: '미분류',
      contentJson: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: body }] }] },
      publishedAt: '2026-01-01', tags: ['SEO'], status: 'published', sections: [],
      ...(explicit ? { seo: { description: '작성자가 직접 지정한 짧은 검색 설명입니다.' } } : {})
    }
  });
  expect(response.status()).toBe(201);
  const saved = await response.json() as { id: string; summary: string };
  const detailResponse = await request.get(`${backendOrigin}/api/posts/${slug}`);
  expect(detailResponse.ok()).toBe(true);
  const detail = await detailResponse.json() as { metaDescription: string; summary: string };
  expect(detail.metaDescription).toBeTruthy();
  expect(detail.summary).toBe(saved.summary);
  if (!explicit) {
    expect(detail.metaDescription.length).toBeGreaterThan(detail.summary.length);
    expect(detail.metaDescription.length).toBeLessThanOrEqual(160);
  }
  return {
    slug, description: detail.metaDescription,
    cleanup: async () => {
      const removed = await request.delete(`${backendOrigin}/api/posts/${saved.id}`, {
        headers: { Cookie: cookie, Origin: backendOrigin }
      });
      expect(removed.status()).toBe(204);
    }
  };
}

for (const explicit of [false, true]) {
  test(`direct post keeps ${explicit ? 'explicit' : 'enriched'} SEO description during hydration`, async ({ page, request }) => {
    const fixture = await createFixture(request, explicit);
    let releaseClient = () => {};
    const clientGate = new Promise<void>(resolve => { releaseClient = resolve; });
    await page.route(/\/assets\/.*\.js(?:\?.*)?$/, async route => {
      await clientGate;
      await route.continue();
    });
    try {
      await page.goto(`${backendOrigin}/posts/${fixture.slug}`, { waitUntil: 'commit' });
      await expect(page.locator('[data-prerendered="post"]')).toBeVisible();
      await expectDescription(page, fixture.description);
      releaseClient();
      await expect(page.locator('[data-prerendered]')).toHaveCount(0);
      await expect(page.getByRole('heading', { level: 1, name: fixture.slug })).toBeVisible();
      await expectDescription(page, fixture.description);
    } finally {
      releaseClient();
      await fixture.cleanup();
    }
  });
}

test('SPA post navigation preserves metadata while loading, replaces it on success and removes schema on missing posts', async ({ page, request }) => {
  const first = await createFixture(request);
  const second = await createFixture(request, true);
  const navigate = (slug: string) => page.evaluate(nextSlug => {
    window.history.pushState({}, '', `/posts/${nextSlug}`);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, slug);
  let releaseRequest = () => {};
  let requestStarted = () => {};
  const gate = new Promise<void>(resolve => { releaseRequest = resolve; });
  const started = new Promise<void>(resolve => { requestStarted = resolve; });
  try {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: '전체 글' })).toBeVisible();
    await navigate(first.slug);
    await expect(page.getByRole('heading', { level: 1, name: first.slug })).toBeVisible();
    await expectDescription(page, first.description);
    await page.route(`**/api/posts/${second.slug}`, async route => {
      requestStarted();
      await gate;
      await route.continue();
    });
    await navigate(second.slug);
    await started;
    await expectDescription(page, first.description);
    releaseRequest();
    await expect(page.getByRole('heading', { level: 1, name: second.slug })).toBeVisible();
    await expectDescription(page, second.description);
    await navigate(`missing-${second.slug}`);
    await expect(page.getByRole('heading', { name: '해당 글이 존재하지 않습니다.' })).toBeVisible();
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow');
    await expect.poll(() => articleDescriptions(page)).toEqual([]);
    await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', '요청한 글을 표시할 수 없습니다.');
  } finally {
    releaseRequest();
    await first.cleanup();
    await second.cleanup();
  }
});
