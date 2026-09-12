import { expect, test, type Page, type Route } from '@playwright/test';

const documentFor = (text: string) => ({
  type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }]
});

const fixturePost = (id: string, title: string) => ({
  id, title, slug: id, summary: '현재 요약', category: '일상',
  contentJson: documentFor(`${title} 본문`), contentHtml: `<p>${title} 본문</p>`,
  publishedAt: '2026-09-12', tags: ['현재'], sections: [], featured: false,
  status: 'draft', updatedAt: '2026-09-12T01:00:00.000Z'
});

const revisionsFor = (post: ReturnType<typeof fixturePost>, count = 7) => Array.from({ length: count }, (_, index) => ({
  id: `${post.id}-revision-${index + 1}`, postId: post.id,
  savedAt: `2026-09-0${7 - index}T01:00:00.000Z`, event: 'updated',
  title: `${post.title} 이전 ${index + 1}`, slug: `${post.slug}-previous-${index + 1}`, status: 'draft'
}));

const detailFor = (post: ReturnType<typeof fixturePost>, revision: ReturnType<typeof revisionsFor>[number]) => ({
  ...revision,
  snapshot: {
    ...post, title: revision.title, slug: revision.slug, summary: '이전 요약', tags: ['이전'],
    contentJson: documentFor(`${revision.title} 이전 본문`),
    contentHtml: `<p>${revision.title} 이전 본문</p>`
  }
});

async function login(page: Page) {
  await page.setViewportSize({ width: 1800, height: 1100 });
  const response = await page.request.post('/api/auth/login', {
    data: { password: process.env.ADMIN_PASSWORD ?? 'e2e-password' }
  });
  expect(response.ok()).toBe(true);
}

async function openHistory(page: Page) {
  const openInspector = page.getByRole('button', { name: '글 설정 열기', exact: true });
  if (await openInspector.isVisible()) await openInspector.click();
  const toggle = page.getByRole('button', { name: /^리비전/ });
  if (await toggle.getAttribute('aria-expanded') !== 'true') await toggle.click();
}

async function navigatePost(page: Page, id: string) {
  await page.evaluate(postId => {
    history.pushState({}, '', `/admin?section=posts&post=${postId}`);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, id);
}

async function rejectUnexpectedMutation(route: Route, mutations: string[]) {
  mutations.push(`${route.request().method()} ${new URL(route.request().url()).pathname}`);
  await route.fulfill({ status: 500, json: { error: 'Unexpected mutation in read-only revision test' } });
}

test('revision history expands beyond five and previews metadata and text without writing', async ({ page }) => {
  await login(page);
  const post = fixturePost('revision-preview', '현재 편집 글');
  const revisions = revisionsFor(post);
  const mutations: string[] = [];
  await page.route('**/api/posts**', async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() !== 'GET') return rejectUnexpectedMutation(route, mutations);
    if (path === '/api/posts') return route.fulfill({ json: { posts: [post], total: 1 } });
    if (path === `/api/posts/${post.id}/revisions`) return route.fulfill({ json: revisions });
    const revision = revisions.find(item => path.endsWith(`/${item.id}`));
    if (revision) return route.fulfill({ json: detailFor(post, revision) });
    return route.continue();
  });
  await page.goto(`/admin?section=posts&post=${post.id}`);
  await openHistory(page);
  const previewButtons = page.getByRole('button', { name: '미리보기 및 비교', exact: true });
  await expect(previewButtons).toHaveCount(5);
  await page.getByRole('button', { name: '전체 이력 보기 (7개)', exact: true }).click();
  await expect(previewButtons).toHaveCount(7);
  await previewButtons.last().click();
  const comparison = page.getByLabel('저장 이력 비교', { exact: true });
  await expect(comparison).toContainText('저장본 → 현재 편집본');
  await expect(comparison).toContainText('이전: 현재 편집 글 이전 7');
  await expect(comparison).toContainText('현재: 현재 편집 글');
  await expect(comparison).toContainText('이전: 이전 요약');
  await expect(comparison).toContainText('문단 추가 1개 / 삭제 1개');
  await expect(comparison).toContainText('− 삭제 현재 편집 글 이전 7 이전 본문');
  await expect(comparison).toContainText('+ 추가 현재 편집 글 본문');
  await comparison.getByText('저장본 전체 텍스트 미리보기', { exact: true }).click();
  await expect(comparison.locator('pre')).toHaveText('현재 편집 글 이전 7 이전 본문');
  await expect(comparison.locator('[contenteditable="true"]')).toHaveCount(0);
  await expect(page.getByPlaceholder('제목을 입력하세요')).toHaveValue(post.title);
  await expect(page.locator('.ProseMirror')).toHaveText(`${post.title} 본문`);
  await page.getByRole('button', { name: '최근 5개만 보기', exact: true }).click();
  await expect(previewButtons).toHaveCount(5);
  await comparison.getByRole('button', { name: '비교 닫기', exact: true }).click();
  await expect(comparison).toBeHidden();
  expect(mutations).toEqual([]);
});

test('an older comparison response is ignored after selecting another revision', async ({ page }) => {
  await login(page);
  const post = fixturePost('revision-selection', '선택 변경 글');
  const revisions = revisionsFor(post, 2);
  let release = () => {};
  const pending = new Promise<void>(resolve => { release = resolve; });
  let oldDetailRequests = 0;
  const mutations: string[] = [];
  await page.route('**/api/posts**', async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() !== 'GET') return rejectUnexpectedMutation(route, mutations);
    if (path === '/api/posts') return route.fulfill({ json: { posts: [post], total: 1 } });
    if (path === `/api/posts/${post.id}/revisions`) return route.fulfill({ json: revisions });
    if (path.endsWith(`/${revisions[0].id}`)) {
      oldDetailRequests += 1;
      await pending;
      return route.fulfill({ json: detailFor(post, revisions[0]) }).catch(() => {});
    }
    if (path.endsWith(`/${revisions[1].id}`)) return route.fulfill({ json: detailFor(post, revisions[1]) });
    return route.continue();
  });
  await page.goto(`/admin?section=posts&post=${post.id}`);
  await openHistory(page);
  const buttons = page.getByRole('button', { name: '미리보기 및 비교', exact: true });
  await buttons.first().click();
  await expect.poll(() => oldDetailRequests).toBe(1);
  await buttons.nth(1).click();
  const comparison = page.getByLabel('저장 이력 비교', { exact: true });
  await expect(comparison).toContainText('이전: 선택 변경 글 이전 2');
  release();
  await expect(buttons.nth(1)).toHaveAttribute('aria-pressed', 'true');
  await expect(comparison).toContainText('이전: 선택 변경 글 이전 2');
  await expect(comparison).not.toContainText('이전: 선택 변경 글 이전 1');
  expect(mutations).toEqual([]);
});

test('late revision lists and details never leak into a different post', async ({ page }) => {
  await login(page);
  const first = fixturePost('revision-switch-first', '이전 글');
  const second = fixturePost('revision-switch-second', '현재 글');
  const firstRevisions = revisionsFor(first, 1);
  const secondRevisions = revisionsFor(second, 1);
  let releaseList = () => {};
  const pendingList = new Promise<void>(resolve => { releaseList = resolve; });
  let releaseDetail = () => {};
  const pendingDetail = new Promise<void>(resolve => { releaseDetail = resolve; });
  let firstLists = 0;
  let firstDetails = 0;
  const mutations: string[] = [];
  await page.route('**/api/posts**', async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() !== 'GET') return rejectUnexpectedMutation(route, mutations);
    if (path === '/api/posts') return route.fulfill({ json: { posts: [first, second], total: 2 } });
    if (path === `/api/posts/${first.id}/revisions`) {
      firstLists += 1;
      if (firstLists === 1) await pendingList;
      return route.fulfill({ json: firstRevisions }).catch(() => {});
    }
    if (path === `/api/posts/${second.id}/revisions`) return route.fulfill({ json: secondRevisions });
    if (path.endsWith(`/${firstRevisions[0].id}`)) {
      firstDetails += 1;
      await pendingDetail;
      return route.fulfill({ json: detailFor(first, firstRevisions[0]) }).catch(() => {});
    }
    if (path.endsWith(`/${secondRevisions[0].id}`)) return route.fulfill({ json: detailFor(second, secondRevisions[0]) });
    return route.continue();
  });
  await page.goto(`/admin?section=posts&post=${first.id}`);
  await expect.poll(() => firstLists).toBe(1);
  await navigatePost(page, second.id);
  await expect(page.getByPlaceholder('제목을 입력하세요')).toHaveValue(second.title);
  await openHistory(page);
  await expect(page.getByText('현재 글 이전 1', { exact: true })).toBeVisible();
  releaseList();
  await expect(page.getByText('이전 글 이전 1', { exact: true })).toBeHidden();

  await navigatePost(page, first.id);
  await expect(page.getByPlaceholder('제목을 입력하세요')).toHaveValue(first.title);
  await openHistory(page);
  await page.getByRole('button', { name: '미리보기 및 비교', exact: true }).click();
  await expect.poll(() => firstDetails).toBe(1);
  await navigatePost(page, second.id);
  await expect(page.getByPlaceholder('제목을 입력하세요')).toHaveValue(second.title);
  await openHistory(page);
  await page.getByRole('button', { name: '미리보기 및 비교', exact: true }).click();
  const comparison = page.getByLabel('저장 이력 비교', { exact: true });
  await expect(comparison).toContainText('이전: 현재 글 이전 1');
  releaseDetail();
  await expect(comparison).not.toContainText('이전 글 이전 1');
  await expect(comparison).toContainText('이전: 현재 글 이전 1');
  expect(mutations).toEqual([]);
});

test('restore sends the server version and preserves typing made while restore is pending', async ({ page }) => {
  await login(page);
  let post = fixturePost('revision-restore-safe', '복구 전 현재 글');
  const revisions = revisionsFor(post, 1);
  const detail = detailFor(post, revisions[0]);
  let release = () => {};
  const pending = new Promise<void>(resolve => { release = resolve; });
  let restoreRequests = 0;
  let saveRequests = 0;
  let expectedVersion: unknown;
  await page.route('**/api/posts**', async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() === 'GET' && path === '/api/posts') {
      return route.fulfill({ json: { posts: [post], total: 1 } });
    }
    if (request.method() === 'GET' && path === `/api/posts/${post.id}/revisions`) {
      return route.fulfill({ json: revisions });
    }
    if (request.method() === 'GET' && path.endsWith(`/${revisions[0].id}`)) {
      return route.fulfill({ json: detail });
    }
    if (request.method() === 'POST' && path.endsWith(`/${revisions[0].id}/restore`)) {
      restoreRequests += 1;
      expectedVersion = request.postDataJSON().expectedUpdatedAt;
      await pending;
      post = { ...detail.snapshot, updatedAt: '2026-09-12T03:00:00.000Z' };
      return route.fulfill({ json: post });
    }
    if (request.method() === 'PUT' && path === `/api/posts/${post.id}`) {
      saveRequests += 1;
      const body = request.postDataJSON();
      expect(body.expectedUpdatedAt).toBe('2026-09-12T03:00:00.000Z');
      post = { ...post, ...body, updatedAt: '2026-09-12T04:00:00.000Z' };
      return route.fulfill({ json: post });
    }
    if (request.method() !== 'GET') return route.fulfill({ status: 500, json: { error: 'Unexpected revision mutation' } });
    return route.continue();
  });
  await page.goto(`/admin?section=posts&post=${post.id}`);
  await openHistory(page);
  await page.getByRole('button', { name: '미리보기 및 비교', exact: true }).click();
  const comparison = page.getByLabel('저장 이력 비교', { exact: true });
  page.on('dialog', dialog => { void dialog.accept(); });
  await comparison.getByRole('button', { name: '이 리비전 복구', exact: true }).click();
  await expect.poll(() => restoreRequests).toBe(1);
  expect(expectedVersion).toBe('2026-09-12T01:00:00.000Z');
  const title = page.getByPlaceholder('제목을 입력하세요');
  const editor = page.locator('.ProseMirror');
  await title.fill('복구 중 입력한 최신 제목');
  await editor.fill('복구 중 입력한 최신 본문');
  await editor.press('Control+s');
  expect(saveRequests).toBe(0);
  release();
  await expect(page.getByText('서버의 저장본은 복구했지만 새 입력은 덮어쓰지 않았습니다. 최신 저장본을 확인해 주세요.', { exact: true })).toBeVisible();
  await expect(title).toHaveValue('복구 중 입력한 최신 제목');
  await expect(editor).toHaveText('복구 중 입력한 최신 본문');
  await expect(page.getByText('저장되지 않은 변경', { exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(id => {
    const raw = localStorage.getItem(`hamlog_draft_${id}`);
    return raw ? JSON.parse(raw).draft.title : null;
  }, post.id)).toBe('복구 중 입력한 최신 제목');
  await editor.press('Control+s');
  await expect.poll(() => saveRequests).toBe(1);
  await expect(page.getByText('저장되지 않은 변경', { exact: true })).toBeHidden();
  expect(post.title).toBe('복구 중 입력한 최신 제목');
  expect(JSON.stringify(post.contentJson)).toContain('복구 중 입력한 최신 본문');
  expect(restoreRequests).toBe(1);
});
