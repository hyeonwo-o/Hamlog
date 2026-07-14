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
  await expect(toolbar.getByRole('button', { name: /본문:/ })).toHaveAttribute('aria-expanded', 'false');

  await toolbar.getByRole('button', { name: '고급 삽입 메뉴' }).click();
  await expect(page.getByRole('button', { name: /수식/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /유튜브/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Mermaid 다이어그램/ })).toBeVisible();
  await page.keyboard.press('Escape');

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

test('admin editor inserts, renders, and reopens Mermaid diagrams', async ({ page }) => {
  await openAdminEditor(page);

  const toolbar = page.getByRole('toolbar', { name: '글 편집 도구' });
  await toolbar.getByRole('button', { name: '고급 삽입 메뉴' }).click();
  await page.getByRole('button', { name: /Mermaid 다이어그램/ }).click();

  const insertDialog = page.getByRole('dialog', { name: 'Mermaid 다이어그램 삽입' });
  const sourceInput = insertDialog.getByRole('textbox', { name: 'Mermaid 다이어그램 삽입' });
  await sourceInput.fill('flowchart LR\n    A[Write] --> B[Preview]');
  await insertDialog.getByRole('button', { name: '삽입' }).click();

  const mermaidNode = page.locator('.mermaid-node');
  await expect(mermaidNode).toBeVisible();
  await expect(mermaidNode.locator('.mermaid-render svg')).toBeVisible({ timeout: 15_000 });

  await mermaidNode.getByRole('button', { name: 'Mermaid 소스 편집' }).click();
  const editDialog = page.getByRole('dialog', { name: 'Mermaid 다이어그램 편집' });
  await expect(editDialog.getByRole('textbox')).toHaveValue('flowchart LR\n    A[Write] --> B[Preview]');
  await page.keyboard.press('Escape');
});

test('publish shortcut opens the confirmation dialog instead of publishing immediately', async ({ page }) => {
  await openAdminEditor(page);
  await page.getByPlaceholder('제목을 입력하세요').fill('Shortcut publish safety');

  await page.keyboard.press('Control+Enter');
  const dialog = page.getByRole('dialog', { name: '발행 설정' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: '비공개 저장' })).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
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
  await expect(page.getByRole('heading', { name: '발행' })).toBeVisible();
  await page.locator('input[type="radio"]').first().check();

  await Promise.all([
    page.waitForResponse(response =>
      response.url().includes('/api/posts') && response.request().method() === 'POST'
    ),
    page.getByRole('button', { name: '공개 발행' }).click()
  ]);

  await expect(page.getByText('발행되었습니다.')).toBeVisible();

  await page.goto(`/posts/${slug}`);
  await expect(page.getByRole('heading', { name: title })).toBeVisible();
  await expect(page.getByText(body)).toBeVisible();

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
