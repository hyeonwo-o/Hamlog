import { expect, test, type Page } from '@playwright/test';

interface WorkspacePost {
  id: string;
  title: string;
  contentJson: unknown;
}

async function openWorkspace(page: Page) {
  const login = await page.request.post('/api/auth/login', {
    data: { password: process.env.ADMIN_PASSWORD ?? 'e2e-password' }
  });
  expect(login.ok(), `로그인 실패 (${login.status()}): ${await login.text()}`).toBe(true);
  await page.goto('/admin?section=posts');
  await expect(page.getByPlaceholder('제목을 입력하세요')).toBeVisible();
  const unique = `${Date.now()}-${test.info().parallelIndex}`;
  const created = await page.evaluate(async unique => {
    const response = await fetch('/api/posts', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: `작업 공간 회귀 ${unique}`,
        slug: `editor-workspace-${unique}`,
        summary: '관리자 작업 공간 회귀 테스트용 초안입니다.',
        category: '테스트',
        status: 'draft',
        publishedAt: '2026-09-08',
        tags: [],
        sections: [],
        contentJson: {
          type: 'doc',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: '저장된 원본 본문입니다.' }] }]
        }
      })
    });
    return { status: response.status, body: await response.text() };
  }, unique);
  expect(created.status, `초안 생성 실패 (${created.status}): ${created.body}`).toBe(201);
  const post = JSON.parse(created.body) as WorkspacePost;
  await page.goto(`/admin?section=posts&post=${post.id}`);
  await expect(page.getByPlaceholder('제목을 입력하세요')).toHaveValue(post.title);
  await expect(page.locator('.ProseMirror')).toHaveText('저장된 원본 본문입니다.');
  return post;
}

async function deleteWorkspacePost(page: Page, id: string) {
  const result = await page.evaluate(async id => {
    const response = await fetch(`/api/posts/${id}`, { method: 'DELETE', credentials: 'include' });
    return { status: response.status, body: await response.text() };
  }, id);
  expect(result.status, `초안 정리 실패 (${result.status}): ${result.body}`).toBe(204);
}

async function expectPanels(page: Page, listOpen: boolean, inspectorOpen: boolean) {
  await expect(page.locator('#admin-post-list-toggle')).toHaveAttribute('aria-expanded', String(listOpen));
  await expect(page.locator('[aria-controls="post-inspector-panel"]')).toHaveAttribute('aria-expanded', String(inspectorOpen));
  if (listOpen) await expect(page.locator('#admin-post-list-panel')).toBeVisible();
  else await expect(page.locator('#admin-post-list-panel')).toBeHidden();
  if (inspectorOpen) await expect(page.locator('#post-inspector-panel')).toBeVisible();
  else await expect(page.locator('#post-inspector-panel')).toBeHidden();
}

async function expectFittingWorkspace(page: Page) {
  const layout = await page.evaluate(() => {
    const viewportWidth = window.innerWidth;
    const overflowElements = Array.from(document.querySelectorAll<HTMLElement>('.admin-compact *'))
      .filter(element => {
        const rect = element.getBoundingClientRect();
        if (!rect.width || !rect.height || (rect.right + window.scrollX <= viewportWidth && rect.left + window.scrollX >= 0)) return false;
        // Ignore content that is intentionally clipped inside a horizontal scroller.
        for (let parent = element.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
          if (['auto', 'scroll', 'hidden', 'clip'].includes(getComputedStyle(parent).overflowX)) return false;
        }
        return true;
      })
      .map(element => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return {
          tag: element.tagName.toLowerCase(),
          id: element.id,
          className: element.getAttribute('class')?.slice(0, 160),
          label: element.getAttribute('aria-label') || element.getAttribute('placeholder'),
          left: rect.left + window.scrollX,
          right: rect.right + window.scrollX,
          width: rect.width,
          scrollWidth: element.scrollWidth,
          clientWidth: element.clientWidth,
          minWidth: style.minWidth,
          overflowX: style.overflowX
        };
      }).sort((a, b) => b.right - a.right).slice(0, 20);
    return {
      viewportWidth,
      scrollWidth: document.documentElement.scrollWidth,
      scrollX: window.scrollX,
      listExpanded: document.querySelector('#admin-post-list-toggle')?.getAttribute('aria-expanded'),
      inspectorExpanded: document.querySelector('[aria-controls="post-inspector-panel"]')?.getAttribute('aria-expanded'),
      overflowElements
    };
  });
  expect(layout.scrollWidth, `작업 공간 가로 넘침: ${JSON.stringify(layout, null, 2)}`).toBeLessThanOrEqual(layout.viewportWidth);
  await expect.poll(() => page.locator('.admin-compact').evaluate(element => {
    const header = element.querySelector('header')!;
    const expected = Math.ceil(header.getBoundingClientRect().height);
    const actual = parseFloat(getComputedStyle(element).getPropertyValue('--admin-header-offset'));
    return actual === expected;
  })).toBe(true);
}

test('desktop workspace panels can collapse and reopen without losing edits', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  const post = await openWorkspace(page);
  try {
    await expectPanels(page, true, true);
    const title = page.getByPlaceholder('제목을 입력하세요');
    const editor = page.locator('.ProseMirror');
    const originalEditorWidth = (await editor.boundingBox())!.width;
    const originalWorkspaceWidth = (await page.locator('#admin-post-editor-panel').boundingBox())!.width;
    await title.fill('접어도 유지되는 작업 중 제목');
    await editor.fill('접어도 유지되는 작업 중 본문');
    await expect(page.getByText('저장되지 않은 변경', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: '글 설정 닫기', exact: true }).click();
    await expectPanels(page, true, false);
    expect((await editor.boundingBox())!.width).toBeGreaterThan(originalEditorWidth + 20);
    await page.getByRole('button', { name: '목록', exact: true }).click();
    await expectPanels(page, false, false);
    expect((await page.locator('#admin-post-editor-panel').boundingBox())!.width).toBeGreaterThan(originalWorkspaceWidth + 300);
    await expect(title).toHaveValue('접어도 유지되는 작업 중 제목');
    await expect(editor).toHaveText('접어도 유지되는 작업 중 본문');
    await expectFittingWorkspace(page);
    await page.screenshot({ path: test.info().outputPath('editor-focus-workspace.png') });

    await page.getByRole('button', { name: '목록', exact: true }).click();
    await page.getByRole('button', { name: '글 설정 열기', exact: true }).click();
    await expectPanels(page, true, true);
    await expect(title).toHaveValue('접어도 유지되는 작업 중 제목');
    await expect(editor).toHaveText('접어도 유지되는 작업 중 본문');
    expect(Math.abs((await editor.boundingBox())!.width - originalEditorWidth)).toBeLessThan(2);
    await page.screenshot({ path: test.info().outputPath('editor-expanded-workspace.png') });
  } finally {
    await deleteWorkspacePost(page, post.id);
  }
});

test('mobile new-post action protects unsaved edits and opens a blank draft after confirmation', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const post = await openWorkspace(page);
  try {
    await expectPanels(page, false, false);
    const newPost = page.getByRole('button', { name: '새 글 작성', exact: true });
    await expect(newPost).toBeEnabled();
    await expect(newPost).toBeInViewport();
    expect((await newPost.boundingBox())!.height).toBeGreaterThanOrEqual(44);

    const title = page.getByPlaceholder('제목을 입력하세요');
    const editor = page.locator('.ProseMirror');
    await title.fill('아직 저장하지 않은 모바일 제목');
    await editor.fill('아직 저장하지 않은 모바일 본문');
    await expect(page.getByText('저장되지 않은 변경', { exact: true })).toBeVisible();
    let dismissedMessage = '';
    page.once('dialog', async dialog => {
      dismissedMessage = dialog.message();
      await dialog.dismiss();
    });
    await newPost.click();
    expect(dismissedMessage).toContain('저장하지 않은 변경사항');
    await expect(page).toHaveURL(new RegExp(`post=${post.id}`));
    await expect(title).toHaveValue('아직 저장하지 않은 모바일 제목');
    await expect(editor).toHaveText('아직 저장하지 않은 모바일 본문');
    await expectFittingWorkspace(page);

    page.once('dialog', dialog => dialog.accept());
    await newPost.click();
    await expect(page).not.toHaveURL(/(?:\?|&)post=/);
    await expect(title).toHaveValue('');
    await expect(editor).toHaveText('');
    await expect(page.getByTestId('post-command-bar').getByText('새 초안', { exact: true })).toBeVisible();
    await expect(newPost).toBeDisabled();
    await expectPanels(page, false, false);
    await expectFittingWorkspace(page);

    const savedResponse = await page.evaluate(async () => {
      const response = await fetch('/api/posts?summary=false', { credentials: 'include' });
      return { status: response.status, body: await response.text() };
    });
    expect(savedResponse.status, `원본 초안 조회 실패: ${savedResponse.body}`).toBe(200);
    const saved = JSON.parse(savedResponse.body) as { posts: WorkspacePost[] };
    const unchanged = saved.posts.find(item => item.id === post.id);
    expect(unchanged, `관리자 전체 목록에 원본 초안 ${post.id}이 있어야 합니다.`).toBeDefined();
    expect(unchanged?.title).toBe(post.title);
    expect(unchanged?.contentJson).toEqual(post.contentJson);
    await page.screenshot({ path: test.info().outputPath('editor-mobile-new-draft.png') });
  } finally {
    await deleteWorkspacePost(page, post.id);
  }
});

test('workspace controls reflect actual panels when crossing mobile and desktop breakpoints', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  const post = await openWorkspace(page);
  try {
    await expectPanels(page, true, true);
    await page.getByRole('button', { name: '글 설정 닫기', exact: true }).click();
    await expectPanels(page, true, false);
    await page.setViewportSize({ width: 390, height: 844 });
    await expectPanels(page, false, false);
    await expectFittingWorkspace(page);
    await page.getByRole('button', { name: '글 설정 열기', exact: true }).click();
    await expectPanels(page, false, true);

    await page.setViewportSize({ width: 1280, height: 1000 });
    await expectPanels(page, false, false);
    await expectFittingWorkspace(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await expectPanels(page, false, true);
    await page.getByRole('button', { name: '목록', exact: true }).click();
    await expect(page.locator('#admin-post-list-panel')).toBeVisible();
    await expect(page.locator('#admin-post-editor-panel')).toBeHidden();
    await expect(page.getByRole('button', { name: '편집기로 돌아가기' })).toBeFocused();
    await expectFittingWorkspace(page);

    await page.setViewportSize({ width: 1600, height: 1000 });
    await expectPanels(page, true, false);
    await expect(page.locator('#admin-post-editor-panel')).toBeVisible();
    await expectFittingWorkspace(page);
    await page.setViewportSize({ width: 320, height: 844 });
    await expect(page.locator('#admin-post-editor-panel')).toBeHidden();
    await page.getByRole('button', { name: '편집기로 돌아가기' }).click();
    await expectPanels(page, false, true);
    await expect(page.getByRole('button', { name: '목록', exact: true })).toBeFocused();
    await expectFittingWorkspace(page);
    await expect(page.getByPlaceholder('제목을 입력하세요')).toHaveValue(post.title);
    await expect(page.locator('.ProseMirror')).toHaveText('저장된 원본 본문입니다.');

    for (const width of [640, 768, 1024]) {
      await page.setViewportSize({ width, height: 900 });
      await expectPanels(page, false, width < 1024);
      await expectFittingWorkspace(page);
      const commands = page.getByTestId('post-command-bar');
      expect(await commands.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
      await expect(commands.getByRole('button', { name: '새 글 작성', exact: true })).toBeVisible();
      await expect(commands.getByRole('button', { name: '발행 설정', exact: true })).toBeVisible();
    }
  } finally {
    await deleteWorkspacePost(page, post.id);
  }
});
