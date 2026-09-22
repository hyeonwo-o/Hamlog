import { expect, test, type Locator, type Page, type Route } from '@playwright/test';
import type { ModeratedComment } from '../../src/types/comment';

const fixtureComment = (id: string, hidden = false): ModeratedComment => ({
  id, postId: `post-${id}`, author: `작성자 ${id}`, content: `댓글 본문 ${id}`,
  createdAt: '2026-09-22T01:00:00.000Z',
  moderation: { hidden, version: '2026-09-22T01:00:00.000Z' },
  post: { id: `post-${id}`, title: `원문 제목 ${id}`, status: 'published', publicVisible: true }
});

const deferred = () => {
  let resolve = () => {};
  const promise = new Promise<void>(done => { resolve = done; });
  return { promise, resolve };
};

async function mockAdmin(page: Page, handler: (route: Route) => Promise<void>) {
  await page.route('https://fonts.googleapis.com/**', route => route.fulfill({ contentType: 'text/css', body: '' }));
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const path = new URL(route.request().url()).pathname;
    if (path.startsWith('/api/comments/moderation')) return handler(route);
    if (path === '/api/auth/config') return route.fulfill({ json: { mode: 'password' } });
    if (path === '/api/auth/me') return route.fulfill({ json: { user: { role: 'admin' } } });
    if (path === '/api/posts') return route.fulfill({ json: { posts: [], total: 0 } });
    if (path === '/api/categories') return route.fulfill({ json: { categories: [], total: 0 } });
    return route.fulfill({ status: 404, json: { message: `Unmocked API: ${path}` } });
  });
  await page.goto('/admin?section=comments', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: '댓글 관리', exact: true })).toBeVisible();
}

async function listResponse(route: Route, items: ModeratedComment[]) {
  const params = new URL(route.request().url()).searchParams;
  const page = Number(params.get('page') ?? 1);
  const pageSize = Number(params.get('pageSize') ?? 20);
  const visibility = params.get('visibility') ?? 'all';
  const filtered = items.filter(comment => visibility === 'all' || comment.moderation.hidden === (visibility === 'hidden'));
  await route.fulfill({ json: {
    comments: filtered.slice((page - 1) * pageSize, page * pageSize), total: filtered.length,
    page, pageSize, hasMore: page * pageSize < filtered.length
  } });
}

async function callTwiceInSameTurn(button: Locator) {
  await button.evaluate(element => {
    // Exercise the mutation guard separately from React's disabled button state.
    const key = Object.keys(element).find(item => item.startsWith('__reactProps$'));
    if (!key) throw new Error('React action-button props not found');
    const action = (element as unknown as Record<string, { onClick: () => void }>)[key].onClick;
    action();
    action();
  });
}

test('moderation list retries errors, filters and paginates with plaintext content on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const items = Array.from({ length: 21 }, (_, index) => fixtureComment(String(index + 1), index === 20));
  items[0].content = '<img src=x onerror="window.__moderationXss = true">\n<script>alert("x")</script>';
  items[1].post = { ...items[1].post, status: 'draft', publicVisible: false };
  items[2].post = { ...items[2].post, status: 'trashed', publicVisible: false };
  const pending = deferred();
  let failReads = true;
  const reads: string[] = [];
  await mockAdmin(page, async route => {
    expect(route.request().method()).toBe('GET');
    reads.push(new URL(route.request().url()).search);
    await pending.promise;
    if (failReads) return route.fulfill({ status: 500, json: { message: '댓글 목록 읽기 오류' } });
    return listResponse(route, items);
  });
  await expect(page.getByRole('status')).toHaveText('댓글 목록을 불러오는 중입니다.');
  pending.resolve();
  await expect(page.getByRole('alert')).toContainText('댓글 목록 읽기 오류');
  failReads = false;
  await page.getByRole('button', { name: '댓글 목록 다시 시도', exact: true }).click();
  await expect(page.getByText('총 21개', { exact: true })).toBeVisible();
  const first = page.getByTestId('moderation-comment-1');
  await expect(first.getByText(items[0].content, { exact: true })).toBeVisible();
  await expect(first.locator('img, script')).toHaveCount(0);
  expect(await page.evaluate(() => '__moderationXss' in window)).toBe(false);
  await expect(page.getByTestId('moderation-comment-2')).toContainText('비공개 초안 · 원문 비공개');
  await expect(page.getByTestId('moderation-comment-3')).toContainText('휴지통 · 원문 비공개');
  await page.getByRole('button', { name: '다음 댓글', exact: true }).click();
  await expect(page.getByText('2 / 2 페이지', { exact: true })).toBeVisible();
  await expect(page.getByTestId('moderation-comment-21')).toBeVisible();
  await expect(page.getByRole('button', { name: '다음 댓글', exact: true })).toBeDisabled();
  await page.getByRole('combobox', { name: '댓글 표시 상태', exact: true }).selectOption('hidden');
  await expect(page.getByText('총 1개', { exact: true })).toBeVisible();
  await expect(page.getByText('1 / 1 페이지', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '숨김 해제', exact: true })).toBeVisible();
  await page.getByRole('combobox', { name: '댓글 표시 상태', exact: true }).selectOption('visible');
  await expect(page.getByText('총 20개', { exact: true })).toBeVisible();
  await expect(page.getByTestId('moderation-comment-21')).toHaveCount(0);
  expect(reads.some(query => query.includes('page=2'))).toBe(true);
  expect(reads.some(query => query.includes('visibility=hidden'))).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('hide and unhide are versioned single-flight operations without a commenter password', async ({ page }) => {
  let comment = fixtureComment('toggle');
  const pending = deferred();
  const writes: Array<Record<string, unknown>> = [];
  await mockAdmin(page, async route => {
    if (route.request().method() === 'GET') return listResponse(route, [comment]);
    expect(route.request().method()).toBe('PATCH');
    const body = route.request().postDataJSON() as Record<string, unknown>;
    expect(body.expectedVersion).toBe(comment.moderation.version);
    expect(body).not.toHaveProperty('password');
    writes.push(body);
    await pending.promise;
    comment = { ...comment, moderation: {
      hidden: Boolean(body.hidden), version: `2026-09-22T01:0${writes.length}:00.000Z`
    } };
    return route.fulfill({ json: { comment } });
  });
  const row = page.getByTestId('moderation-comment-toggle');
  await expect(row).toBeVisible();
  await callTwiceInSameTurn(row.getByRole('button', { name: '댓글 숨기기', exact: true }));
  await expect.poll(() => writes.length).toBe(1);
  await expect(row.getByRole('button', { name: '처리 중...', exact: true })).toBeDisabled();
  await expect(page.getByRole('combobox', { name: '댓글 표시 상태', exact: true })).toBeDisabled();
  pending.resolve();
  await expect(row.getByRole('button', { name: '숨김 해제', exact: true })).toBeEnabled();
  await expect(page.getByRole('status')).toContainText('댓글을 숨겼습니다.');
  expect(writes).toEqual([{ hidden: true, expectedVersion: '2026-09-22T01:00:00.000Z' }]);
  await row.getByRole('button', { name: '숨김 해제', exact: true }).click();
  await expect(row.getByRole('button', { name: '댓글 숨기기', exact: true })).toBeEnabled();
  expect(writes).toHaveLength(2);
  expect(writes[1]).toEqual({ hidden: false, expectedVersion: '2026-09-22T01:01:00.000Z' });
});

test('permanent deletion requires confirmation, supports keyboard cancellation and preserves other comments', async ({ page }) => {
  let items = [fixtureComment('delete'), fixtureComment('keep')];
  const pending = deferred();
  let deletes = 0;
  await mockAdmin(page, async route => {
    if (route.request().method() === 'GET') return listResponse(route, items);
    expect(route.request().method()).toBe('DELETE');
    expect(route.request().postDataJSON()).toEqual({ expectedVersion: items[0].moderation.version });
    deletes += 1;
    await pending.promise;
    items = items.filter(comment => comment.id !== 'delete');
    return route.fulfill({ status: 204 });
  });
  const row = page.getByTestId('moderation-comment-delete');
  const trigger = row.getByRole('button', { name: '댓글 영구삭제', exact: true });
  await trigger.click();
  const confirmation = row.getByRole('group', { name: '댓글 영구삭제 확인', exact: true });
  await expect(confirmation).toBeVisible();
  await expect(confirmation.getByRole('button', { name: '삭제 취소', exact: true })).toBeFocused();
  expect(deletes).toBe(0);
  await page.keyboard.press('Escape');
  await expect(confirmation).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await trigger.press('Enter');
  expect(deletes).toBe(0);
  await callTwiceInSameTurn(confirmation.getByRole('button', { name: '댓글 영구삭제 확인', exact: true }));
  await expect.poll(() => deletes).toBe(1);
  await expect(confirmation.getByRole('button', { name: '댓글 영구삭제 확인', exact: true })).toBeDisabled();
  pending.resolve();
  await expect(row).toHaveCount(0);
  await expect(page.getByTestId('moderation-comment-keep')).toContainText('댓글 본문 keep');
  await expect(page.getByRole('status')).toHaveText('댓글을 영구삭제했습니다.');
  await expect(page.getByRole('heading', { name: '댓글 관리', exact: true })).toBeFocused();
  expect(deletes).toBe(1);
});

test('conflicting moderation refreshes the latest version and never automatically repeats a write', async ({ page }) => {
  let comment = fixtureComment('conflict');
  const writes: Array<Record<string, unknown>> = [];
  await mockAdmin(page, async route => {
    if (route.request().method() === 'GET') return listResponse(route, [comment]);
    const body = route.request().postDataJSON() as Record<string, unknown>;
    writes.push(body);
    if (writes.length === 1) {
      comment = { ...comment, moderation: { hidden: true, version: '2026-09-22T02:00:00.000Z' } };
      return route.fulfill({ status: 409, json: { message: '다른 관리자가 댓글 상태를 변경했습니다.' } });
    }
    expect(body.expectedVersion).toBe('2026-09-22T02:00:00.000Z');
    comment = { ...comment, moderation: { hidden: false, version: '2026-09-22T03:00:00.000Z' } };
    return route.fulfill({ json: { comment } });
  });
  const row = page.getByTestId('moderation-comment-conflict');
  await row.getByRole('button', { name: '댓글 숨기기', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('다른 관리자가 댓글 상태를 변경했습니다.');
  await expect(row.getByRole('button', { name: '숨김 해제', exact: true })).toBeEnabled();
  expect(writes).toHaveLength(1);
  await row.getByRole('button', { name: '숨김 해제', exact: true }).click();
  await expect(row.getByRole('button', { name: '댓글 숨기기', exact: true })).toBeEnabled();
  await expect(page.getByRole('alert')).toHaveCount(0);
  expect(writes).toHaveLength(2);
});

test('an uncertain write blocks further actions until a fresh moderation list is available', async ({ page }) => {
  const comment = fixtureComment('uncertain');
  let failReads = false;
  let writes = 0;
  await mockAdmin(page, async route => {
    if (route.request().method() === 'GET') {
      if (failReads) return route.fulfill({ status: 500, json: { message: '목록 재확인 실패' } });
      return listResponse(route, [comment]);
    }
    writes += 1;
    failReads = true;
    return route.fulfill({ status: 500, json: { message: '댓글 변경 응답 실패' } });
  });
  const row = page.getByTestId('moderation-comment-uncertain');
  await row.getByRole('button', { name: '댓글 숨기기', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('목록을 다시 불러온 뒤 진행해 주세요.');
  await expect(row.getByRole('button', { name: '댓글 숨기기', exact: true })).toBeDisabled();
  await expect(row.getByRole('button', { name: '댓글 영구삭제', exact: true })).toBeDisabled();
  expect(writes).toBe(1);
  failReads = false;
  await page.getByRole('button', { name: '댓글 목록 다시 시도', exact: true }).click();
  await expect(row.getByRole('button', { name: '댓글 숨기기', exact: true })).toBeEnabled();
  await expect(page.getByRole('alert')).toHaveCount(0);
  expect(writes).toBe(1);
});
