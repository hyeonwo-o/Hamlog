import { useEffect } from 'react';
import type { Post } from '../types/blog';
import { siteMeta } from '../data/blogData';

interface UseSchemaProps {
    post: Post | undefined;
}

const getBaseUrl = () => (
    typeof window !== 'undefined' ? window.location.origin : siteMeta.siteUrl
);

const toAbsoluteUrl = (value?: string) => {
    if (!value) return '';
    if (/^https?:\/\//i.test(value)) return value;
    const baseUrl = getBaseUrl();
    return `${baseUrl}${value.startsWith('/') ? '' : '/'}${value}`;
};

export const useSchema = ({ post }: UseSchemaProps) => {
    useEffect(() => {
        if (!post) return;

        const baseUrl = getBaseUrl();
        const canonicalUrl = post.seo?.canonicalUrl || `${baseUrl}/posts/${post.slug}`;
        const imageUrl = toAbsoluteUrl(post.seo?.ogImage ?? post.cover);

        const schema = {
            "@context": "https://schema.org",
            "@type": "BlogPosting",
            "headline": post.seo?.title ?? post.title,
            "image": imageUrl ? [imageUrl] : [],
            "datePublished": post.publishedAt,
            "dateModified": post.updatedAt ?? post.publishedAt,
            "mainEntityOfPage": canonicalUrl,
            "url": canonicalUrl,
            "author": {
                "@type": "Person",
                "name": "Hamwoo",
                "url": baseUrl
            },
            "publisher": {
                "@type": "Organization",
                "name": "HamLog",
                "logo": {
                    "@type": "ImageObject",
                    "url": `${baseUrl}/avatar.jpg`
                }
            },
            "description": post.seo?.description ?? post.summary,
            "articleSection": post.category,
            "keywords": (post.seo?.keywords?.length ? post.seo.keywords : post.tags).join(', ')
        };

        const script = document.createElement('script');
        script.type = 'application/ld+json';
        script.text = JSON.stringify(schema).replace(/</g, '\\u003c');
        document.head.appendChild(script);

        return () => {
            document.head.removeChild(script);
        };
    }, [post]);
};
