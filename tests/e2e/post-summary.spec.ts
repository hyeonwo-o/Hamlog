import { expect, test, type Locator, type Page } from '@playwright/test';

const backendOrigin = `http://127.0.0.1:${process.env.E2E_API_PORT ?? process.env.PORT ?? '4100'}`;

async function checkSummaryLayout(page: Page, summary: Locator, text: string) {
  await expect(summary).toHaveText(text);
  await expect(summary).toHaveCSS('word-break', 'keep-all');
  await expect(summary).toHaveCSS('overflow-wrap', 'anywhere');

  for (const width of [1440, 320]) {
    await page.setViewportSize({ width, height: 900 });
    const layout = await summary.evaluate(element => {
      const heading = element.parentElement!.querySelector('h1')!;
      const rect = element.getBoundingClientRect();
      const headingRect = heading.getBoundingClientRect();
      const node = element.firstChild!;
      const start = node.textContent!.indexOf('사이트와');
      const range = document.createRange();
      range.setStart(node, start);
      range.setEnd(node, start + '사이트와'.length);
      return {
        width: rect.width,
        headingWidth: headingRect.width,
        left: rect.left,
        headingLeft: headingRect.left,
        wordLines: range.getClientRects().length,
        scrollWidth: document.documentElement.scrollWidth,
        viewportWidth: document.documentElement.clientWidth
      };
    });
    expect(layout.width).toBeCloseTo(layout.headingWidth, 0);
    expect(layout.left).toBeCloseTo(layout.headingLeft, 0);
    expect(layout.wordLines).toBe(1);
    expect(layout.scrollWidth).toBeLessThanOrEqual(layout.viewportWidth);
  }
}

test('post summaries use the heading width and wrap safely before and after hydration', async ({ page, request }) => {
  const slug = `summary-layout-${Date.now()}`;
  const summary = `협업 문의를 정리하기 어렵다는 숏폼 크리에이터의 요청에서 시작해, 소개·문의 사이트와 OpenClaw 요약, 텔레그램 알림을 연결한 프로젝트. AI 개발 도구를 활용한 과정과 장애 처리, 검증 범위를 정리했다. https://example.com/${'long-path'.repeat(16)}`;
  const login = await request.post(`${backendOrigin}/api/auth/login`, {
    data: { password: process.env.ADMIN_PASSWORD ?? 'e2e-password' }
  });
  expect(login.ok()).toBe(true);
  const headers = { Cookie: login.headers()['set-cookie'].split(';', 1)[0], Origin: backendOrigin };
  let postId = '';
  try {
    const response = await request.post(`${backendOrigin}/api/posts`, {
      headers,
      data: {
        title: '요약문 레이아웃 확인', slug, summary, category: '테스트',
        contentJson: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: '본문입니다.' }] }] },
        status: 'published', tags: [], sections: []
      }
    });
    expect(response.status()).toBe(201);
    postId = (await response.json()).id;

    let releaseBundle = () => {};
    const gate = new Promise<void>(resolve => { releaseBundle = resolve; });
    await page.route(/\/assets\/.*\.js(?:\?.*)?$/, async route => {
      await gate;
      await route.continue();
    });
    const navigation = page.goto(`${backendOrigin}/posts/${slug}`);
    try {
      await checkSummaryLayout(page, page.locator('.prerender-article-header > p:not(.prerender-category)'), summary);
    } finally {
      releaseBundle();
      await navigation;
    }
    await checkSummaryLayout(page, page.locator('.post-summary'), summary);
    const saved = await request.get(`${backendOrigin}/api/posts/${slug}`);
    expect((await saved.json()).summary).toBe(summary);
  } finally {
    if (postId) {
      const response = await request.delete(`${backendOrigin}/api/posts/${postId}`, { headers });
      expect(response.status()).toBe(204);
    }
  }
});
