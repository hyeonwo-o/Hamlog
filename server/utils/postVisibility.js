import { normalizePostStatus, normalizeScheduledAt } from './normalizers/postNormalizers.js';

// A malformed tombstone must stay private too. Only an explicit restore removes it.
export const isPostTrashed = (post) => Object.hasOwn(post ?? {}, 'deletedAt');

export function getScheduledTimestamp(value) {
    const normalized = normalizeScheduledAt(value);
    if (!normalized) return null;

    const timestamp = new Date(normalized).getTime();
    return Number.isNaN(timestamp) ? null : timestamp;
}

export function isPostPublicVisible(post, now = Date.now()) {
    if (isPostTrashed(post)) return false;
    const status = normalizePostStatus(post?.status);
    if (status === 'draft') return false;
    if (status === 'scheduled') {
        const scheduledAt = getScheduledTimestamp(post?.scheduledAt);
        return scheduledAt !== null && scheduledAt <= now;
    }
    return true;
}

export function filterPublicPosts(posts, now = Date.now()) {
    return posts.filter(post => isPostPublicVisible(post, now));
}

export function findPublicPostBySlug(posts, slug, now = Date.now()) {
    return posts.find(post => post.slug === slug && isPostPublicVisible(post, now));
}
