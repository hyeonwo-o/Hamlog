import { readPosts } from '../models/postModel.js';
import { readProfile } from '../models/profileModel.js';
import { filterPublicPosts, findPublicPostBySlug } from '../utils/postVisibility.js';
import { readSpaIndexHtml, resolveSpaIndexPath } from '../utils/spaIndex.js';
import { buildRobotsTxt, injectSearchVerificationMeta } from '../utils/searchVerification.js';
import {
  escapeHtml,
  escapeXml,
  normalizeBaseUrl,
  removeHeadTag,
  replaceHeadTag,
  toAbsoluteUrl,
  wrapCdata
} from '../utils/seoHtml.js';

const DEFAULT_SITE_URL = (process.env.SITE_URL?.trim() || 'https://tech.hamwoo.co.kr').replace(/\/+$/, '');
const SITE_NAME = 'Hamlog';
const AUTHOR_NAME = 'Hamwoo';

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

const buildArticleSchema = (post, canonicalUrl, image, baseUrl) => {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.seo?.title || post.title,
    description: post.seo?.description || post.summary,
    image: image ? [image] : [],
    datePublished: getArticleDate(post.publishedAt),
    dateModified: getArticleDate(post.updatedAt || post.publishedAt),
    mainEntityOfPage: canonicalUrl,
    url: canonicalUrl,
    author: {
      '@type': 'Person',
      name: AUTHOR_NAME,
      url: baseUrl
    },
    publisher: {
      '@type': 'Organization',
      name: SITE_NAME,
      logo: {
        '@type': 'ImageObject',
        url: `${baseUrl}/avatar.jpg`
      }
    }
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
      const notFoundTitle = `페이지를 찾을 수 없습니다 | ${SITE_NAME}`;

      html = replaceHeadTag(html, /<title>.*?<\/title>/, `<title>${escapeHtml(notFoundTitle)}</title>`);
      html = setRobotsDirective(html, 'noindex, nofollow');
      html = replaceHeadTag(
        html,
        /<link rel="canonical" href=".*?" \/>/,
        `<link rel="canonical" href="${escapeHtml(requestedUrl)}" />`
      );

      return res
        .status(404)
        .set('X-Robots-Tag', 'noindex, nofollow')
        .send(html);
    }

    const title = post.seo?.title || post.title;
    const description = post.seo?.description || post.summary;
    const image = toAbsoluteUrl(baseUrl, post.seo?.ogImage || post.cover || '/avatar.jpg');
    const fullUrl = `${baseUrl}/posts/${post.slug}`;
    const canonicalUrl = toAbsoluteUrl(baseUrl, post.seo?.canonicalUrl || fullUrl);
    const escapedTitle = escapeHtml(title);
    const escapedDescription = escapeHtml(description);
    const escapedImage = escapeHtml(image);
    const escapedFullUrl = escapeHtml(fullUrl);
    const escapedCanonicalUrl = escapeHtml(canonicalUrl);
    const escapedKeywords = escapeHtml(resolvePostKeywords(post).join(', '));
    const articleSchema = buildArticleSchema(post, canonicalUrl, image, baseUrl);

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
      `<meta property="og:url" content="${escapedFullUrl}" />`
    );
    html = replaceHeadTag(
      html,
      /<meta property="og:image" content=".*?" \/>/,
      `<meta property="og:image" content="${escapedImage}" />`
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

    const items = publishedPosts.map(post => `
    <item>
      <title>${wrapCdata(post.title)}</title>
      <link>${escapeXml(`${baseUrl}/posts/${post.slug}`)}</link>
      <guid>${escapeXml(`${baseUrl}/posts/${post.slug}`)}</guid>
      <pubDate>${new Date(post.updatedAt || post.publishedAt).toUTCString()}</pubDate>
      <description>${wrapCdata(post.summary)}</description>
      <content:encoded>${wrapCdata(post.contentHtml || '')}</content:encoded>
      ${post.category ? `<category>${escapeXml(post.category)}</category>` : ''}
    </item>`).join('');

    const rss = `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>${escapeXml(profile.title)}</title>
    <link>${escapeXml(baseUrl)}</link>
    <description>${escapeXml(profile.tagline)}</description>
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

    const urls = publishedPosts.map(post => `
  <url>
    <loc>${escapeXml(`${baseUrl}/posts/${post.slug}`)}</loc>
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
  <url>
    <loc>${escapeXml(`${baseUrl}/graph`)}</loc>
    <changefreq>weekly</changefreq>
    <priority>0.6</priority>
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
