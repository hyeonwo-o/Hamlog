import { expect, test } from '@playwright/test';

const loginPasswords = Array.from(new Set([
  process.env.ADMIN_PASSWORD,
  'admin1234',
  'e2e-password'
].filter(Boolean))) as string[];

test('admin can publish a simple post and view it publicly', async ({ page }) => {
  const uniqueId = Date.now();
  const title = `E2E Editor Smoke ${uniqueId}`;
  const slug = `e2e-editor-smoke-${uniqueId}`;
  const body = `This post was created by an editor smoke test ${uniqueId}.`;

  await page.goto('/admin');

  for (const password of loginPasswords) {
    const passwordInput = page.getByLabel('관리자 비밀번호');
    if (!(await passwordInput.isVisible().catch(() => false))) break;

    await passwordInput.fill(password);
    await page.getByRole('button', { name: '로그인' }).click();

    const titleInput = page.getByPlaceholder('제목을 입력하세요');
    const loginFailed = await page.getByText('비밀번호가 올바르지 않습니다.').isVisible()
      .catch(() => false);
    if (!loginFailed && await titleInput.isVisible().catch(() => false)) {
      break;
    }
  }

  await expect(page.getByPlaceholder('제목을 입력하세요')).toBeVisible();
  await page.getByPlaceholder('제목을 입력하세요').fill(title);

  const editor = page.locator('.ProseMirror').first();
  await editor.click();
  await page.keyboard.type(body);

  await Promise.all([
    page.waitForResponse(response =>
      response.url().includes('/api/posts') && response.request().method() === 'POST'
    ),
    page.getByRole('button', { name: '발행' }).click()
  ]);

  await expect(page.getByText('발행되었습니다.')).toBeVisible();

  await page.goto(`/posts/${slug}`);
  await expect(page.getByRole('heading', { name: title })).toBeVisible();
  await expect(page.getByText(body)).toBeVisible();

  await page.goto('/admin');
  await page.evaluate(async (postSlug) => {
    const listResponse = await fetch('/api/posts', { credentials: 'include' });
    const { posts } = await listResponse.json();
    const target = posts.find((post: { id: string; slug: string }) => post.slug === postSlug);
    if (target) {
      await fetch(`/api/posts/${target.id}`, {
        method: 'DELETE',
        credentials: 'include'
      });
    }
  }, slug);
});
