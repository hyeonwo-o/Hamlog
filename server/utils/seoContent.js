import * as cheerio from 'cheerio';
import { escapeHtml } from './seoHtml.js';

const MIN_POST_DESCRIPTION_LENGTH = 50;
const MIN_HOME_DESCRIPTION_LENGTH = 40;
const MAX_GENERATED_DESCRIPTION_LENGTH = 160;
const SKIPPED_CONTENT_TAGS = new Set([
  'script',
  'style',
  'noscript',
  'template',
  'iframe',
  'object',
  'embed',
  'svg'
]);
const SAFE_CONTENT_TAGS = new Set([
  'article',
  'section',
  'header',
  'footer',
  'nav',
  'aside',
  'div',
  'p',
  'span',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'ul',
  'ol',
  'li',
  'blockquote',
  'pre',
  'code',
  'strong',
  'em',
  'b',
  'i',
  'u',
  's',
  'del',
  'mark',
  'kbd',
  'sup',
  'sub',
  'figure',
  'figcaption',
  'table',
  'thead',
  'tbody',
  'tfoot',
  'tr',
  'th',
  'td',
  'time'
]);
const GENERIC_IMAGE_ALT_PATTERN = /^(?:image|img|photo|picture|screenshot|이미지|사진|스크린샷)(?:[-_ ]?\d+)?(?:\.(?:avif|gif|jpe?g|png|webp))?$/i;

const normalizeText = (value = '') => String(value).replace(/\s+/g, ' ').trim();

const truncateGeneratedDescription = (value, maxLength = MAX_GENERATED_DESCRIPTION_LENGTH) => {
  const normalized = normalizeText(value);
  if (normalized.length <= maxLength) return normalized;

  const candidate = normalized.slice(0, maxLength - 1);
  const lastSpace = candidate.lastIndexOf(' ');
  const trimmed = lastSpace >= Math.floor(maxLength * 0.65)
    ? candidate.slice(0, lastSpace)
    : candidate;

  return `${trimmed.trim()}…`;
};

const isMeaningfulImageAlt = (value) => {
  const normalized = normalizeText(value);
  return Boolean(normalized && !GENERIC_IMAGE_ALT_PATTERN.test(normalized));
};

const sanitizeWebUrl = (value, { baseUrl = '', absoluteUploads = false, allowHash = true } = {}) => {
  const normalized = String(value ?? '').trim();
  const hasControlCharacter = Array.from(normalized).some((character) => {
    const codePoint = character.codePointAt(0);
    return codePoint <= 31 || codePoint === 127;
  });
  if (!normalized || hasControlCharacter) return '';
  if (allowHash && normalized.startsWith('#')) return normalized;

  if (normalized.startsWith('/') && !normalized.startsWith('//')) {
    if (absoluteUploads && normalized.startsWith('/uploads/') && baseUrl) {
      return `${String(baseUrl).replace(/\/+$/, '')}${normalized}`;
    }
    return normalized;
  }

  try {
    const parsed = new URL(normalized);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.href : '';
  } catch {
    return '';
  }
};

const safeNumericAttribute = (value) => {
  const normalized = String(value ?? '').trim();
  if (!/^\d{1,5}$/.test(normalized)) return '';
  const parsed = Number.parseInt(normalized, 10);
  return parsed > 0 ? String(parsed) : '';
};

const buildLinkAttributes = (url) => {
  if (!/^https?:\/\//i.test(url)) return '';
  return ' rel="noopener noreferrer"';
};

const resolveImageAlt = ($, element, postTitle) => {
  const suppliedAlt = normalizeText($(element).attr('alt'));
  if (isMeaningfulImageAlt(suppliedAlt)) return suppliedAlt;

  const candidates = [
    $(element).attr('data-caption'),
    $(element).closest('figure').find('figcaption').first().text(),
    $(element).parent().clone().children('img').remove().end().text(),
    $(element).parent().prevAll('h1, h2, h3, h4, p, figcaption').first().text(),
    $(element).prevAll('h1, h2, h3, h4, p, figcaption').first().text()
  ];

  const contextualAlt = candidates
    .map(normalizeText)
    .find(isMeaningfulImageAlt);

  return truncateGeneratedDescription(
    contextualAlt || `${normalizeText(postTitle) || '게시글'} 관련 이미지`,
    140
  );
};

export const sanitizePostContentHtml = (
  contentHtml,
  { postTitle = '', baseUrl = '', absoluteUploads = false, demoteH1 = true } = {}
) => {
  const $ = cheerio.load(String(contentHtml ?? ''), {}, false);
  $(Array.from(SKIPPED_CONTENT_TAGS).join(',')).remove();

  const renderChildren = (node) => (
    Array.isArray(node?.children)
      ? node.children.map(renderNode).join('')
      : ''
  );

  const renderNode = (node) => {
    if (!node) return '';
    if (node.type === 'text') return escapeHtml(node.data ?? '');
    if (node.type !== 'tag') return renderChildren(node);

    const tagName = String(node.name ?? node.tagName ?? '').toLowerCase();
    if (!tagName || SKIPPED_CONTENT_TAGS.has(tagName)) return '';

    if (tagName === 'link-card') {
      const element = $(node);
      const url = sanitizeWebUrl(element.attr('url') || element.attr('href'), {
        baseUrl,
        absoluteUploads,
        allowHash: false
      });
      const title = normalizeText(element.attr('title') || element.attr('domain') || url);
      const description = normalizeText(element.attr('description'));
      if (!title && !description) return '';

      const label = escapeHtml(title || description);
      const heading = url
        ? `<a href="${escapeHtml(url)}"${buildLinkAttributes(url)}>${label}</a>`
        : `<span>${label}</span>`;
      const detail = description && description !== title
        ? `<p>${escapeHtml(description)}</p>`
        : '';
      return `<aside data-content-type="link-card">${heading}${detail}</aside>`;
    }

    if (tagName === 'a') {
      const children = renderChildren(node);
      const url = sanitizeWebUrl($(node).attr('href'), { baseUrl, absoluteUploads });
      return url
        ? `<a href="${escapeHtml(url)}"${buildLinkAttributes(url)}>${children}</a>`
        : children;
    }

    if (tagName === 'img') {
      const source = sanitizeWebUrl($(node).attr('src'), {
        baseUrl,
        absoluteUploads,
        allowHash: false
      });
      if (!source) return '';

      const alt = resolveImageAlt($, node, postTitle);
      const width = safeNumericAttribute($(node).attr('width') || $(node).attr('data-width'));
      const height = safeNumericAttribute($(node).attr('height'));
      const dimensions = [
        width ? ` width="${width}"` : '',
        height ? ` height="${height}"` : ''
      ].join('');

      return `<img src="${escapeHtml(source)}" alt="${escapeHtml(alt)}"${dimensions} loading="lazy" decoding="async" />`;
    }

    if (tagName === 'br' || tagName === 'hr') return `<${tagName} />`;
    if (!SAFE_CONTENT_TAGS.has(tagName)) return renderChildren(node);

    const outputTag = demoteH1 && tagName === 'h1' ? 'h2' : tagName;
    let attributes = '';
    if (outputTag === 'time') {
      const dateTime = normalizeText($(node).attr('datetime'));
      if (dateTime) attributes = ` datetime="${escapeHtml(dateTime)}"`;
    }
    if (outputTag === 'th' || outputTag === 'td') {
      const colSpan = safeNumericAttribute($(node).attr('colspan'));
      const rowSpan = safeNumericAttribute($(node).attr('rowspan'));
      if (colSpan) attributes += ` colspan="${colSpan}"`;
      if (rowSpan) attributes += ` rowspan="${rowSpan}"`;
    }

    return `<${outputTag}${attributes}>${renderChildren(node)}</${outputTag}>`;
  };

  return $.root().contents().toArray().map(renderNode).join('').trim();
};

export const extractPostPlainText = (contentHtml, postTitle = '') => {
  const safeHtml = sanitizePostContentHtml(contentHtml, { postTitle });
  if (!safeHtml) return '';
  return normalizeText(cheerio.load(safeHtml, {}, false).root().text());
};

export const resolvePostMetaDescription = (post) => {
  const explicitDescription = normalizeText(post?.seo?.description);
  if (explicitDescription) return explicitDescription;

  const summary = normalizeText(post?.summary);
  if (summary.length >= MIN_POST_DESCRIPTION_LENGTH) return summary;

  let bodyText = extractPostPlainText(post?.contentHtml, post?.title);
  if (summary && bodyText.toLocaleLowerCase().startsWith(summary.toLocaleLowerCase())) {
    bodyText = normalizeText(bodyText.slice(summary.length));
  }

  const combined = normalizeText([summary, bodyText].filter(Boolean).join(' '));
  return combined
    ? truncateGeneratedDescription(combined)
    : summary;
};

export const resolveHomeMetaDescription = (profile, fallbackDescription) => {
  const description = normalizeText(profile?.description) || normalizeText(fallbackDescription);
  if (description.length >= MIN_HOME_DESCRIPTION_LENGTH) return description;

  const ignoredPlaceholders = new Set(['tagline', 'role', 'description']);
  const supplements = [profile?.tagline, profile?.role]
    .map(normalizeText)
    .filter(value => (
      value
      && !ignoredPlaceholders.has(value.toLocaleLowerCase())
      && !description.includes(value)
    ));
  const stack = Array.isArray(profile?.stack)
    ? profile.stack.map(normalizeText).filter(Boolean).slice(0, 6)
    : [];
  if (stack.length > 0) supplements.push(`${stack.join(', ')} 기술 스택`);

  let combined = normalizeText([description, ...Array.from(new Set(supplements))].join(' · '));
  if (combined.length < MIN_HOME_DESCRIPTION_LENGTH) {
    combined = normalizeText([combined, fallbackDescription].filter(Boolean).join(' '));
  }

  return truncateGeneratedDescription(combined);
};

export const resolveSeoFavicon = (profile) => {
  const favicon = String(profile?.favicon ?? '').trim();
  return !favicon || favicon === '/avatar.jpg' ? '/favicon.svg' : favicon;
};

const toDateTime = (value) => {
  const parsed = new Date(value ?? '');
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString();
};

const toPostHref = (slug) => `/posts/${encodeURIComponent(String(slug ?? ''))}`;

const sortPostsNewestFirst = (posts) => [...posts].sort((left, right) => (
  new Date(right.updatedAt || right.publishedAt || 0).getTime()
  - new Date(left.updatedAt || left.publishedAt || 0).getTime()
));

export const buildHomePrerenderContent = (profile, posts, description) => {
  const siteName = normalizeText(profile?.title) || 'Hamlog';
  const recentPosts = sortPostsNewestFirst(posts).slice(0, 20);
  const postItems = recentPosts.map((post) => {
    const publishedAt = toDateTime(post.publishedAt);
    const time = publishedAt
      ? `<time datetime="${escapeHtml(publishedAt)}">${escapeHtml(String(post.publishedAt).slice(0, 10))}</time>`
      : '';
    return `<li><article><h2><a href="${escapeHtml(toPostHref(post.slug))}">${escapeHtml(post.title)}</a></h2><p>${escapeHtml(post.summary || '')}</p>${time}</article></li>`;
  }).join('');

  return `<main data-prerendered="home"><header><a href="/">${escapeHtml(siteName)}</a><h1>${escapeHtml(siteName)}</h1><p>${escapeHtml(description)}</p></header><section aria-labelledby="recent-posts-heading"><h2 id="recent-posts-heading">최근 글</h2>${postItems ? `<ul>${postItems}</ul>` : '<p>아직 공개된 글이 없습니다.</p>'}</section></main>`;
};

export const buildPostPrerenderContent = (post, profile, publicPosts, description, baseUrl) => {
  const siteName = normalizeText(profile?.title) || 'Hamlog';
  const publishedAt = toDateTime(post?.publishedAt);
  const modifiedAt = toDateTime(post?.updatedAt || post?.publishedAt);
  const safeArticle = sanitizePostContentHtml(post?.contentHtml, {
    postTitle: post?.title,
    baseUrl,
    demoteH1: true
  });
  const relatedPosts = sortPostsNewestFirst(publicPosts)
    .filter(candidate => candidate.slug !== post.slug)
    .slice(0, 5);
  const relatedLinks = relatedPosts.map(candidate => (
    `<li><a href="${escapeHtml(toPostHref(candidate.slug))}">${escapeHtml(candidate.title)}</a></li>`
  )).join('');
  const dateMarkup = publishedAt
    ? `<time datetime="${escapeHtml(publishedAt)}">${escapeHtml(String(post.publishedAt).slice(0, 10))}</time>`
    : '';
  const modifiedMarkup = modifiedAt && modifiedAt !== publishedAt
    ? `<meta itemprop="dateModified" content="${escapeHtml(modifiedAt)}" />`
    : '';

  return `<main data-prerendered="post"><nav aria-label="사이트"><a href="/">${escapeHtml(siteName)}</a></nav><article><header>${post.category ? `<p>${escapeHtml(post.category)}</p>` : ''}<h1>${escapeHtml(post.title)}</h1><p>${escapeHtml(post.summary || description)}</p>${dateMarkup}${modifiedMarkup}</header><section aria-label="본문">${safeArticle || `<p>${escapeHtml(description)}</p>`}</section></article>${relatedLinks ? `<nav aria-label="다른 글"><h2>다른 글</h2><ul>${relatedLinks}</ul></nav>` : ''}</main>`;
};

export const buildNotFoundPrerenderContent = () => (
  '<main data-prerendered="not-found"><h1>페이지를 찾을 수 없습니다.</h1><p>요청한 페이지가 없거나 이동되었습니다.</p><a href="/">글 목록으로 돌아가기</a></main>'
);
