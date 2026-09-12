import { expect, test, type Page } from '@playwright/test';

const documentFor = (text: string) => ({
  type: 'doc',
  content: [{ type: 'paragraph', attrs: { textAlign: null }, content: [{ type: 'text', text }] }]
});

const fixturePost = (id: string, title: string) => ({
  id, title, slug: id, summary: '브라우저 임시 저장 검증', category: '일상',
  contentJson: documentFor(`${title} 본문`), contentHtml: `<p>${title} 본문</p>`,
  publishedAt: '2026-09-12', tags: [], sections: [], featured: false,
  status: 'draft', updatedAt: '2026-09-12T01:00:00.000Z'
});

async function mockPosts(page: Page, initial: ReturnType<typeof fixturePost>[]) {
  const login = await page.request.post('/api/auth/login', {
    data: { password: process.env.ADMIN_PASSWORD ?? 'e2e-password' }
  });
  expect(login.ok()).toBe(true);
  const posts = [...initial];
  let writes = 0;
  await page.route('**/api/posts**', async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() === 'GET' && path === '/api/posts') {
      await route.fulfill({ json: { posts, total: posts.length } });
      return;
    }
    if (request.method() === 'GET' && path.endsWith('/revisions')) {
      await route.fulfill({ json: [] });
      return;
    }
    if (request.method() !== 'GET') writes += 1;
    const index = posts.findIndex(post => path === `/api/posts/${post.id}`);
    if (request.method() === 'PUT' && index !== -1) {
      posts[index] = { ...posts[index], ...request.postDataJSON(), updatedAt: '2026-09-12T02:00:00.000Z' };
      await route.fulfill({ json: posts[index] });
      return;
    }
    // Never let an unexpected test write fall through to the real test database.
    await route.fulfill({ status: 404, json: { error: 'Unexpected mocked post request' } });
  });
  await page.clock.install({ time: new Date('2026-09-12T08:00:00.000Z') });
  return { get writes() { return writes; }, get posts() { return posts; } };
}

async function openEditor(page: Page, post?: ReturnType<typeof fixturePost>) {
  await page.goto(`/admin?section=posts${post ? `&post=${post.id}` : ''}`);
  await expect(page.getByPlaceholder('제목을 입력하세요')).toHaveValue(post?.title ?? '');
  await expect(page.locator('.ProseMirror')).toBeVisible();
  // Load normally, then pause well ahead of startup so timers are deterministic.
  await page.clock.pauseAt(new Date('2026-09-12T10:00:00.000Z'));
}

const storedDraft = (page: Page, id = 'new') => page.evaluate(key => {
  const raw = localStorage.getItem(`hamlog_draft_${key}`);
  return raw ? JSON.parse(raw).draft : null;
}, id);

test('browser pending and saved states remain distinct from a new draft being unsaved on the server', async ({ page }) => {
  const api = await mockPosts(page, []);
  await openEditor(page);
  await page.getByPlaceholder('제목을 입력하세요').fill('브라우저에만 보관하는 초안');
  await expect(page.getByTestId('browser-save-status')).toHaveText('브라우저 임시 저장 대기');
  await expect(page.getByTestId('server-save-status')).toHaveText('서버 미저장');
  expect(await storedDraft(page)).toBeNull();
  await page.clock.runFor(1_001);
  await expect(page.getByTestId('browser-save-status')).toContainText('브라우저 임시 저장됨 ·');
  await expect.poll(() => storedDraft(page)).toMatchObject({ title: '브라우저에만 보관하는 초안' });
  await expect(page.getByTestId('server-save-status')).toHaveText('서버 미저장');
  expect(api.writes).toBe(0);
});

test('pagehide flushes the latest title and body without waiting for the autosave debounce', async ({ page }) => {
  const post = fixturePost('autosave-flush', '서버 저장본');
  const api = await mockPosts(page, [post]);
  await openEditor(page, post);
  await expect(page.getByTestId('server-save-status')).toContainText('10:00:00');
  await page.getByPlaceholder('제목을 입력하세요').fill('바로 떠나기 전 제목');
  await page.locator('.ProseMirror').fill('바로 떠나기 전 최신 본문');
  await expect(page.getByTestId('browser-save-status')).toHaveText('브라우저 임시 저장 대기');
  expect(await storedDraft(page, post.id)).toBeNull();
  // No clock advancement: the 1-second autosave timer cannot have fired.
  await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
  await expect.poll(() => storedDraft(page, post.id)).toMatchObject({
    title: '바로 떠나기 전 제목', contentHtml: '<p>바로 떠나기 전 최신 본문</p>'
  });
  await expect(page.getByTestId('browser-save-status')).toContainText('브라우저 임시 저장됨');
  await expect(page.getByTestId('server-save-status')).toContainText('10:00:00');
  expect(api.writes).toBe(0);
});

test('reload preserves a recovery copy until explicit restore, including beyond the debounce', async ({ page }) => {
  const post = fixturePost('autosave-reload', '복구 전 서버 제목');
  const api = await mockPosts(page, [post]);
  await openEditor(page, post);
  await page.getByPlaceholder('제목을 입력하세요').fill('복구해야 하는 최신 제목');
  await page.locator('.ProseMirror').fill('복구해야 하는 최신 본문');
  await page.clock.runFor(1_001);
  const recovery = await storedDraft(page, post.id);
  expect(recovery.title).toBe('복구해야 하는 최신 제목');
  page.on('dialog', dialog => { void dialog.accept(); });
  await page.clock.resume();
  await page.reload();
  await expect(page.getByPlaceholder('제목을 입력하세요')).toHaveValue(post.title);
  await expect(page.getByTestId('browser-save-status')).toHaveText('브라우저 복구본 확인 필요');
  await page.clock.pauseAt(new Date('2026-09-12T11:00:00.000Z'));
  await page.clock.runFor(2_001);
  expect(await storedDraft(page, post.id)).toEqual(recovery);
  await page.getByTestId('post-command-bar').getByRole('button', { name: '복구', exact: true }).click();
  await expect(page.getByPlaceholder('제목을 입력하세요')).toHaveValue(recovery.title);
  await expect(page.locator('.ProseMirror')).toHaveText('복구해야 하는 최신 본문');
  await page.clock.runFor(1_001);
  await expect(page.getByTestId('browser-save-status')).toContainText('브라우저 임시 저장됨');
  await expect(page.getByText('저장되지 않은 변경', { exact: true })).toBeVisible();
  expect(api.writes).toBe(0);
});

test('returning to the server baseline removes an obsolete recovery copy', async ({ page }) => {
  const post = fixturePost('autosave-revert', '원래 제목');
  const api = await mockPosts(page, [post]);
  await openEditor(page, post);
  const title = page.getByPlaceholder('제목을 입력하세요');
  await title.fill('취소할 변경');
  await page.clock.runFor(1_001);
  await expect.poll(() => storedDraft(page, post.id)).toMatchObject({ title: '취소할 변경' });
  await title.fill(post.title);
  await page.clock.runFor(1_001);
  await expect.poll(() => storedDraft(page, post.id)).toBeNull();
  await expect(page.getByTestId('browser-save-status')).toHaveText('브라우저: 변경 없음');
  await expect(page.getByText('저장되지 않은 변경', { exact: true })).toBeHidden();
  expect(api.writes).toBe(0);
});

test('a browser quota error reports local failure without silently saving to the server', async ({ page }) => {
  const post = fixturePost('autosave-quota', '저장 공간 오류 검증');
  const api = await mockPosts(page, [post]);
  await openEditor(page, post);
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key.startsWith('hamlog_draft_')) throw new DOMException('Test quota exhausted', 'QuotaExceededError');
      return original.call(this, key, value);
    };
  });
  await page.getByPlaceholder('제목을 입력하세요').fill('메모리에 보존해야 하는 제목');
  await page.clock.runFor(1_001);
  await expect(page.getByTestId('browser-save-status')).toHaveText('브라우저 임시 저장 실패');
  await expect(page.getByText('브라우저 임시 저장에 실패했습니다. 서버 저장으로 내용을 보관해 주세요.', { exact: true })).toBeVisible();
  await expect(page.getByPlaceholder('제목을 입력하세요')).toHaveValue('메모리에 보존해야 하는 제목');
  await expect(page.getByTestId('server-save-status')).toContainText('10:00:00');
  expect(await storedDraft(page, post.id)).toBeNull();
  expect(api.writes).toBe(0);
});

test('an unresolved recovery copy blocks server-save controls and shortcuts without erasing it', async ({ page }) => {
  const post = fixturePost('autosave-blocked', '서버에 있는 제목');
  const api = await mockPosts(page, [post]);
  const recovery = { title: '아직 확인하지 않은 복구본', contentHtml: '<p>지켜야 하는 복구 내용</p>', contentJson: documentFor('지켜야 하는 복구 내용') };
  const raw = JSON.stringify({ draft: recovery, updatedAt: '2026-09-12T03:00:00.000Z' });
  await page.addInitScript(({ key, value }) => localStorage.setItem(key, value), { key: `hamlog_draft_${post.id}`, value: raw });
  await openEditor(page, post);
  await expect(page.getByTestId('browser-save-status')).toHaveText('브라우저 복구본 확인 필요');
  await page.getByPlaceholder('제목을 입력하세요').fill('복구 선택 전에 입력한 제목');
  const save = page.getByRole('button', { name: '초안 저장', exact: true });
  if (await save.isEnabled()) await save.click();
  await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true, bubbles: true })));
  await page.clock.runFor(5_001);
  await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
  expect(api.writes).toBe(0);
  expect(await page.evaluate(id => localStorage.getItem(`hamlog_draft_${id}`), post.id)).toBe(raw);
  await expect(page.getByTestId('browser-save-status')).toHaveText('브라우저 복구본 확인 필요');
  await expect(page.getByTestId('post-command-bar').getByRole('button', { name: '복구', exact: true })).toBeVisible();
});

test('a cleanup failure after a successful server save is reported separately', async ({ page }) => {
  const post = fixturePost('autosave-cleanup', '정리 실패 전 제목');
  const api = await mockPosts(page, [post]);
  await openEditor(page, post);
  const title = page.getByPlaceholder('제목을 입력하세요');
  await title.fill('서버 저장은 성공한 제목');
  await page.clock.runFor(1_001);
  await expect.poll(() => storedDraft(page, post.id)).toMatchObject({ title: '서버 저장은 성공한 제목' });
  await page.evaluate(id => {
    const original = Storage.prototype.removeItem;
    Storage.prototype.removeItem = function (key) {
      if (key === `hamlog_draft_${id}`) throw new DOMException('Test removal denied', 'SecurityError');
      return original.call(this, key);
    };
  }, post.id);
  await title.press('Control+s');
  await expect.poll(() => api.writes).toBe(1);
  await expect(page.getByTestId('server-save-status')).toContainText('11:00:00');
  await expect(page.getByText('서버 저장은 완료했지만 브라우저의 이전 임시 저장본을 정리하지 못했습니다.', { exact: true })).toBeVisible();
  await page.clock.runFor(1_001);
  await expect(page.getByTestId('browser-save-status')).toHaveText('브라우저 임시 저장 실패');
  await expect(page.getByText('저장되지 않은 변경', { exact: true })).toBeHidden();
  expect(api.posts[0].title).toBe('서버 저장은 성공한 제목');
  expect(await storedDraft(page, post.id)).not.toBeNull();
  expect(api.writes).toBe(1);
});

for (const scenario of ['pagehide', 'debounce', 'baseline-cleanup'] as const) {
  test(`an unexpected recovery copy is preserved during ${scenario}`, async ({ page }) => {
    const post = fixturePost(`autosave-external-${scenario}`, '현재 서버 제목');
    const api = await mockPosts(page, [post]);
    await openEditor(page, post);
    const title = page.getByPlaceholder('제목을 입력하세요');
    await title.fill('이 탭에서 먼저 보관한 제목');
    await page.clock.runFor(1_001);
    const knownDraft = await storedDraft(page, post.id);
    expect(knownDraft.title).toBe('이 탭에서 먼저 보관한 제목');

    // A different same-origin tab may replace this key between our last observed
    // write and the next debounce/lifecycle flush. Do not synthesize a storage
    // event: the write path must notice the changed bytes independently.
    const pendingTitle = scenario === 'baseline-cleanup' ? post.title : '이 탭의 아직 저장하지 않은 제목';
    await title.fill(pendingTitle);
    const externalDraft = {
      ...knownDraft,
      title: '다른 탭에서 보관한 복구 제목',
      contentHtml: '<p>다른 탭에서 보관한 복구 본문</p>',
      contentJson: documentFor('다른 탭에서 보관한 복구 본문')
    };
    const externalRaw = JSON.stringify({ draft: externalDraft, updatedAt: '2026-09-12T09:59:59.000Z' });
    await page.evaluate(({ id, raw }) => localStorage.setItem(`hamlog_draft_${id}`, raw), {
      id: post.id, raw: externalRaw
    });
    if (scenario === 'debounce') {
      await page.clock.runFor(1_001);
    } else {
      await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
    }

    const readRaw = () => page.evaluate(id => localStorage.getItem(`hamlog_draft_${id}`), post.id);
    expect(await readRaw()).toBe(externalRaw);
    await expect(page.getByTestId('browser-save-status')).toHaveText('브라우저 복구본 확인 필요');
    const restore = page.getByTestId('post-command-bar').getByRole('button', { name: '복구', exact: true });
    await expect(restore).toBeVisible();
    await expect(title).toHaveValue(pendingTitle);
    await page.clock.runFor(5_001);
    await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
    expect(await readRaw()).toBe(externalRaw);
    expect(api.writes).toBe(0);

    // Only the explicit recovery choice applies the other tab's content.
    await restore.click();
    await expect(title).toHaveValue(externalDraft.title);
    await expect(page.locator('.ProseMirror')).toHaveText('다른 탭에서 보관한 복구 본문');
    expect(api.writes).toBe(0);
  });
}
