import { expect, test, type Page } from '@playwright/test';

const backendOrigin = `http://127.0.0.1:${process.env.E2E_API_PORT ?? process.env.PORT ?? '4100'}`;
const resultPost = (id: string, title: string) => ({
  id, slug: id, title, summary: '요약에는 검색어가 없습니다.', category: '검색 테스트',
  publishedAt: '2026-01-01', tags: [], status: 'published', views: 0,
  searchExcerpt: `${title} 명령어를 본문에서 찾았습니다.`
});
const searchInput = (page: Page) => page.getByRole('searchbox', { name: '글 검색' });
const results = (page: Page) => page.locator('#post-search-results');

test('body search highlights matches and retains query and category after reading and reloading', async ({ page, request }) => {
  const unique = Date.now().toString();
  const query = `ERR_CONNECTION_${unique}`;
  const title = `네트워크 문제 해결 기록 ${unique}`;
  const category = `인프라 ${unique}`;
  const login = await request.post(`${backendOrigin}/api/auth/login`, {
    data: { password: process.env.ADMIN_PASSWORD ?? 'e2e-password' }
  });
  expect(login.ok()).toBe(true);
  const cookie = login.headers()['set-cookie']?.split(';', 1)[0] ?? '';
  const headers = { Cookie: cookie, Origin: backendOrigin };
  const created = await request.post(`${backendOrigin}/api/posts`, {
    headers,
    data: {
      title, slug: `search-body-${unique}`, category, summary: '연결 문제의 원인과 해결 방법을 정리합니다.',
      contentJson: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: `설정 확인 후 ${query} 오류를 해결했습니다.` }] }] },
      status: 'published', publishedAt: '2026-01-01', tags: []
    }
  });
  expect(created.status()).toBe(201);
  const post = await created.json();
  try {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/?q=${encodeURIComponent(`  ${query}  `)}&category=${encodeURIComponent(category)}`);
    await expect(searchInput(page)).toHaveValue(`  ${query}  `);
    const card = results(page).locator(`a[href="/posts/${post.slug}"]`);
    await expect(card).toBeVisible();
    await expect(card.locator('mark')).toHaveText(query);
    await expect(results(page)).toHaveAttribute('aria-busy', 'false');
    await expect(page.getByRole('heading', { name: '조건에 맞는 글이 없어요' })).toBeHidden();
    await page.screenshot({ path: test.info().outputPath('body-search-mobile.png') });
    await card.click();
    await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
    await page.getByRole('link', { name: '메인화면으로 돌아가기' }).click();
    await expect(card).toBeVisible();
    await expect(searchInput(page)).toHaveValue(`  ${query}  `);
    expect(new URL(page.url()).searchParams.get('category')).toBe(category);
    await card.click();
    await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
    await page.goBack();
    await expect(card).toBeVisible();
    await page.reload();
    await expect(searchInput(page)).toHaveValue(`  ${query}  `);
    await expect(card).toBeVisible();
    await page.getByRole('button', { name: '검색 초기화' }).click();
    await expect(searchInput(page)).toHaveValue('');
    expect(new URL(page.url()).searchParams.has('q')).toBe(false);
    expect(new URL(page.url()).searchParams.get('category')).toBe(category);
    await page.setViewportSize({ width: 320, height: 720 });
    const sizes = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
    expect(sizes[0]).toBeLessThanOrEqual(sizes[1]);
  } finally {
    expect((await request.delete(`${backendOrigin}/api/posts/${post.id}`, { headers })).status()).toBe(204);
  }
});

test('search ignores obsolete responses and distinguishes errors from no results with retry', async ({ page }) => {
  let releaseOld = () => {};
  let startedOld = () => {};
  const oldGate = new Promise<void>(resolve => { releaseOld = resolve; });
  const oldStarted = new Promise<void>(resolve => { startedOld = resolve; });
  let failureAttempts = 0;
  await page.route('**/api/search?**', async route => {
    const q = new URL(route.request().url()).searchParams.get('q');
    if (q === 'older') {
      startedOld();
      await oldGate;
      await route.fulfill({ json: [resultPost('old-result', 'older 결과')] }).catch(() => {});
    } else if (q === 'failed') {
      failureAttempts += 1;
      if (failureAttempts === 1) await route.fulfill({ status: 503, json: { message: '잠시 검색할 수 없습니다.' } });
      else await route.fulfill({ json: [resultPost('retry-result', '재시도 성공')] });
    } else if (q === 'empty') await route.fulfill({ json: [] });
    else await route.fulfill({ json: [resultPost('new-result', '최신 결과')] });
  });
  await page.goto('/');
  try {
    await searchInput(page).fill('older');
    await oldStarted;
    await expect(results(page)).toHaveAttribute('aria-busy', 'true');
    await expect(page.getByRole('heading', { name: '조건에 맞는 글이 없어요' })).toBeHidden();
    await searchInput(page).fill('newer');
    await expect(results(page).getByRole('heading', { name: '최신 결과' })).toBeVisible();
    releaseOld();
    await expect(results(page).getByRole('heading', { name: 'older 결과' })).toBeHidden();
    await searchInput(page).fill('failed');
    await expect(results(page).getByRole('alert')).toHaveText(/잠시 검색할 수 없습니다/);
    await expect(page.getByRole('heading', { name: '조건에 맞는 글이 없어요' })).toBeHidden();
    await page.getByRole('button', { name: '검색 다시 시도' }).click();
    await expect(results(page).getByRole('heading', { name: '재시도 성공' })).toBeVisible();
    expect(failureAttempts).toBe(2);
    await searchInput(page).fill('empty');
    await expect(page.getByRole('heading', { name: '조건에 맞는 글이 없어요' })).toBeVisible();
    await expect(results(page).getByRole('alert')).toBeHidden();
  } finally {
    releaseOld();
  }
});

test('Korean composition waits for completion and search excerpts render as safe text', async ({ page }) => {
  const queries: string[] = [];
  const snippet = '한글 <img src=x onerror=alert(1)> 오류';
  await page.route('**/api/search?**', async route => {
    queries.push(new URL(route.request().url()).searchParams.get('q') ?? '');
    await route.fulfill({ json: [{ ...resultPost('literal-code', '명령어 설명'), searchExcerpt: snippet }] });
  });
  await page.goto('/');
  const input = searchInput(page);
  await input.dispatchEvent('compositionstart');
  await input.fill('ㅎ');
  await input.fill('한글');
  // Longer than the search debounce: incomplete IME text must not be requested.
  await page.waitForTimeout(350);
  expect(queries).toEqual([]);
  await input.dispatchEvent('compositionend', { data: '한글' });
  await expect(results(page).getByRole('heading', { name: '명령어 설명' })).toBeVisible();
  expect(queries).toEqual(['한글']);
  const card = results(page).locator('a[href="/posts/literal-code"]');
  await expect(card.locator('mark')).toHaveText('한글');
  await expect(card.locator('img')).toHaveCount(0);
  await expect(card).toContainText(snippet);
});
