import { expect, test, type Page, type Route } from '@playwright/test';

const profile = {
  title: '테스트 블로그', name: '작성자', role: '개발자', tagline: '개발 기록', description: '회귀 테스트',
  location: '', profileImage: '', favicon: '/favicon.svg', email: '', siteUrl: 'https://example.com',
  social: {}, stack: [], now: '', display: {}
};
const postFor = (id: string, patch = {}) => ({
  id, slug: id, title: `글 ${id}`, summary: '프론트엔드 회귀 테스트', category: '테스트',
  contentHtml: '<p>안전한 본문</p>', publishedAt: '2026-09-01', updatedAt: '2026-09-01T00:00:00.000Z',
  tags: [], sections: [], status: 'published', ...patch
});

async function mockApplication(page: Page, posts: ReturnType<typeof postFor>[]) {
  await page.route(/^http:\/\/[^/]+\/api\//, async route => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    if (path === '/api/auth/config') return route.fulfill({ json: { mode: 'password' } });
    if (path === '/api/auth/me') return route.fulfill({ json: { user: { role: 'admin' } } });
    if (path === '/api/profile') return route.fulfill({ json: { profile } });
    if (path === '/api/categories') return route.fulfill({ json: { categories: [] } });
    if (path === '/api/posts') return route.fulfill({ json: { posts, total: posts.length } });
    if (path.endsWith('/revisions')) return route.fulfill({ json: [] });
    if (path.endsWith('/view')) return route.fulfill({ json: { slug: path.split('/')[3], views: 1 } });
    if (path.startsWith('/api/posts/')) {
      const post = posts.find(item => item.slug === decodeURIComponent(path.split('/').at(-1) ?? ''));
      return route.fulfill(post ? { json: post } : { status: 404, json: { message: '없는 글' } });
    }
    if (path === '/api/comments') return route.fulfill({ json: { comments: [] } });
    if (path === '/api/analytics/public') {
      return route.fulfill({ json: { totalVisitors: 0, realtimeVisitors: 0 } });
    }
    if (path.startsWith('/api/analytics/')) return route.fulfill({ status: 204 });
    return route.fulfill({ status: 404, json: { message: 'Unexpected mocked request' } });
  });
  // Frame rendering is verified locally without contacting video services.
  await page.route('https://**', route => route.abort());
}

test('public content preserves YouTube embeds while rejecting arbitrary frame URLs and attributes', async ({ page }) => {
  const rejected = [
    'https://evil.example/embed/dQw4w9WgXcQ',
    'https://www.youtube.com.evil.example/embed/dQw4w9WgXcQ',
    'https://www.youtube.com:444/embed/dQw4w9WgXcQ',
    'https://user@www.youtube.com/embed/dQw4w9WgXcQ',
    'http://www.youtube.com/embed/dQw4w9WgXcQ',
    '//www.youtube.com/embed/dQw4w9WgXcQ',
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    'https://www.youtube.com/embed/dQw4w9WgXcQ/extra',
    'javascript:window.__unsafeIframe=true',
    'data:text/html,<script>parent.__unsafeIframe=true</script>'
  ];
  const contentHtml = `
    <h2>동영상</h2>
    <div data-youtube-video><iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ?controls=0&amp;start=30&amp;enablejsapi=1&amp;origin=https://evil.example"
      title="영상 제목" onload="window.__unsafeIframe=true" srcdoc="&lt;script&gt;parent.__unsafeIframe=true&lt;/script&gt;" allow="camera; microphone"></iframe></div>
    <iframe src="https://www.youtube-nocookie.com/embed/aqz-KE-bpKQ"></iframe>
    <iframe src="https://www.youtube-nocookie.com/embed/videoseries?list=PL1234567890&amp;rel=0"></iframe>
    ${rejected.map(src => `<iframe src="${src}"></iframe>`).join('')}
  `;
  const post = postFor('youtube-safe', { contentHtml });
  await mockApplication(page, [post]);
  const unsafeRequests: string[] = [];
  page.on('request', request => {
    if (request.url().includes('evil.example')) unsafeRequests.push(request.url());
  });
  await page.goto(`/posts/${post.slug}`);
  const frames = page.locator('.post-content iframe');
  await expect(frames).toHaveCount(3);
  await expect(frames.nth(0)).toHaveAttribute('src', 'https://www.youtube.com/embed/dQw4w9WgXcQ?controls=0&start=30');
  await expect(frames.nth(0)).toHaveAttribute('title', '영상 제목');
  await expect(frames.nth(1)).toHaveAttribute('title', 'YouTube 동영상');
  await expect(frames.nth(2)).toHaveAttribute('src', 'https://www.youtube-nocookie.com/embed/videoseries?list=PL1234567890&rel=0');
  for (const frame of await frames.all()) {
    await expect(frame).toHaveAttribute('sandbox', 'allow-scripts allow-same-origin allow-presentation');
    await expect(frame).toHaveAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
    await expect(frame).not.toHaveAttribute('srcdoc');
    await expect(frame).not.toHaveAttribute('onload');
    expect(await frame.getAttribute('allow')).not.toMatch(/camera|microphone/);
  }
  expect(unsafeRequests).toEqual([]);
  expect(await page.evaluate(() => '__unsafeIframe' in window)).toBe(false);
});

test('editor preview keeps the saved YouTube video with the same safe frame policy', async ({ page }) => {
  const post = postFor('youtube-preview', {
    contentJson: { type: 'doc', content: [{ type: 'youtube', attrs: { src: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' } }] },
    contentHtml: '<div data-youtube-video><iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ?controls=0"></iframe></div>'
  });
  await mockApplication(page, [post]);
  await page.goto(`/admin?section=posts&post=${post.id}`);
  await expect(page.getByPlaceholder('제목을 입력하세요')).toHaveValue(post.title);
  await page.getByTestId('post-preview-toggle').click();
  const frame = page.locator('.rich-content iframe');
  await expect(frame).toBeVisible();
  await expect(frame).toHaveAttribute('src', 'https://www.youtube.com/embed/dQw4w9WgXcQ?controls=0');
  await expect(frame).toHaveAttribute('sandbox', 'allow-scripts allow-same-origin allow-presentation');
  await expect(frame).toHaveAttribute('title', 'YouTube 동영상');
});

for (const mode of ['blocked-read', 'full-write', 'invalid-values'] as const) {
  test(`admin filters remain usable with ${mode} browser preferences`, async ({ page }) => {
    await page.setViewportSize({ width: 1700, height: 1000 });
    await page.addInitScript(mode => {
      const key = 'hamlog:admin:post-filter';
      if (mode === 'invalid-values') {
        localStorage.setItem(key, JSON.stringify({ status: 'unknown', category: { name: 'bad' }, includeDescendants: 'false' }));
      }
      const getItem = Storage.prototype.getItem;
      const setItem = Storage.prototype.setItem;
      Storage.prototype.getItem = function(name) {
        if (mode === 'blocked-read' && name === key) throw new DOMException('Storage blocked', 'SecurityError');
        return getItem.call(this, name);
      };
      Storage.prototype.setItem = function(name, value) {
        if (mode === 'full-write' && name === key) throw new DOMException('Storage full', 'QuotaExceededError');
        return setItem.call(this, name, value);
      };
    }, mode);
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    const published = postFor('published-filter');
    const draft = postFor('draft-filter', { status: 'draft' });
    await mockApplication(page, [published, draft]);
    await page.goto(`/admin?section=posts&post=${published.id}`);
    await expect(page.getByPlaceholder('제목을 입력하세요')).toHaveValue(published.title);
    const list = page.locator('#admin-post-list-panel');
    await expect(list.getByRole('heading', { name: published.title, exact: true })).toBeVisible();
    await expect(list.getByRole('heading', { name: draft.title, exact: true })).toBeVisible();
    await list.getByRole('button', { name: '필터 열기', exact: true }).click();
    await expect(list.getByRole('button', { name: '필터 숨기기', exact: true })).toBeVisible();
    await list.getByRole('button', { name: /^초안\s*\d+$/ }).click();
    await expect(list.getByRole('heading', { name: published.title, exact: true })).toHaveCount(0);
    await expect(list.getByRole('heading', { name: draft.title, exact: true })).toBeVisible();
    expect(errors).toEqual([]);
  });
}

test('failed comment loading shows a retry instead of claiming that the list is empty', async ({ page }) => {
  const post = postFor('comments-retry');
  await mockApplication(page, [post]);
  let available = false;
  await page.route('**/api/comments?**', route => route.fulfill(available
    ? { json: { comments: [{ id: 'comment', author: '독자', content: '불러온 댓글', createdAt: '2026-09-01' }] } }
    : { status: 503, json: { message: '댓글 서버에 연결하지 못했습니다.' } }));
  await page.goto(`/posts/${post.slug}`);
  await expect(page.getByRole('alert')).toContainText('댓글 서버에 연결하지 못했습니다.');
  await expect(page.getByText('첫 번째 댓글을 남겨보세요.')).toHaveCount(0);
  available = true;
  await page.getByRole('button', { name: '댓글 다시 불러오기' }).click();
  await expect(page.getByText('불러온 댓글', { exact: true })).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('an old comment response cannot replace comments after opening another post', async ({ page }) => {
  const first = postFor('comments-old');
  const second = postFor('comments-new');
  await mockApplication(page, [first, second]);
  const cancelled: string[] = [];
  page.on('requestfailed', request => {
    if (request.url().includes(`/api/comments?postId=${first.id}`)) cancelled.push(request.url());
  });
  let held: Route | undefined;
  await page.route('**/api/comments?**', async route => {
    if (new URL(route.request().url()).searchParams.get('postId') === first.id) {
      held = route;
      return;
    }
    return route.fulfill({ json: { comments: [{ id: 'new-comment', author: '새 독자', content: '새 글의 댓글', createdAt: '2026-09-01' }] } });
  });
  await page.goto(`/posts/${first.slug}`);
  await expect.poll(() => Boolean(held)).toBe(true);
  await page.getByRole('link').filter({ has: page.getByRole('heading', { name: second.title, exact: true }) }).click();
  await expect(page.getByRole('heading', { level: 1, name: second.title, exact: true })).toBeVisible();
  await expect(page.getByText('새 글의 댓글', { exact: true })).toBeVisible();
  await expect.poll(() => cancelled.length).toBeGreaterThan(0);
  await held!.fulfill({ json: { comments: [{ id: 'old-comment', author: '예전 독자', content: '예전 글의 댓글', createdAt: '2026-09-01' }] } }).catch(() => undefined);
  await expect(page.getByText('예전 글의 댓글', { exact: true })).toHaveCount(0);
  await expect(page.getByText('새 글의 댓글', { exact: true })).toBeVisible();
});
