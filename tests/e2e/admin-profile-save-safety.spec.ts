import { expect, test, type Page, type Route } from '@playwright/test';
import type { SiteMeta } from '../../src/types/blog';

const cacheKey = 'hamlog-admin-profile-draft';
const savedNotice = '자기소개 정보가 저장되었습니다.';
const unsavedNotice = `${savedNotice} 저장되지 않은 변경이 남아 있습니다.`;

const fixtureProfile = (): SiteMeta => ({
  title: '프로필 저장 검증', name: '작성자', role: '개발자', tagline: '기본 태그라인',
  description: '소개 문장', location: '서울', profileImage: '/avatar.jpg',
  favicon: '/avatar.jpg', email: 'author@example.test', siteUrl: 'https://example.test',
  now: '프로필 편집', stack: ['TypeScript'],
  social: { github: '', linkedin: '', twitter: '', instagram: '', threads: '', telegram: '' },
  display: {
    showProfileImage: true, showLocation: true, showEmail: true,
    showSocialLinks: true, showNow: true, showStack: true
  }
});

const deferred = () => {
  let resolve = () => {};
  const promise = new Promise<void>(done => { resolve = done; });
  return { promise, resolve };
};

async function mockAdmin(page: Page, onSave: (route: Route, profile: SiteMeta) => Promise<void>) {
  const profile = fixtureProfile();
  await page.route('https://fonts.googleapis.com/**', route => route.fulfill({ contentType: 'text/css', body: '' }));
  // Keep all API traffic mocked, including authentication and unrelated bootstrap reads.
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === '/api/profile') {
      if (request.method() === 'PUT') return onSave(route, request.postDataJSON() as SiteMeta);
      return route.fulfill({ json: { profile } });
    }
    if (path === '/api/auth/config') return route.fulfill({ json: { mode: 'password' } });
    if (path === '/api/auth/me') return route.fulfill({ json: { user: { role: 'admin' } } });
    if (path === '/api/posts') return route.fulfill({ json: { posts: [], total: 0 } });
    if (path === '/api/categories') return route.fulfill({ json: { categories: [], total: 0 } });
    return route.fulfill({ status: 404, json: { message: `Unmocked API: ${path}` } });
  });
  await page.goto('/admin?section=profile', { waitUntil: 'domcontentloaded' });
  await expect(page.getByLabel('블로그 이름', { exact: true })).toHaveValue(profile.title);
}

const cachedProfile = (page: Page) => page.evaluate(key => {
  const raw = localStorage.getItem(key);
  return raw ? JSON.parse(raw) as SiteMeta : null;
}, cacheKey);

const displayToggle = (page: Page, label: string) => page.locator('section')
  .filter({ has: page.getByRole('heading', { name: '자기소개 요소 표시 설정', exact: true }) })
  .locator('div.flex.items-center')
  .filter({ has: page.getByText(label, { exact: true }) })
  .getByRole('button');

test('delayed profile success preserves newer fields, nested settings and the cached draft', async ({ page }) => {
  const pending = deferred();
  const requests: SiteMeta[] = [];
  await mockAdmin(page, async (route, submitted) => {
    requests.push(submitted);
    if (requests.length === 1) await pending.promise;
    await route.fulfill({ json: { profile: {
      ...submitted,
      display: { ...submitted.display, showLocation: false }
    } } });
  });
  const title = page.getByLabel('블로그 이름', { exact: true });
  await title.fill('  제출한 제목  ');
  await page.getByLabel('이름', { exact: true }).fill('  정리할 작성자  ');
  await page.getByLabel('GitHub', { exact: true }).fill('  https://github.com/submitted  ');
  await page.getByLabel('LinkedIn', { exact: true }).fill('  https://linkedin.com/in/submitted  ');
  await page.getByRole('button', { name: '소개 저장', exact: true }).click();
  await expect.poll(() => requests.length).toBe(1);
  await expect(title).toBeEditable();
  await title.fill('저장 중 작성한 최신 제목');
  await page.getByLabel('GitHub', { exact: true }).fill('https://github.com/newer');
  await displayToggle(page, '이메일').click();
  await page.getByPlaceholder('스택 추가', { exact: true }).fill('React');
  await page.getByPlaceholder('스택 추가', { exact: true }).press('Enter');
  pending.resolve();
  await expect(page.getByText(unsavedNotice, { exact: true })).toBeVisible();
  await expect(title).toHaveValue('저장 중 작성한 최신 제목');
  await expect(page.getByLabel('이름', { exact: true })).toHaveValue('정리할 작성자');
  await expect(page.getByLabel('GitHub', { exact: true })).toHaveValue('https://github.com/newer');
  await expect(page.getByLabel('LinkedIn', { exact: true })).toHaveValue('https://linkedin.com/in/submitted');
  await expect(displayToggle(page, '이메일')).toHaveText('숨김');
  await expect(displayToggle(page, '로케이션')).toHaveText('숨김');
  await expect.poll(() => cachedProfile(page)).toEqual({
    ...requests[0], title: '저장 중 작성한 최신 제목',
    social: { ...requests[0].social, github: 'https://github.com/newer' },
    display: { ...requests[0].display, showEmail: false, showLocation: false },
    stack: ['TypeScript', 'React']
  });
  expect(requests[0].title).toBe('제출한 제목');
  expect(requests[0].social.github).toBe('https://github.com/submitted');
  expect(requests[0].display.showEmail).toBe(true);
  expect(requests[0].stack).toEqual(['TypeScript']);

  await page.getByRole('button', { name: '소개 저장', exact: true }).click();
  await expect.poll(() => requests.length).toBe(2);
  await expect(page.getByText(savedNotice, { exact: true })).toBeVisible();
  await expect(page.getByText(unsavedNotice, { exact: true })).toBeHidden();
  expect(requests[1].title).toBe('저장 중 작성한 최신 제목');
  expect(requests[1].social.github).toBe('https://github.com/newer');
  expect(requests[1].display.showEmail).toBe(false);
  expect(requests[1].stack).toEqual(['TypeScript', 'React']);
  await expect.poll(() => cachedProfile(page)).toEqual(requests[1]);

  // The last successful response remains the baseline for subsequent typing.
  await title.fill('저장 후 추가 입력');
  await expect(page.getByText(unsavedNotice, { exact: true })).toBeVisible();
  await title.fill(requests[1].title);
  await expect(page.getByText(savedNotice, { exact: true })).toBeVisible();
});

test('unchanged profile success applies server normalization and reports a saved draft', async ({ page }) => {
  const pending = deferred();
  let submitted: SiteMeta | undefined;
  let saved: SiteMeta | undefined;
  await mockAdmin(page, async (route, profile) => {
    submitted = profile;
    await pending.promise;
    saved = { ...profile, tagline: '서버에서 정리한 태그라인' };
    await route.fulfill({ json: { profile: saved } });
  });
  await page.getByLabel('블로그 이름', { exact: true }).fill('  정리할 제목  ');
  await page.getByLabel('GitHub', { exact: true }).fill('  https://github.com/normalized  ');
  await page.getByRole('button', { name: '소개 저장', exact: true }).click();
  await expect.poll(() => submitted?.title).toBe('정리할 제목');
  pending.resolve();
  await expect(page.getByText(savedNotice, { exact: true })).toBeVisible();
  await expect(page.getByLabel('블로그 이름', { exact: true })).toHaveValue('정리할 제목');
  await expect(page.getByLabel('GitHub', { exact: true })).toHaveValue('https://github.com/normalized');
  await expect(page.getByLabel('태그라인', { exact: false })).toHaveValue('서버에서 정리한 태그라인');
  await expect.poll(() => cachedProfile(page)).toEqual(saved);
  await expect(page.getByRole('button', { name: '소개 저장', exact: true })).toBeEnabled();
});

test('failed profile saves keep newer input and cached recovery, and allow a retry', async ({ page }) => {
  const pending = deferred();
  const requests: SiteMeta[] = [];
  await mockAdmin(page, async (route, profile) => {
    requests.push(profile);
    if (requests.length === 1) {
      await pending.promise;
      return route.fulfill({ status: 500, json: { message: '프로필 저장 실패 테스트' } });
    }
    return route.fulfill({ json: { profile } });
  });
  const title = page.getByLabel('블로그 이름', { exact: true });
  await title.fill('실패할 제출 제목');
  await page.getByRole('button', { name: '소개 저장', exact: true }).click();
  await expect.poll(() => requests.length).toBe(1);
  await title.fill('실패해도 남길 최신 제목');
  await page.getByLabel('GitHub', { exact: true }).fill('https://github.com/recovery');
  await displayToggle(page, '이메일').click();
  const beforeFailure = await cachedProfile(page);
  pending.resolve();
  await expect(page.getByText('프로필 저장 실패 테스트', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '소개 저장', exact: true })).toBeEnabled();
  await expect(title).toHaveValue('실패해도 남길 최신 제목');
  await expect(page.getByLabel('GitHub', { exact: true })).toHaveValue('https://github.com/recovery');
  await expect(displayToggle(page, '이메일')).toHaveText('숨김');
  expect(await cachedProfile(page)).toEqual(beforeFailure);
  await expect(page.getByText(savedNotice, { exact: true })).toBeHidden();
  await page.getByRole('button', { name: '소개 저장', exact: true }).click();
  await expect(page.getByText(savedNotice, { exact: true })).toBeVisible();
  await expect(page.getByText('프로필 저장 실패 테스트', { exact: true })).toBeHidden();
  expect(requests).toHaveLength(2);
  expect(requests[1]).toEqual(beforeFailure);
  expect(await cachedProfile(page)).toEqual(beforeFailure);
});

test('same-turn repeated profile save callbacks issue only one request', async ({ page }) => {
  const pending = deferred();
  const requests: SiteMeta[] = [];
  await mockAdmin(page, async (route, profile) => {
    requests.push(profile);
    await pending.promise;
    return route.fulfill({ json: { profile } });
  });
  await page.getByLabel('블로그 이름', { exact: true }).fill('중복 저장 방지');
  await page.getByRole('button', { name: '소개 저장', exact: true }).evaluate(button => {
    // Invoke the same render's callback directly to test the hook guard itself,
    // independently of the button's disabled state after React rerenders.
    const propsKey = Object.keys(button).find(key => key.startsWith('__reactProps$'));
    if (!propsKey) throw new Error('React save-button props not found');
    const props = (button as unknown as Record<string, { onClick: () => void }>)[propsKey];
    const save = props.onClick;
    save();
    save();
    save();
  });
  await expect.poll(() => requests.length).toBe(1);
  await expect(page.getByRole('button', { name: '저장 중...', exact: true })).toBeDisabled();
  pending.resolve();
  await expect(page.getByText(savedNotice, { exact: true })).toBeVisible();
  expect(requests).toHaveLength(1);
  await page.getByLabel('블로그 이름', { exact: true }).fill('다음 저장 가능');
  await page.getByRole('button', { name: '소개 저장', exact: true }).click();
  await expect.poll(() => requests.length).toBe(2);
  await expect(page.getByText(savedNotice, { exact: true })).toBeVisible();
  expect(requests[1].title).toBe('다음 저장 가능');
});
