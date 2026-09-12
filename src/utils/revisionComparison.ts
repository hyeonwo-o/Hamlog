import type { PostDraft } from '../types/admin';

type ContentNode = { type?: string; text?: string; attrs?: Record<string, unknown>; content?: ContentNode[] };

const blockTypes = new Set(['paragraph', 'heading', 'codeBlock', 'listItem', 'blockquote', 'tableRow']);

const nodeText = (node: ContentNode): string => {
  if (node.type === 'text') return node.text ?? '';
  if (node.type === 'hardBreak') return '\n';
  if (node.type === 'image') return `[이미지: ${String(node.attrs?.alt || node.attrs?.src || '')}]\n`;
  if (node.type === 'youtube' || node.type === 'linkCard') return `[${node.type}: ${String(node.attrs?.src || node.attrs?.url || node.attrs?.href || '')}]\n`;
  const value = (node.content ?? []).map(nodeText).join('');
  if (value) return value + (blockTypes.has(node.type ?? '') ? '\n' : '');
  // Custom math and diagram nodes often keep their source in attributes.
  return String(node.attrs?.latex || node.attrs?.code || node.attrs?.source || '');
};

export const revisionPlainText = (draft: Pick<PostDraft, 'contentJson' | 'contentHtml'>): string => {
  if (draft.contentJson) return nodeText(draft.contentJson).trim();
  if (typeof DOMParser === 'undefined') return draft.contentHtml.replace(/<[^>]*>/g, ' ').trim();
  const document = new DOMParser().parseFromString(draft.contentHtml, 'text/html');
  document.querySelectorAll('script,style,iframe,object').forEach(node => node.remove());
  document.querySelectorAll('br').forEach(node => node.replaceWith('\n'));
  document.querySelectorAll('p,h1,h2,h3,h4,h5,h6,li,pre,tr,blockquote').forEach(node => node.append('\n'));
  return (document.body.textContent ?? '').trim();
};

const paragraphs = (text: string) => text.split('\n').map(line => line.trim()).filter(Boolean);

const subtract = (source: string[], other: string[]) => {
  const counts = new Map<string, number>();
  other.forEach(line => counts.set(line, (counts.get(line) ?? 0) + 1));
  return source.filter(line => {
    const count = counts.get(line) ?? 0;
    if (count === 0) return true;
    counts.set(line, count - 1);
    return false;
  });
};

export const compareRevisionParagraphs = (previous: string, current: string) => {
  const before = paragraphs(previous);
  const after = paragraphs(current);
  return { added: subtract(after, before), removed: subtract(before, after) };
};

const metadataFields = [
  ['title', '제목'], ['slug', '주소'], ['summary', '요약'], ['category', '카테고리'],
  ['tags', '태그'], ['series', '시리즈'], ['featured', '추천 글'], ['cover', '대표 이미지'],
  ['status', '발행 상태'], ['publishedAt', '발행일'], ['scheduledAt', '예약일'],
  ['seoTitle', 'SEO 제목'], ['seoDescription', 'SEO 설명'], ['seoOgImage', '공유 이미지'],
  ['seoCanonicalUrl', '대표 URL'], ['seoKeywords', 'SEO 키워드']
] as const;

const displayValue = (value: unknown) => {
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'boolean') return value ? '설정' : '해제';
  if (value === 'draft') return '초안';
  if (value === 'published') return '발행';
  if (value === 'scheduled') return '예약';
  return String(value ?? '');
};

export const compareRevisionDrafts = (previous: PostDraft, current: PostDraft) => {
  const previousText = revisionPlainText(previous);
  const currentText = revisionPlainText(current);
  return {
    previousText,
    currentText,
    ...compareRevisionParagraphs(previousText, currentText),
    bodyChanged: JSON.stringify(previous.contentJson ?? previous.contentHtml)
      !== JSON.stringify(current.contentJson ?? current.contentHtml),
    metadata: metadataFields.flatMap(([key, label]) => (
      JSON.stringify(previous[key]) === JSON.stringify(current[key])
        ? []
        : [{ key, label, before: displayValue(previous[key]), after: displayValue(current[key]) }]
    ))
  };
};
