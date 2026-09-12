import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

const backendOrigin = `http://127.0.0.1:${process.env.E2E_API_PORT ?? process.env.PORT ?? '4100'}`;
const paragraph = (text: string) => ({ type: 'paragraph', content: [{ type: 'text', text }] });
const heading = (text: string, level = 2) => ({ type: 'heading', attrs: { level }, content: [{ type: 'text', text }] });

async function createFixture(request: APIRequestContext, variant = 'standard') {
  const login = await request.post(`${backendOrigin}/api/auth/login`, {
    data: { password: process.env.ADMIN_PASSWORD ?? 'e2e-password' }
  });
  expect(login.ok()).toBe(true);
  const cookie = login.headers()['set-cookie']?.split(';', 1)[0] ?? '';
  const slug = `toc-${variant}-${Date.now()}`;
  const response = await request.post(`${backendOrigin}/api/posts`, {
    headers: { Cookie: cookie, Origin: backendOrigin },
    data: {
      slug, title: slug, summary: '목차의 화면 크기별 배치와 절 링크를 검증하는 글입니다.',
      category: '미분류', tags: ['TOC'], status: 'published', publishedAt: '2026-01-01', sections: [],
      contentJson: {
        type: 'doc',
        content: variant === 'empty' ? [paragraph('제목 없는 본문입니다.')]
          : variant === 'other' ? [heading('다른 글 전용 절'), paragraph('새 목차입니다.')]
            : [heading('첫 번째 절', 1), ...Array.from({ length: 8 }, () => paragraph('첫 번째 절의 내용을 자세히 설명하는 문단입니다. '.repeat(3))),
              heading('반복 제목'), ...Array.from({ length: 8 }, () => paragraph('두 번째 절의 문단입니다. '.repeat(5))),
              heading('반복 제목', 3), ...Array.from({ length: 8 }, () => paragraph('마지막 절의 문단입니다. '.repeat(5)))]
      }
    }
  });
  expect(response.status()).toBe(201);
  const saved = await response.json() as { id: string };
  return {
    slug,
    cleanup: async () => {
      const removed = await request.delete(`${backendOrigin}/api/posts/${saved.id}`, {
        headers: { Cookie: cookie, Origin: backendOrigin }
      });
      expect(removed.status()).toBe(204);
    }
  };
}

const toc = (page: Page) => page.getByRole('navigation', { name: '글 목차' });
const contentHeadings = (page: Page) => page.locator('.post-content').locator('h1, h2, h3');

for (const width of [375, 1280, 1600]) {
  test(`post TOC is accessible and correctly placed at ${width}px`, async ({ page, request }) => {
    const fixture = await createFixture(request);
    try {
      await page.setViewportSize({ width, height: 960 });
      await page.goto(`/posts/${fixture.slug}`);
      await expect(toc(page)).toBeVisible();
      await expect(toc(page)).toHaveCount(1);
      if (width < 1536) {
        const toggle = toc(page).getByRole('button', { name: '목차' });
        await expect(toggle).toHaveAttribute('aria-expanded', 'false');
        await expect(toc(page).getByRole('link')).toHaveCount(0);
        await toggle.focus();
        await page.keyboard.press('Enter');
        await expect(toggle).toHaveAttribute('aria-expanded', 'true');
        const navigationBox = await toc(page).boundingBox();
        const contentBox = await page.locator('.post-content').boundingBox();
        expect(navigationBox!.y + navigationBox!.height).toBeLessThan(contentBox!.y);
      } else {
        await expect(toc(page).getByRole('button')).toHaveCount(0);
        const navigationBox = await toc(page).boundingBox();
        const contentBox = await page.locator('.post-content').boundingBox();
        expect(navigationBox!.x).toBeGreaterThan(contentBox!.x + contentBox!.width);
      }
      await expect(toc(page).getByRole('link')).toHaveCount(3);
      const ids = await contentHeadings(page).evaluateAll(elements => elements.map(element => element.id));
      expect(new Set(ids).size).toBe(ids.length);
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    } finally {
      await fixture.cleanup();
    }
  });
}

test('TOC supports hash links, heading focus, reduced motion, reload and browser history', async ({ page, request }) => {
  const fixture = await createFixture(request);
  try {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(`/posts/${fixture.slug}`);
    await toc(page).getByRole('button', { name: '목차' }).click();
    const links = toc(page).getByRole('link');
    const firstHash = await links.nth(0).getAttribute('href');
    const secondHash = await links.nth(1).getAttribute('href');
    const priorHistoryState = await page.evaluate(() => window.history.state);
    await links.nth(0).focus();
    await page.keyboard.press('Enter');
    await expect(contentHeadings(page).nth(0)).toBeFocused();
    await expect(links.nth(0)).toHaveAttribute('aria-current', 'location');
    await expect.poll(() => page.evaluate(() => window.location.hash)).toBe(firstHash);
    expect(await page.evaluate(() => window.history.state)).toEqual(priorHistoryState);
    await links.nth(1).click();
    await expect(contentHeadings(page).nth(1)).toBeFocused();
    await expect.poll(() => page.evaluate(() => window.location.hash)).toBe(secondHash);
    await page.goBack();
    await expect(contentHeadings(page).nth(0)).toBeFocused();
    await expect.poll(() => page.evaluate(() => window.location.hash)).toBe(firstHash);
    await page.goForward();
    await expect(contentHeadings(page).nth(1)).toBeFocused();
    await page.reload();
    await expect(contentHeadings(page).nth(1)).toBeFocused();
    await expect.poll(() => contentHeadings(page).nth(1).evaluate(element => Math.round(element.getBoundingClientRect().top))).toBe(96);
  } finally {
    await fixture.cleanup();
  }
});

test('direct server-rendered anchors survive hydration and duplicate headings', async ({ page, request }) => {
  const fixture = await createFixture(request);
  const targetHash = `#${encodeURIComponent('heading--반복-제목-2')}`;
  let releaseClient = () => {};
  const gate = new Promise<void>(resolve => { releaseClient = resolve; });
  await page.route(/\/assets\/.*\.js(?:\?.*)?$/, async route => {
    await gate;
    await route.continue();
  });
  try {
    await page.goto(`${backendOrigin}/posts/${fixture.slug}${targetHash}`, { waitUntil: 'commit' });
    await expect(page.locator('[data-prerendered="post"]')).toBeVisible();
    const initialIds = await contentHeadings(page).evaluateAll(elements => elements.map(element => element.id));
    expect(initialIds).toEqual(['heading--첫-번째-절', 'heading--반복-제목', 'heading--반복-제목-2']);
    releaseClient();
    await expect(page.locator('[data-prerendered]')).toHaveCount(0);
    await expect(contentHeadings(page).nth(2)).toBeFocused();
    expect(await contentHeadings(page).evaluateAll(elements => elements.map(element => element.id))).toEqual(initialIds);
  } finally {
    releaseClient();
    await fixture.cleanup();
  }
});

test('SPA post navigation replaces the TOC and hides it for posts without headings', async ({ page, request }) => {
  const fixtures = await Promise.all(['standard', 'other', 'empty'].map(variant => createFixture(request, variant)));
  try {
    await page.goto(`/posts/${fixtures[0].slug}`);
    await expect(toc(page)).toBeVisible();
    for (const fixture of fixtures.slice(1)) {
      await page.evaluate(slug => {
        window.history.pushState({}, '', `/posts/${slug}`);
        window.dispatchEvent(new PopStateEvent('popstate'));
      }, fixture.slug);
      await expect(page.getByRole('heading', { level: 1, name: fixture.slug })).toBeVisible();
      if (fixture.slug.includes('-empty-')) {
        await expect(toc(page)).toHaveCount(0);
      } else {
        await toc(page).getByRole('button', { name: '목차' }).click();
        await expect(toc(page).getByRole('link')).toHaveCount(1);
        await expect(toc(page).getByRole('link', { name: '다른 글 전용 절' })).toBeVisible();
        await expect(toc(page).getByRole('link', { name: '첫 번째 절' })).toHaveCount(0);
      }
    }
  } finally {
    for (const fixture of fixtures) await fixture.cleanup();
  }
});

test('TOC preserves authored anchors, avoids ID collisions and excludes legacy H4 headings', async ({ page, request }) => {
  const fixture = await createFixture(request);
  // The editor supports H1–H3 only, so legacy H4 markup must be supplied as
  // HTML rather than a JSON level that the editor renderer normalizes to H1.
  const html = '<h2>intro</h2><h2 id="heading--intro">예약된 절</h2><h3 id="custom:anchor">사용자 지정 절</h3><h3 id="custom:anchor">중복 사용자 절</h3><p id="heading--other">본문</p><h2>other</h2><h4>목차에서 제외되는 H4</h4>';
  await page.route(`**/api/posts/${fixture.slug}`, async route => {
    const response = await route.fetch();
    await route.fulfill({ response, json: { ...await response.json(), contentHtml: html } });
  });
  try {
    await page.goto(`/posts/${fixture.slug}`);
    await expect(toc(page)).toBeVisible();
    await toc(page).getByRole('button', { name: '목차' }).click();
    const ids = await contentHeadings(page).evaluateAll(elements => elements.map(element => element.id));
    expect(ids).toEqual(['heading--intro-2', 'heading--intro', 'custom:anchor', 'custom:anchor-2', 'heading--other-2']);
    await expect(page.locator('.post-content').getByRole('heading', { level: 4, name: '목차에서 제외되는 H4' })).toBeVisible();
    await expect(toc(page).getByRole('link', { name: '목차에서 제외되는 H4' })).toHaveCount(0);
    await toc(page).getByRole('link', { name: '사용자 지정 절', exact: true }).click();
    await expect(contentHeadings(page).nth(2)).toBeFocused();
    await expect.poll(() => page.evaluate(() => decodeURIComponent(window.location.hash))).toBe('#custom:anchor');
  } finally {
    await fixture.cleanup();
  }
});
