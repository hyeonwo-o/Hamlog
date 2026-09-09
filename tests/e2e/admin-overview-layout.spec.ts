import { expect, test, type Page } from '@playwright/test';

const summary = {
  realtimeVisitors: 7,
  totalVisitors: 1234,
  totalPageViews: 5678,
  today: { visitors: 123, pageViews: 456 },
  recentDays: Array.from({ length: 7 }, (_, index) => ({
    date: `2026-09-0${index + 1}`,
    visitors: 10 + index,
    pageViews: 20 + index
  })),
  timeZone: 'Asia/Seoul',
  updatedAt: '2026-09-07T10:00:00.000Z',
  generatedAt: '2026-09-07T10:00:00.000Z'
};

async function openDashboard(page: Page) {
  await page.route('**/api/analytics/summary', route => route.fulfill({ json: summary }));
  const login = await page.request.post('/api/auth/login', {
    data: { password: process.env.ADMIN_PASSWORD ?? 'e2e-password' }
  });
  expect(login.ok()).toBe(true);
  await page.goto('/admin?section=dashboard');
  await expect(page.getByRole('heading', { name: '방문자 현황' })).toBeVisible();
}

test('admin theme selector keeps a clear mobile icon and native keyboard control', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.emulateMedia({ colorScheme: 'dark' });
  await openDashboard(page);

  const select = page.getByRole('combobox', { name: '화면 테마', exact: true });
  const label = select.locator('..');
  const visibleText = label.locator('span[aria-hidden="true"] > span');
  await expect(select).toHaveValue('system');
  // Native select text is hidden as a whole, so option colors cannot leak over the icon.
  await expect(select).toHaveCSS('opacity', '0');
  await expect(visibleText).toBeHidden();
  const bounds = await label.boundingBox();
  expect(bounds?.width).toBeGreaterThanOrEqual(44);
  expect(bounds?.height).toBeGreaterThanOrEqual(44);
  const icon = await label.locator('svg').boundingBox();
  expect(Math.abs(icon!.x + icon!.width / 2 - bounds!.x - bounds!.width / 2)).toBeLessThan(1);
  expect(Math.abs(icon!.y + icon!.height / 2 - bounds!.y - bounds!.height / 2)).toBeLessThan(1);

  await select.selectOption('dark');
  await select.focus();
  await expect(label).not.toHaveCSS('box-shadow', 'none');
  await page.keyboard.press('ArrowUp');
  await expect(select).toHaveValue('light');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(page.locator('.admin-compact')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await page.screenshot({ path: test.info().outputPath('admin-mobile-theme.png') });

  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(visibleText).toBeVisible();
  await expect(visibleText).toHaveText('라이트');
  await page.reload();
  await expect(select).toHaveValue('light');
});

test('analytics cards stay compact beside daily history and fit narrow screens', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await openDashboard(page);
  const panel = page.getByRole('region', { name: '방문자 현황' });
  const realtimeCard = panel.getByText('현재 접속자', { exact: true }).locator('../..');
  const todayCard = panel.getByText('오늘 방문자', { exact: true }).locator('../..');
  const pageViewsCard = panel.getByText('오늘 페이지뷰', { exact: true }).locator('../..');
  const dailyHistory = panel.getByRole('table');

  await expect(dailyHistory.locator('tbody tr')).toHaveCount(7);
  const realtime = await realtimeCard.boundingBox();
  const today = await todayCard.boundingBox();
  const pageViews = await pageViewsCard.boundingBox();
  const history = await dailyHistory.boundingBox();
  expect(realtime!.height).toBeLessThan(150);
  expect(realtime!.height).toBeLessThan(history!.height * 0.6);
  expect(Math.abs(realtime!.y - today!.y)).toBeLessThan(1);
  expect(pageViews!.y).toBeGreaterThan(realtime!.y + realtime!.height);
  expect(history!.x).toBeGreaterThan(today!.x + today!.width);
  await page.screenshot({ path: test.info().outputPath('admin-dashboard-desktop.png') });

  for (const width of [768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(realtimeCard).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const cards = panel.getByText('오늘 방문자', { exact: true }).locator('../../..');
    expect(await cards.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  }

  const mobileRealtime = await realtimeCard.boundingBox();
  const mobileToday = await todayCard.boundingBox();
  expect(mobileRealtime!.width).toBeGreaterThan(mobileToday!.width * 1.9);
  expect(mobileToday!.y).toBeGreaterThan(mobileRealtime!.y + mobileRealtime!.height);
  await page.screenshot({ path: test.info().outputPath('admin-dashboard-mobile.png') });
});
