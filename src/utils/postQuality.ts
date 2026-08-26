import type { JSONContent } from '@tiptap/core';
import { isGenericImageAlt } from '../editor/utils/imageAlt.ts';
import type { PostStatus } from '../data/blogData';
import type { PostDraft } from '../types/admin';
import { hasDocumentContent, stripHtml } from './postContent.ts';
import { slugify } from './slugify.ts';
import { toIsoDateTime } from './adminDate.ts';

export const SEO_TITLE_MAX_LENGTH = 60;
export const SEO_DESCRIPTION_MIN_LENGTH = 50;
export const SEO_DESCRIPTION_MAX_LENGTH = 160;
export const LONG_POST_HEADING_THRESHOLD = 1000;

export type PostQualityStatus = 'pass' | 'warning' | 'required';

export interface PostQualityItem {
  id:
    | 'required-fields'
    | 'seo-title'
    | 'seo-description'
    | 'heading-structure'
    | 'image-alt'
    | 'canonical-url'
    | 'og-image';
  label: string;
  detail: string;
  status: PostQualityStatus;
}

export interface PostQualityAudit {
  items: PostQualityItem[];
  warningCount: number;
  requiredCount: number;
}

interface PostQualityOptions {
  slugTaken?: boolean;
}

interface ContentAudit {
  textLength: number;
  headingLevels: number[];
  emptyHeadingCount: number;
  imageCount: number;
  genericImageAltCount: number;
}

const createContentAudit = (): ContentAudit => ({
  textLength: 0,
  headingLevels: [],
  emptyHeadingCount: 0,
  imageCount: 0,
  genericImageAltCount: 0
});

const getJsonNodeText = (node: JSONContent): string => {
  const ownText = typeof node.text === 'string' ? node.text : '';
  const childText = node.content?.map(getJsonNodeText).join(' ') ?? '';
  return `${ownText} ${childText}`.trim();
};

const auditJsonContent = (contentJson: JSONContent): ContentAudit => {
  const audit = createContentAudit();

  const visit = (node: JSONContent) => {
    if (typeof node.text === 'string') {
      audit.textLength += Array.from(node.text.trim()).length;
    }

    if (node.type === 'heading') {
      const level = Number(node.attrs?.level);
      if (Number.isInteger(level)) audit.headingLevels.push(level);
      if (!getJsonNodeText(node)) audit.emptyHeadingCount += 1;
    }

    if (node.type === 'image') {
      audit.imageCount += 1;
      const alt = typeof node.attrs?.alt === 'string' ? node.attrs.alt : '';
      if (isGenericImageAlt(alt)) audit.genericImageAltCount += 1;
    }

    node.content?.forEach(visit);
  };

  visit(contentJson);
  return audit;
};

const readHtmlAttribute = (attributes: string, name: string) => {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = attributes.match(new RegExp(
    `\\b${escapedName}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'=<>\u0060]+))`,
    'i'
  ));
  return match?.[1] ?? match?.[2] ?? match?.[3] ?? '';
};

const auditHtmlContent = (contentHtml: string): ContentAudit => {
  const audit = createContentAudit();
  audit.textLength = Array.from(stripHtml(contentHtml)).length;

  const headingPattern = /<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1\s*>/gi;
  for (const match of contentHtml.matchAll(headingPattern)) {
    audit.headingLevels.push(Number(match[1]));
    if (!stripHtml(match[2] ?? '')) audit.emptyHeadingCount += 1;
  }

  const imagePattern = /<img\b([^>]*)>/gi;
  for (const match of contentHtml.matchAll(imagePattern)) {
    audit.imageCount += 1;
    if (isGenericImageAlt(readHtmlAttribute(match[1] ?? '', 'alt'))) {
      audit.genericImageAltCount += 1;
    }
  }

  return audit;
};

const auditContent = (draft: PostDraft) => (
  draft.contentJson?.content?.length
    ? auditJsonContent(draft.contentJson)
    : auditHtmlContent(draft.contentHtml || '')
);

const isValidCanonicalUrl = (value: string) => {
  if (!value) return true;
  try {
    const url = new URL(value);
    return (url.protocol === 'http:' || url.protocol === 'https:') && Boolean(url.hostname);
  } catch {
    return false;
  }
};

const isValidImageReference = (value: string) => {
  if (!value) return true;
  if (value.startsWith('/') && !value.startsWith('//')) return true;
  try {
    const url = new URL(value);
    return (url.protocol === 'http:' || url.protocol === 'https:') && Boolean(url.hostname);
  } catch {
    return false;
  }
};

export const getEffectiveSeoMetadata = (draft: Pick<
  PostDraft,
  'title' | 'summary' | 'seoTitle' | 'seoDescription'
>) => {
  const title = draft.seoTitle.trim() || draft.title.trim();
  const description = draft.seoDescription.trim() || draft.summary.trim();
  return {
    title,
    description,
    titleLength: Array.from(title).length,
    descriptionLength: Array.from(description).length
  };
};

export const auditPostQuality = (
  draft: PostDraft,
  status: PostStatus = draft.status,
  options: PostQualityOptions = {}
): PostQualityAudit => {
  const content = auditContent(draft);
  const seo = getEffectiveSeoMetadata(draft);
  const items: PostQualityItem[] = [];

  const requiredWarnings: string[] = [];
  const title = draft.title.trim();
  const slug = slugify(draft.slug.trim() || title);
  const hasBody = hasDocumentContent(draft.contentJson) || stripHtml(draft.contentHtml || '').length > 0;
  if (!title) requiredWarnings.push('제목이 없습니다');
  if (!slug) requiredWarnings.push('사용할 수 있는 URL이 없습니다');
  if (slug && options.slugTaken) requiredWarnings.push('이미 사용 중인 URL입니다');
  if (status !== 'draft' && !hasBody) requiredWarnings.push('본문이 없습니다');
  if (status === 'scheduled' && !draft.scheduledAt.trim()) {
    requiredWarnings.push('예약 시간이 없습니다');
  } else if (status === 'scheduled' && !toIsoDateTime(draft.scheduledAt)) {
    requiredWarnings.push('예약 시간이 올바르지 않습니다');
  }

  items.push({
    id: 'required-fields',
    label: '필수 입력',
    status: requiredWarnings.length > 0 ? 'required' : 'pass',
    detail: requiredWarnings.length > 0
      ? `${requiredWarnings.join('. ')}.`
      : status === 'draft'
        ? '초안 저장에 필요한 항목이 준비되었습니다.'
        : '발행에 필요한 항목이 준비되었습니다.'
  });

  items.push({
    id: 'seo-title',
    label: '검색 제목',
    status: seo.titleLength > 0 && seo.titleLength <= SEO_TITLE_MAX_LENGTH ? 'pass' : 'warning',
    detail: seo.titleLength === 0
      ? '글 제목을 입력해 주세요.'
      : seo.titleLength > SEO_TITLE_MAX_LENGTH
        ? `${SEO_TITLE_MAX_LENGTH}자 이내를 권장합니다. 현재 ${seo.titleLength}자입니다.`
        : `${seo.titleLength}자로 적절합니다.`
  });

  items.push({
    id: 'seo-description',
    label: '검색 설명',
    status: seo.descriptionLength >= SEO_DESCRIPTION_MIN_LENGTH
      && seo.descriptionLength <= SEO_DESCRIPTION_MAX_LENGTH
      ? 'pass'
      : 'warning',
    detail: seo.descriptionLength < SEO_DESCRIPTION_MIN_LENGTH
      ? `${SEO_DESCRIPTION_MIN_LENGTH}자 이상으로 글의 핵심을 설명해 주세요. 현재 ${seo.descriptionLength}자입니다.`
      : seo.descriptionLength > SEO_DESCRIPTION_MAX_LENGTH
        ? `${SEO_DESCRIPTION_MAX_LENGTH}자 이내를 권장합니다. 현재 ${seo.descriptionLength}자입니다.`
        : `${seo.descriptionLength}자로 적절합니다.`
  });

  const bodyH1Count = content.headingLevels.filter(level => level === 1).length;
  let seenH2 = false;
  let h3WithoutH2Count = 0;
  for (const level of content.headingLevels) {
    if (level === 2) seenH2 = true;
    if (level === 3 && !seenH2) h3WithoutH2Count += 1;
  }

  const headingWarnings: string[] = [];
  if (bodyH1Count > 0) headingWarnings.push(`본문 제목 1이 ${bodyH1Count}개 있습니다`);
  if (h3WithoutH2Count > 0) headingWarnings.push(`제목 2보다 먼저 나온 제목 3이 ${h3WithoutH2Count}개 있습니다`);
  if (content.emptyHeadingCount > 0) headingWarnings.push(`내용이 비어 있는 제목이 ${content.emptyHeadingCount}개 있습니다`);
  if (
    content.textLength >= LONG_POST_HEADING_THRESHOLD
    && !content.headingLevels.includes(2)
  ) {
    headingWarnings.push('긴 글에 제목 2가 없습니다');
  }

  items.push({
    id: 'heading-structure',
    label: '본문 제목 구조',
    status: headingWarnings.length > 0 ? 'warning' : 'pass',
    detail: headingWarnings.length > 0
      ? `${headingWarnings.join('. ')}.`
      : content.headingLevels.length > 0
        ? '제목 단계가 자연스럽게 구성되어 있습니다.'
        : '현재 분량에는 별도 소제목이 필수는 아닙니다.'
  });

  items.push({
    id: 'image-alt',
    label: '이미지 설명',
    status: content.genericImageAltCount > 0 ? 'warning' : 'pass',
    detail: content.genericImageAltCount > 0
      ? `대체 텍스트가 없거나 일반적인 이미지가 ${content.genericImageAltCount}개 있습니다. 장식용 이미지라면 비워둘 수 있습니다.`
      : content.imageCount > 0
        ? `본문 이미지 ${content.imageCount}개에 설명이 있습니다.`
        : '본문 이미지가 없습니다.'
  });

  const canonicalUrl = draft.seoCanonicalUrl.trim();
  items.push({
    id: 'canonical-url',
    label: 'Canonical URL',
    status: isValidCanonicalUrl(canonicalUrl) ? 'pass' : 'warning',
    detail: !canonicalUrl
      ? '비워두면 현재 글 주소를 사용합니다.'
      : isValidCanonicalUrl(canonicalUrl)
        ? '유효한 웹 주소입니다.'
        : 'http:// 또는 https://로 시작하는 전체 주소를 입력해 주세요.'
  });

  const imageReference = draft.seoOgImage.trim() || draft.cover.trim();
  items.push({
    id: 'og-image',
    label: '공유 이미지',
    status: isValidImageReference(imageReference) ? 'pass' : 'warning',
    detail: !imageReference
      ? '비워두면 사이트 기본 이미지를 사용합니다.'
      : isValidImageReference(imageReference)
        ? '공유에 사용할 이미지 주소가 유효합니다.'
        : 'http://, https:// 주소 또는 /로 시작하는 사이트 내부 경로를 입력해 주세요.'
  });

  return {
    items,
    warningCount: items.filter(item => item.status === 'warning').length,
    requiredCount: requiredWarnings.length
  };
};
