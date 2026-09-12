import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import request from 'supertest';
import * as cheerio from 'cheerio';
import { resolvePostMetaDescription, toPublicPostDetail } from '../utils/seoContent.js';
import { getPostMetaDescription } from '../../src/utils/postSeo.ts';

// Never read or replace the developer's content, including when run standalone.
const fixtureRoot = await mkdtemp(path.join(tmpdir(), 'hamlog-seo-description-'));
process.env.HAMLOG_DATA_DIR = path.join(fixtureRoot, 'data');
process.env.HAMLOG_UPLOAD_DIR = path.join(fixtureRoot, 'uploads');
await mkdir(process.env.HAMLOG_DATA_DIR, { recursive: true });
process.env.JWT_SECRET ||= 'seo-description-test-secret';
process.env.ADMIN_PASSWORD ||= 'seo-description-test-password';
const { default: app } = await import('../app.js');
const { readPosts, writePosts } = await import('../models/postModel.js');
after(() => rm(fixtureRoot, { recursive: true, force: true }));

const body = '홈 서버 구성부터 가상 머신 생성, 네트워크 설정과 자동 백업까지 직접 운영하며 확인한 내용을 단계별로 설명합니다. '.repeat(4);
const makePost = (id, overrides = {}) => ({
  id,
  slug: id,
  title: '홈 랩 구축 기록',
  summary: '홈 랩 구축기',
  contentJson: {
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text: body }] }]
  },
  contentHtml: `<p>${body}</p>`,
  publishedAt: '2026-01-01',
  tags: ['Proxmox'],
  status: 'published',
  ...overrides
});

test('public description is derived without mutating author fields and matches the client', () => {
  const post = makePost('derived');
  const original = structuredClone(post);
  const detail = toPublicPostDetail(post);
  assert.deepEqual(post, original);
  assert.equal(detail.summary, post.summary);
  assert.equal(detail.seo, undefined);
  assert.equal(detail.metaDescription, resolvePostMetaDescription(post));
  assert.equal(getPostMetaDescription(detail), detail.metaDescription);
  assert.ok(detail.metaDescription.length > post.summary.length);
  assert.ok(detail.metaDescription.length <= 160);
  assert.match(detail.metaDescription, /가상 머신/);
});

test('explicit SEO copy, long summaries, whitespace, and legacy responses retain their priority', () => {
  const explicit = toPublicPostDetail(makePost('explicit', {
    seo: { description: '  직접 작성한\n 검색 설명  ' }
  }));
  assert.equal(explicit.metaDescription, '직접 작성한 검색 설명');
  assert.equal(getPostMetaDescription(explicit), explicit.metaDescription);
  assert.equal(getPostMetaDescription({ ...explicit, metaDescription: '오래된 계산값' }), '직접 작성한 검색 설명');

  const longSummary = '사용자가 충분한 길이로 작성한 요약은 본문을 덧붙이거나 임의로 자르지 않고 검색 설명으로 그대로 유지합니다.';
  const long = toPublicPostDetail(makePost('long', { summary: longSummary }));
  assert.equal(long.metaDescription, longSummary);
  assert.equal(getPostMetaDescription(long), longSummary);
  assert.equal(getPostMetaDescription({ summary: ' 이전 응답의  요약 ', seo: { description: '  ' } }), '이전 응답의 요약');
  assert.equal(getPostMetaDescription({ summary: '', metaDescription: '', seo: {} }), '');
});

test('description enrichment excludes non-content markup and does not duplicate a leading summary', () => {
  const post = makePost('plain-text', {
    summary: '짧은 요약',
    contentHtml: '<p>짧은 요약 본문의 실제 내용 &amp; 추가 설명</p><script>비공개 스크립트 문자열</script><style>숨김 스타일</style>'
  });
  const description = toPublicPostDetail(post).metaDescription;
  assert.equal(description, '짧은 요약 본문의 실제 내용 & 추가 설명');
  assert.doesNotMatch(description, /스크립트|스타일|<|>/);
});

test('HTML metadata, bootstrap, public detail API, and JSON-LD use exactly the same description', async () => {
  const posts = [
    makePost('generated-description'),
    makePost('explicit-description', { seo: { description: '작성자가 정한 설명을 그대로 유지합니다.' } }),
    makePost('private-description', { status: 'draft' })
  ];
  await writePosts(posts);
  const savedBefore = await readPosts();

  for (const post of savedBefore.filter(post => post.status === 'published')) {
    const expected = resolvePostMetaDescription(post);
    const detail = await request(app).get(`/api/posts/${post.slug}`).expect(200);
    assert.equal(detail.body.metaDescription, expected);
    assert.equal(detail.body.summary, post.summary);
    assert.deepEqual(detail.body.seo, post.seo);

    const response = await request(app).get(`/posts/${post.slug}`).expect(200);
    const $ = cheerio.load(response.text);
    for (const selector of ['meta[name="description"]', 'meta[property="og:description"]', 'meta[name="twitter:description"]']) {
      assert.equal($(selector).length, 1);
      assert.equal($(selector).attr('content'), expected);
    }
    const bootstrap = JSON.parse($('#hamlog-bootstrap').text());
    assert.equal(bootstrap.post.metaDescription, expected);
    assert.equal(getPostMetaDescription(bootstrap.post), expected);
    assert.equal(bootstrap.post.contentJson, undefined);
    const schemas = $('script[type="application/ld+json"]').toArray()
      .map(node => JSON.parse($(node).text()))
      .filter(schema => schema['@type'] === 'BlogPosting');
    assert.equal(schemas.length, 1);
    assert.equal(schemas[0].description, expected);
  }

  await request(app).get('/api/posts/private-description').expect(404);
  await request(app).get('/posts/private-description').expect(404);
  assert.deepEqual(await readPosts(), savedBefore);
  assert.ok((await readPosts()).every(post => !Object.hasOwn(post, 'metaDescription')));
});
