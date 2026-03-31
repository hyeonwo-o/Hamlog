import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import path from 'path';
import { fileURLToPath } from 'url';

// Config
import { uploadDir } from './config/paths.js';
import { resolveCorsOptions } from './config/security.js';
import { readProfile } from './models/profileModel.js';

// Routers
import { categoryRouter } from './routes/categories.js';
import { postRouter } from './routes/posts.js';
import { profileRouter } from './routes/profile.js';
import { uploadRouter } from './routes/uploads.js';
import { healthRouter } from './routes/health.js';
import { seoRouter } from './routes/seo.js';
import { commentRouter } from './routes/comments.js';
import { authRouter } from './routes/auth.js';
import { previewRouter } from './routes/preview.js';
import { searchPosts } from './controllers/searchController.js';
import { injectPostMeta } from './controllers/seoController.js';
import { readSpaIndexHtml, resolveSpaIndexPath } from './utils/spaIndex.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_SITE_URL = 'https://tech.hamwoo.co.kr';
const HOME_TITLE_SUFFIX = '클라우드 엔지니어링과 개발 기록';
const HOME_DESCRIPTION = '클라우드 엔지니어링, 인프라, DevOps, 개발 경험을 기록하는 기술 블로그입니다.';

const app = express();
const replaceHeadTag = (html, pattern, replacement) => (
    pattern.test(html)
        ? html.replace(pattern, replacement)
        : html.replace('</head>', `  ${replacement}\n</head>`)
);
const escapeHtml = (value = '') => String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
const resolveBaseUrl = (profile) => {
    const candidate = String(profile?.siteUrl ?? '').trim().replace(/\/+$/, '');
    return /^https?:\/\//i.test(candidate) ? candidate : DEFAULT_SITE_URL;
};
const toAbsoluteUrl = (baseUrl, value = '') => {
    if (!value) return `${baseUrl}/avatar.jpg`;
    if (/^https?:\/\//i.test(value)) return value;
    return `${baseUrl}${value.startsWith('/') ? '' : '/'}${value}`;
};
const resolveHomeTitle = (profile) => {
    const title = String(profile?.title ?? '').trim() || 'Ham_Tech_Log';
    return title.includes('|') ? title : `${title} | ${HOME_TITLE_SUFFIX}`;
};
const resolveHomeDescription = (profile) => (
    String(profile?.description ?? '').trim() || HOME_DESCRIPTION
);
const resolveHomeKeywords = (profile) => {
    const profileStack = Array.isArray(profile?.stack)
        ? profile.stack.map(item => String(item).trim()).filter(Boolean)
        : [];

    return Array.from(new Set([
        '클라우드 엔지니어링',
        'DevOps',
        '인프라',
        'AWS',
        'GCP',
        'Kubernetes',
        ...profileStack
    ])).join(', ');
};
const buildHomeSchema = (profile, baseUrl, description) => JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: String(profile?.title ?? '').trim() || 'Hamlog',
    description,
    url: baseUrl,
    publisher: {
        '@type': 'Person',
        name: String(profile?.name ?? '').trim() || 'Hamwoo'
    },
    inLanguage: 'ko-KR'
}).replace(/</g, '\\u003c');

const injectGoogleSiteVerification = (html) => {
    const verification = String(process.env.GOOGLE_SITE_VERIFICATION ?? '').trim();

    if (!verification) {
        return html;
    }

    return replaceHeadTag(
        html,
        /<meta name="google-site-verification" content=".*?" \/>/,
        `<meta name="google-site-verification" content="${escapeHtml(verification)}" />`
    );
};

const injectHomeSeoMeta = (html, profile) => {
    const baseUrl = resolveBaseUrl(profile);
    const title = resolveHomeTitle(profile);
    const description = resolveHomeDescription(profile);
    const keywords = resolveHomeKeywords(profile);
    const author = String(profile?.name ?? '').trim() || 'Hamwoo';
    const siteName = String(profile?.title ?? '').trim() || 'Hamlog';
    const favicon = toAbsoluteUrl(baseUrl, profile?.favicon || '/avatar.jpg');
    const image = toAbsoluteUrl(baseUrl, profile?.profileImage || profile?.favicon || '/avatar.jpg');
    const schema = buildHomeSchema(profile, baseUrl, description);

    let nextHtml = html;
    nextHtml = replaceHeadTag(nextHtml, /<title>.*?<\/title>/, `<title>${escapeHtml(title)}</title>`);
    nextHtml = replaceHeadTag(
        nextHtml,
        /<meta name="description" content=".*?" \/>/,
        `<meta name="description" content="${escapeHtml(description)}" />`
    );
    nextHtml = replaceHeadTag(
        nextHtml,
        /<meta name="keywords" content=".*?" \/>/,
        `<meta name="keywords" content="${escapeHtml(keywords)}" />`
    );
    nextHtml = replaceHeadTag(
        nextHtml,
        /<meta name="author" content=".*?" \/>/,
        `<meta name="author" content="${escapeHtml(author)}" />`
    );
    nextHtml = replaceHeadTag(
        nextHtml,
        /<meta property="og:title" content=".*?" \/>/,
        `<meta property="og:title" content="${escapeHtml(title)}" />`
    );
    nextHtml = replaceHeadTag(
        nextHtml,
        /<meta property="og:description" content=".*?" \/>/,
        `<meta property="og:description" content="${escapeHtml(description)}" />`
    );
    nextHtml = replaceHeadTag(
        nextHtml,
        /<meta property="og:url" content=".*?" \/>/,
        `<meta property="og:url" content="${escapeHtml(baseUrl)}" />`
    );
    nextHtml = replaceHeadTag(
        nextHtml,
        /<meta property="og:image" content=".*?" \/>/,
        `<meta property="og:image" content="${escapeHtml(image)}" />`
    );
    nextHtml = replaceHeadTag(
        nextHtml,
        /<meta property="og:site_name" content=".*?" \/>/,
        `<meta property="og:site_name" content="${escapeHtml(siteName)}" />`
    );
    nextHtml = replaceHeadTag(
        nextHtml,
        /<meta name="twitter:title" content=".*?" \/>/,
        `<meta name="twitter:title" content="${escapeHtml(title)}" />`
    );
    nextHtml = replaceHeadTag(
        nextHtml,
        /<meta name="twitter:description" content=".*?" \/>/,
        `<meta name="twitter:description" content="${escapeHtml(description)}" />`
    );
    nextHtml = replaceHeadTag(
        nextHtml,
        /<meta name="twitter:image" content=".*?" \/>/,
        `<meta name="twitter:image" content="${escapeHtml(image)}" />`
    );
    nextHtml = replaceHeadTag(
        nextHtml,
        /<link rel="canonical" href=".*?" \/>/,
        `<link rel="canonical" href="${escapeHtml(baseUrl)}" />`
    );
    nextHtml = replaceHeadTag(
        nextHtml,
        /<link rel="icon"[^>]*href=".*?"[^>]*\/>/,
        `<link rel="icon" href="${escapeHtml(favicon)}" />`
    );
    nextHtml = replaceHeadTag(
        nextHtml,
        /<link rel="apple-touch-icon"[^>]*href=".*?"[^>]*\/>/,
        `<link rel="apple-touch-icon" href="${escapeHtml(favicon)}" />`
    );
    nextHtml = replaceHeadTag(
        nextHtml,
        /<script type="application\/ld\+json">[\s\S]*?<\/script>/,
        `<script type="application/ld+json">${schema}</script>`
    );

    return injectGoogleSiteVerification(nextHtml);
};

const injectHomeAppShell = async (req, res, next) => {
    try {
        const [html, profile] = await Promise.all([readSpaIndexHtml(), readProfile()]);
        res.send(injectHomeSeoMeta(html, profile));
    } catch (error) {
        next(error);
    }
};

const injectNoindexAppShell = async (req, res, next) => {
    try {
        let html = await readSpaIndexHtml();
        html = injectGoogleSiteVerification(html);
        html = replaceHeadTag(
            html,
            /<meta name="robots" content=".*?" \/>/,
            '<meta name="robots" content="noindex, nofollow" />'
        );

        res
            .set('X-Robots-Tag', 'noindex, nofollow')
            .send(html);
    } catch (error) {
        next(error);
    }
};

// Middleware
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
}));
app.use(cors((req, callback) => {
    callback(null, resolveCorsOptions(req));
}));
app.use(cookieParser());
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ limit: '25mb', extended: true }));

app.get('/', injectHomeAppShell);

// Static Files
app.use('/uploads', express.static(uploadDir));
app.use(express.static(path.join(__dirname, '../dist')));

// API Routes
app.use('/api', healthRouter);
app.use('/api/posts', postRouter);
app.use('/api/categories', categoryRouter);
app.use('/api/profile', profileRouter);
app.use('/api/uploads', uploadRouter);
app.use('/api/comments', commentRouter);
app.use('/api/auth', authRouter);
app.use('/api', previewRouter);
app.get('/api/search', searchPosts);
app.get(/^\/admin(?:\/.*)?$/, injectNoindexAppShell);
app.get(['/posts/:slug', '/p/:slug'], injectPostMeta);
app.use('/', seoRouter);

// Fallback for SPA
app.get('*', async (req, res, next) => {
    try {
        res.sendFile(await resolveSpaIndexPath());
    } catch (error) {
        next(error);
    }
});

export default app;
