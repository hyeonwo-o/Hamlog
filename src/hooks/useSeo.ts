import { useEffect } from 'react';

interface SeoProps {
    title?: string;
    description?: string;
    image?: string;
    keywords?: string[];
    url?: string;
    type?: 'article' | 'website';
    favicon?: string;
    twitterHandle?: string;
}

const toAbsoluteUrl = (value?: string) => {
    if (!value) return '';
    if (/^https?:\/\//i.test(value)) return value;
    if (typeof window === 'undefined') return value;
    return `${window.location.origin}${value.startsWith('/') ? '' : '/'}${value}`;
};

export const useSeo = ({
    title,
    description,
    image,
    keywords,
    url,
    type = 'article',
    favicon,
    twitterHandle,
}: SeoProps) => {
    useEffect(() => {
        if (typeof document === 'undefined') return;

        const seoTitle = title ?? '';
        const seoDescription = description ?? '';
        const seoImage = toAbsoluteUrl(image);
        const seoKeywords = keywords?.join(', ') ?? '';
        const canonicalUrl = toAbsoluteUrl(url) || window.location.href;
        const seoFavicon = toAbsoluteUrl(favicon ?? '/avatar.jpg');

        if (seoTitle) {
            document.title = seoTitle;
        }

        const setMetaTag = (key: string, content: string, attr: 'name' | 'property') => {
            const selector = `meta[${attr}="${key}"]`;
            let element = document.head.querySelector(selector) as HTMLMetaElement | null;
            if (!content) {
                if (element) element.remove();
                return;
            }
            if (!element) {
                element = document.createElement('meta');
                element.setAttribute(attr, key);
                document.head.appendChild(element);
            }
            element.setAttribute('content', content);
        };

        const setLinkTag = (rel: string, href: string) => {
            const selector = `link[rel="${rel}"]`;
            let element = document.head.querySelector(selector) as HTMLLinkElement | null;
            if (!href) {
                if (element) element.remove();
                return;
            }
            if (!element) {
                element = document.createElement('link');
                element.setAttribute('rel', rel);
                document.head.appendChild(element);
            }
            element.setAttribute('href', href);
        };

        setMetaTag('description', seoDescription, 'name');
        setMetaTag('keywords', seoKeywords, 'name');
        setMetaTag('og:title', seoTitle, 'property');
        setMetaTag('og:description', seoDescription, 'property');
        setMetaTag('og:image', seoImage, 'property');
        setMetaTag('og:type', type, 'property');
        setMetaTag('og:url', canonicalUrl, 'property');
        setMetaTag('twitter:card', seoImage ? 'summary_large_image' : 'summary', 'name');
        setMetaTag('twitter:title', seoTitle, 'name');
        setMetaTag('twitter:description', seoDescription, 'name');
        setMetaTag('twitter:image', seoImage, 'name');
        setMetaTag('twitter:site', twitterHandle ?? '', 'name');
        setMetaTag('twitter:creator', twitterHandle ?? '', 'name');
        setLinkTag('canonical', canonicalUrl);
        setLinkTag('icon', seoFavicon);
        setLinkTag('apple-touch-icon', seoFavicon);
    }, [title, description, image, keywords, url, type, favicon, twitterHandle]);
};
