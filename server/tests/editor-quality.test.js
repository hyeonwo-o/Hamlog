import test from 'node:test';
import assert from 'node:assert/strict';
import {
  auditPostQuality,
  SEO_DESCRIPTION_MAX_LENGTH,
  SEO_DESCRIPTION_MIN_LENGTH
} from '../../src/utils/postQuality.ts';

const createDraft = (overrides = {}) => ({
  title: '안정적인 블로그 에디터 만들기',
  slug: 'stable-blog-editor',
  summary: '에디터의 작성 경험과 발행 품질을 함께 개선하면서 확인한 문제와 해결 과정을 구체적인 예시와 함께 정리합니다.',
  category: '개인 프로젝트',
  contentJson: {
    type: 'doc',
    content: [
      {
        type: 'heading',
        attrs: { level: 2 },
        content: [{ type: 'text', text: '작성 환경' }]
      },
      {
        type: 'paragraph',
        content: [{ type: 'text', text: '작성 흐름과 발행 절차를 설명합니다.' }]
      },
      {
        type: 'heading',
        attrs: { level: 3 },
        content: [{ type: 'text', text: '모바일 대응' }]
      },
      {
        type: 'image',
        attrs: { src: '/uploads/editor-flow.png', alt: '모바일 에디터 작성 흐름' }
      }
    ]
  },
  contentHtml: '',
  publishedAt: '2026-08-26',
  tags: [],
  series: '',
  featured: false,
  cover: '',
  status: 'draft',
  scheduledAt: '',
  seoTitle: '',
  seoDescription: '',
  seoOgImage: '',
  seoCanonicalUrl: 'https://tech.hamwoo.co.kr/posts/stable-blog-editor',
  seoKeywords: '',
  ...overrides
});

test('publication quality audit accepts a well-structured draft', () => {
  const audit = auditPostQuality(createDraft());
  assert.equal(audit.warningCount, 0);
  assert.ok(audit.items.every(item => item.status === 'pass'));
});

test('publication quality audit finds nested images, heading order, and SEO warnings', () => {
  const draft = createDraft({
    title: '가'.repeat(61),
    summary: '짧은 설명',
    seoCanonicalUrl: 'javascript:alert(1)',
    seoOgImage: 'javascript:alert(1)',
    contentJson: {
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 3 },
          content: [{ type: 'text', text: '상위 제목 없는 하위 제목' }]
        },
        {
          type: 'columns',
          content: [
            {
              type: 'column',
              content: [
                {
                  type: 'image',
                  attrs: { src: '/uploads/image.png', alt: 'image.png' }
                }
              ]
            }
          ]
        }
      ]
    }
  });

  const warnings = new Set(
    auditPostQuality(draft).items
      .filter(item => item.status === 'warning')
      .map(item => item.id)
  );

  assert.deepEqual(warnings, new Set([
    'seo-title',
    'seo-description',
    'heading-structure',
    'image-alt',
    'canonical-url',
    'og-image'
  ]));
});

test('publication quality audit follows the selected status for required fields', () => {
  const audit = auditPostQuality(createDraft({
    contentJson: { type: 'doc', content: [] },
    contentHtml: '',
    scheduledAt: ''
  }), 'scheduled');
  const requiredFields = audit.items.find(item => item.id === 'required-fields');

  assert.equal(audit.requiredCount, 2);
  assert.equal(requiredFields?.status, 'required');
  assert.match(requiredFields?.detail ?? '', /본문이 없습니다/);
  assert.match(requiredFields?.detail ?? '', /예약 시간이 없습니다/);
});

test('publication quality audit rejects invalid schedule and generated slug values', () => {
  const invalidScheduleAudit = auditPostQuality(createDraft({
    scheduledAt: 'not-a-date'
  }), 'scheduled');
  assert.match(
    invalidScheduleAudit.items.find(item => item.id === 'required-fields')?.detail ?? '',
    /예약 시간이 올바르지 않습니다/
  );

  const invalidSlugAudit = auditPostQuality(createDraft({
    title: '!!!',
    slug: ''
  }));
  assert.match(
    invalidSlugAudit.items.find(item => item.id === 'required-fields')?.detail ?? '',
    /사용할 수 있는 URL이 없습니다/
  );
});

test('publication quality audit reports an existing slug as required', () => {
  const audit = auditPostQuality(createDraft(), 'published', { slugTaken: true });
  const requiredFields = audit.items.find(item => item.id === 'required-fields');

  assert.equal(audit.requiredCount, 1);
  assert.equal(requiredFields?.status, 'required');
  assert.match(requiredFields?.detail ?? '', /이미 사용 중인 URL입니다/);
});

test('publication quality audit prefers an explicit SEO description', () => {
  const audit = auditPostQuality(createDraft({
    summary: '짧은 요약',
    seoDescription: '가'.repeat(SEO_DESCRIPTION_MIN_LENGTH)
  }));
  const description = audit.items.find(item => item.id === 'seo-description');

  assert.equal(description?.status, 'pass');
});

test('publication quality audit applies inclusive description length boundaries', () => {
  for (const length of [SEO_DESCRIPTION_MIN_LENGTH, SEO_DESCRIPTION_MAX_LENGTH]) {
    const audit = auditPostQuality(createDraft({ summary: '가'.repeat(length) }));
    const description = audit.items.find(item => item.id === 'seo-description');
    assert.equal(description?.status, 'pass');
  }

  for (const length of [SEO_DESCRIPTION_MIN_LENGTH - 1, SEO_DESCRIPTION_MAX_LENGTH + 1]) {
    const audit = auditPostQuality(createDraft({ summary: '가'.repeat(length) }));
    const description = audit.items.find(item => item.id === 'seo-description');
    assert.equal(description?.status, 'warning');
  }
});

test('publication quality audit supports legacy HTML-only content', () => {
  const audit = auditPostQuality(createDraft({
    contentJson: undefined,
    contentHtml: '<h3>설정</h3><p>본문입니다.</p><img src="/uploads/setup.png" alt="" />'
  }));

  assert.equal(
    audit.items.find(item => item.id === 'heading-structure')?.status,
    'warning'
  );
  assert.equal(audit.items.find(item => item.id === 'image-alt')?.status, 'warning');
});
