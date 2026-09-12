import { expect, test } from '@playwright/test';

test('a list refresh cannot advance the base version of a dirty draft', async ({ page }) => {
  const login = await page.request.post('/api/auth/login', {
    data: { password: process.env.ADMIN_PASSWORD ?? 'e2e-password' }
  });
  expect(login.ok()).toBe(true);
  const content = (text: string) => ({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] });
  const initial = {
    id: 'baseline-safety-post', title: '원래 제목', slug: 'baseline-safety-post',
    summary: '버전 충돌 검증', category: '일상', contentJson: content('기존 본문'), contentHtml: '<p>기존 본문</p>',
    publishedAt: '2026-09-12', tags: [], sections: [], featured: false, status: 'draft',
    updatedAt: '2026-09-12T01:00:00.000Z'
  };
  let serverPost = { ...initial };
  let listReads = 0;
  let submittedVersion: string | null = null;
  await page.route('**/api/posts**', async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() === 'GET' && path === '/api/posts') {
      listReads += 1;
      await route.fulfill({ json: { posts: [serverPost], total: 1 } });
    } else if (request.method() === 'PUT' && path === `/api/posts/${initial.id}`) {
      const body = request.postDataJSON();
      submittedVersion = body.expectedUpdatedAt;
      if (body.expectedUpdatedAt !== serverPost.updatedAt) {
        await route.fulfill({ status: 409, json: { message: '다른 탭에서 수정되었습니다. 최신 글을 확인해 주세요.' } });
      } else {
        serverPost = { ...serverPost, ...body };
        await route.fulfill({ json: serverPost });
      }
    } else if (path.endsWith('/revisions')) {
      await route.fulfill({ json: [] });
    } else await route.continue();
  });
  await page.setViewportSize({ width: 1700, height: 1000 });
  await page.goto(`/admin?section=posts&post=${initial.id}`);
  const title = page.getByPlaceholder('제목을 입력하세요');
  await expect(title).toHaveValue(initial.title);
  await title.fill('내가 수정한 제목');
  serverPost = { ...serverPost, contentJson: content('다른 탭이 수정한 본문'), contentHtml: '<p>다른 탭이 수정한 본문</p>', updatedAt: '2026-09-12T02:00:00.000Z' };
  const readsBeforeRefresh = listReads;
  await page.getByRole('button', { name: '새로고침', exact: true }).click();
  await expect.poll(() => listReads).toBeGreaterThan(readsBeforeRefresh);
  await expect(page.getByTestId('server-save-status')).toContainText('11:00:00');
  await expect(title).toHaveValue('내가 수정한 제목');
  await title.press('Control+s');
  await expect.poll(() => submittedVersion).toBe(initial.updatedAt);
  await expect(page.getByText('다른 탭에서 수정되었습니다. 최신 글을 확인해 주세요.', { exact: true })).toBeVisible();
  await expect(title).toHaveValue('내가 수정한 제목');
  expect(serverPost.contentHtml).toBe('<p>다른 탭이 수정한 본문</p>');
  expect(serverPost.title).toBe(initial.title);
});

for (const legacy of [false, true]) {
  test(legacy ? 'legacy recovery requires an explicit overwrite choice before a server write' : 'restoring a local V1 draft after reload retains its V1 server precondition', async ({ page }) => {
    const login = await page.request.post('/api/auth/login', { data: { password: process.env.ADMIN_PASSWORD ?? 'e2e-password' } });
    expect(login.ok()).toBe(true);
    const content = (text: string) => ({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] });
    const v1 = '2026-09-12T01:00:00.000Z';
    const v2 = '2026-09-12T02:00:00.000Z';
    const id = legacy ? 'baseline-legacy-recovery' : 'baseline-versioned-recovery';
    let serverPost = {
      id, title: '현재 서버 제목', slug: id, summary: '복구 버전 검증', category: '일상',
      contentJson: content('다른 탭에서 수정한 최신 본문'), contentHtml: '<p>다른 탭에서 수정한 최신 본문</p>',
      publishedAt: '2026-09-12', tags: [], sections: [], featured: false, status: 'draft', updatedAt: v2
    };
    const recovery = {
      draft: {
        title: '복구할 예전 초안', slug: id, summary: '복구 버전 검증', category: '일상',
        publishedAt: '2026-09-12', tags: [], featured: false, status: 'draft',
        contentJson: content('V1에서 편집한 본문'), contentHtml: '<p>V1에서 편집한 본문</p>',
        series: '', cover: '', scheduledAt: '', seoTitle: '', seoDescription: '', seoOgImage: '', seoCanonicalUrl: '', seoKeywords: ''
      },
      updatedAt: '2026-09-12T01:30:00.000Z',
      ...(legacy ? {} : { baseUpdatedAt: v1 })
    };
    await page.addInitScript(({ key, value }) => localStorage.setItem(key, value), {
      key: `hamlog_draft_${id}`, value: JSON.stringify(recovery)
    });
    const versions: string[] = [];
    await page.route('**/api/posts**', async route => {
      const request = route.request();
      const path = new URL(request.url()).pathname;
      if (request.method() === 'GET' && path === '/api/posts') {
        await route.fulfill({ json: { posts: [serverPost], total: 1 } });
      } else if (request.method() === 'PUT' && path === `/api/posts/${id}`) {
        const body = request.postDataJSON();
        versions.push(body.expectedUpdatedAt);
        if (body.expectedUpdatedAt !== serverPost.updatedAt) {
          await route.fulfill({ status: 409, json: { message: '복구본 이후 서버가 변경되었습니다.' } });
        } else {
          serverPost = { ...serverPost, ...body, updatedAt: '2026-09-12T03:00:00.000Z' };
          await route.fulfill({ json: serverPost });
        }
      } else if (path.endsWith('/revisions')) {
        await route.fulfill({ json: [] });
      } else await route.continue();
    });
    await page.goto(`/admin?section=posts&post=${id}`);
    await expect(page.getByTestId('server-save-status')).toContainText('11:00:00');
    await page.getByTestId('post-command-bar').getByRole('button', { name: '복구', exact: true }).click();
    const title = page.getByPlaceholder('제목을 입력하세요');
    await expect(title).toHaveValue('복구할 예전 초안');
    if (legacy) {
      let acceptOverwrite = false;
      const dialogs: string[] = [];
      page.on('dialog', dialog => {
        dialogs.push(dialog.message());
        void (acceptOverwrite ? dialog.accept() : dialog.dismiss());
      });
      await title.press('Control+s');
      await expect.poll(() => dialogs.length).toBe(1);
      expect(dialogs[0]).toContain('서버 기준 버전 정보가 없습니다');
      expect(versions).toEqual([]);
      await expect(title).toHaveValue('복구할 예전 초안');
      acceptOverwrite = true;
      await title.press('Control+s');
      await expect.poll(() => versions).toEqual([v2]);
      expect(serverPost.title).toBe('복구할 예전 초안');
    } else {
      await title.press('Control+s');
      await expect.poll(() => versions).toEqual([v1]);
      await expect(page.getByText('복구본 이후 서버가 변경되었습니다.', { exact: true })).toBeVisible();
      await expect(title).toHaveValue('복구할 예전 초안');
      expect(serverPost.title).toBe('현재 서버 제목');
      expect(serverPost.contentHtml).toBe('<p>다른 탭에서 수정한 최신 본문</p>');
      await expect.poll(() => page.evaluate(key => {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw).baseUpdatedAt : null;
      }, `hamlog_draft_${id}`)).toBe(v1);
    }
  });
}

test('HTML-only legacy recovery for an existing JSON post preserves and restores its own body', async ({ page }) => {
  const login = await page.request.post('/api/auth/login', { data: { password: process.env.ADMIN_PASSWORD ?? 'e2e-password' } });
  expect(login.ok()).toBe(true);
  const id = 'baseline-legacy-html-only';
  const serverText = '서버에 저장된 기존 JSON 본문';
  const recoveryText = '구형 임시 저장본에만 남은 중요한 본문';
  const serverPost = {
    id, title: '서버와 복구본의 같은 제목', slug: id, summary: 'HTML 구형 복구 검증', category: '일상',
    contentJson: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: serverText }] }] },
    contentHtml: `<p>${serverText}</p>`, publishedAt: '2026-09-12', tags: [], sections: [],
    featured: false, status: 'draft', updatedAt: '2026-09-12T02:00:00.000Z'
  };
  const key = `hamlog_draft_${id}`;
  // All missing metadata falls back to the server. Only this HTML body differs.
  const rawRecovery = JSON.stringify({ title: serverPost.title, contentHtml: `<p>${recoveryText}</p>` });
  await page.addInitScript(({ key, raw }) => localStorage.setItem(key, raw), { key, raw: rawRecovery });
  let writes = 0;
  await page.route('**/api/posts**', async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() !== 'GET') {
      writes += 1;
      await route.fulfill({ status: 405, json: { message: '이 검증은 읽기 전용입니다.' } });
    } else if (path === '/api/posts') {
      await route.fulfill({ json: { posts: [serverPost], total: 1 } });
    } else if (path.endsWith('/revisions')) {
      await route.fulfill({ json: [] });
    } else await route.continue();
  });
  await page.goto(`/admin?section=posts&post=${id}`);
  const restore = page.getByTestId('post-command-bar').getByRole('button', { name: '복구', exact: true });
  await expect(restore).toBeVisible();
  await expect(page.locator('.ProseMirror')).toContainText(serverText);
  // Cross the timer boundary and a lifecycle flush before resolving recovery.
  await page.waitForTimeout(1250);
  await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
  expect(await page.evaluate(key => localStorage.getItem(key), key)).toBe(rawRecovery);
  await restore.click();
  await expect(page.getByPlaceholder('제목을 입력하세요')).toHaveValue(serverPost.title);
  await expect(page.locator('.ProseMirror')).toContainText(recoveryText);
  await expect(page.locator('.ProseMirror')).not.toContainText(serverText);
  await expect(page.getByText('저장되지 않은 변경', { exact: true })).toBeVisible();
  expect(writes).toBe(0);
});
