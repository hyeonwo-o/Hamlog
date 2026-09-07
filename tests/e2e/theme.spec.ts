import { expect, test, type Locator } from '@playwright/test';

const backendOrigin = `http://127.0.0.1:${process.env.E2E_API_PORT ?? process.env.PORT ?? '4100'}`;
const themeControl = '화면 테마';

async function expectReadableText(locator: Locator) {
  const contrast = await locator.evaluate(element => {
    const parse = (color: string) => {
      const values = color.match(/[\d.]+/g)?.map(Number) ?? [];
      return [values[0] ?? 0, values[1] ?? 0, values[2] ?? 0, values[3] ?? 1];
    };
    const blend = (top: number[], bottom: number[]) => top.slice(0, 3).map(
      (channel, index) => channel * top[3] + bottom[index] * (1 - top[3])
    );
    const parents = [];
    for (let current: Element | null = element; current; current = current.parentElement) parents.unshift(current);
    let background = [255, 255, 255];
    for (const parent of parents) background = blend(parse(getComputedStyle(parent).backgroundColor), background);
    const foreground = blend(parse(getComputedStyle(element).color), background);
    const luminance = (rgb: number[]) => rgb.map(channel => {
      const normalized = channel / 255;
      return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
    }).reduce((total, channel, index) => total + channel * [0.2126, 0.7152, 0.0722][index], 0);
    const a = luminance(foreground);
    const b = luminance(background);
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  });
  expect(contrast).toBeGreaterThanOrEqual(4.5);
}

test('theme follows the device, persists explicit choices, and synchronizes tabs', async ({ page, context }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');
  const root = page.locator('html');
  const select = page.getByRole('combobox', { name: themeControl });
  await expect(root).toHaveAttribute('data-theme', 'dark');
  await expect(select).toHaveValue('system');
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(16, 21, 30)');

  await select.selectOption('light');
  await expect(root).toHaveAttribute('data-theme', 'light');
  await page.reload();
  await expect(select).toHaveValue('light');
  await expect(root).toHaveAttribute('data-theme', 'light');
  await page.emulateMedia({ colorScheme: 'light' });
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(root).toHaveAttribute('data-theme', 'light');

  const otherTab = await context.newPage();
  await otherTab.goto('/');
  await otherTab.getByRole('combobox', { name: themeControl }).selectOption('dark');
  await expect(select).toHaveValue('dark');
  await expect(root).toHaveAttribute('data-theme', 'dark');
  await otherTab.close();

  await select.selectOption('system');
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(root).toHaveAttribute('data-theme', 'light');
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(root).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#10151e');

  await page.setViewportSize({ width: 320, height: 720 });
  await expect(select).toBeVisible();
  await expect(page.getByRole('navigation', { name: '주요 메뉴' }).getByRole('link')).toBeVisible();
  expect(await select.evaluate(element => element.getBoundingClientRect().width)).toBeGreaterThanOrEqual(44);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: test.info().outputPath('dark-home-mobile.png') });
});

test('theme switching still works when browser storage is unavailable', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.addInitScript(() => {
    const getItem = Storage.prototype.getItem;
    const setItem = Storage.prototype.setItem;
    Storage.prototype.getItem = function(key) {
      if (key === 'hamlog:theme') throw new DOMException('Storage blocked', 'SecurityError');
      return getItem.call(this, key);
    };
    Storage.prototype.setItem = function(key, value) {
      if (key === 'hamlog:theme') throw new DOMException('Storage full', 'QuotaExceededError');
      return setItem.call(this, key, value);
    };
  });
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('combobox', { name: themeControl }).selectOption('light');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  expect(errors).toEqual([]);
});

for (const preference of ['system', 'light'] as const) {
  test(`production first paint respects ${preference} theme before JavaScript hydration`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.addInitScript(value => localStorage.setItem('hamlog:theme', value), preference);
    let releaseBundle = () => {};
    const gate = new Promise<void>(resolve => { releaseBundle = resolve; });
    await page.route(/\/assets\/.*\.js(?:\?.*)?$/, async route => {
      await gate;
      await route.continue();
    });
    const navigation = page.goto(`${backendOrigin}/`, { waitUntil: 'load' });
    try {
      const shell = page.locator('[data-prerendered="home"]');
      await expect(shell).toBeVisible();
      await expect(page.locator('html')).toHaveAttribute('data-theme', preference === 'system' ? 'dark' : 'light');
      await expect(shell).toHaveCSS('background-color', preference === 'system' ? 'rgb(16, 21, 30)' : 'rgb(255, 255, 255)');
    } finally {
      releaseBundle();
      await navigation;
    }
    await expect(page.locator('[data-prerendered]')).toHaveCount(0);
    await expect(page.getByRole('combobox', { name: themeControl })).toHaveValue(preference);
  });
}

test('dark editor, dialogs, and public diagrams stay readable without changing saved content', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/admin?section=posts');
  await expect(page.getByRole('combobox', { name: themeControl })).toHaveValue('system');
  await page.getByLabel('관리자 비밀번호', { exact: true }).fill(process.env.ADMIN_PASSWORD ?? 'e2e-password');
  await page.getByRole('button', { name: '로그인', exact: true }).click();
  await expect(page.getByPlaceholder('제목을 입력하세요')).toBeVisible();

  const title = `다크모드 문서 ${Date.now()}`;
  let postId = '';
  try {
    const post = await page.evaluate(async title => {
      const response = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title, slug: `dark-theme-${Date.now()}`, status: 'published',
          summary: '다크모드 전환 중에도 문서와 다이어그램의 내용이 보존되는지 확인합니다.',
          category: '테스트', tags: [], sections: [],
          contentJson: {
            type: 'doc', content: [
              { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: '다크모드 제목' }] },
              { type: 'paragraph', content: [{ type: 'text', text: '읽기 쉬운 본문입니다.' }] },
              { type: 'paragraph', content: [{ type: 'text', text: '글자색 문구', marks: [{ type: 'textStyle', attrs: { color: '#1d1916' } }] }] },
              { type: 'mermaid', attrs: { source: 'flowchart LR\n A[입력] --> B[결과]' } },
              { type: 'paragraph', content: [{ type: 'text', text: '강조 문구', marks: [{ type: 'highlight', attrs: { color: '#fef3c7' } }] }] }
            ]
          }
        })
      });
      if (!response.ok) throw new Error(await response.text());
      return response.json() as Promise<{ id: string; slug: string; contentJson: unknown }>;
    }, title);
    postId = post.id;
    await page.goto(`/admin?section=posts&post=${postId}`);
    const toolbar = page.getByRole('toolbar', { name: '글 편집 도구' });
    await expect(page.locator('.ProseMirror')).toHaveCSS('background-color', 'rgb(23, 30, 42)');
    await expect(toolbar).toHaveCSS('background-color', 'rgba(23, 30, 42, 0.95)');
    await expect(page.locator('.ProseMirror span').filter({ hasText: /^글자색 문구$/ })).toHaveCSS('color', 'rgb(229, 234, 243)');
    await expect(page.locator('.ProseMirror mark')).toHaveCSS('color', 'rgb(17, 17, 17)');
    const diagram = page.locator('.mermaid-node .mermaid-render svg');
    await expect(diagram).toBeVisible();
    const initialDiagram = await diagram.getAttribute('id');
    await page.getByRole('combobox', { name: themeControl }).selectOption('light');
    await expect(page.locator('.ProseMirror span').filter({ hasText: /^글자색 문구$/ })).toHaveCSS('color', 'rgb(29, 25, 22)');
    await expect(diagram).not.toHaveAttribute('id', initialDiagram!);
    await page.getByRole('combobox', { name: themeControl }).selectOption('dark');
    await expect(page.getByText('저장되지 않은 변경', { exact: true })).toHaveCount(0);

    await page.getByRole('button', { name: 'Mermaid 소스 편집' }).click();
    const sourceDialog = page.getByRole('dialog');
    await expect(sourceDialog).toHaveCSS('background-color', 'rgb(23, 30, 42)');
    await expect(sourceDialog.getByRole('textbox')).toHaveCSS('color', 'rgb(229, 234, 243)');
    await page.keyboard.press('Escape');
    await page.getByPlaceholder('제목을 입력하세요').focus();
    await page.keyboard.press('Control+Enter');
    const publishDialog = page.getByRole('dialog');
    await expect(publishDialog).toBeVisible();
    await expect(publishDialog).toHaveCSS('background-color', 'rgb(23, 30, 42)');
    await page.screenshot({ path: test.info().outputPath('dark-publish-dialog.png') });
    await page.keyboard.press('Escape');

    await page.goto('/');
    await page.locator(`a[href="/posts/${post.slug}"]`).first().click();
    await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(page.locator('.mermaid-render svg')).toBeVisible();
    await expect(page.locator('.post-content')).toHaveCSS('color', 'rgb(229, 234, 243)');
    await expectReadableText(page.locator('.post-content span').filter({ hasText: /^글자색 문구$/ }));
    await expectReadableText(page.locator('.post-content mark'));
    const unchanged = await page.evaluate(async slug => (await fetch(`/api/posts/${slug}`)).json(), post.slug);
    expect(unchanged.contentJson).toEqual(post.contentJson);
    await page.screenshot({ path: test.info().outputPath('dark-post.png'), fullPage: true });
  } finally {
    if (postId) {
      await page.evaluate(async id => {
        localStorage.removeItem(`hamlog_draft_${id}`);
        await fetch(`/api/posts/${id}`, { method: 'DELETE' });
      }, postId);
    }
  }
});
