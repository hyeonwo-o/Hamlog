import test from 'node:test';
import assert from 'node:assert/strict';
import * as cheerio from 'cheerio';
import { createHeadingIdAllocator } from '../utils/headingAnchors.js';
import { sanitizePostContentHtml } from '../utils/seoContent.js';

test('heading anchors retain existing URL format and distinguish repeated or empty titles', () => {
  const allocate = createHeadingIdAllocator();
  assert.equal(allocate('배포 준비'), 'heading--배포-준비');
  assert.equal(allocate('배포 준비'), 'heading--배포-준비-2');
  assert.equal(allocate('배포 준비'), 'heading--배포-준비-3');
  assert.equal(allocate('💡'), 'heading--heading');
  assert.equal(allocate(''), 'heading--heading-2');
});

test('authored heading anchors are reserved, non-heading IDs cannot be taken, and duplicates are unique', () => {
  const allocate = createHeadingIdAllocator(['heading--intro', 'custom', 'custom', 'custom-2'], ['heading--other']);
  assert.equal(allocate('intro'), 'heading--intro-2');
  assert.equal(allocate('custom title', 'heading--intro'), 'heading--intro');
  assert.equal(allocate('first', 'custom'), 'custom');
  assert.equal(allocate('second', 'custom'), 'custom-3');
  assert.equal(allocate('third', 'custom-2'), 'custom-2');
  assert.equal(allocate('other'), 'heading--other-2');
});

test('initial HTML preserves authored and generated heading anchors, including safe attribute escaping', () => {
  const content = '<h1>소개</h1><h2>소개</h2><h3 id="custom-anchor">단계</h3><h2 id="custom-anchor">다음 단계</h2><h2 id="a&amp;quot;&quot;&lt;">특수 문자</h2>';
  const $ = cheerio.load(sanitizePostContentHtml(content));
  assert.deepEqual($('h1, h2, h3').toArray().map(node => $(node).attr('id')), [
    'heading--소개', 'heading--소개-2', 'custom-anchor', 'custom-anchor-2', 'a&quot;"<'
  ]);
  assert.equal($('h1').length, 0);
  assert.equal($('[onclick], script').length, 0);
  // Every request independently allocates exactly the same links.
  assert.equal(sanitizePostContentHtml(content), sanitizePostContentHtml(content));
});
