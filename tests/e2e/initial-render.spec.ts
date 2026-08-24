import { expect, test } from '@playwright/test';

const backendOrigin = `http://127.0.0.1:${process.env.E2E_API_PORT ?? process.env.PORT ?? '4100'}`;

test('production home keeps a styled shell until bootstrap hydration completes', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });

  let releaseClientBundle = () => {};
  const clientBundleGate = new Promise<void>(resolve => {
    releaseClientBundle = resolve;
  });

  await page.route(/\/assets\/.*\.js(?:\?.*)?$/, async route => {
    await clientBundleGate;
    await route.continue();
  });

  const navigation = page.goto(`${backendOrigin}/`, { waitUntil: 'load' });

  try {
    const shell = page.locator('[data-prerendered="home"]');
    await expect(shell).toBeVisible();
    await expect(shell).toHaveClass(/public-site/);
    await expect(page.locator('.prerender-section')).toBeVisible();
    await expect(page.getByText('블로그 정보 불러오는 중...', { exact: true })).toHaveCount(0);

    const shellMetrics = await shell.evaluate(element => {
      const container = element.querySelector('.prerender-container');
      const containerRect = container?.getBoundingClientRect();
      return {
        fontFamily: getComputedStyle(element).fontFamily,
        containerWidth: containerRect?.width ?? 0
      };
    });

    expect(shellMetrics.fontFamily).toContain('Noto Serif KR');
    expect(shellMetrics.containerWidth).toBeGreaterThan(700);
    expect(shellMetrics.containerWidth).toBeLessThan(1280);
  } finally {
    releaseClientBundle();
  }

  await navigation;
  await expect(page.locator('[data-prerendered]')).toHaveCount(0);
  await expect(page.getByText('블로그 정보 불러오는 중...', { exact: true })).toHaveCount(0);
  await expect(page.locator('.public-site h1').first()).toBeVisible();
});
