import { test, expect, type Page } from '@playwright/test';

const trashedPost = {
  id: 'retry-trash', slug: 'retry-trash', title: '중단된 삭제 검증', status: 'draft',
  deletedAt: '2026-09-20T01:00:00.000Z', updatedAt: '2026-09-20T01:00:00.000Z',
  tags: [], sections: [], category: '테스트', publishedAt: '2026-01-01', summary: ''
};

async function openTrash(page: Page) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.request.post('/api/auth/login', { data: { password: process.env.ADMIN_PASSWORD ?? 'e2e-password' } });
  await page.goto('/admin?section=posts');
  await page.getByRole('button', { name: '목록', exact: true }).click();
  await page.getByRole('button', { name: '휴지통 열기', exact: true }).click();
  return page.getByRole('dialog', { name: '글 휴지통', exact: true });
}

test('pending permanent deletion cannot restore and can resume with explicit confirmation', async ({ page }) => {
  let present = true;
  let submitted: unknown;
  await page.route('**/api/posts/trash/list', route => route.fulfill({ json: { posts: present ? [{ ...trashedPost, purgeRequestedAt: '2026-09-21T01:00:00.000Z' }] : [], total: present ? 1 : 0 } }));
  await page.route('**/api/posts/retry-trash/permanent', async route => {
    submitted = route.request().postDataJSON();
    present = false;
    await route.fulfill({ status: 204 });
  });
  const dialog = await openTrash(page);
  await expect(dialog.getByRole('button', { name: '초안으로 복원' })).toBeDisabled();
  await expect(dialog.getByText('영구삭제 정리가 완료되지 않았습니다.', { exact: false })).toBeVisible();
  await dialog.getByRole('button', { name: '영구삭제 재시도', exact: true }).click();
  const confirm = dialog.getByRole('button', { name: '영구삭제 확인', exact: true });
  await expect(confirm).toBeDisabled();
  await dialog.getByLabel('영구삭제 확인 제목').fill(trashedPost.title);
  await confirm.click();
  await expect(dialog.getByRole('heading', { name: trashedPost.title })).toHaveCount(0);
  expect(submitted).toEqual({ expectedDeletedAt: trashedPost.deletedAt, confirmTitle: trashedPost.title });
});

test('uncertain permanent-delete response requires a fresh server state before restoration', async ({ page }) => {
  let deleteAttempted = false;
  let refreshFails = true;
  await page.route('**/api/posts/trash/list', route => {
    return route.fulfill(deleteAttempted && refreshFails
      ? { status: 503, json: { message: '목록 확인 실패' } }
      : { json: { posts: [trashedPost], total: 1 } });
  });
  await page.route('**/api/posts/retry-trash/permanent', route => {
    deleteAttempted = true;
    return route.fulfill({ status: 500, json: { message: '삭제 정리 실패' } });
  });
  const dialog = await openTrash(page);
  await dialog.getByRole('button', { name: '영구삭제', exact: true }).click();
  await dialog.getByLabel('영구삭제 확인 제목').fill(trashedPost.title);
  await dialog.getByRole('button', { name: '영구삭제 확인', exact: true }).click();
  await expect(dialog.getByRole('alert')).toHaveText('삭제 정리 실패');
  await expect(dialog.getByText('삭제 요청의 결과를 확인하지 못했습니다.', { exact: false })).toBeVisible();
  await expect(dialog.getByRole('button', { name: '초안으로 복원' })).toBeDisabled();
  refreshFails = false;
  await dialog.getByRole('button', { name: '휴지통 새로고침' }).click();
  await expect(dialog.getByRole('button', { name: '초안으로 복원' })).toBeEnabled();
});
