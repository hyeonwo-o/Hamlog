import { expect, test } from '@playwright/test';

const loginPasswords = Array.from(new Set([
  process.env.ADMIN_PASSWORD,
  'admin1234',
  'e2e-password'
].filter(Boolean))) as string[];

async function login(page: import('@playwright/test').Page) {
  await page.goto('/');
  for (const password of loginPasswords) {
    const loggedIn = await page.evaluate(async (candidate) => {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: candidate })
      });
      return response.ok;
    }, password);
    if (loggedIn) return;
  }
  throw new Error('E2E admin login failed');
}

test('main navigation opens the dedicated graph page', async ({ page }) => {
  await page.goto('/');

  const homeNavigation = page.getByRole('navigation', { name: '주요 메뉴' });
  await expect(homeNavigation).toBeVisible();
  await expect(homeNavigation.getByRole('link', { name: '홈' })).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('heading', { name: '그래프 뷰', exact: true })).toHaveCount(0);

  await homeNavigation.getByRole('link', { name: '그래프뷰' }).click();

  await expect(page).toHaveURL(/\/graph$/);
  await expect(page.getByRole('heading', { level: 1, name: '그래프뷰' })).toBeVisible();

  const graphNavigation = page.getByRole('navigation', { name: '주요 메뉴' });
  await expect(graphNavigation.getByRole('link', { name: '그래프뷰' })).toHaveAttribute('aria-current', 'page');

  await graphNavigation.getByRole('link', { name: '홈' }).click();
  await expect(page).toHaveURL(/\/$/);
});

test('graph search, relationship filters, and URL state work together', async ({ page }) => {
  const uniqueId = Date.now();
  const targetSlug = `e2e-graph-target-${uniqueId}`;
  const sourceSlug = `e2e-graph-source-${uniqueId}`;
  const targetTitle = `Graph target ${uniqueId}`;

  await login(page);

  try {
    await page.evaluate(async (payloads) => {
      const results: Array<{ id: string }> = [];
      for (const payload of payloads) {
        const response = await fetch('/api/posts', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (!response.ok) throw new Error(await response.text());
        results.push(await response.json());
      }
      return results;
    }, [
      {
        slug: targetSlug,
        title: targetTitle,
        summary: 'Graph search target.',
        category: 'Graph E2E',
        series: 'Graph exploration',
        contentJson: {
          type: 'doc',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Target body.' }] }]
        },
        publishedAt: '2026-07-01',
        tags: ['graph'],
        status: 'published',
        sections: []
      },
      {
        slug: sourceSlug,
        title: `Graph source ${uniqueId}`,
        summary: 'Graph link source.',
        category: 'Graph E2E',
        series: 'Graph exploration',
        linkedPostSlugs: [targetSlug],
        contentJson: {
          type: 'doc',
          content: [{
            type: 'paragraph',
            content: [{
              type: 'text',
              text: 'Linked target',
              marks: [{ type: 'link', attrs: { href: `/posts/${targetSlug}`, target: null, rel: 'noopener noreferrer nofollow', class: null } }]
            }]
          }]
        },
        publishedAt: '2026-07-02',
        tags: ['graph'],
        status: 'published',
        sections: []
      }
    ]);
    await page.goto('/graph');

    const search = page.getByRole('searchbox', { name: '그래프 노드 검색' });
    await expect(search).toBeVisible();
    await search.fill(targetTitle);
    await page.getByRole('option', { name: new RegExp(targetTitle) }).click();

    await expect(page).toHaveURL(new RegExp(`node=post%3A${targetSlug}`));
    await expect(page).toHaveURL(/[?&]z=/);

    await page.getByRole('button', { name: /^필터/ }).click();
    const relationFilters = page.getByRole('group', { name: '그래프 관계 필터' });
    await relationFilters.getByRole('button', { name: '본문 링크' }).click();
    await expect(page).toHaveURL(/relation=link/);
    await expect(relationFilters.getByRole('button', { name: '본문 링크' })).toHaveAttribute('aria-pressed', 'true');

    await page.getByRole('button', { name: '추가 설정' }).click();
    await page.getByRole('checkbox', { name: '라벨 표시' }).uncheck();
    await expect(page).toHaveURL(/labels=0/);

    await page.reload();
    await page.getByRole('button', { name: /^필터/ }).click();
    await expect(page.getByRole('group', { name: '그래프 관계 필터' }).getByRole('button', { name: '본문 링크' })).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: '추가 설정' }).click();
    await expect(page.getByRole('checkbox', { name: '라벨 표시' })).not.toBeChecked();

    await page.getByRole('button', { name: '그래프 초기화' }).click();
    await expect(page).toHaveURL(/\/graph$/);
  } finally {
    await page.evaluate(async (postSlugs) => {
      const response = await fetch('/api/posts', { credentials: 'include' });
      if (!response.ok) return;
      const { posts } = await response.json() as {
        posts: Array<{ id: string; slug: string }>;
      };
      const targets = posts.filter(post => postSlugs.includes(post.slug));
      await Promise.all(targets.map(post => fetch(`/api/posts/${post.id}`, {
          method: 'DELETE',
          credentials: 'include'
      })));
    }, [targetSlug, sourceSlug]);
  }
});
