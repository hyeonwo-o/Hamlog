import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveHomeMetaDescription,
  resolvePostMetaDescription,
  sanitizePostContentHtml
} from '../utils/seoContent.js';

test('post descriptions preserve explicit SEO copy and augment only short summaries', () => {
  assert.equal(
    resolvePostMetaDescription({
      title: 'Explicit',
      summary: '짧은 요약',
      contentHtml: '<p>본문에서 가져오면 안 됩니다.</p>',
      seo: { description: '사용자가 직접 작성한 SEO 설명' }
    }),
    '사용자가 직접 작성한 SEO 설명'
  );

  const generated = resolvePostMetaDescription({
    title: 'Generated',
    summary: '짧은 요약',
    contentHtml: '<p>본문의 구체적인 클라우드 배포 과정과 장애 해결 방법을 단계별로 설명합니다.</p>'
  });
  assert.match(generated, /^짧은 요약 /);
  assert.match(generated, /클라우드 배포 과정/);
});

test('home description preserves the original copy while adding useful profile context', () => {
  const generated = resolveHomeMetaDescription({
    description: '클라우드 운영 기록',
    tagline: '인프라 자동화와 장애 대응',
    role: 'Cloud Engineer',
    stack: ['AWS', 'Terraform']
  }, '기술 블로그입니다.');

  assert.match(generated, /^클라우드 운영 기록/);
  assert.match(generated, /인프라 자동화와 장애 대응/);
  assert.match(generated, /AWS, Terraform 기술 스택/);
});

test('prerender sanitizer rebuilds safe markup, link cards, and contextual image alt text', () => {
  const html = sanitizePostContentHtml(`
    <h1 onclick="alert(1)">본문 제목</h1>
    <script>alert('xss')</script>
    <p>배포 구성도 <img src="/uploads/map.png" alt="image.png" onerror="alert(1)" /></p>
    <p>운영 화면 <img src="/uploads/screen.png" alt="screenshot.png" /></p>
    <a href="javascript:alert(1)">위험 링크</a>
    <link-card url="https://example.com/guide" title="안전한 가이드" description="참고 문서"></link-card>
  `, { postTitle: '테스트 글' });

  assert.match(html, /<h2>본문 제목<\/h2>/);
  assert.match(html, /alt="배포 구성도"/);
  assert.match(html, /alt="운영 화면"/);
  assert.match(html, /<a href="https:\/\/example\.com\/guide" rel="noopener noreferrer">안전한 가이드<\/a>/);
  assert.match(html, /위험 링크/);
  assert.doesNotMatch(html, /<script|onclick|onerror|javascript:/i);
});

test('RSS-safe content converts upload paths to absolute URLs', () => {
  const html = sanitizePostContentHtml(
    '<p><img src="/uploads/example.png" alt="구성도" /></p>',
    {
      postTitle: '테스트 글',
      baseUrl: 'https://tech.hamwoo.co.kr',
      absoluteUploads: true,
      demoteH1: false
    }
  );

  assert.match(html, /src="https:\/\/tech\.hamwoo\.co\.kr\/uploads\/example\.png"/);
});
