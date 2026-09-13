import { expect, test, type Page } from '@playwright/test';

const documentFor = (text: string) => ({
  type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }]
});

async function login(page: Page) {
  const response = await page.request.post('/api/auth/login', {
    data: { password: process.env.ADMIN_PASSWORD ?? 'e2e-password' }
  });
  expect(response.ok()).toBe(true);
}

async function expectNoOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(await page.getByTestId('post-command-bar').evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
}

// Browser fetch follows the same cookie and origin rules as the admin UI.
async function browserApi(page: Page, url: string, method = 'GET', body?: unknown) {
  return page.evaluate(async ({ url, method, body }) => {
    const response = await fetch(url, {
      method, credentials: 'include',
      ...(body === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    });
    const text = await response.text();
    return { status: response.status, body: text ? JSON.parse(text) : null };
  }, { url, method, body });
}

for (const width of [320, 390, 1600]) {
  test(`focus and compact save details preserve input and panel preferences at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await login(page);
    const post = {
      id: 'focus-fixture', slug: 'focus-fixture', title: '집중 모드 원본', status: 'draft',
      summary: '', tags: [], sections: [], category: '테스트', publishedAt: '2026-01-01',
      updatedAt: '2026-09-12T00:00:00.000Z', contentJson: documentFor('집중 모드 원본 본문')
    };
    await page.route('**/api/posts**', async route => {
      const path = new URL(route.request().url()).pathname;
      if (path === '/api/posts') await route.fulfill({ json: { posts: [post], total: 1 } });
      else if (path.endsWith('/revisions')) await route.fulfill({ json: [] });
      else await route.continue();
    });
    await page.goto(`/admin?section=posts&post=${post.id}`);
    const title = page.getByPlaceholder('제목을 입력하세요');
    const editor = page.locator('.ProseMirror');
    await expect(title).toHaveValue(post.title);
    await title.fill('집중해 작성 중인 제목');
    await editor.fill('아직 서버에 저장하지 않은 본문');
    await expect(page.getByText('저장되지 않은 변경', { exact: true })).toBeVisible();
    await expect(page.getByTestId('browser-save-status')).toContainText('브라우저 임시 저장됨');
    await expect(page.getByTestId('browser-save-status')).toBeHidden();
    await page.getByLabel('저장 상태 상세', { exact: true }).click();
    await expect(page.getByTestId('browser-save-status')).toBeVisible();
    await expect(page.getByTestId('server-save-status')).toContainText('서버 저장 ·');
    await expectNoOverflow(page);
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('browser-save-status')).toBeHidden();
    await page.evaluate(() => window.scrollTo(0, 0));
    const beforeTop = (await editor.boundingBox())!.y;
    await editor.evaluate(element => { element.dataset.mountProbe = 'same-editor'; });
    const listWasOpen = await page.locator('#admin-post-list-panel').isVisible();
    const inspectorWasOpen = await page.locator('#post-inspector-panel').isVisible();

    await page.getByRole('button', { name: '집중 모드 켜기', exact: true }).click();
    await expect(page.locator('.admin-compact header')).toBeHidden();
    await expect(page.locator('#admin-post-list-panel')).toBeHidden();
    await expect(page.locator('#post-inspector-panel')).toBeHidden();
    await expect(page.getByRole('button', { name: '집중 모드 끄기', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(() => page.locator('.admin-compact').evaluate(element =>
      parseFloat(getComputedStyle(element).getPropertyValue('--admin-header-offset')))).toBe(0);
    if (width < 1024) expect((await editor.boundingBox())!.y).toBeLessThan(beforeTop - 50);
    await expect(editor).toHaveAttribute('data-mount-probe', 'same-editor');
    await expect(title).toHaveValue('집중해 작성 중인 제목');
    await expect(editor).toHaveText('아직 서버에 저장하지 않은 본문');
    await expectNoOverflow(page);
    await page.screenshot({ path: test.info().outputPath(`editor-focus-${width}.png`) });

    await page.getByRole('button', { name: '집중 모드 끄기', exact: true }).click();
    await expect(page.locator('.admin-compact header')).toBeVisible();
    expect(await page.locator('#admin-post-list-panel').isVisible()).toBe(listWasOpen);
    expect(await page.locator('#post-inspector-panel').isVisible()).toBe(inspectorWasOpen);
    await expect(title).toHaveValue('집중해 작성 중인 제목');
    await expect(editor).toHaveText('아직 서버에 저장하지 않은 본문');
    await expectNoOverflow(page);
    await page.getByRole('button', { name: '집중 모드 켜기', exact: true }).click();
    await page.getByRole('button', { name: '글 설정 열기', exact: true }).click();
    await expect(page.locator('#post-inspector-panel')).toBeVisible();
    await expect(page.getByRole('button', { name: '집중 모드 켜기', exact: true })).toBeVisible();
  });
}

test('trash restores privately without replacing current edits and permanently deletes only after title confirmation', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await login(page);
  await page.goto('/admin?section=posts');
  await expect(page.getByPlaceholder('제목을 입력하세요')).toBeVisible();
  const slug = `trash-e2e-${Date.now()}`;
  const created = await browserApi(page, '/api/posts', 'POST', {
    title: `휴지통 실제 검증 ${slug}`, slug, category: '테스트', status: 'published', publishedAt: '2026-01-01', contentJson: documentFor('보존할 본문')
  });
  expect(created.status).toBe(201);
  const post = created.body;
  await page.goto(`/admin?section=posts&post=${post.id}`);
  const title = page.getByPlaceholder('제목을 입력하세요');
  await expect(title).toHaveValue(post.title);
  const revisions = (await browserApi(page, `/api/posts/${post.id}/revisions`)).body;
  page.on('dialog', dialog => {
    expect(dialog.message()).toContain('휴지통');
    void dialog.accept();
  });
  await page.getByRole('button', { name: '집중 모드 켜기', exact: true }).click();
  const moved = page.waitForResponse(response => response.request().method() === 'DELETE' && response.url().endsWith(`/posts/${post.id}`));
  await page.getByRole('button', { name: '글 삭제', exact: true }).click();
  expect((await moved).status()).toBe(204);
  await expect(title).toHaveValue('');
  await expect(page.locator('.admin-compact header')).toBeVisible();
  expect((await page.request.get(`/api/posts/${slug}`)).status()).toBe(404);
  await title.fill('복원 중에도 유지할 새 글 제목');
  await page.locator('.ProseMirror').fill('복원 중에도 유지할 새 글 본문');
  const trigger = page.getByRole('button', { name: '휴지통 열기', exact: true });
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: '글 휴지통', exact: true });
  const row = dialog.getByRole('listitem').filter({ has: page.getByRole('heading', { name: post.title, exact: true }) });
  await expect(row).toBeVisible();
  await row.getByRole('button', { name: '초안으로 복원', exact: true }).click();
  await expect(dialog.getByText('글을 비공개 초안으로 복원했습니다.', { exact: false })).toBeVisible();
  await expect(row).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
  await expect(title).toHaveValue('복원 중에도 유지할 새 글 제목');
  await expect(page.locator('.ProseMirror')).toHaveText('복원 중에도 유지할 새 글 본문');
  const active = (await browserApi(page, '/api/posts')).body.posts.find((item: { id: string }) => item.id === post.id);
  expect(active.status).toBe('draft');
  expect(active.contentJson).toEqual(post.contentJson);
  expect((await page.request.get(`/api/posts/${slug}`)).status()).toBe(404);
  expect((await browserApi(page, `/api/posts/${post.id}/revisions`)).body).toEqual(revisions);

  expect((await browserApi(page, `/api/posts/${post.id}`, 'DELETE')).status).toBe(204);
  await trigger.click();
  await row.getByRole('button', { name: '영구삭제', exact: true }).click();
  const confirm = row.getByRole('button', { name: '영구삭제 확인', exact: true });
  await expect(confirm).toBeDisabled();
  await row.getByLabel('영구삭제 확인 제목').fill('틀린 제목');
  await expect(confirm).toBeDisabled();
  await row.getByLabel('영구삭제 확인 제목').fill(post.title);
  await expect(confirm).toBeEnabled();
  const purged = page.waitForResponse(response => response.url().endsWith(`/posts/${post.id}/permanent`));
  await confirm.click();
  expect((await purged).status()).toBe(204);
  await expect(row).toHaveCount(0);
  expect((await browserApi(page, `/api/posts/${post.id}/revisions`)).status).toBe(404);
  await dialog.getByRole('button', { name: '닫기', exact: true }).click();
  await expect(title).toHaveValue('복원 중에도 유지할 새 글 제목');
});

test('mobile trash reports loading errors, retries, and traps keyboard focus', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await login(page);
  let fails = true;
  await page.route('**/api/posts/trash/list', route => route.fulfill(fails
    ? { status: 500, json: { message: '휴지통 테스트 조회 실패' } }
    : { json: { posts: [], total: 0 } }));
  await page.goto('/admin?section=posts');
  await page.getByRole('button', { name: '목록', exact: true }).click();
  const trigger = page.getByRole('button', { name: '휴지통 열기', exact: true });
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: '글 휴지통', exact: true });
  await expect(dialog.getByRole('alert')).toContainText('휴지통 테스트 조회 실패');
  await expect(dialog.getByText('휴지통이 비어 있습니다.')).toBeHidden();
  fails = false;
  const refresh = dialog.getByRole('button', { name: '휴지통 새로고침', exact: true });
  await refresh.click();
  await expect(dialog.getByText('휴지통이 비어 있습니다.')).toBeVisible();
  await refresh.focus();
  await page.keyboard.press('Tab');
  await expect(dialog.getByRole('button', { name: '닫기', exact: true })).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(refresh).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: test.info().outputPath('trash-mobile.png') });
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
});
