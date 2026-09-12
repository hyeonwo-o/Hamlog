import { expect, test } from '@playwright/test';

test('old list responses cannot undo confirmed saves, creates, deletes or restores', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  const results = await page.evaluate(async () => {
    const modulePath = '/src/store/postStore.ts';
    const { usePostStore } = await import(modulePath);
    const originalFetch = window.fetch;
    const originalState = usePostStore.getState();
    const original = { id: 'store-race-original', title: '이전 제목', slug: 'store-race', summary: '', publishedAt: '2026-09-12', tags: [], status: 'draft', updatedAt: '2026-09-12T01:00:00.000Z' };
    const updated = { ...original, title: '최신 제목', updatedAt: '2026-09-12T02:00:00.000Z' };
    const created = { ...updated, id: 'store-race-created' };
    const outcomes: Array<{ action: string; ids: string[]; title: string; loading: boolean; error: string | null }> = [];
    try {
      for (const action of ['update', 'create', 'delete', 'restore']) {
        usePostStore.setState({ posts: [original], loading: false, loadedMode: 'full', hasLoaded: true, error: null });
        let releaseRead: (response: Response) => void = () => {};
        window.fetch = async (input, options) => {
          const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, location.origin);
          if (!url.pathname.startsWith('/api/posts')) return originalFetch(input, options);
          if (!options?.method || options.method === 'GET') {
            return new Promise<Response>(resolve => { releaseRead = resolve; });
          }
          if (options.method === 'DELETE') return new Response(null, { status: 204 });
          return Response.json(options.method === 'POST' ? created : updated);
        };
        const read = usePostStore.getState().fetchPosts('full');
        if (action === 'update') await usePostStore.getState().updatePost(original.id, updated);
        if (action === 'create') await usePostStore.getState().addPost(created);
        if (action === 'delete') await usePostStore.getState().deletePost(original.id);
        if (action === 'restore') usePostStore.getState().applyConfirmedPost(updated);
        releaseRead(Response.json({ posts: [original], total: 1 }));
        await read;
        const state = usePostStore.getState();
        outcomes.push({ action, ids: state.posts.map((post: { id: string }) => post.id), title: state.posts[0]?.title ?? '', loading: state.loading, error: state.error });
      }
      return outcomes;
    } finally {
      window.fetch = originalFetch;
      usePostStore.setState(originalState);
    }
  });
  expect(results).toEqual([
    { action: 'update', ids: ['store-race-original'], title: '최신 제목', loading: false, error: null },
    { action: 'create', ids: ['store-race-created', 'store-race-original'], title: '최신 제목', loading: false, error: null },
    { action: 'delete', ids: [], title: '', loading: false, error: null },
    { action: 'restore', ids: ['store-race-original'], title: '최신 제목', loading: false, error: null }
  ]);
});

test('an invalidated list error does not clear an active save indicator or replace its error', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  const outcome = await page.evaluate(async () => {
    const modulePath = '/src/store/postStore.ts';
    const { usePostStore } = await import(modulePath);
    const originalFetch = window.fetch;
    const originalState = usePostStore.getState();
    const post = { id: 'store-race-pending', title: '저장 중', slug: 'store-race-pending', summary: '', publishedAt: '2026-09-12', tags: [] };
    try {
      usePostStore.setState({ posts: [post], loading: false, loadedMode: 'full', hasLoaded: true, error: null });
      let releaseRead: (response: Response) => void = () => {};
      let releaseWrite: (response: Response) => void = () => {};
      window.fetch = async (input, options) => {
        const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, location.origin);
        if (!url.pathname.startsWith('/api/posts')) return originalFetch(input, options);
        return new Promise<Response>(resolve => {
          if (options?.method === 'PUT') releaseWrite = resolve;
          else releaseRead = resolve;
        });
      };
      const read = usePostStore.getState().fetchPosts('full');
      const write = usePostStore.getState().updatePost(post.id, post);
      releaseRead(Response.json({ message: '오래된 목록 오류' }, { status: 500 }));
      await read;
      const pending = { loading: usePostStore.getState().loading, error: usePostStore.getState().error };
      releaseWrite(Response.json(post));
      await write;
      return { pending, finishedLoading: usePostStore.getState().loading };
    } finally {
      window.fetch = originalFetch;
      usePostStore.setState(originalState);
    }
  });
  expect(outcome).toEqual({ pending: { loading: true, error: null }, finishedLoading: false });
});
