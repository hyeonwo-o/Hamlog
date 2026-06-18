import type { JSONContent } from '@tiptap/core';

export interface ProfileDisplaySettings {
    showProfileImage: boolean;
    showLocation: boolean;
    showEmail: boolean;
    showSocialLinks: boolean;
    showNow: boolean;
    showStack: boolean;
}

export interface SiteMeta {
    title: string;
    name: string;
    role: string;
    tagline: string;
    description: string;
    location: string;
    profileImage: string;
    favicon?: string;
    email: string;
    siteUrl: string;
    social: {
        github?: string;
        linkedin?: string;
        twitter?: string;
        instagram?: string;
        threads?: string;
        telegram?: string;
    };
    stack: string[];
    now: string;
    display: ProfileDisplaySettings;
}

export interface TopicHighlight {
    title: string;
    description: string;
}

export type PostSection =
    | { type: 'heading'; content: string }
    | { type: 'paragraph'; content: string }
    | { type: 'list'; content: string[] }
    | { type: 'code'; content: string; language?: string }
    | { type: 'quote'; content: string }
    | { type: 'callout'; content: string }
    | { type: 'image'; content: string; alt?: string; caption?: string };

export type PostStatus = 'draft' | 'scheduled' | 'published';
export type PostRevisionEvent = 'baseline' | 'created' | 'updated' | 'restored';

export interface PostSeo {
    title?: string;
    description?: string;
    ogImage?: string;
    canonicalUrl?: string;
    keywords?: string[];
}

export interface Post {
    id: string;
    slug: string;
    title: string;
    summary: string;
    category?: string;
    contentJson?: JSONContent;
    contentHtml?: string;
    publishedAt: string;
    updatedAt?: string;
    readingTime: string;
    tags: string[];
    series?: string;
    featured?: boolean;
    cover?: string;
    status?: PostStatus;
    scheduledAt?: string;
    seo?: PostSeo;
    sections: PostSection[];
}

export interface PostRevision {
    id: string;
    postId: string;
    savedAt: string;
    event: PostRevisionEvent;
    title: string;
    slug: string;
    status: PostStatus;
}

export type PostInput = Omit<Post, 'id'>;
