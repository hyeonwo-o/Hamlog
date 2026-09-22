import { expect, test } from '@playwright/test';

for (const variant of ['plain-json', 'rich-json', 'legacy-html'] as const) {
  test(`mounting a saved ${variant} document and changing theme does not dirty or autosave its normalized projection`, async ({ page }) => {
    const contentJson = variant === 'plain-json'
      ? { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: '기존 본문' }] }] }
      : variant === 'rich-json'
        ? { type: 'doc', content: [
          { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: '기존 제목' }] },
          { type: 'paragraph', content: [{ type: 'text', text: '색상 본문', marks: [{ type: 'textStyle', attrs: { color: '#1d1916' } }] }] },
          { type: 'paragraph', content: [{ type: 'text', text: '강조 본문', marks: [{ type: 'highlight', attrs: { color: '#fef3c7' } }] }] }
        ] }
        : undefined;
    const contentHtml = variant === 'rich-json'
      ? '<h2>기존 제목</h2><p><span style="color: #1d1916">색상 본문</span></p><p><mark data-color="#fef3c7" style="background-color: #fef3c7; color: inherit">강조 본문</mark></p>'
      : '<p>기존 본문</p>';
    const post = {
      id: `initialization-${variant}`, slug: `initialization-${variant}`, title: '저장된 원본 제목',
      summary: '초기 편집기 정규화 검증', category: '일상', contentJson, contentHtml,
      publishedAt: '2026-09-22', tags: [], sections: [], status: 'draft',
      updatedAt: '2026-09-22T01:00:00.000Z'
    };
    let writes = 0;
    await page.route('**/api/auth/config', route => route.fulfill({ json: { mode: 'password' } }));
    await page.route('**/api/auth/me', route => route.fulfill({ json: { user: { role: 'admin' } } }));
    await page.route('**/api/categories', route => route.fulfill({ json: { categories: [] } }));
    await page.route('**/api/posts**', async route => {
      const request = route.request();
      const path = new URL(request.url()).pathname;
      if (request.method() === 'GET' && path === '/api/posts') return route.fulfill({ json: { posts: [post], total: 1 } });
      if (request.method() === 'GET' && path.endsWith('/revisions')) return route.fulfill({ json: [] });
      writes += 1;
      return route.fulfill({ status: 405, json: { message: 'Unexpected test write' } });
    });
    const recovery = () => page.evaluate(id => JSON.parse(localStorage.getItem(`hamlog_draft_${id}`) ?? 'null'), post.id);
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto(`/admin?section=posts&post=${post.id}`);
    const title = page.getByPlaceholder('제목을 입력하세요');
    const editor = page.locator('.ProseMirror');
    await expect(title).toHaveValue(post.title);
    await expect(editor).toContainText(variant === 'rich-json' ? '색상 본문' : '기존 본문');
    // Cross the startup and browser-save debounce boundary before checking that
    // schema defaults/HTML serialization have not become author edits.
    await page.waitForTimeout(1_200);
    await page.getByRole('radiogroup', { name: '화면 테마' }).getByRole('radio', { name: '라이트', exact: true }).check();
    await page.getByRole('radiogroup', { name: '화면 테마' }).getByRole('radio', { name: '다크', exact: true }).check();
    await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
    expect(await recovery()).toBeNull();
    await expect(page.getByText('저장되지 않은 변경', { exact: true })).toHaveCount(0);
    expect(writes).toBe(0);

    // Metadata-only edits must retain the original body representation rather
    // than persisting the editor's automatic schema/HTML normalization.
    await title.fill('제목만 수정');
    await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
    const metadataEdit = await recovery();
    expect(metadataEdit.draft.contentJson).toEqual(contentJson);
    expect(metadataEdit.draft.contentHtml).toBe(contentHtml);
    expect(metadataEdit.baseUpdatedAt).toBe(post.updatedAt);
    await title.fill(post.title);
    await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
    expect(await recovery()).toBeNull();
    await expect(page.getByText('저장되지 않은 변경', { exact: true })).toHaveCount(0);

    // Real document changes still flow synchronously through the update handler.
    await editor.locator('p').last().click();
    await page.keyboard.press('End');
    await page.keyboard.insertText(' 실제 본문 수정');
    await expect(page.getByText('저장되지 않은 변경', { exact: true })).toBeVisible();
    await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
    expect(JSON.stringify((await recovery()).draft.contentJson)).toContain('실제 본문 수정');
    expect(writes).toBe(0);
  });
}
