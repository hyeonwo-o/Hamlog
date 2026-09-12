import { expect, test, type Page } from '@playwright/test';

const documentFor = (text: string) => ({
  type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }]
});

const fixturePost = (id: string, title: string) => ({
  id, title, slug: id, summary: '저장 안전성 검증', category: '일상',
  contentJson: documentFor(`${title} 본문`), contentHtml: `<p>${title} 본문</p>`,
  publishedAt: '2026-09-12', tags: [], sections: [], featured: false,
  status: 'draft', updatedAt: '2026-09-12T01:00:00.000Z'
});

async function login(page: Page) {
  const response = await page.request.post('/api/auth/login', {
    data: { password: process.env.ADMIN_PASSWORD ?? 'e2e-password' }
  });
  expect(response.ok()).toBe(true);
}

test('a new-post save preserves later typing, migrates recovery and rejects repeated shortcuts', async ({ page }) => {
  await login(page);
  let release = () => {};
  const pending = new Promise<void>(resolve => { release = resolve; });
  let requestStarted = () => {};
  const started = new Promise<void>(resolve => { requestStarted = resolve; });
  let creates = 0;
  let updates = 0;
  let saved = fixturePost('save-safety-created', '저장 전 제목');
  await page.route('**/api/posts**', async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() === 'GET' && path === '/api/posts') {
      await route.fulfill({ json: { posts: [], total: 0 } });
    } else if (request.method() === 'POST' && path === '/api/posts') {
      creates += 1;
      const body = request.postDataJSON();
      requestStarted();
      await pending;
      saved = { ...saved, ...body };
      await route.fulfill({ status: 201, json: saved });
    } else if (request.method() === 'PUT' && path === `/api/posts/${saved.id}`) {
      updates += 1;
      const body = request.postDataJSON();
      expect(body.expectedUpdatedAt).toBe(saved.updatedAt);
      saved = { ...saved, ...body, updatedAt: '2026-09-12T01:01:00.000Z' };
      await route.fulfill({ json: saved });
    } else if (path.endsWith('/revisions')) {
      await route.fulfill({ json: [] });
    } else await route.continue();
  });
  await page.goto('/admin?section=posts');
  const title = page.getByPlaceholder('제목을 입력하세요');
  const editor = page.locator('.ProseMirror');
  await title.fill('저장 전 제목');
  await editor.fill('저장 전 본문');
  await page.evaluate(() => {
    for (let index = 0; index < 3; index += 1) {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true, bubbles: true }));
    }
  });
  await started;
  await title.fill('저장 중 새 제목');
  await editor.fill('저장 중 새 본문');
  await editor.press('Control+s');
  expect(creates).toBe(1);
  release();
  await expect(page).toHaveURL(/post=save-safety-created/);
  await expect(title).toHaveValue('저장 중 새 제목');
  await expect(editor).toHaveText('저장 중 새 본문');
  await expect(page.getByText('저장되지 않은 변경', { exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => {
    const raw = localStorage.getItem('hamlog_draft_save-safety-created');
    return raw ? JSON.parse(raw).draft.title : null;
  })).toBe('저장 중 새 제목');
  expect(await page.evaluate(() => localStorage.getItem('hamlog_draft_new'))).toBeNull();
  expect(saved.title).toBe('저장 전 제목');
  expect(JSON.stringify(saved.contentJson)).toContain('저장 전 본문');
  await editor.press('Control+s');
  await expect.poll(() => updates).toBe(1);
  await expect(page.getByText('저장되지 않은 변경', { exact: true })).toBeHidden();
  expect(saved.title).toBe('저장 중 새 제목');
  expect(JSON.stringify(saved.contentJson)).toContain('저장 중 새 본문');
  expect(creates).toBe(1);
});

test('a delayed save cannot select or replace a different document', async ({ page }) => {
  await login(page);
  const first = fixturePost('save-safety-first', '첫 번째 글');
  const second = fixturePost('save-safety-second', '두 번째 글');
  let release = () => {};
  const pending = new Promise<void>(resolve => { release = resolve; });
  let requestStarted = () => {};
  const started = new Promise<void>(resolve => { requestStarted = resolve; });
  await page.route('**/api/posts**', async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() === 'GET' && path === '/api/posts') {
      await route.fulfill({ json: { posts: [first, second], total: 2 } });
    } else if (request.method() === 'PUT' && path === `/api/posts/${first.id}`) {
      requestStarted();
      await pending;
      await route.fulfill({ json: { ...first, ...request.postDataJSON(), updatedAt: '2026-09-12T02:00:00.000Z' } });
    } else if (path.endsWith('/revisions')) {
      await route.fulfill({ json: [] });
    } else await route.continue();
  });
  await page.goto(`/admin?section=posts&post=${first.id}`);
  const title = page.getByPlaceholder('제목을 입력하세요');
  await expect(title).toHaveValue(first.title);
  await title.fill('첫 번째 글 수정');
  await title.press('Control+s');
  await started;
  // Simulates a route/back-forward document switch without reloading the app.
  await page.evaluate(id => {
    history.pushState({}, '', `/admin?section=posts&post=${id}`);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, second.id);
  await expect(title).toHaveValue(second.title);
  await title.fill('두 번째 글의 새 입력');
  release();
  await expect(page.getByRole('button', { name: '초안 저장', exact: true })).toBeEnabled();
  await expect(page).toHaveURL(/post=save-safety-second/);
  await expect(title).toHaveValue('두 번째 글의 새 입력');
  await expect(page.locator('.ProseMirror')).toHaveText(`${second.title} 본문`);
});

test('failed saves keep current input and its browser recovery copy', async ({ page }) => {
  await login(page);
  const post = fixturePost('save-safety-failure', '실패 전 제목');
  await page.route('**/api/posts**', async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() === 'GET' && path === '/api/posts') {
      await route.fulfill({ json: { posts: [post], total: 1 } });
    } else if (request.method() === 'PUT') {
      await route.fulfill({ status: 500, json: { error: '저장 안전성 테스트 오류' } });
    } else if (path.endsWith('/revisions')) {
      await route.fulfill({ json: [] });
    } else await route.continue();
  });
  await page.goto(`/admin?section=posts&post=${post.id}`);
  const title = page.getByPlaceholder('제목을 입력하세요');
  await title.fill('실패 후에도 남아야 하는 제목');
  await title.press('Control+s');
  await expect(page.getByRole('button', { name: '초안 저장', exact: true })).toBeEnabled();
  await expect(title).toHaveValue('실패 후에도 남아야 하는 제목');
  await expect(page.getByText('저장되지 않은 변경', { exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(id => {
    const raw = localStorage.getItem(`hamlog_draft_${id}`);
    return raw ? JSON.parse(raw).draft.title : null;
  }, post.id)).toBe('실패 후에도 남아야 하는 제목');
});

test('deletion is single-flight and returns the editor to a new draft', async ({ page }) => {
  await login(page);
  const post = fixturePost('save-safety-delete', '삭제 검증 글');
  let release = () => {};
  const pending = new Promise<void>(resolve => { release = resolve; });
  let deletes = 0;
  await page.route('**/api/posts**', async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() === 'GET' && path === '/api/posts') {
      await route.fulfill({ json: { posts: [post], total: 1 } });
    } else if (request.method() === 'DELETE' && path === `/api/posts/${post.id}`) {
      deletes += 1;
      await pending;
      await route.fulfill({ status: 204 });
    } else if (path.endsWith('/revisions')) {
      await route.fulfill({ json: [] });
    } else await route.continue();
  });
  await page.goto(`/admin?section=posts&post=${post.id}`);
  await expect(page.getByPlaceholder('제목을 입력하세요')).toHaveValue(post.title);
  page.on('dialog', dialog => { void dialog.accept(); });
  await page.evaluate(() => {
    const button = document.querySelector<HTMLButtonElement>('button[aria-label="글 삭제"]');
    if (!button) throw new Error('Delete control not found');
    button.click();
    button.click();
  });
  await expect.poll(() => deletes).toBe(1);
  await expect(page.getByRole('button', { name: '글 삭제', exact: true })).toBeDisabled();
  release();
  await expect(page).not.toHaveURL(/post=save-safety-delete/);
  expect(deletes).toBe(1);
  // Successful deletion should also open the list, not just lose the selected ID.
  await expect(page.getByRole('button', { name: '편집기로 돌아가기', exact: true })).toBeVisible();
});

test('returning to a saved existing post still offers its newer local recovery copy', async ({ page }) => {
  await login(page);
  let first = fixturePost('save-safety-return-first', '복구 대상 글');
  const second = fixturePost('save-safety-return-second', '다른 글');
  await page.route('**/api/posts**', async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() === 'GET' && path === '/api/posts') {
      await route.fulfill({ json: { posts: [first, second], total: 2 } });
    } else if (request.method() === 'PUT' && path === `/api/posts/${first.id}`) {
      first = { ...first, ...request.postDataJSON(), updatedAt: '2026-09-12T02:00:00.000Z' };
      await route.fulfill({ json: first });
    } else if (path.endsWith('/revisions')) {
      await route.fulfill({ json: [] });
    } else await route.continue();
  });
  await page.goto(`/admin?section=posts&post=${first.id}`);
  const title = page.getByPlaceholder('제목을 입력하세요');
  await title.fill('서버에 저장된 제목');
  await title.press('Control+s');
  await expect(page.getByText('저장되지 않은 변경', { exact: true })).toBeHidden();
  await title.fill('돌아와서 복구할 최신 제목');
  const storedTitle = () => page.evaluate(id => {
    const raw = localStorage.getItem(`hamlog_draft_${id}`);
    return raw ? JSON.parse(raw).draft.title : null;
  }, first.id);
  await expect.poll(storedTitle).toBe('돌아와서 복구할 최신 제목');
  await page.evaluate(id => {
    history.pushState({}, '', `/admin?section=posts&post=${id}`);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, second.id);
  await expect(title).toHaveValue(second.title);
  await page.evaluate(id => {
    history.pushState({}, '', `/admin?section=posts&post=${id}`);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, first.id);
  await expect(title).toHaveValue('서버에 저장된 제목');
  const restore = page.getByTestId('post-command-bar').getByRole('button', { name: '복구', exact: true });
  await expect(restore).toBeVisible();
  await expect.poll(storedTitle).toBe('돌아와서 복구할 최신 제목');
  await restore.click();
  await expect(title).toHaveValue('돌아와서 복구할 최신 제목');
  await expect(page.getByText('저장되지 않은 변경', { exact: true })).toBeVisible();
});

for (const newerInput of [false, true]) {
  test(`a delayed successful save preserves an already-detected foreign recovery copy (${newerInput ? 'newer input' : 'unchanged input'})`, async ({ page }) => {
    await login(page);
    await page.clock.install({ time: new Date('2026-09-12T08:00:00.000Z') });
    let post = fixturePost(`save-safety-foreign-${newerInput}`, '외부 복구본 검증 글');
    let release = () => {};
    const pending = new Promise<void>(resolve => { release = resolve; });
    let writes = 0;
    await page.route('**/api/posts**', async route => {
      const request = route.request();
      const path = new URL(request.url()).pathname;
      if (request.method() === 'GET' && path === '/api/posts') {
        return route.fulfill({ json: { posts: [post], total: 1 } });
      }
      if (request.method() === 'GET' && path.endsWith('/revisions')) {
        return route.fulfill({ json: [] });
      }
      if (request.method() !== 'GET') writes += 1;
      if (request.method() === 'PUT' && path === `/api/posts/${post.id}`) {
        const submitted = request.postDataJSON();
        await pending;
        post = { ...post, ...submitted, updatedAt: '2026-09-12T02:00:00.000Z' };
        return route.fulfill({ json: post });
      }
      return route.fulfill({ status: 404, json: { error: 'Unexpected mocked save-safety request' } });
    });
    await page.goto(`/admin?section=posts&post=${post.id}`);
    const title = page.getByPlaceholder('제목을 입력하세요');
    await expect(title).toHaveValue(post.title);
    await page.clock.pauseAt(new Date('2026-09-12T10:00:00.000Z'));
    await title.fill('서버에 저장 요청한 제목');
    await title.press('Control+s');
    await expect.poll(() => writes).toBe(1);
    const expectedTitle = newerInput ? '서버 요청 이후 추가한 제목' : '서버에 저장 요청한 제목';
    if (newerInput) await title.fill(expectedTitle);

    const foreignRaw = JSON.stringify({
      draft: {
        title: '다른 탭에서 만든 복구본',
        contentHtml: '<p>서버 응답이 지우면 안 되는 외부 본문</p>',
        contentJson: documentFor('서버 응답이 지우면 안 되는 외부 본문')
      },
      updatedAt: '2026-09-12T09:59:59.000Z'
    });
    await page.evaluate(({ id, raw }) => {
      localStorage.setItem(`hamlog_draft_${id}`, raw);
      window.dispatchEvent(new Event('pagehide'));
    }, { id: post.id, raw: foreignRaw });
    const readRaw = () => page.evaluate(id => localStorage.getItem(`hamlog_draft_${id}`), post.id);
    await expect(page.getByTestId('browser-save-status')).toHaveText('브라우저 복구본 확인 필요');
    const restore = page.getByTestId('post-command-bar').getByRole('button', { name: '복구', exact: true });
    await expect(restore).toBeVisible();
    expect(await readRaw()).toBe(foreignRaw);

    // The local writer has already observed and blocked the foreign bytes. The
    // save reconciliation must retain that blocked state even though a raw-value
    // comparison now sees the same (last-observed) foreign payload.
    release();
    await expect(page.getByTestId('server-save-status')).toContainText('11:00:00');
    await expect(title).toHaveValue(expectedTitle);
    expect(post.title).toBe('서버에 저장 요청한 제목');
    expect(await readRaw()).toBe(foreignRaw);
    await expect(page.getByTestId('browser-save-status')).toHaveText('브라우저 복구본 확인 필요');
    await expect(restore).toBeVisible();
    await page.clock.runFor(2_001);
    await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
    expect(await readRaw()).toBe(foreignRaw);
    await expect(restore).toBeVisible();
    expect(writes).toBe(1);
  });
}
