import test, { after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import request from 'supertest';

const fixtureRoot = await mkdtemp(path.join(tmpdir(), 'hamlog-search-pagination-'));
process.env.HAMLOG_DATA_DIR = path.join(fixtureRoot, 'data');
process.env.HAMLOG_UPLOAD_DIR = path.join(fixtureRoot, 'uploads');
process.env.JWT_SECRET ||= 'search-pagination-test-secret';
process.env.ADMIN_PASSWORD ||= 'search-pagination-test-password';
const { default: app } = await import('../app.js');
const { writePosts } = await import('../models/postModel.js');
const { beginPostDeletion } = await import('../models/postDeletionModel.js');
const { writeCategories } = await import('../models/categoryModel.js');

beforeEach(async () => {
    await rm(process.env.HAMLOG_DATA_DIR, { recursive: true, force: true });
    await mkdir(process.env.HAMLOG_DATA_DIR, { recursive: true });
    await writePosts([]);
    await writeCategories([]);
});
after(() => rm(fixtureRoot, { recursive: true, force: true }));

const makePost = (id, patch = {}) => ({
    id, slug: id, title: 'Synthetic title', summary: 'Synthetic summary',
    category: 'Backend', tags: ['JavaScript'], series: 'Build diary',
    publishedAt: '2026-01-01', status: 'published',
    contentHtml: '<p>needle in synthetic body</p>', ...patch
});
const search = query => request(app).get('/api/search').query(query).expect(200);
const ids = posts => posts.map(post => post.id);

test('search ranks exact/title matches above metadata and body regardless of publication date', async () => {
    await writePosts([
        makePost('body', { publishedAt: '2026-09-01' }),
        makePost('metadata-contains', { summary: 'Some needle details', publishedAt: '2026-08-01' }),
        makePost('metadata-exact', { tags: ['needle'], publishedAt: '2026-07-01' }),
        makePost('title-contains', { title: 'Finding a needle', publishedAt: '2026-06-01' }),
        makePost('title-prefix', { title: 'Needle search', publishedAt: '2026-05-01' }),
        makePost('title-exact', { title: 'NEEDLE', publishedAt: '2020-01-01' })
    ]);
    const expected = ['title-exact', 'title-prefix', 'title-contains', 'metadata-exact', 'metadata-contains', 'body'];
    assert.deepEqual(ids((await search({ q: 'needle' })).body), expected);
    const paginated = (await search({ q: 'needle', page: 1, pageSize: 2 })).body;
    assert.deepEqual(ids(paginated.posts), expected.slice(0, 2));
    assert.equal(paginated.total, 6);
    assert.equal(paginated.hasMore, true);
    for (const post of paginated.posts) {
        for (const field of ['contentHtml', 'contentJson', 'sections', 'rank']) assert.equal(post[field], undefined);
        assert.match(post.searchExcerpt, /needle/);
    }
});

test('ranking ties use descending publication date then ascending stable ID, including invalid dates', async () => {
    const posts = [
        makePost('tie-b'), makePost('invalid-b', { publishedAt: 'invalid' }),
        makePost('newest', { publishedAt: '2026-09-01' }), makePost('tie-a'),
        makePost('invalid-a', { publishedAt: '' })
    ];
    const expected = ['newest', 'tie-a', 'tie-b', 'invalid-a', 'invalid-b'];
    await writePosts(posts);
    assert.deepEqual(ids((await search({ q: 'needle' })).body), expected);
    await writePosts([...posts].reverse());
    assert.deepEqual(ids((await search({ q: 'needle' })).body), expected);
});

test('pagination is opt-in and has stable totals, defaults, boundaries, and a clamped maximum size', async () => {
    await writePosts(Array.from({ length: 57 }, (_, index) => makePost(`post-${String(index).padStart(2, '0')}`)));
    const legacy = (await search({ q: 'needle' })).body;
    assert.ok(Array.isArray(legacy));
    assert.equal(legacy.length, 25);
    const first = (await search({ q: 'needle', page: 1 })).body;
    assert.deepEqual(first, { posts: legacy, total: 57, page: 1, pageSize: 25, hasMore: true });
    const second = (await search({ q: 'needle', page: 2 })).body;
    assert.deepEqual(ids(second.posts), Array.from({ length: 25 }, (_, index) => `post-${index + 25}`));
    assert.equal(second.total, 57);
    assert.equal(second.hasMore, true);
    const last = (await search({ q: 'needle', page: 3 })).body;
    assert.equal(last.posts.length, 7);
    assert.equal(last.hasMore, false);
    const pastEnd = (await search({ q: 'needle', page: 4 })).body;
    assert.deepEqual(pastEnd, { posts: [], total: 57, page: 4, pageSize: 25, hasMore: false });
    const capped = (await search({ q: 'needle', pageSize: 999 })).body;
    assert.equal(capped.posts.length, 50);
    assert.equal(capped.page, 1);
    assert.equal(capped.pageSize, 50);
    assert.equal(capped.hasMore, true);
    const hugePage = (await search({ q: 'needle', page: Number.MAX_SAFE_INTEGER, pageSize: 50 })).body;
    assert.deepEqual(hugePage.posts, []);
    assert.equal(hugePage.hasMore, false);
});

test('malformed pagination rejects empty, negative, fractional, repeated, nested, and unsafe integers', async () => {
    for (const key of ['page', 'pageSize']) {
        for (const value of ['', '0', '-1', '1.5', '1e2', 'Infinity', 'NaN', ' 1 ', '01', '9007199254740992']) {
            const response = await request(app).get('/api/search').query({ q: 'needle', [key]: value });
            assert.equal(response.status, 400, `${key}=${value}`);
        }
        await request(app).get(`/api/search?q=needle&${key}=1&${key}=2`).expect(400);
        await request(app).get(`/api/search?q=needle&${key}[value]=1`).expect(400);
    }
    // Invalid paging is still invalid when there is no query to search for.
    await request(app).get('/api/search?page=invalid').expect(400);
});

test('category descendants and all exact reader filters are applied before pagination and totals', async () => {
    await writeCategories([
        { id: 'root', name: 'Backend', parentId: null },
        { id: 'child', name: 'Database', parentId: 'root' },
        { id: 'leaf', name: 'PostgreSQL', parentId: 'child' }
    ]);
    await writePosts([
        ...Array.from({ length: 60 }, (_, index) => makePost(`outside-${index}`, { category: 'Frontend', title: 'needle' })),
        ...Array.from({ length: 5 }, (_, index) => makePost(`wanted-${index}`, { category: index % 2 ? 'Database' : 'PostgreSQL' })),
        makePost('wrong-tag', { tags: ['JavaScript guides'] }),
        makePost('wrong-tag-case', { tags: ['javascript'] }),
        makePost('wrong-series', { series: 'Build diary extra' }),
        makePost('wrong-series-case', { series: 'build diary' })
    ]);
    const query = { q: 'needle', category: 'root', tag: ' JavaScript ', series: ' Build diary ', pageSize: 2 };
    const first = (await search(query)).body;
    assert.deepEqual(ids(first.posts), ['wanted-0', 'wanted-1']);
    assert.equal(first.total, 5);
    assert.equal(first.hasMore, true);
    const last = (await search({ ...query, page: 3 })).body;
    assert.deepEqual(ids(last.posts), ['wanted-4']);
    assert.equal(last.hasMore, false);
    assert.deepEqual(ids((await search({ ...query, category: ' backend ', pageSize: 50 })).body.posts), Array.from({ length: 5 }, (_, index) => `wanted-${index}`));
});

test('tag and series support empty queries while legacy empty and category-only queries remain empty', async () => {
    await writePosts([
        makePost('matching', { publishedAt: '2026-09-01' }),
        makePost('tag-only', { series: 'Other series' }),
        makePost('series-only', { tags: ['Other tag'] }),
        makePost('neither', { tags: [], series: '' })
    ]);
    assert.deepEqual(ids((await search({ tag: 'JavaScript' })).body), ['matching', 'tag-only']);
    assert.deepEqual(ids((await search({ series: 'Build diary' })).body), ['matching', 'series-only']);
    const combined = (await search({ q: ' ', tag: 'JavaScript', series: 'Build diary', page: 1 })).body;
    assert.deepEqual(ids(combined.posts), ['matching']);
    assert.equal(combined.posts[0].searchExcerpt, undefined);
    assert.equal(combined.total, 1);
    assert.equal(combined.hasMore, false);
    for (const query of [{}, { q: ' ' }, { category: 'Backend' }, { tag: ' ', series: ' ' }]) {
        assert.deepEqual((await search(query)).body, []);
        assert.deepEqual((await search({ ...query, page: 1 })).body, { posts: [], total: 0, page: 1, pageSize: 25, hasMore: false });
    }
    assert.deepEqual((await search({ tag: 'unknown', pageSize: 10 })).body, { posts: [], total: 0, page: 1, pageSize: 10, hasMore: false });
});

test('pagination and reader filters never count drafts, future schedules, trash, or journal-only pending purges', async () => {
    const pending = makePost('pending-purge', { title: 'needle', deletedAt: '2026-09-01T00:00:00.000Z' });
    await beginPostDeletion(pending);
    await writePosts([
        makePost('public'),
        makePost('due', { status: 'scheduled', scheduledAt: '2020-01-01T00:00:00.000Z' }),
        makePost('draft', { status: 'draft', title: 'needle' }),
        makePost('future', { status: 'scheduled', scheduledAt: '2099-01-01T00:00:00.000Z', title: 'needle' }),
        makePost('trashed', { deletedAt: '2026-09-01T00:00:00.000Z', title: 'needle' }),
        makePost('malformed-purge', { purgeRequestedAt: null, title: 'needle' })
    ]);
    for (const filters of [{ q: 'needle' }, { tag: 'JavaScript' }, { series: 'Build diary' }]) {
        const response = (await search({ ...filters, page: 1, pageSize: 1 })).body;
        assert.deepEqual(ids(response.posts), ['due']);
        assert.equal(response.total, 2);
        assert.equal(response.hasMore, true);
        const second = (await search({ ...filters, page: 2, pageSize: 1 })).body;
        assert.deepEqual(ids(second.posts), ['public']);
        assert.equal(second.hasMore, false);
        assert.deepEqual(ids((await search(filters)).body), ['due', 'public']);
    }
});

test('query/filter arrays and nested parameters are rejected instead of coerced into accidental matches', async () => {
    for (const key of ['q', 'category', 'tag', 'series']) {
        await request(app).get(`/api/search?${key}=one&${key}=two`).expect(400);
        await request(app).get(`/api/search?${key}[value]=one`).expect(400);
    }
    await request(app).get('/api/search').query({ q: 'x'.repeat(121), page: 1 }).expect(400);
});
