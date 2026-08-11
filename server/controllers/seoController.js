import { readPosts } from '../models/postModel.js';
import { readProfile } from '../models/profileModel.js';
import { filterPublicPosts, findPublicPostBySlug } from '../utils/postVisibility.js';
import { readSpaIndexHtml, resolveSpaIndexPath } from '../utils/spaIndex.js';
import { buildRobotsTxt, injectSearchVerificationMeta } from '../utils/searchVerification.js';
import {
  buildNotFoundPrerenderContent,
  buildPostPrerenderContent,
  resolveHomeMetaDescription,
  resolvePostMetaDescription,
  resolveSeoFavicon,
  sanitizePostContentHtml
} from '../utils/seoContent.js';
import {
  escapeHtml,
  escapeXml,
  injectAppRootContent,
  normalizeBaseUrl,
  removeHeadTag,
  replaceHeadTag,
  toAbsoluteUrl,
  wrapCdata
} from '../utils/seoHtml.js';

const DEFAULT_SITE_URL = (process.env.SITE_URL?.trim() || 'https://tech.hamwoo.co.kr').replace(/\/+$/, '');
const HOME_DESCRIPTION = '클라우드 엔지니어링, 인프라, DevOps, 개발 경험을 기록하는 기술 블로그입니다.';

const resolvePostKeywords = (post) => {
  if (Array.isArray(post?.seo?.keywords) && post.seo.keywords.length > 0) {
    return post.seo.keywords;
  }
  if (Array.isArray(post?.tags) && post.tags.length > 0) {
    return post.tags;
  }
  return [];
};

const resolveBaseUrl = (profile) => {
  return normalizeBaseUrl(profile?.siteUrl, DEFAULT_SITE_URL);
};
const setRobotsDirective = (html, content) => replaceHeadTag(
  html,
  /<meta name="robots" content=".*?" \/>/,
  `<meta name="robots" content="${escapeHtml(content)}" />`
);

const getArticleDate = (value = '') => {
  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) {
    return value || undefined;
  }
  return timestamp.toISOString();
};

const resolveCanonicalUrl = (post, baseUrl) => {
  const postUrl = `${baseUrl}/posts/${post.slug}`;
  return toAbsoluteUrl(baseUrl, post.seo?.canonicalUrl || postUrl);
};

const buildArticleSchema = (post, canonicalUrl, image, baseUrl, profile, description) => {
  const authorName = String(profile?.name ?? '').trim() || 'Hamwoo';
  const siteName = String(profile?.title ?? '').trim() || 'Hamlog';
  const logo = toAbsoluteUrl(baseUrl, resolveSeoFavicon(profile));
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.seo?.title || post.title,
    description,
    image: image ? [image] : [],
    datePublished: getArticleDate(post.publishedAt),
    dateModified: getArticleDate(post.updatedAt || post.publishedAt),
    mainEntityOfPage: canonicalUrl,
    url: canonicalUrl,
    author: {
      '@type': 'Person',
      name: authorName,
      url: baseUrl
    },
    publisher: {
      '@type': 'Organization',
      name: siteName,
      logo: {
        '@type': 'ImageObject',
        url: logo
      }
    },
    isPartOf: {
      '@type': 'WebSite',
      name: siteName,
      url: baseUrl
    },
    inLanguage: 'ko-KR'
  };

  if (post.category) {
    schema.articleSection = post.category;
  }

  const keywords = resolvePostKeywords(post);
  if (keywords.length > 0) {
    schema.keywords = keywords.join(', ');
  }

  return JSON.stringify(schema).replace(/</g, '\\u003c');
};

export const injectPostMeta = async (req, res) => {
  try {
    const { slug } = req.params;
    const [posts, profile] = await Promise.all([readPosts(), readProfile()]);
    const baseUrl = resolveBaseUrl(profile);
    const post = findPublicPostBySlug(posts, slug);

    let html = await readSpaIndexHtml();

    if (!post) {
      const requestedUrl = `${baseUrl}${req.originalUrl}`;
      const siteName = String(profile?.title ?? '').trim() || 'Hamlog';
      const notFoundTitle = `페이지를 찾을 수 없습니다 | ${siteName}`;

      html = replaceHeadTag(html, /<title>.*?<\/title>/, `<title>${escapeHtml(notFoundTitle)}</title>`);
      html = setRobotsDirective(html, 'noindex, nofollow');
      html = replaceHeadTag(
        html,
        /<link rel="canonical" href=".*?" \/>/,
        `<link rel="canonical" href="${escapeHtml(requestedUrl)}" />`
      );
      html = injectAppRootContent(html, buildNotFoundPrerenderContent());

      return res
        .status(404)
        .set('X-Robots-Tag', 'noindex, nofollow')
        .send(html);
    }

    const title = post.seo?.title || post.title;
    const description = resolvePostMetaDescription(post);
    const image = toAbsoluteUrl(baseUrl, post.seo?.ogImage || post.cover || '/avatar.jpg');
    const canonicalUrl = resolveCanonicalUrl(post, baseUrl);
    const siteName = String(profile?.title ?? '').trim() || 'Hamlog';
    const authorName = String(profile?.name ?? '').trim() || 'Hamwoo';
    const favicon = toAbsoluteUrl(baseUrl, resolveSeoFavicon(profile));
    const escapedTitle = escapeHtml(title);
    const escapedDescription = escapeHtml(description);
    const escapedImage = escapeHtml(image);
    const escapedCanonicalUrl = escapeHtml(canonicalUrl);
    const escapedKeywords = escapeHtml(resolvePostKeywords(post).join(', '));
    const articleSchema = buildArticleSchema(
      post,
      canonicalUrl,
      image,
      baseUrl,
      profile,
      description
    );

    // Update basic meta
    html = replaceHeadTag(html, /<title>.*?<\/title>/, `<title>${escapedTitle}</title>`);
    html = replaceHeadTag(
      html,
      /<meta name="description" content=".*?" \/>/,
      `<meta name="description" content="${escapedDescription}" />`
    );
    html = replaceHeadTag(
      html,
      /<meta name="keywords" content=".*?" \/>/,
      `<meta name="keywords" content="${escapedKeywords}" />`
    );
    html = replaceHeadTag(
      html,
      /<meta name="author" content=".*?" \/>/,
      `<meta name="author" content="${escapeHtml(authorName)}" />`
    );
    html = setRobotsDirective(html, 'index, follow');

    // Update OG meta
    html = replaceHeadTag(
      html,
      /<meta property="og:title" content=".*?" \/>/,
      `<meta property="og:title" content="${escapedTitle}" />`
    );
    html = replaceHeadTag(
      html,
      /<meta property="og:description" content=".*?" \/>/,
      `<meta property="og:description" content="${escapedDescription}" />`
    );
    html = replaceHeadTag(
      html,
      /<meta property="og:type" content=".*?" \/>/,
      '<meta property="og:type" content="article" />'
    );
    html = replaceHeadTag(
      html,
      /<meta property="og:url" content=".*?" \/>/,
      `<meta property="og:url" content="${escapedCanonicalUrl}" />`
    );
    html = replaceHeadTag(
      html,
      /<meta property="og:image" content=".*?" \/>/,
      `<meta property="og:image" content="${escapedImage}" />`
    );
    html = replaceHeadTag(
      html,
      /<meta property="og:site_name" content=".*?" \/>/,
      `<meta property="og:site_name" content="${escapeHtml(siteName)}" />`
    );

    // Update Twitter meta
    html = replaceHeadTag(
      html,
      /<meta name="twitter:title" content=".*?" \/>/,
      `<meta name="twitter:title" content="${escapedTitle}" />`
    );
    html = replaceHeadTag(
      html,
      /<meta name="twitter:description" content=".*?" \/>/,
      `<meta name="twitter:description" content="${escapedDescription}" />`
    );
    html = replaceHeadTag(
      html,
      /<meta name="twitter:image" content=".*?" \/>/,
      `<meta name="twitter:image" content="${escapedImage}" />`
    );
    html = removeHeadTag(html, /<meta name="twitter:site" content=".*?" \/>\s*/);
    html = removeHeadTag(html, /<meta name="twitter:creator" content=".*?" \/>\s*/);

    html = replaceHeadTag(
      html,
      /<link rel="canonical" href=".*?" \/>/,
      `<link rel="canonical" href="${escapedCanonicalUrl}" />`
    );
    html = replaceHeadTag(
      html,
      /<meta property="article:published_time" content=".*?" \/>/,
      `<meta property="article:published_time" content="${escapeHtml(getArticleDate(post.publishedAt) || '')}" />`
    );
    html = replaceHeadTag(
      html,
      /<meta property="article:modified_time" content=".*?" \/>/,
      `<meta property="article:modified_time" content="${escapeHtml(getArticleDate(post.updatedAt || post.publishedAt) || '')}" />`
    );
    html = replaceHeadTag(
      html,
      /<script type="application\/ld\+json">[\s\S]*?<\/script>/,
      `<script type="application/ld+json">${articleSchema}</script>`
    );
    html = replaceHeadTag(
      html,
      /<link rel="icon"[^>]*href=".*?"[^>]*\/>/,
      `<link rel="icon" href="${escapeHtml(favicon)}" />`
    );
    html = replaceHeadTag(
      html,
      /<link rel="apple-touch-icon"[^>]*href=".*?"[^>]*\/>/,
      `<link rel="apple-touch-icon" href="${escapeHtml(favicon)}" />`
    );
    html = injectAppRootContent(
      html,
      buildPostPrerenderContent(
        post,
        profile,
        filterPublicPosts(posts),
        description,
        baseUrl
      )
    );

    res.send(injectSearchVerificationMeta(html));
  } catch (error) {
    console.error('Meta injection error:', error);
    // Fallback to regular file if injection fails
    try {
      res.sendFile(await resolveSpaIndexPath());
    } catch (fallbackError) {
      console.error('SPA fallback error:', fallbackError);
      res.status(500).send('Failed to load application shell.');
    }
  }
};

export const getRss = async (req, res) => {
  try {
    const posts = await readPosts();
    const profile = await readProfile();
    const baseUrl = resolveBaseUrl(profile);
    const publishedPosts = filterPublicPosts(posts)
      .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

    const authorName = String(profile?.name ?? '').trim() || 'Hamwoo';
    const feedDescription = String(profile?.tagline ?? '').trim()
      || resolveHomeMetaDescription(profile, HOME_DESCRIPTION);
    const items = publishedPosts.map(post => {
      const canonicalUrl = resolveCanonicalUrl(post, baseUrl);
      const publishedDate = new Date(post.publishedAt);
      const pubDate = Number.isNaN(publishedDate.getTime())
        ? new Date(post.updatedAt || 0).toUTCString()
        : publishedDate.toUTCString();
      const safeContent = sanitizePostContentHtml(post.contentHtml || '', {
        postTitle: post.title,
        baseUrl,
        absoluteUploads: true,
        demoteH1: false
      });

      return `
    <item>
      <title>${wrapCdata(post.title)}</title>
      <link>${escapeXml(canonicalUrl)}</link>
      <guid>${escapeXml(canonicalUrl)}</guid>
      <pubDate>${pubDate}</pubDate>
      <dc:creator>${wrapCdata(authorName)}</dc:creator>
      <description>${wrapCdata(post.summary)}</description>
      <content:encoded>${wrapCdata(safeContent)}</content:encoded>
      ${post.category ? `<category>${escapeXml(post.category)}</category>` : ''}
    </item>`;
    }).join('');

    const rss = `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>${escapeXml(profile.title)}</title>
    <link>${escapeXml(baseUrl)}</link>
    <description>${escapeXml(feedDescription)}</description>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    ${items}
  </channel>
</rss>`;

    res.set('Content-Type', 'text/xml');
    res.send(rss);
  } catch (error) {
    console.error(error);
    res.status(500).send('Error generating RSS');
  }
};

export const getSitemap = async (req, res) => {
  try {
    const [posts, profile] = await Promise.all([readPosts(), readProfile()]);
    const baseUrl = resolveBaseUrl(profile);
    const publishedPosts = filterPublicPosts(posts);

    const baseOrigin = new URL(baseUrl).origin;
    const sitemapPosts = Array.from(new Map(publishedPosts.flatMap(post => {
      const canonicalUrl = resolveCanonicalUrl(post, baseUrl);
      try {
        return new URL(canonicalUrl).origin === baseOrigin
          ? [[canonicalUrl, post]]
          : [];
      } catch {
        return [];
      }
    })).entries());
    const urls = sitemapPosts.map(([canonicalUrl, post]) => `
  <url>
    <loc>${escapeXml(canonicalUrl)}</loc>
    <lastmod>${(post.updatedAt || post.publishedAt).slice(0, 10)}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>`).join('');

    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${escapeXml(baseUrl)}</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  ${urls}
</urlset>`;

    res.set('Content-Type', 'text/xml');
    res.send(sitemap);
  } catch (error) {
    console.error(error);
    res.status(500).send('Error generating Sitemap');
  }
};

export const getRobots = async (req, res) => {
  try {
    const profile = await readProfile();
    const baseUrl = resolveBaseUrl(profile);

    res
      .set('Content-Type', 'text/plain; charset=utf-8')
      .send(buildRobotsTxt(baseUrl));
  } catch (error) {
    console.error(error);
    res.status(500).send('Error generating robots.txt');
  }
};
