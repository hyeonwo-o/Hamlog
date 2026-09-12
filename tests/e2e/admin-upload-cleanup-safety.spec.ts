import { expect, test } from '@playwright/test';

const orphan = {
  filename: 'cleanup-old-unused.webp', url: '/uploads/cleanup-old-unused.webp',
  size: 120, modifiedAt: '2026-01-01T00:00:00.000Z'
};

test('image cleanup protects current and recovery drafts and requires explicit selection', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  const login = await page.request.post('/api/auth/login', {
    data: { password: process.env.ADMIN_PASSWORD ?? 'e2e-password' }
  });
  expect(login.ok()).toBe(true);
  await page.addInitScript(() => {
    localStorage.setItem('hamlog_draft_cleanup-other', JSON.stringify({
      draft: { title: '다른 글의 복구본', contentHtml: '<p><img src="/uploads/recovery-photo.webp"></p>' },
      updatedAt: new Date().toISOString()
    }));
  });
  const scanned: string[][] = [];
  const deleted: Array<{ filenames: string[]; protectedFilenames: string[] }> = [];
  await page.route('**/api/uploads/unused/scan', async route => {
    expect(route.request().method()).toBe('POST');
    scanned.push(route.request().postDataJSON().protectedFilenames);
    await route.fulfill({ json: {
      totalFiles: 3, totalBytes: 360, referencedFiles: 2,
      recentFiles: 0, gracePeriodHours: 24,
      unused: deleted.length ? [] : [orphan], unusedBytes: deleted.length ? 0 : orphan.size
    } });
  });
  await page.route('**/api/uploads/unused', async route => {
    if (route.request().method() !== 'DELETE') return route.continue();
    deleted.push(route.request().postDataJSON());
    await route.fulfill({ json: { deleted: [orphan], deletedBytes: orphan.size, remainingUnused: [] } });
  });
  await page.goto('/admin?section=posts');
  await page.getByPlaceholder('제목을 입력하세요').fill('이미지를 정리하는 중인 초안');
  const inspector = page.locator('#post-inspector-panel');
  await expect(inspector).toBeVisible();
  await inspector.getByPlaceholder('https://...', { exact: true }).first().fill('/uploads/current-cover.webp');
  await inspector.getByRole('button', { name: '이미지 정리', exact: true }).click();
  await inspector.getByRole('button', { name: '미사용 이미지 확인', exact: true }).click();
  await expect.poll(() => scanned.length).toBe(1);
  expect(scanned[0]).toEqual(expect.arrayContaining(['current-cover.webp', 'recovery-photo.webp']));
  const checkbox = inspector.getByRole('checkbox', { name: /cleanup-old-unused\.webp/ });
  await expect(checkbox).not.toBeChecked();
  const remove = inspector.getByRole('button', { name: '선택 삭제', exact: true });
  await expect(remove).toBeDisabled();
  await checkbox.check();

  // Protection is collected again at deletion, not frozen at the scan time.
  await inspector.getByPlaceholder('https://...', { exact: true }).first().fill('/uploads/newer-cover.webp');
  page.on('dialog', dialog => { void dialog.accept(); });
  await remove.click();
  await expect.poll(() => deleted.length).toBe(1);
  expect(deleted[0].filenames).toEqual([orphan.filename]);
  expect(deleted[0].protectedFilenames).toEqual(expect.arrayContaining(['newer-cover.webp', 'recovery-photo.webp']));
  await expect(page.getByPlaceholder('제목을 입력하세요')).toHaveValue('이미지를 정리하는 중인 초안');
});

test('image cleanup fails closed when browser recovery storage cannot be checked', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  const login = await page.request.post('/api/auth/login', {
    data: { password: process.env.ADMIN_PASSWORD ?? 'e2e-password' }
  });
  expect(login.ok()).toBe(true);
  await page.goto('/admin?section=posts');
  const inspector = page.locator('#post-inspector-panel');
  await inspector.getByRole('button', { name: '이미지 정리', exact: true }).click();
  await page.evaluate(() => {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() { throw new DOMException('Storage blocked', 'SecurityError'); }
    });
  });
  let cleanupRequests = 0;
  await page.route('**/api/uploads/unused**', route => {
    cleanupRequests += 1;
    return route.fulfill({ status: 500, json: { message: 'Should not be requested' } });
  });
  await inspector.getByRole('button', { name: '미사용 이미지 확인', exact: true }).click();
  await expect(inspector.getByText(/브라우저.*(?:확인|저장|복구)/).last()).toBeVisible();
  await expect(inspector.getByRole('button', { name: '선택 삭제', exact: true })).toBeDisabled();
  expect(cleanupRequests).toBe(0);
});
