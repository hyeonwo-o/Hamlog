import { expect, test, type Page } from '@playwright/test';

interface VisitEvent {
  path: string;
  eventId: string;
}

const post = {
  id: 'analytics-navigation-post',
  slug: 'analytics-navigation-post',
  title: '방문 통계 내비게이션 테스트',
  summary: '검색과 목차 이동이 방문 통계를 중복 기록하지 않는지 확인합니다.',
  category: '미분류',
  tags: [],
  publishedAt: '2026-01-01',
  status: 'published',
  contentHtml: '<h2 id="first-section">첫 번째 절</h2><p>방문 통계 테스트 본문입니다.</p>',
  sections: []
};
const postPath = `/posts/${post.slug}`;

async function mockPublicData(page: Page) {
  const visits: VisitEvent[] = [];
  const heartbeats: string[] = [];

  await page.route('**/api/analytics/public', route => route.fulfill({
    json: { totalVisitors: 1, realtimeVisitors: 1 }
  }));
  await page.route('**/api/analytics/visit', async route => {
    visits.push(route.request().postDataJSON() as VisitEvent);
    await route.fulfill({ status: 204 });
  });
  await page.route('**/api/analytics/heartbeat', async route => {
    heartbeats.push(String(route.request().postDataJSON().path));
    await route.fulfill({ status: 204 });
  });
  await page.route(url => url.pathname === '/api/posts', route => route.fulfill({
    json: { posts: [post], total: 1 }
  }));
  await page.route(`**/api/posts/${post.slug}`, route => route.fulfill({ json: post }));
  await page.route(`**/api/posts/${post.slug}/view`, route => route.fulfill({
    json: { slug: post.slug, views: 1 }
  }));
  await page.route('**/api/categories', route => route.fulfill({
    json: { categories: [], total: 0 }
  }));
  await page.route(url => url.pathname === '/api/search', route => route.fulfill({ json: [post] }));

  return { visits, heartbeats };
}

// Exercise the router's history listener with a fresh key, just as query/hash
// navigation does, without introducing production-only test controls.
async function pushLocation(page: Page, nextUrl: string) {
  await page.evaluate(url => {
    const state = {
      ...window.history.state,
      idx: Number(window.history.state?.idx ?? 0) + 1,
      key: crypto.randomUUID()
    };
    window.history.pushState(state, '', url);
    window.dispatchEvent(new PopStateEvent('popstate', { state }));
  }, nextUrl);
}

async function settleNavigation(page: Page) {
  await page.evaluate(() => new Promise<void>(resolve => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  }));
}

test('query and hash history changes keep one visit, including Back and Forward', async ({ page }) => {
  const { visits } = await mockPublicData(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '전체 글' })).toBeVisible();
  await expect.poll(() => visits.length).toBe(1);
  const initialEventId = visits[0].eventId;

  await pushLocation(page, '/?q=first');
  await expect(page.getByRole('searchbox', { name: '글 검색' })).toHaveValue('first');
  await pushLocation(page, '/?q=second');
  await expect(page.getByRole('searchbox', { name: '글 검색' })).toHaveValue('second');
  await pushLocation(page, '/?q=second#writing');
  await settleNavigation(page);
  expect(visits).toEqual([{ path: '/', eventId: initialEventId }]);

  await page.goBack();
  await expect(page).toHaveURL(/\/\?q=second$/);
  await page.goBack();
  await expect(page.getByRole('searchbox', { name: '글 검색' })).toHaveValue('first');
  await page.goForward();
  await expect(page.getByRole('searchbox', { name: '글 검색' })).toHaveValue('second');
  await settleNavigation(page);
  expect(visits).toEqual([{ path: '/', eventId: initialEventId }]);
});

test('real path changes, Back to a post, and reload each create one fresh visit', async ({ page }) => {
  const { visits } = await mockPublicData(page);
  await page.goto('/');
  await expect.poll(() => visits.length).toBe(1);

  await page.getByRole('link').filter({
    has: page.getByRole('heading', { name: post.title })
  }).first().click();
  await expect(page.getByRole('heading', { level: 1, name: post.title })).toBeVisible();
  await expect.poll(() => visits.map(visit => visit.path)).toEqual(['/', postPath]);

  await page.getByRole('navigation', { name: '주요 메뉴' }).getByRole('link').click();
  await expect(page.getByRole('heading', { name: '전체 글' })).toBeVisible();
  await expect.poll(() => visits.map(visit => visit.path)).toEqual(['/', postPath, '/']);

  await page.goBack();
  await expect(page.getByRole('heading', { level: 1, name: post.title })).toBeVisible();
  await expect.poll(() => visits.map(visit => visit.path)).toEqual(['/', postPath, '/', postPath]);
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: post.title })).toBeVisible();
  await expect.poll(() => visits.map(visit => visit.path)).toEqual(['/', postPath, '/', postPath, postPath]);
  await settleNavigation(page);

  expect(visits).toHaveLength(5);
  expect(new Set(visits.map(visit => visit.eventId)).size).toBe(5);
  for (const visit of visits) {
    expect(visit.eventId).toMatch(/^[a-zA-Z0-9_-]{8,80}$/);
  }
});

test('query and hash updates preserve the active page heartbeat interval', async ({ page }) => {
  const { visits, heartbeats } = await mockPublicData(page);
  await page.clock.install({ time: new Date('2026-09-12T08:00:00.000Z') });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '전체 글' })).toBeVisible();
  await expect.poll(() => visits.length).toBe(1);
  await page.clock.pauseAt(new Date('2026-09-12T10:00:00.000Z'));

  // Start a fresh post interval while the clock is paused so its deadline is exact.
  await pushLocation(page, postPath);
  await expect(page.getByRole('heading', { level: 1, name: post.title })).toBeVisible();
  await expect.poll(() => visits.length).toBe(2);
  const postHeartbeats = () => heartbeats.filter(path => path === postPath).length;
  const baseline = postHeartbeats();
  await page.clock.runFor(20_000);
  expect(postHeartbeats()).toBe(baseline);

  await pushLocation(page, `${postPath}?view=reading`);
  await page.clock.runFor(1);
  await pushLocation(page, `${postPath}?view=reading#first-section`);
  await page.clock.runFor(1);
  await page.goBack();
  await page.clock.runFor(1);
  await page.clock.runFor(10_001);
  await expect.poll(postHeartbeats).toBe(baseline + 1);
  expect(visits.map(visit => visit.path)).toEqual(['/', postPath]);

  await pushLocation(page, '/');
  await expect(page.getByRole('heading', { name: '전체 글' })).toBeVisible();
  await expect.poll(() => visits.length).toBe(3);
  const homeHeartbeatBaseline = heartbeats.filter(path => path === '/').length;
  await page.clock.runFor(30_001);
  await expect.poll(() => heartbeats.filter(path => path === '/').length)
    .toBe(homeHeartbeatBaseline + 1);
  expect(postHeartbeats()).toBe(baseline + 1);
});
