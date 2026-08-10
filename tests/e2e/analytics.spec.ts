import { expect, test, type Page } from '@playwright/test';

const loginPasswords = Array.from(new Set([
  process.env.ADMIN_PASSWORD,
  'admin1234',
  'e2e-password'
].filter(Boolean))) as string[];

interface VisitRequest {
  method: string;
  contentType: string;
  path: string;
  eventId: string;
}

const initialSummary = {
  realtimeVisitors: 7,
  totalVisitors: 1234,
  totalPageViews: 5678,
  today: {
    visitors: 123,
    pageViews: 456
  },
  recentDays: [
    { date: '2026-08-04', visitors: 10, pageViews: 20 },
    { date: '2026-08-05', visitors: 11, pageViews: 21 },
    { date: '2026-08-06', visitors: 12, pageViews: 22 },
    { date: '2026-08-07', visitors: 13, pageViews: 23 },
    { date: '2026-08-08', visitors: 14, pageViews: 24 },
    { date: '2026-08-09', visitors: 15, pageViews: 25 },
    { date: '2026-08-10', visitors: 77, pageViews: 88 }
  ],
  timeZone: 'Asia/Seoul',
  updatedAt: '2026-08-10T10:00:00.000Z',
  generatedAt: '2026-08-10T10:00:00.000Z'
};

async function openAdminDashboard(page: Page) {
  await page.goto('/admin?section=dashboard');
  const dashboardHeading = page.getByRole('heading', { name: '방문자 현황' });

  if (await dashboardHeading.isVisible().catch(() => false)) {
    return;
  }

  for (const password of loginPasswords) {
    const loggedIn = await page.evaluate(async (candidate) => {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ password: candidate })
      });
      return response.ok;
    }, password);

    if (loggedIn) {
      break;
    }
  }

  await page.goto('/admin?section=dashboard');
  await expect(dashboardHeading).toBeVisible();
}

test('public pages send visits with a stable idempotency key per navigation', async ({ page }) => {
  const visits: VisitRequest[] = [];

  await page.route('**/api/analytics/public', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ totalVisitors: 1_234_567, realtimeVisitors: 7 })
  }));
  await page.route('**/api/analytics/visit', async (route) => {
    const request = route.request();
    const payload = request.postDataJSON() as { path?: unknown; eventId?: unknown };
    visits.push({
      method: request.method(),
      contentType: request.headers()['content-type'] ?? '',
      path: String(payload.path ?? ''),
      eventId: String(payload.eventId ?? '')
    });
    await route.fulfill({ status: 204 });
  });
  await page.route('**/api/analytics/heartbeat', route => route.fulfill({ status: 204 }));

  await page.goto('/');
  await expect.poll(() => visits.some(visit => visit.path === '/')).toBe(true);

  const publicNavigation = page.getByRole('navigation', { name: '주요 메뉴' });
  const visitorStatus = publicNavigation.getByTestId('public-visitor-status');
  await expect(publicNavigation).toBeVisible();
  await expect(publicNavigation.getByRole('link')).toHaveCount(1);
  await expect(visitorStatus.getByText('1,234,567', { exact: true })).toBeVisible();
  await expect(visitorStatus.getByText('7', { exact: true })).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  const mobileWidth = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth
  }));
  expect(mobileWidth.scrollWidth).toBeLessThanOrEqual(mobileWidth.clientWidth);

  await page.setViewportSize({ width: 320, height: 720 });
  const narrowMobileWidth = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth
  }));
  expect(narrowMobileWidth.scrollWidth).toBeLessThanOrEqual(narrowMobileWidth.clientWidth);

  await page.goto('/posts/analytics-e2e-missing');
  await expect.poll(() => visits.some(visit => visit.path === '/posts/analytics-e2e-missing'))
    .toBe(true);
  await expect(page.getByRole('navigation', { name: '주요 메뉴' })
    .getByTestId('public-visitor-status')).toBeVisible();

  const homeVisits = visits.filter(visit => visit.path === '/');
  const postVisits = visits.filter(visit => visit.path === '/posts/analytics-e2e-missing');
  const homeEventIds = new Set(homeVisits.map(visit => visit.eventId));
  const postEventIds = new Set(postVisits.map(visit => visit.eventId));

  for (const visit of [...homeVisits, ...postVisits]) {
    expect(visit.method).toBe('POST');
    expect(visit.contentType).toContain('application/json');
    expect(visit.eventId).toMatch(/^[a-zA-Z0-9_-]{8,80}$/);
  }

  expect(homeEventIds.size).toBe(1);
  expect(postEventIds.size).toBe(1);
  expect(homeVisits).toHaveLength(1);
  expect(postVisits).toHaveLength(1);
  expect([...postEventIds][0]).not.toBe([...homeEventIds][0]);
});

test('admin dashboard renders analytics, refreshes manually, and fits mobile width', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });

  let summaryRequests = 0;
  let summaryResponse = initialSummary;
  await page.route('**/api/analytics/summary', async (route) => {
    summaryRequests += 1;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(summaryResponse)
    });
  });

  await openAdminDashboard(page);

  const analyticsPanel = page.locator('section[aria-labelledby="analytics-summary-title"]');
  await expect(analyticsPanel).toBeVisible();
  await expect(analyticsPanel.getByText('현재 접속자', { exact: true })).toBeVisible();
  await expect(analyticsPanel.getByText('7', { exact: true })).toBeVisible();
  await expect(analyticsPanel.getByText('오늘 방문자', { exact: true })).toBeVisible();
  await expect(analyticsPanel.getByText('123', { exact: true })).toBeVisible();
  await expect(analyticsPanel.getByText('누적 방문자', { exact: true })).toBeVisible();
  await expect(analyticsPanel.getByText('1,234', { exact: true })).toBeVisible();
  await expect(analyticsPanel.getByText('오늘 페이지뷰', { exact: true })).toBeVisible();
  await expect(analyticsPanel.getByText('456', { exact: true })).toBeVisible();
  await expect(analyticsPanel.getByText('누적 페이지뷰', { exact: true })).toBeVisible();
  await expect(analyticsPanel.getByText('5,678', { exact: true })).toBeVisible();
  await expect(analyticsPanel.getByRole('table').locator('tbody tr')).toHaveCount(7);
  await expect(analyticsPanel.getByRole('row', { name: /77 88/ })).toBeVisible();

  const requestsBeforeRefresh = summaryRequests;
  summaryResponse = {
    ...initialSummary,
    realtimeVisitors: 9,
    generatedAt: '2026-08-10T10:01:00.000Z'
  };
  await analyticsPanel.getByRole('button', { name: '새로고침' }).click();
  await expect.poll(() => summaryRequests).toBeGreaterThan(requestsBeforeRefresh);
  await expect(analyticsPanel.getByText('9', { exact: true })).toBeVisible();

  const pageWidth = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth
  }));
  expect(pageWidth.scrollWidth).toBeLessThanOrEqual(pageWidth.clientWidth);
});
