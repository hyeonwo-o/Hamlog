import { expect, test, type Page } from '@playwright/test';

const backendOrigin = `http://127.0.0.1:${process.env.E2E_API_PORT ?? process.env.PORT ?? '4100'}`;
const loginPasswords = Array.from(new Set([
  process.env.ADMIN_PASSWORD,
  'admin1234',
  'e2e-password'
].filter(Boolean))) as string[];

async function openAdminEditor(page: Page) {
  await page.goto('/admin?section=posts');
  const titleInput = page.getByPlaceholder('제목을 입력하세요');

  if (await titleInput.isVisible().catch(() => false)) {
    return;
  }

  for (const password of loginPasswords) {
    const loggedIn = await page.evaluate(async (candidate) => {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ password: candidate })
      });
      return response.ok;
    }, password);

    if (loggedIn) {
      break;
    }
  }

  await page.goto('/admin?section=posts');
  await expect(titleInput).toBeVisible();
}

function createParagraphDocument(text: string) {
  return {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [
          {
            type: 'text',
            text
          }
        ]
      }
    ]
  };
}

async function deletePostFromAdmin(page: Page, postId: string) {
  await page.evaluate(async (id) => {
    localStorage.removeItem(`hamlog_draft_${id}`);
    await fetch(`/api/posts/${id}`, {
      method: 'DELETE',
      credentials: 'include'
    });
  }, postId);
}

test('backend exposes robots and baseline security headers', async ({ request }) => {
  const homeResponse = await request.get(`${backendOrigin}/`);
  expect(homeResponse.status()).toBe(200);

  const csp = homeResponse.headers()['content-security-policy'] ?? '';
  expect(csp).toContain("default-src 'self'");
  expect(csp).toContain("object-src 'none'");
  expect(csp).toContain("frame-ancestors 'self'");

  const robotsResponse = await request.get(`${backendOrigin}/robots.txt`);
  expect(robotsResponse.status()).toBe(200);
  expect(robotsResponse.headers()['content-type']).toContain('text/plain');

  const robots = await robotsResponse.text();
  expect(robots).toContain('User-agent: *');
  expect(robots).toContain('Allow: /');
  expect(robots).toContain('Sitemap: https://tech.hamwoo.co.kr/sitemap.xml');
});

test('admin editor toolbar is grouped and accessible', async ({ page }) => {
  await page.setViewportSize({ width: 760, height: 900 });
  await openAdminEditor(page);

  const toolbar = page.getByRole('toolbar', { name: '글 편집 도구' });
  await expect(toolbar).toBeVisible();

  for (const groupName of ['실행 기록', '문단 설정', '텍스트 서식', '정렬', '목록과 인용', '삽입']) {
    await expect(toolbar.getByRole('group', { name: groupName })).toBeVisible();
  }

  await expect(toolbar.getByRole('button', { name: '굵게' })).toHaveAttribute('aria-pressed', 'false');
  await expect(toolbar.getByRole('button', { name: /문단:/ })).toHaveAttribute('aria-expanded', 'false');

  const textColorButton = toolbar.getByRole('button', { name: '글자색' });
  await textColorButton.focus();
  await page.keyboard.press('Enter');
  const textColorMenu = page.getByRole('menu', { name: '글자색' });
  await expect(textColorMenu).toBeVisible();
  const firstTextColor = textColorMenu.getByRole('menuitem', { name: '글자색 #1d1916' });
  const secondTextColor = textColorMenu.getByRole('menuitem', { name: '글자색 #0f766e' });
  const sameColumnLastRowColor = textColorMenu.getByRole('menuitem', { name: '글자색 #b91c1c' });
  await expect(firstTextColor).toBeFocused();
  await page.keyboard.press('ArrowUp');
  await expect(sameColumnLastRowColor).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(firstTextColor).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(secondTextColor).toBeFocused();
  await page.keyboard.press('Home');
  await expect(firstTextColor).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(textColorMenu).toBeHidden();
  await expect(textColorButton).toBeFocused();
  await expect(textColorButton).toHaveAttribute('aria-expanded', 'false');

  const highlightButton = toolbar.getByRole('button', { name: '하이라이트' });
  await highlightButton.focus();
  await page.keyboard.press('Enter');
  const highlightMenu = page.getByRole('menu', { name: '하이라이트' });
  const firstHighlight = highlightMenu.getByRole('menuitem', { name: '하이라이트 #fef3c7' });
  const secondHighlight = highlightMenu.getByRole('menuitem', { name: '하이라이트 #d1fae5' });
  await expect(firstHighlight).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(secondHighlight).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(highlightMenu).toBeHidden();
  await expect(highlightButton).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(secondHighlight).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(highlightButton).toBeFocused();

  await textColorButton.focus();
  await page.keyboard.press('Enter');
  await expect(textColorMenu).toBeVisible();
  await page.keyboard.press('Alt+Shift+P');
  await expect(textColorMenu).toBeHidden();
  const editToggle = page.getByRole('button', { name: '편집' });
  await expect(editToggle).toBeFocused();
  const toolbarRegion = page.getByTestId('editor-toolbar-region');
  await expect(toolbarRegion)
    .toHaveAttribute('aria-hidden', 'true');
  await expect(toolbarRegion).toHaveAttribute('inert', '');
  await page.keyboard.press('Tab');
  expect(await toolbarRegion.evaluate(element => element.contains(document.activeElement))).toBe(false);
  await page.keyboard.press('Alt+Shift+P');
  await expect(page.getByRole('button', { name: '미리보기' })).toBeFocused();

  await toolbar.getByRole('button', { name: '고급 삽입 메뉴' }).click();
  await expect(page.getByRole('button', { name: /수식/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /유튜브/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Mermaid 다이어그램/ })).toBeVisible();
  await page.keyboard.press('Escape');

  await toolbar.getByRole('button', { name: '코드 블록' }).click();
  await expect(page.getByRole('group', { name: '코드 언어 선택' }).getByRole('button', { name: 'Mermaid' })).toBeVisible();

  await page.getByRole('button', { name: '글 설정 열기' }).click();
  await expect(page.getByRole('heading', { name: '발행과 메타' })).toBeVisible();
  await page.getByRole('button', { name: /^SEO/ }).click();
  await expect(page.getByPlaceholder('검색 결과 제목')).toBeVisible();

  await page.getByTestId('editor-image-input').setInputFiles({
    name: 'too-large.png',
    mimeType: 'image/png',
    buffer: Buffer.alloc((8 * 1024 * 1024) + 1)
  });
  await expect(page.getByText('이미지는 8MB 이하만 가능합니다.')).toBeVisible();

  const toolbarOverflow = await toolbar.getByTestId('editor-toolbar-scroll').evaluate(node => ({
    scrollWidth: node.scrollWidth,
    clientWidth: node.clientWidth
  }));
  expect(toolbarOverflow.scrollWidth).toBeGreaterThan(toolbarOverflow.clientWidth);
});

test('admin editor keeps the mobile workspace focused without page overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openAdminEditor(page);

  const titleInput = page.getByPlaceholder('제목을 입력하세요');
  await expect(titleInput).toBeVisible();
  await expect(page.getByLabel('현재 글 상태: 초안')).toContainText('현재: 초안');
  await expect(page.locator('select[aria-label="글 상태"]')).toHaveCount(0);

  const initialTitleHeight = await titleInput.evaluate(element => element.getBoundingClientRect().height);
  const longTitle = '모바일에서도 긴 제목이 자연스럽게 여러 줄로 표시되는지 확인하는 에디터 제목 입력 테스트입니다';
  await titleInput.fill(longTitle);
  await expect(titleInput).toHaveValue(longTitle);
  await expect.poll(() => titleInput.evaluate(element => element.getBoundingClientRect().height))
    .toBeGreaterThan(initialTitleHeight);

  const titleLayout = await titleInput.evaluate(element => {
    const style = window.getComputedStyle(element);
    return {
      scrollWidth: element.scrollWidth,
      clientWidth: element.clientWidth,
      whiteSpace: style.whiteSpace
    };
  });
  expect(titleLayout.scrollWidth).toBeLessThanOrEqual(titleLayout.clientWidth + 1);
  expect(titleLayout.whiteSpace).not.toBe('nowrap');

  await titleInput.fill('가'.repeat(2000));
  const cappedTitleLayout = await titleInput.evaluate(element => ({
    height: element.getBoundingClientRect().height,
    scrollHeight: element.scrollHeight,
    clientHeight: element.clientHeight
  }));
  expect(cappedTitleLayout.height).toBeLessThanOrEqual(145);
  expect(cappedTitleLayout.scrollHeight).toBeGreaterThan(cappedTitleLayout.clientHeight);
  await titleInput.fill(longTitle);

  const toolbar = page.getByRole('toolbar', { name: '글 편집 도구' });
  const toolbarScroll = toolbar.getByTestId('editor-toolbar-scroll');
  const paragraphSelect = toolbar.getByRole('button', { name: /문단:/ });
  await paragraphSelect.click();
  const paragraphList = page.getByRole('listbox', { name: '문단' });
  await expect(paragraphList).toBeVisible();
  const paragraphMenuIsClickable = await paragraphList.evaluate(element => {
    const rect = element.getBoundingClientRect();
    const hit = document.elementFromPoint(rect.left + (rect.width / 2), rect.top + (rect.height / 2));
    return Boolean(hit && element.contains(hit));
  });
  expect(paragraphMenuIsClickable).toBe(true);
  expect(await toolbarScroll.evaluate(element => element.scrollTop)).toBe(0);
  await paragraphList.getByRole('option', { name: '제목 2' }).click();

  const nextToolsButton = toolbar.getByRole('button', { name: '다음 편집 도구 보기' });
  await expect(nextToolsButton).toBeVisible();
  await nextToolsButton.click();
  await expect.poll(() => toolbarScroll.evaluate(element => element.scrollLeft)).toBeGreaterThan(0);
  await expect(toolbar.getByRole('button', { name: '이전 편집 도구 보기' })).toBeVisible();
  await nextToolsButton.focus();
  await toolbarScroll.evaluate(element => {
    element.scrollLeft = element.scrollWidth;
  });
  await expect(nextToolsButton).toHaveAttribute('aria-disabled', 'true');
  await expect(nextToolsButton).toBeFocused();

  const pageWidth = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth
  }));
  expect(pageWidth.scrollWidth).toBeLessThanOrEqual(pageWidth.clientWidth);

  const listToggle = page.getByRole('button', { name: '목록', exact: true });
  await expect(listToggle).toHaveAttribute('aria-expanded', 'false');
  await listToggle.click();
  await expect(titleInput).toBeHidden();
  await expect(page.getByRole('heading', { name: /개 글/ })).toBeVisible();

  const returnToEditor = page.getByRole('button', { name: '편집기로 돌아가기' });
  await expect(returnToEditor).toBeFocused();
  await returnToEditor.click();
  await expect(titleInput).toBeVisible();
  await expect(listToggle).toBeFocused();
});

test('admin editor inserts, renders, and reopens Mermaid diagrams', async ({ page }) => {
  await openAdminEditor(page);

  const toolbar = page.getByRole('toolbar', { name: '글 편집 도구' });
  await toolbar.getByRole('button', { name: '고급 삽입 메뉴' }).click();
  await page.getByRole('button', { name: /Mermaid 다이어그램/ }).click();

  const insertDialog = page.getByRole('dialog', { name: 'Mermaid 다이어그램 삽입' });
  const sourceInput = insertDialog.getByRole('textbox', { name: 'Mermaid 다이어그램 삽입' });
  const normalizedSource = [
    '%%{init: {"htmlLabels": true}}%%',
    'flowchart LR',
    '    A["사용자 브라우저"] --> B["Nginx<br/>80 · 443"]'
  ].join('\n');
  const fencedSource = ['```mermaid', normalizedSource, '```'].join('\n');
  await sourceInput.fill(fencedSource);
  await insertDialog.getByRole('button', { name: '삽입' }).click();

  const mermaidNode = page.locator('.mermaid-node');
  await expect(mermaidNode).toBeVisible();
  await expect(mermaidNode.locator('.mermaid-render svg')).toBeVisible({ timeout: 15_000 });
  await expect(mermaidNode.locator('.mermaid-render svg')).toContainText('사용자 브라우저');

  await mermaidNode.getByRole('button', { name: 'Mermaid 소스 편집' }).click();
  const editDialog = page.getByRole('dialog', { name: 'Mermaid 다이어그램 편집' });
  await expect(editDialog.getByRole('textbox')).toHaveValue(normalizedSource);
  await page.keyboard.press('Escape');
});

test('published fenced Mermaid code block renders as a public diagram', async ({ page }) => {
  const uniqueId = Date.now();
  const title = `E2E Mermaid Code Block ${uniqueId}`;
  const slug = `e2e-mermaid-code-block-${uniqueId}`;
  const mermaidSource = [
    '```mermaid',
    'flowchart LR',
    '    A["사용자 브라우저"] --> B["Nginx<br/>80 · 443"]',
    '```'
  ].join('\n');
  let postId: string | null = null;

  await openAdminEditor(page);

  try {
    const created = await page.evaluate(async (payload) => {
      const response = await fetch('/api/posts', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      return response.json() as Promise<{ id: string }>;
    }, {
      slug,
      title,
      summary: 'Mermaid fenced code block E2E coverage.',
      category: '미분류',
      contentJson: {
        type: 'doc',
        content: [
          {
            type: 'codeBlock',
            attrs: { language: 'plaintext' },
            content: [{ type: 'text', text: mermaidSource }]
          }
        ]
      },
      publishedAt: '2026-07-14',
      tags: ['e2e', 'mermaid'],
      status: 'published',
      sections: []
    });

    postId = created.id;

    await page.goto(`/posts/${slug}`);
    await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();

    const diagram = page.locator('.mermaid-block svg');
    await expect(diagram).toBeVisible({ timeout: 15_000 });
    await expect(diagram).toContainText('사용자 브라우저');
    await expect(page.getByText('```mermaid')).toHaveCount(0);
  } finally {
    if (postId) {
      await deletePostFromAdmin(page, postId);
    }
  }
});

test('publish shortcut opens the confirmation dialog instead of publishing immediately', async ({ page }) => {
  await openAdminEditor(page);
  await page.getByPlaceholder('제목을 입력하세요').fill('Shortcut publish safety');

  const toolbar = page.getByRole('toolbar', { name: '글 편집 도구' });
  const paragraphSelect = toolbar.getByRole('button', { name: /문단:/ });
  await paragraphSelect.click();
  const paragraphList = page.getByRole('listbox', { name: '문단' });
  await expect(paragraphList).toBeVisible();

  await page.keyboard.press('Control+Enter');
  const dialog = page.getByRole('dialog', { name: '발행 설정' });
  await expect(dialog).toBeVisible();
  await expect(dialog).toBeFocused();
  await expect(paragraphList).toBeHidden();
  await expect(dialog.getByRole('button', { name: '비공개 저장' })).toBeVisible();
  const dialogLayout = await dialog.evaluate(element => {
    const dialogRect = element.getBoundingClientRect();
    const qualityRect = element.querySelector('[aria-labelledby="publish-quality-title"]')
      ?.getBoundingClientRect();
    return {
      scrollTop: element.scrollTop,
      qualityInsideViewport: Boolean(
        qualityRect
        && qualityRect.top >= dialogRect.top
        && qualityRect.top < dialogRect.bottom
      )
    };
  });
  expect(dialogLayout.scrollTop).toBeLessThanOrEqual(1);
  expect(dialogLayout.qualityInsideViewport).toBe(true);

  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(paragraphSelect).toBeFocused();
});

test('failed publish validation keeps the editor in draft status', async ({ page }) => {
  await openAdminEditor(page);
  await page.getByPlaceholder('제목을 입력하세요').fill('Publish validation status safety');

  await page.getByTestId('post-publish-button').click();
  const dialog = page.getByRole('dialog', { name: '발행 설정' });
  await dialog.locator('input[type="radio"]').first().check();
  await expect(dialog.locator('[data-quality-id="required-fields"]'))
    .toContainText('본문이 없습니다');
  await dialog.getByRole('button', { name: '공개 발행' }).click();

  await expect(dialog).toBeVisible();
  await expect(page.getByText('본문 내용을 입력하세요.')).toBeVisible();
  await expect(page.getByLabel('현재 글 상태: 초안')).toContainText('현재: 초안');
});

test('publish dialog reports a duplicate post URL before saving', async ({ page }) => {
  const uniqueId = Date.now();
  const existingSlug = `e2e-duplicate-slug-${uniqueId}`;
  let existingPostId: string | null = null;

  await openAdminEditor(page);

  try {
    const created = await page.evaluate(async (payload) => {
      const response = await fetch('/api/posts', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!response.ok) throw new Error(await response.text());
      return response.json() as Promise<{ id: string }>;
    }, {
      slug: existingSlug,
      title: `Existing duplicate URL post ${uniqueId}`,
      summary: '중복 URL 검증을 위해 미리 생성한 테스트 글입니다.',
      category: '미분류',
      contentJson: createParagraphDocument(`Existing post body ${uniqueId}.`),
      publishedAt: '2026-08-26',
      tags: [],
      status: 'draft',
      sections: []
    });
    existingPostId = created.id;

    await page.reload();
    await expect(page.getByPlaceholder('제목을 입력하세요')).toBeVisible();
    await page.getByPlaceholder('제목을 입력하세요').fill(`New post ${uniqueId}`);
    await page.getByTestId('post-publish-button').click();

    const dialog = page.getByRole('dialog', { name: '발행 설정' });
    await dialog.getByRole('textbox', { name: '글 URL' }).fill(existingSlug);

    const requiredFields = dialog.locator('[data-quality-id="required-fields"]');
    await expect(requiredFields).toContainText('이미 사용 중인 URL입니다');
    await expect(dialog.getByText('1개 필수 확인')).toBeVisible();
  } finally {
    if (existingPostId) {
      await page.keyboard.press('Escape').catch(() => undefined);
      await deletePostFromAdmin(page, existingPostId);
    }
  }
});

test('publish dialog shows non-blocking document quality guidance', async ({ page }) => {
  await openAdminEditor(page);
  await page.getByPlaceholder('제목을 입력하세요').fill('발행 품질 점검 테스트');

  const toolbar = page.getByRole('toolbar', { name: '글 편집 도구' });
  await toolbar.getByRole('button', { name: /문단:/ }).click();
  await page.getByRole('listbox', { name: '문단' }).getByRole('option', { name: '제목 3' }).click();

  const editor = page.locator('.ProseMirror').first();
  await editor.click();
  await page.keyboard.type('상위 제목 없이 작성된 소제목');

  await page.getByTestId('post-publish-button').click();
  const dialog = page.getByRole('dialog', { name: '발행 설정' });
  await dialog.locator('input[type="radio"]').first().check();

  const qualityRegion = dialog.getByRole('region', { name: '발행 전 점검' });
  await expect(qualityRegion).toBeVisible();
  await expect(qualityRegion.locator('[data-quality-id="heading-structure"]'))
    .toContainText('제목 2보다 먼저 나온 제목 3');
  await expect(qualityRegion.locator('[data-quality-id="seo-description"]'))
    .toContainText('50자 이상');
  await expect(dialog.getByRole('button', { name: '공개 발행' })).toBeEnabled();
});

test('admin editor detects autosave drafts with metadata-only changes', async ({ page }) => {
  const uniqueId = Date.now();
  const title = `E2E Autosave Metadata ${uniqueId}`;
  const slug = `e2e-autosave-metadata-${uniqueId}`;
  const summary = 'Metadata autosave regression test summary.';
  const publishedAt = '2026-07-01';
  const body = `Metadata autosave body ${uniqueId}.`;
  const contentJson = createParagraphDocument(body);
  let postId: string | null = null;

  await openAdminEditor(page);

  try {
    const created = await page.evaluate(async (payload) => {
      const response = await fetch('/api/posts', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      return response.json() as Promise<{ id: string }>;
    }, {
      slug,
      title,
      summary,
      category: '미분류',
      contentJson,
      publishedAt,
      tags: ['e2e'],
      status: 'draft',
      sections: []
    });

    postId = created.id;

    const draft = {
      title,
      slug,
      summary,
      category: '미분류',
      contentJson,
      contentHtml: '',
      publishedAt,
      tags: ['e2e'],
      series: '',
      featured: false,
      cover: '',
      status: 'draft',
      scheduledAt: '',
      seoTitle: '',
      seoDescription: '자동저장 SEO 설명만 변경됨',
      seoOgImage: '',
      seoCanonicalUrl: '',
      seoKeywords: ''
    };

    await page.evaluate(({ id, autosaveDraft }) => {
      localStorage.setItem(`hamlog_draft_${id}`, JSON.stringify({
        draft: autosaveDraft,
        updatedAt: '2026-07-01T00:00:00.000Z'
      }));
    }, { id: postId, autosaveDraft: draft });

    await page.goto(`/admin?section=posts&post=${postId}`);
    await expect(page.getByText('임시 저장본이 있습니다. 복구 또는 삭제를 선택하세요.')).toBeVisible();
  } finally {
    if (postId) {
      await deletePostFromAdmin(page, postId);
    }
  }
});

test('admin editor restores legacy partial autosave data safely', async ({ page }) => {
  await openAdminEditor(page);

  await page.evaluate(() => {
    localStorage.setItem('hamlog_draft_new', JSON.stringify({
      title: 'Legacy autosave title',
      contentHtml: '<p>Legacy autosave body</p>'
    }));
  });
  await page.reload();

  await expect(page.getByText('임시 저장본이 있습니다. 복구 또는 삭제를 선택하세요.')).toBeVisible();
  await page.getByRole('button', { name: '복구', exact: true }).click();
  await expect(page.getByPlaceholder('제목을 입력하세요')).toHaveValue('Legacy autosave title');
  await expect(page.locator('.ProseMirror').first()).toContainText('Legacy autosave body');
});

test('admin can publish a simple post and view it publicly', async ({ page }) => {
  const uniqueId = Date.now();
  const title = `E2E Editor Smoke ${uniqueId}`;
  const slug = `e2e-editor-smoke-${uniqueId}`;
  const body = `This post was created by an editor smoke test ${uniqueId}.`;
  const seoTitle = `SEO ${title}`;

  await openAdminEditor(page);
  await page.getByPlaceholder('제목을 입력하세요').fill(title);

  const editor = page.locator('.ProseMirror').first();
  await editor.click();
  await page.keyboard.type(body);

  await page.getByRole('button', { name: /^SEO/ }).click();
  await page.getByPlaceholder('검색 결과 제목').fill(seoTitle);

  await page.getByTestId('post-publish-button').click();
  const publishDialog = page.getByRole('dialog', { name: '발행 설정' });
  await expect(publishDialog).toBeVisible();
  await publishDialog.locator('input[type="radio"]').first().check();
  await expect(publishDialog.locator('[data-quality-id="seo-description"]'))
    .toContainText('권장');

  await Promise.all([
    page.waitForResponse(response =>
      response.url().includes('/api/posts') && response.request().method() === 'POST'
    ),
    publishDialog.getByRole('button', { name: '공개 발행' }).click()
  ]);

  await expect(page.getByText('발행되었습니다.')).toBeVisible();
  await expect(page.getByLabel('현재 글 상태: 발행')).toContainText('현재: 발행');

  await page.keyboard.press('Control+Shift+S');
  await expect(publishDialog).toBeVisible();
  await expect(publishDialog.locator('input[type="radio"]').first()).toBeChecked();
  await page.keyboard.press('Escape');

  await page.setViewportSize({ width: 1700, height: 900 });
  await page.goto(`/posts/${slug}`);
  await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
  await expect(page.getByText(body)).toBeVisible();
  const measurePostContentWidth = () => page.locator('.post-content').evaluate(element =>
    Math.round(element.getBoundingClientRect().width)
  );
  const postContentWidth = await measurePostContentWidth();
  expect(postContentWidth).toBeGreaterThanOrEqual(840);
  expect(postContentWidth).toBeLessThanOrEqual(920);

  await page.setViewportSize({ width: 1535, height: 900 });
  const contentWidthBelowSidebarBreakpoint = await measurePostContentWidth();
  await page.setViewportSize({ width: 1536, height: 900 });
  const contentWidthWithSidebars = await measurePostContentWidth();
  expect(Math.abs(contentWidthWithSidebars - contentWidthBelowSidebarBreakpoint)).toBeLessThanOrEqual(2);

  await page.setViewportSize({ width: 390, height: 844 });
  const mobilePageWidth = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth
  }));
  expect(mobilePageWidth.scrollWidth).toBeLessThanOrEqual(mobilePageWidth.clientWidth);

  const seoResponse = await page.request.get(`${backendOrigin}/posts/${slug}`);
  expect(seoResponse.status()).toBe(200);
  const seoHtml = await seoResponse.text();
  expect(seoHtml).toContain(`<title>${seoTitle}</title>`);
  expect(seoHtml).toContain(`<meta property="og:type" content="article" />`);
  expect(seoHtml).toContain(`/posts/${slug}`);

  const detailResponse = await page.request.get(`${backendOrigin}/api/posts/${slug}`);
  expect(detailResponse.status()).toBe(200);
  const savedPost = await detailResponse.json();
  expect(savedPost.seo?.title).toBe(seoTitle);

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

test('public SPA keeps images, robots, and BlogPosting schema in sync across routes', async ({ page }) => {
  const uniqueId = Date.now();
  const title = `E2E SEO Route State ${uniqueId}`;
  const slug = `e2e-seo-route-state-${uniqueId}`;
  let postId: string | null = null;

  const readBlogPostingSchemas = () => page.evaluate(() => (
    Array.from(document.head.querySelectorAll<HTMLScriptElement>('script[type="application/ld+json"]'))
      .map(script => {
        try {
          return JSON.parse(script.textContent ?? '');
        } catch {
          return null;
        }
      })
      .filter(schema => schema?.['@type'] === 'BlogPosting')
  ));
  const navigateInSpa = (path: string) => page.evaluate(nextPath => {
    window.history.pushState({}, '', nextPath);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, path);

  await openAdminEditor(page);

  try {
    const created = await page.evaluate(async (payload) => {
      const response = await fetch('/api/posts', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      if (!response.ok) throw new Error(await response.text());
      return response.json() as Promise<{ id: string }>;
    }, {
      slug,
      title,
      summary: 'Client-side SEO state regression coverage.',
      category: '미분류',
      contentJson: createParagraphDocument('SEO route state body.'),
      publishedAt: '2026-08-10',
      tags: ['e2e', 'seo'],
      status: 'published',
      sections: []
    });
    postId = created.id;

    await page.goto('/');
    await expect(page.getByRole('heading', { name: '전체 글' })).toBeVisible();
    const homeOgImage = page.locator('meta[property="og:image"]');
    const homeTwitterImage = page.locator('meta[name="twitter:image"]');
    await expect(homeOgImage).toHaveCount(1);
    await expect(homeTwitterImage).toHaveCount(1);
    await expect.poll(() => homeOgImage.getAttribute('content')).not.toBe('');
    const hydratedHomeImage = await homeOgImage.getAttribute('content');
    expect(hydratedHomeImage).toBeTruthy();
    await expect(homeTwitterImage).toHaveAttribute('content', hydratedHomeImage!);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'index, follow');
    await expect(page.locator('link[rel="icon"]')).toHaveAttribute('href', /\/favicon\.svg$/);

    let releasePostRequest: (() => void) | undefined;
    let markPostRequestStarted: (() => void) | undefined;
    const postRequestGate = new Promise<void>(resolve => {
      releasePostRequest = resolve;
    });
    const postRequestStarted = new Promise<void>(resolve => {
      markPostRequestStarted = resolve;
    });
    await page.route(`**/api/posts/${slug}`, async route => {
      markPostRequestStarted?.();
      await postRequestGate;
      await route.continue();
    });

    await page.evaluate(({ postTitle, postSlug }) => {
      document.title = postTitle;
      document.querySelector('link[rel="canonical"]')?.setAttribute(
        'href',
        `${window.location.origin}/posts/${postSlug}`
      );
      const script = document.createElement('script');
      script.type = 'application/ld+json';
      script.text = JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'BlogPosting',
        headline: postTitle
      });
      document.head.appendChild(script);
    }, { postTitle: title, postSlug: slug });

    await navigateInSpa(`/posts/${slug}`);
    await postRequestStarted;
    try {
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'index, follow');
      await expect(page).toHaveTitle(title);
      expect(await readBlogPostingSchemas()).toHaveLength(1);
    } finally {
      releasePostRequest?.();
    }

    await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
    await page.unroute(`**/api/posts/${slug}`);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'index, follow');
    await expect.poll(async () => (await readBlogPostingSchemas()).length).toBe(1);
    const [postSchema] = await readBlogPostingSchemas();
    expect(postSchema.headline).toBe(title);
    expect(postSchema.publisher?.logo?.url).toMatch(/\/favicon\.svg$/);

    await page.getByRole('link', { name: '메인화면으로 돌아가기' }).click();
    await expect(page.getByRole('heading', { name: '전체 글' })).toBeVisible();
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'index, follow');
    await expect.poll(async () => (await readBlogPostingSchemas()).length).toBe(0);

    await navigateInSpa(`/posts/${slug}`);
    await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'index, follow');
    await expect.poll(async () => (await readBlogPostingSchemas()).length).toBe(1);

    await navigateInSpa(`/posts/missing-${uniqueId}`);
    await expect(page.getByRole('heading', { name: '해당 글이 존재하지 않습니다.' })).toBeVisible();
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow');
    await expect.poll(async () => (await readBlogPostingSchemas()).length).toBe(0);

    await navigateInSpa(`/missing-page-${uniqueId}`);
    await expect(page.getByRole('heading', { name: '페이지를 찾을 수 없습니다' })).toBeVisible();
    await expect(page.getByText('404 · Not Found')).toBeVisible();
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow');
    expect(await readBlogPostingSchemas()).toHaveLength(0);

    await page.getByRole('link', { name: '홈으로 돌아가기' }).click();
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'index, follow');
    await expect.poll(() => page.locator('meta[property="og:image"]').getAttribute('content')).not.toBe('');
    await expect.poll(() => page.locator('meta[name="twitter:image"]').getAttribute('content')).not.toBe('');
  } finally {
    if (postId) {
      await deletePostFromAdmin(page, postId);
    }
  }
});
