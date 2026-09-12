import test, { after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import request from 'supertest';
import {
    createSearchExcerpt,
    extractSearchBodyText,
    normalizeSearchQuery,
    SEARCH_EXCERPT_MAX_LENGTH
} from '../utils/postSearch.js';

// Standalone runs must not read or replace the developer's content.
const fixtureRoot = await mkdtemp(path.join(tmpdir(), 'hamlog-search-quality-'));
process.env.HAMLOG_DATA_DIR = path.join(fixtureRoot, 'data');
process.env.HAMLOG_UPLOAD_DIR = path.join(fixtureRoot, 'uploads');
process.env.JWT_SECRET ||= 'search-quality-test-secret';
process.env.ADMIN_PASSWORD ||= 'search-quality-test-password';
await mkdir(process.env.HAMLOG_DATA_DIR, { recursive: true });
const { default: app } = await import('../app.js');
const { readPosts, writePosts } = await import('../models/postModel.js');
const { writeCategories } = await import('../models/categoryModel.js');
const { SEARCH_QUERY_MAX_LENGTH, SEARCH_RESULT_LIMIT } = await import('../controllers/searchController.js');

after(() => rm(fixtureRoot, { recursive: true, force: true }));
beforeEach(async () => {
    await writePosts([]);
    await writeCategories([]);
});

const makePost = (id, overrides = {}) => ({
    id,
    slug: id,
    title: '게시글',
    summary: '짧은 요약',
    category: '기록',
    tags: [],
    publishedAt: '2026-01-01',
    status: 'published',
    contentHtml: '<p>기본 본문</p>',
    ...overrides
});

const search = (q, category) => request(app).get('/api/search').query({ q, ...(category ? { category } : {}) });

test('search extracts decoded visible text and respects inline and block boundaries', () => {
    const text = extractSearchBodyText(makePost('plain', {
        contentHtml: '<h2>제목</h2><p>한<strong>글</strong> &amp; 글</p><p>다음&nbsp;문단<br>끝</p>'
            + '<script>scriptOnlyToken</script><style>styleOnlyToken</style>'
            + '<!-- commentOnlyToken --><p class="classOnlyToken"><a href="https://urlOnlyToken.test">보이는 링크</a></p>'
    }));
    assert.equal(text, '제목 한글 & 글 다음 문단 끝 보이는 링크');
    assert.equal(normalizeSearchQuery('  검\u0000색   입력\u007f '), '검색 입력');
});

test('full body search returns a bounded matching excerpt without editor payloads', async () => {
    const body = `${'앞부분의 긴 설명입니다. '.repeat(500)}본문에만 있는 심층검색 단어 ${'뒷부분 설명 '.repeat(100)}`;
    await writePosts([makePost('deep-body', {
        contentJson: {
            type: 'doc',
            content: [{ type: 'paragraph', content: [{ type: 'text', text: body }] }]
        },
        sections: [{ type: 'paragraph', content: 'legacy content' }]
    })]);
    const savedBefore = await readPosts();
    const response = await search('심층검색').expect(200);
    assert.equal(response.body.length, 1);
    const result = response.body[0];
    assert.equal(result.id, 'deep-body');
    assert.equal(result.summary, '짧은 요약');
    assert.match(result.searchExcerpt, /본문에만 있는 심층검색 단어/);
    assert.ok(result.searchExcerpt.length <= SEARCH_EXCERPT_MAX_LENGTH);
    assert.ok(result.searchExcerpt.startsWith('…'));
    assert.ok(result.searchExcerpt.endsWith('…'));
    for (const key of ['contentHtml', 'contentJson', 'sections']) {
        assert.equal(Object.hasOwn(result, key), false);
    }
    assert.deepEqual(await readPosts(), savedBefore);
});

test('HTML entities and inline marks match but source markup and executable text do not', async () => {
    await writePosts([makePost('rendered-copy', {
        contentHtml: '<p class="attributeOnlyToken">배포<strong>자동화</strong> &amp; 보안</p>'
            + '<p>공백&nbsp;&nbsp;축약</p><pre><code>&lt;example&gt;코드 예제&lt;/example&gt;</code></pre>'
            + '<script>scriptOnlyToken</script><style>styleOnlyToken</style>'
            + '<p><a href="https://urlOnlyToken.test">링크</a></p>'
    })]);
    for (const query of ['배포자동화 & 보안', '공백 축약', '<example>코드 예제</example>']) {
        const response = await search(query).expect(200);
        assert.equal(response.body[0]?.id, 'rendered-copy', query);
    }
    for (const query of ['attributeOnlyToken', 'scriptOnlyToken', 'styleOnlyToken', 'urlOnlyToken', '<strong>', '&amp;']) {
        const response = await search(query).expect(200);
        assert.deepEqual(response.body, [], query);
    }
});

test('title, summary, slug, category, tags, and series remain searchable case insensitively', async () => {
    const fields = ['title', 'summary', 'slug', 'category', 'tags', 'series'];
    await writePosts(fields.map(field => makePost(`field-${field}`, {
        [field]: field === 'tags' ? [`Match ${field}`] : `Match ${field}`
    })));
    for (const field of fields) {
        const response = await search(`  MATCH   ${field.toUpperCase()}  `).expect(200);
        assert.deepEqual(response.body.map(post => post.id), [`field-${field}`]);
        assert.equal(response.body[0].searchExcerpt, undefined);
    }
});

test('search never exposes drafts or future scheduled posts', async () => {
    const body = '<p>가시성검증 본문</p>';
    await writePosts([
        makePost('published', { contentHtml: body }),
        makePost('draft', { contentHtml: body, status: 'draft' }),
        makePost('future', {
            contentHtml: body,
            status: 'scheduled',
            scheduledAt: new Date(Date.now() + 86_400_000).toISOString()
        }),
        makePost('due', {
            contentHtml: body,
            status: 'scheduled',
            scheduledAt: new Date(Date.now() - 86_400_000).toISOString()
        })
    ]);
    const response = await search('가시성검증').expect(200);
    assert.deepEqual(response.body.map(post => post.id).sort(), ['due', 'published']);
});

test('category and descendants are filtered before the 25-result limit', async () => {
    await writeCategories([
        { id: 'parent', name: 'Backend', parentId: null },
        { id: 'child', name: 'Database', parentId: 'parent' },
        { id: 'grandchild', name: 'PostgreSQL', parentId: 'child' },
        { id: 'other', name: 'Frontend', parentId: null }
    ]);
    await writePosts([
        ...Array.from({ length: SEARCH_RESULT_LIMIT + 5 }, (_, index) => makePost(`recent-${index}`, {
            title: '찾을글', category: 'Frontend', publishedAt: '2026-08-01'
        })),
        makePost('root-match', { title: '찾을글', category: 'Backend' }),
        makePost('child-match', { title: '찾을글', category: 'Database' }),
        makePost('grandchild-match', { title: '찾을글', category: 'PostgreSQL' }),
        makePost('unregistered', { title: '찾을글', category: '레거시' })
    ]);

    const all = await search('찾을글').expect(200);
    assert.equal(all.body.length, SEARCH_RESULT_LIMIT);
    assert.ok(all.body.every(post => post.category === 'Frontend'));
    for (const category of [' backend ', 'parent']) {
        const response = await search('찾을글', category).expect(200);
        assert.deepEqual(response.body.map(post => post.id).sort(), ['child-match', 'grandchild-match', 'root-match']);
    }
    const leaf = await search('찾을글', 'Database').expect(200);
    assert.deepEqual(leaf.body.map(post => post.id).sort(), ['child-match', 'grandchild-match']);
    const legacy = await search('찾을글', '레거시').expect(200);
    assert.deepEqual(legacy.body.map(post => post.id), ['unregistered']);
    const unknown = await search('찾을글', '없는 분류').expect(200);
    assert.deepEqual(unknown.body, []);
});

test('empty, oversized, and normalized queries retain the existing API contract', async () => {
    await writePosts([makePost('normalization', { title: '검색 입력' })]);
    const missing = await request(app).get('/api/search').expect(200);
    assert.deepEqual(missing.body, []);
    const empty = await search('\u0000   ').expect(200);
    assert.deepEqual(empty.body, []);
    const oversized = await search('가'.repeat(SEARCH_QUERY_MAX_LENGTH + 1)).expect(400);
    assert.match(oversized.body.message, /120자/);
    const normalized = await search(' 검\u0000색    입력\u007f ').expect(200);
    assert.deepEqual(normalized.body.map(post => post.id), ['normalization']);
});

test('excerpt boundaries keep Unicode intact and include a maximum-length query', () => {
    const query = '검'.repeat(SEARCH_QUERY_MAX_LENGTH);
    const text = `${'😀'.repeat(100)}${query}${'😀'.repeat(100)}`;
    const excerpt = createSearchExcerpt(text, query);
    assert.ok(excerpt.includes(query));
    assert.ok(excerpt.length <= SEARCH_EXCERPT_MAX_LENGTH);
    assert.equal(excerpt.isWellFormed(), true);
    assert.equal(createSearchExcerpt('no matching text', 'missing'), undefined);
    assert.ok(createSearchExcerpt(`${'İ'.repeat(300)}검색대상${'문맥'.repeat(100)}`, '검색대상').includes('검색대상'));
});
