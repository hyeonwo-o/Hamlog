import test from 'node:test';
import assert from 'node:assert/strict';
import { compareRevisionParagraphs, compareRevisionDrafts, revisionPlainText } from '../../src/utils/revisionComparison.ts';

const draft = (text, patch = {}) => ({
    title: '글 제목', slug: 'test', summary: '', category: '일상', tags: [],
    series: '', featured: false, cover: '', status: 'draft', publishedAt: '2026-09-12',
    scheduledAt: '', seoTitle: '', seoDescription: '', seoOgImage: '', seoCanonicalUrl: '', seoKeywords: '',
    contentHtml: '', contentJson: { type: 'doc', content: text.split('\n').map(value => ({
        type: 'paragraph', content: [{ type: 'text', text: value }]
    })) }, ...patch
});

test('revision comparison counts duplicate paragraphs and shows additions and removals', () => {
    assert.deepEqual(compareRevisionParagraphs('같음\n반복\n반복\n삭제', '같음\n반복\n추가'), {
        added: ['추가'], removed: ['반복', '삭제']
    });
});

test('revision comparison includes unsaved metadata and the direction is stored to current', () => {
    const result = compareRevisionDrafts(draft('이전 내용'), draft('새 내용', { title: '새 제목', tags: ['태그'] }));
    assert.deepEqual(result.added, ['새 내용']);
    assert.deepEqual(result.removed, ['이전 내용']);
    assert.deepEqual(result.metadata, [
        { key: 'title', label: '제목', before: '글 제목', after: '새 제목' },
        { key: 'tags', label: '태그', before: '', after: '태그' }
    ]);
    assert.equal(result.bodyChanged, true);
});

test('same paragraphs with changed formatting remain detectable without false text additions', () => {
    const before = draft('본문');
    const after = structuredClone(before);
    after.contentJson.content[0].content[0].marks = [{ type: 'bold' }];
    const result = compareRevisionDrafts(before, after);
    assert.equal(result.bodyChanged, true);
    assert.deepEqual(result.added, []);
    assert.deepEqual(result.removed, []);
    assert.equal(compareRevisionDrafts(before, before).bodyChanged, false);
});

test('revision text preview preserves image and custom node source as non-executable text', () => {
    const text = revisionPlainText({ contentHtml: '', contentJson: { type: 'doc', content: [
        { type: 'image', attrs: { alt: '설명', src: 'https://example.test/image' } },
        { type: 'mermaid', attrs: { code: 'graph TD; A-->B' } },
        { type: 'paragraph', content: [{ type: 'text', text: '<script>alert(1)</script>' }] }
    ] } });
    assert.match(text, /\[이미지: 설명\]/);
    assert.match(text, /graph TD/);
    assert.match(text, /<script>/);
});

test('large paragraph comparison is linear and retains all change counts', () => {
    const before = Array.from({ length: 5000 }, (_, index) => `문단 ${index}`).join('\n');
    const result = compareRevisionParagraphs(before, `${before}\n마지막 추가`);
    assert.deepEqual(result, { added: ['마지막 추가'], removed: [] });
});
