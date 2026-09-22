import { expect, test, type Page, type Route } from '@playwright/test';

const fixturePost = (id: string) => ({
  id, slug: id, title: '서버에서 불러온 제목', summary: '불러오기 안전성 검증', category: '일상',
  contentJson: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: '서버 본문' }] }] },
  contentHtml: '<p>서버 본문</p>', publishedAt: '2026-09-22', tags: [], sections: [],
  featured: false, status: 'draft', updatedAt: '2026-09-22T01:00:00.000Z'
});

const deferred = () => {
  let resolve = () => {};
  const promise = new Promise<void>(done => { resolve = done; });
  return { promise, resolve };
};

async function mockSession(page: Page) {
  const session = { authenticated: true };
  await page.route('**/api/auth/**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/config')) return route.fulfill({ json: { mode: 'password' } });
    if (path.endsWith('/login')) session.authenticated = true;
    return route.fulfill({
      status: session.authenticated ? 200 : 401,
      json: session.authenticated ? { user: { role: 'admin' } } : { message: '세션 만료' }
    });
  });
  await page.route('**/api/categories', route => route.fulfill({ json: { categories: [] } }));
  return session;
}

async function mockPosts(page: Page, list: (route: Route) => Promise<void>) {
  await page.route('**/api/posts**', async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() === 'GET' && path === '/api/posts') return list(route);
    if (request.method() === 'GET' && path.endsWith('/revisions')) return route.fulfill({ json: [] });
    return route.fulfill({ status: 405, json: { message: '이 검증은 읽기 전용입니다.' } });
  });
}

test('a direct requested post has no editable blank form before its delayed full read resolves', async ({ page }) => {
  await mockSession(page);
  await page.setViewportSize({ width: 390, height: 844 });
  const post = fixturePost('loading-delayed-post');
  const pending = deferred();
  const started = deferred();
  const unrelatedRecovery = JSON.stringify({ draft: { title: '보관할 새 글', contentHtml: '<p>보관할 본문</p>' }, updatedAt: '2026-09-22T00:00:00.000Z' });
  await page.addInitScript(raw => localStorage.setItem('hamlog_draft_new', raw), unrelatedRecovery);
  let writes = 0;
  page.on('request', request => {
    if (new URL(request.url()).pathname.startsWith('/api/posts') && request.method() !== 'GET') writes += 1;
  });
  await mockPosts(page, async route => {
    started.resolve();
    await pending.promise;
    await route.fulfill({ json: { posts: [post], total: 1 } });
  });
  await page.goto(`/admin?post=${post.id}`);
  await started.promise;
  await expect(page.getByTestId('admin-post-load-state')).toContainText('선택한 글을 불러오는 중');
  await expect(page.getByPlaceholder('제목을 입력하세요')).toHaveCount(0);
  await expect(page.locator('.ProseMirror')).toHaveCount(0);
  await expect(page.getByTestId('post-command-bar')).toHaveCount(0);
  // A public summary for this same ID is still not a verified editable body.
  await page.evaluate(async post => {
    const modulePath = '/src/store/postStore.ts';
    const { usePostStore } = await import(modulePath);
    usePostStore.setState({ posts: [{ ...post, contentJson: undefined, contentHtml: undefined }], hasLoaded: true, loadedMode: 'summary' });
  }, post);
  await expect(page.getByPlaceholder('제목을 입력하세요')).toHaveCount(0);
  await page.keyboard.press('Control+s');
  expect(await page.evaluate(() => localStorage.getItem('hamlog_draft_new'))).toBe(unrelatedRecovery);
  expect(writes).toBe(0);
  pending.resolve();
  await expect(page.getByPlaceholder('제목을 입력하세요')).toHaveValue(post.title);
  await expect(page.locator('.ProseMirror')).toHaveText('서버 본문');
  await expect(page.getByTestId('admin-post-load-state')).toHaveCount(0);
  await expect(page).toHaveURL(new RegExp(`post=${post.id}`));
  expect(await page.evaluate(() => localStorage.getItem('hamlog_draft_new'))).toBe(unrelatedRecovery);
});

test('an initial read failure preserves the URL and recovery copy with a visible mobile retry', async ({ page }) => {
  await mockSession(page);
  await page.setViewportSize({ width: 390, height: 844 });
  const post = fixturePost('loading-retry-post');
  const key = `hamlog_draft_${post.id}`;
  const raw = JSON.stringify({ draft: { title: '복구할 제목', contentHtml: '<p>복구할 본문</p>' }, updatedAt: '2026-09-22T02:00:00.000Z', baseUpdatedAt: post.updatedAt });
  await page.addInitScript(({ key, raw }) => localStorage.setItem(key, raw), { key, raw });
  let reads = 0;
  await mockPosts(page, async route => {
    reads += 1;
    await route.fulfill(reads === 1
      ? { status: 503, json: { message: '일시적인 읽기 오류' } }
      : { json: { posts: [post], total: 1 } });
  });
  await page.goto(`/admin?section=posts&post=${post.id}`);
  const state = page.getByTestId('admin-post-load-state');
  await expect(state).toContainText('선택한 글을 불러오지 못했습니다.');
  await expect(state.getByRole('button', { name: '다시 시도', exact: true })).toBeInViewport();
  await expect(page.getByPlaceholder('제목을 입력하세요')).toHaveCount(0);
  await expect(page).toHaveURL(new RegExp(`post=${post.id}`));
  const storeState = await page.evaluate(async () => {
    const modulePath = '/src/store/postStore.ts';
    const { usePostStore } = await import(modulePath);
    const state = usePostStore.getState();
    return { hasLoaded: state.hasLoaded, loadedMode: state.loadedMode, loading: state.loading };
  });
  expect(storeState).toEqual({ hasLoaded: false, loadedMode: 'none', loading: false });
  // A read error must wait for explicit retry rather than starting a request loop.
  await page.waitForTimeout(250);
  expect(reads).toBe(1);
  expect(await page.evaluate(key => localStorage.getItem(key), key)).toBe(raw);
  await state.getByRole('button', { name: '다시 시도', exact: true }).click();
  await expect(page.getByPlaceholder('제목을 입력하세요')).toHaveValue(post.title);
  await page.getByTestId('post-command-bar').getByRole('button', { name: '복구', exact: true }).click();
  await expect(page.getByPlaceholder('제목을 입력하세요')).toHaveValue('복구할 제목');
  await expect(page.locator('.ProseMirror')).toHaveText('복구할 본문');
  expect(reads).toBe(2);
});

test('a successful missing-post read is not mistaken for a new document or an error', async ({ page }) => {
  await mockSession(page);
  await mockPosts(page, route => route.fulfill({ json: { posts: [], total: 0 } }));
  await page.goto('/admin?section=posts&post=missing-requested-post');
  const state = page.getByTestId('admin-post-load-state');
  await expect(state).toContainText('선택한 글을 찾을 수 없습니다.');
  await expect(state).not.toContainText('불러오지 못했습니다');
  await expect(page).toHaveURL(/post=missing-requested-post/);
  await expect(page.getByPlaceholder('제목을 입력하세요')).toHaveCount(0);
  await state.getByRole('button', { name: '새 글 작성', exact: true }).click();
  await expect(page).not.toHaveURL(/post=/);
  await expect(page.getByPlaceholder('제목을 입력하세요')).toHaveValue('');
});

test('background refresh loading, failure and a missing list entry never unmount the active dirty editor', async ({ page }) => {
  await mockSession(page);
  await page.setViewportSize({ width: 1700, height: 1000 });
  const post = fixturePost('loading-background-post');
  const pending = deferred();
  let reads = 0;
  await mockPosts(page, async route => {
    reads += 1;
    if (reads === 1) return route.fulfill({ json: { posts: [post], total: 1 } });
    if (reads === 2) {
      await pending.promise;
      return route.fulfill({ status: 503, json: { message: '목록 갱신 오류' } });
    }
    return route.fulfill({ json: { posts: [], total: 0 } });
  });
  await page.goto(`/admin?section=posts&post=${post.id}`);
  const title = page.getByPlaceholder('제목을 입력하세요');
  await expect(title).toHaveValue(post.title);
  await title.fill('유지되어야 할 편집 제목');
  await page.locator('.ProseMirror').fill('유지되어야 할 편집 본문');
  await title.evaluate(element => element.setAttribute('data-editor-instance', 'original'));
  await page.getByRole('button', { name: '새로고침', exact: true }).click();
  await expect.poll(() => reads).toBe(2);
  await expect(title).toHaveAttribute('data-editor-instance', 'original');
  await expect(title).toHaveValue('유지되어야 할 편집 제목');
  await expect(page.getByTestId('admin-post-load-state')).toHaveCount(0);
  pending.resolve();
  const error = page.getByTestId('admin-post-refresh-error');
  await expect(error).toBeVisible();
  await expect(title).toHaveValue('유지되어야 할 편집 제목');
  await error.getByRole('button', { name: '다시 시도', exact: true }).click();
  await expect.poll(() => reads).toBe(3);
  await expect(error).toHaveCount(0);
  await expect(title).toHaveAttribute('data-editor-instance', 'original');
  await expect(title).toHaveValue('유지되어야 할 편집 제목');
  await expect(page.locator('.ProseMirror')).toHaveText('유지되어야 할 편집 본문');
  await expect(page).toHaveURL(new RegExp(`post=${post.id}`));
  await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
  expect(await page.evaluate(id => JSON.parse(localStorage.getItem(`hamlog_draft_${id}`) ?? 'null')?.draft.title, post.id)).toBe('유지되어야 할 편집 제목');
});

test('a new draft remains editable during an unrelated delayed list read', async ({ page }) => {
  await mockSession(page);
  const pending = deferred();
  await mockPosts(page, async route => {
    await pending.promise;
    await route.fulfill({ json: { posts: [], total: 0 } });
  });
  await page.goto('/admin?section=posts');
  const title = page.getByPlaceholder('제목을 입력하세요');
  await title.fill('목록과 독립적인 새 초안');
  await page.locator('.ProseMirror').fill('새 초안의 본문');
  const response = page.waitForResponse(response => new URL(response.url()).pathname === '/api/posts');
  pending.resolve();
  await response;
  await expect(title).toHaveValue('목록과 독립적인 새 초안');
  await expect(page.locator('.ProseMirror')).toHaveText('새 초안의 본문');
});

test('creating during a summary-to-full read verifies only the new document and keeps its newer input mounted', async ({ page }) => {
  await mockSession(page);
  const existing = fixturePost('loading-unverified-summary');
  const created = fixturePost('loading-confirmed-created');
  const firstRead = deferred();
  const secondRead = deferred();
  const create = deferred();
  let reads = 0;
  let creates = 0;
  await page.route('**/api/posts**', async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() === 'GET' && path === '/api/posts') {
      reads += 1;
      const readNumber = reads;
      await (readNumber === 1 ? firstRead.promise : secondRead.promise);
      return route.fulfill({ json: { posts: readNumber === 1 ? [existing] : [existing, created], total: readNumber === 1 ? 1 : 2 } });
    }
    if (request.method() === 'POST' && path === '/api/posts') {
      creates += 1;
      const submitted = request.postDataJSON();
      await create.promise;
      return route.fulfill({ status: 201, json: { ...created, ...submitted } });
    }
    if (request.method() === 'GET' && path.endsWith('/revisions')) return route.fulfill({ json: [] });
    return route.fulfill({ status: 405, json: { message: 'Unexpected write' } });
  });
  await page.goto('/admin?section=posts');
  await expect.poll(() => reads).toBe(1);
  await page.evaluate(async post => {
    const modulePath = '/src/store/postStore.ts';
    const { usePostStore } = await import(modulePath);
    usePostStore.setState({ posts: [{ ...post, contentJson: undefined, contentHtml: undefined }], hasLoaded: true, loadedMode: 'summary', fullPostIds: [] });
  }, existing);
  const title = page.getByPlaceholder('제목을 입력하세요');
  await title.fill('새 글의 첫 저장');
  await title.evaluate(element => element.setAttribute('data-editor-instance', 'created-draft'));
  await title.press('Control+s');
  await expect.poll(() => creates).toBe(1);
  await title.fill('저장 요청 이후의 새 입력');
  create.resolve();
  await expect(page).toHaveURL(new RegExp(`post=${created.id}`));
  await expect.poll(() => reads).toBe(2);
  await expect(title).toHaveValue('저장 요청 이후의 새 입력');
  await expect(title).toHaveAttribute('data-editor-instance', 'created-draft');
  const completeness = await page.evaluate(async () => {
    const modulePath = '/src/store/postStore.ts';
    const { usePostStore } = await import(modulePath);
    const state = usePostStore.getState();
    return { loadedMode: state.loadedMode, fullPostIds: state.fullPostIds };
  });
  expect(completeness).toEqual({ loadedMode: 'summary', fullPostIds: [created.id] });
  // The old read predates the create and must still be discarded.
  firstRead.resolve();
  page.on('dialog', dialog => { void dialog.accept(); });
  await page.evaluate(id => {
    history.pushState({}, '', `/admin?section=posts&post=${id}`);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, existing.id);
  await expect(page.getByTestId('admin-post-load-state')).toContainText('선택한 글을 불러오는 중');
  await expect(title).toHaveCount(0);
  await expect.poll(() => page.evaluate(id => JSON.parse(localStorage.getItem(`hamlog_draft_${id}`) ?? 'null')?.draft.title, created.id)).toBe('저장 요청 이후의 새 입력');
  secondRead.resolve();
  await expect(title).toHaveValue(existing.title);
  await expect(page.locator('.ProseMirror')).toHaveText('서버 본문');
  expect(creates).toBe(1);
});

for (const action of ['save', 'delete'] as const) {
  test(`expired authentication during ${action} returns to the same document and keeps browser recovery`, async ({ page }) => {
    const session = await mockSession(page);
    const post = fixturePost(`loading-reauth-${action}`);
    let writes = 0;
    await page.route('**/api/posts**', async route => {
      const request = route.request();
      const path = new URL(request.url()).pathname;
      if (request.method() === 'GET' && path === '/api/posts') return route.fulfill({ json: { posts: [post], total: 1 } });
      if (request.method() === 'GET' && path.endsWith('/revisions')) return route.fulfill({ json: [] });
      writes += 1;
      session.authenticated = false;
      return route.fulfill({ status: 401, json: { message: '세션 만료' } });
    });
    page.on('dialog', dialog => { void dialog.accept(); });
    await page.goto(`/admin?section=posts&post=${post.id}&returnTo=https%3A%2F%2Fexample.invalid%2Fescape&redirect=%2F%2Fevil.invalid`);
    const originalOrigin = new URL(page.url()).origin;
    const title = page.getByPlaceholder('제목을 입력하세요');
    await expect(title).toHaveValue(post.title);
    await title.fill('다시 로그인한 뒤 복구할 제목');
    await page.locator('.ProseMirror').fill('인증이 만료되어도 복구할 본문');
    // Exercise the lifecycle flush rather than waiting for the debounce timer.
    if (action === 'save') await title.press('Control+s');
    else await page.getByRole('button', { name: '글 삭제', exact: true }).click();
    await expect(page.getByLabel('관리자 비밀번호', { exact: true })).toBeVisible();
    const returnUrl = new URL(page.url());
    expect(returnUrl.origin).toBe(originalOrigin);
    expect(returnUrl.pathname).toBe('/admin');
    expect(returnUrl.searchParams.get('section')).toBe('posts');
    expect(returnUrl.searchParams.get('post')).toBe(post.id);
    expect(returnUrl.searchParams.get('auth')).toBe('required');
    expect(returnUrl.searchParams.has('returnTo')).toBe(false);
    expect(returnUrl.searchParams.has('redirect')).toBe(false);
    const recovery = await page.evaluate(id => JSON.parse(localStorage.getItem(`hamlog_draft_${id}`) ?? 'null'), post.id);
    expect(recovery.draft.title).toBe('다시 로그인한 뒤 복구할 제목');
    expect(recovery.baseUpdatedAt).toBe(post.updatedAt);
    await page.getByLabel('관리자 비밀번호', { exact: true }).fill('test-password');
    await page.getByRole('button', { name: '로그인', exact: true }).click();
    await expect(page).not.toHaveURL(/auth=required/);
    await expect(page).toHaveURL(new RegExp(`post=${post.id}`));
    await page.getByTestId('post-command-bar').getByRole('button', { name: '복구', exact: true }).click();
    await expect(title).toHaveValue('다시 로그인한 뒤 복구할 제목');
    await expect(page.locator('.ProseMirror')).toHaveText('인증이 만료되어도 복구할 본문');
    expect(writes).toBe(1);
  });
}
