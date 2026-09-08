import { expect, test } from '@playwright/test';

const backendOrigin = `http://127.0.0.1:${process.env.E2E_API_PORT ?? process.env.PORT ?? '4100'}`;

test('Access mode opens the editor without a password, routes writes through Access and logs out', async ({ page, request }) => {
  // The real signature/claim/CSRF boundary is exercised by access-auth.test.js.
  // Here a mock edge forwards protected requests to the isolated password-mode test API.
  const login = await request.post(`${backendOrigin}/api/auth/login`, {
    data: { password: process.env.ADMIN_PASSWORD ?? 'e2e-password' }
  });
  expect(login.ok()).toBe(true);
  const cookie = login.headers()['set-cookie'].split(';', 1)[0];
  const protectedRequests: string[] = [];
  const title = `Access 로그인 테스트 ${Date.now()}`;
  let postId = '';
  await page.route('**/api/auth/config', route => route.fulfill({ json: { mode: 'cloudflare-access' } }));
  await page.route('**/admin/api/**', async route => {
    const incoming = route.request();
    const url = new URL(incoming.url());
    protectedRequests.push(`${incoming.method()} ${url.pathname}`);
    expect(incoming.headers()['x-requested-with']).toBe('XMLHttpRequest');
    const response = await route.fetch({
      url: `${backendOrigin}${url.pathname.replace('/admin/api', '/api')}${url.search}`,
      headers: { ...incoming.headers(), cookie, origin: backendOrigin, host: new URL(backendOrigin).host }
    });
    if (incoming.method() === 'POST' && url.pathname === '/admin/api/posts' && response.status() === 201) {
      postId = (await response.json()).id;
    }
    await route.fulfill({ response });
  });

  try {
    await page.goto('/admin?section=posts');
    await expect(page.getByLabel('관리자 비밀번호', { exact: true })).toHaveCount(0);
    await page.getByPlaceholder('제목을 입력하세요').fill(title);
    await page.locator('.ProseMirror').fill('Access로 인증한 관리자의 저장 테스트입니다.');
    await page.keyboard.press('Control+s');
    await expect.poll(() => postId).not.toBe('');
    expect(protectedRequests).toContain('GET /admin/api/auth/me');
    expect(protectedRequests).toContain('POST /admin/api/posts');

    await page.route('**/api/auth/logout', route => route.fulfill({ json: { message: '로그아웃 성공', redirectTo: '/cdn-cgi/access/logout' } }));
    await page.route('**/cdn-cgi/access/logout', route => route.fulfill({ contentType: 'text/html', body: '<p>Access 로그아웃 완료</p>' }));
    await page.getByRole('button', { name: '로그아웃', exact: true }).click();
    await expect(page).toHaveURL(/\/cdn-cgi\/access\/logout$/);
  } finally {
    if (postId) {
      const response = await request.delete(`${backendOrigin}/api/posts/${postId}`, { headers: { Cookie: cookie, Origin: backendOrigin } });
      expect(response.status()).toBe(204);
    }
  }
});

test('expired Access authentication offers reauthentication without password fallback', async ({ page }) => {
  const passwordRequests: string[] = [];
  page.on('request', request => {
    if (request.url().endsWith('/auth/login')) passwordRequests.push(request.url());
  });
  await page.route('**/api/auth/config', route => route.fulfill({ json: { mode: 'cloudflare-access' } }));
  await page.route('**/admin/api/auth/me', route => route.fulfill({ status: 401, json: { message: 'Access session expired' } }));
  await page.goto('/admin?section=posts');
  await expect(page.getByRole('button', { name: 'Cloudflare Access로 다시 인증' })).toBeVisible();
  await expect(page.getByLabel('관리자 비밀번호', { exact: true })).toHaveCount(0);
  await expect(page.locator('.ProseMirror')).toHaveCount(0);
  expect(passwordRequests).toEqual([]);
});

test('unavailable auth configuration does not expose a password fallback', async ({ page }) => {
  await page.route('**/api/auth/config', route => route.fulfill({ status: 503, json: { message: 'Unavailable' } }));
  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: '인증 설정 확인' })).toBeVisible();
  await expect(page.getByRole('button', { name: '다시 시도', exact: true })).toBeVisible();
  await expect(page.getByLabel('관리자 비밀번호', { exact: true })).toHaveCount(0);
});
