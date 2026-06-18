import { randomUUID } from 'crypto';
import { readPosts, writePosts } from '../models/postModel.js';
import {
    createPostRevision,
    readPostRevisions,
    deletePostRevisions
} from '../models/revisionModel.js';
import { createCategoryUnlocked } from './categoryService.js';
import { normalizePostData } from '../utils/postHelpers.js';
import { filterPublicPosts } from '../utils/postVisibility.js';
import { runWithDataStoreLock } from '../utils/storeLock.js';

const serializeComparablePost = (post) => JSON.stringify(post ?? null);

const arePostsEquivalent = (left, right) => (
    serializeComparablePost(left) === serializeComparablePost(right)
);

const toRevisionSummary = (revision) => ({
    id: revision.id,
    postId: revision.postId,
    savedAt: revision.savedAt,
    event: revision.event,
    title: revision.title || revision.snapshot?.title || '',
    slug: revision.slug || revision.snapshot?.slug || '',
    status: revision.snapshot?.status ?? revision.status ?? 'draft'
});

export async function getAllPostsService(includeAll = false) {
    const posts = await readPosts();
    return { success: true, data: includeAll ? posts : filterPublicPosts(posts) };
}

export async function createPostService(rawData) {
    return runWithDataStoreLock(async () => {
        // 1. Normalize & Validate Input
        const { error, data } = normalizePostData(rawData);

        if (error) {
            return { success: false, error, code: 'validation_error' };
        }

        // 2. Check Slug Uniqueness
        const allPosts = await readPosts();
        if (allPosts.some(post => post.slug === data.slug)) {
            return { success: false, error: '슬러그가 이미 존재합니다.', code: 'duplicate_slug' };
        }

        // 3. Side Effects (Category)
        await createCategoryUnlocked(data.category);

        // 4. Create New Post
        const newPost = {
            id: `post-${randomUUID()}`,
            updatedAt: new Date().toISOString(),
            ...data
        };

        const next = [newPost, ...allPosts];
        await writePosts(next);
        await createPostRevision(newPost, 'created');

        return { success: true, data: newPost };
    });
}

export async function getPostRevisionsService(id) {
    const allPosts = await readPosts();
    const existing = allPosts.find(post => post.id === id);

    if (!existing) {
        return { success: false, error: '포스트를 찾을 수 없습니다.', code: 'not_found' };
    }

    const revisions = await readPostRevisions(id);
    return { success: true, data: revisions.map(toRevisionSummary) };
}

export async function updatePostService(id, rawData) {
    return runWithDataStoreLock(async () => {
        const allPosts = await readPosts();
        const index = allPosts.findIndex(post => post.id === id);

        if (index === -1) {
            return { success: false, error: '포스트를 찾을 수 없습니다.', code: 'not_found' };
        }

        const existing = allPosts[index];

        // 1. Normalize & Validate Input (merging with existing)
        const { error, data } = normalizePostData(rawData, existing);

        if (error) {
            return { success: false, error, code: 'validation_error' };
        }

        // 2. Check Slug Uniqueness (if changed)
        if (data.slug !== existing.slug) {
            if (allPosts.some(post => post.slug === data.slug && post.id !== id)) {
                return { success: false, error: '슬러그가 이미 존재합니다.', code: 'duplicate_slug' };
            }
        }

        // 3. Side Effects (Category)
        await createCategoryUnlocked(data.category);

        const revisions = await readPostRevisions(existing.id);
        const needsBaselineRevision = revisions.length === 0
            || !arePostsEquivalent(revisions[0]?.snapshot, existing);

        // 4. Update Post
        const updatedPost = {
            ...existing,
            ...data
        };
        updatedPost.updatedAt = new Date().toISOString();

        allPosts[index] = updatedPost;
        await writePosts(allPosts);
        if (needsBaselineRevision) {
            await createPostRevision(existing, 'baseline');
        }
        await createPostRevision(updatedPost, 'updated');

        return { success: true, data: updatedPost };
    });
}

export async function restorePostRevisionService(id, revisionId) {
    return runWithDataStoreLock(async () => {
        const allPosts = await readPosts();
        const index = allPosts.findIndex(post => post.id === id);

        if (index === -1) {
            return { success: false, error: '포스트를 찾을 수 없습니다.', code: 'not_found' };
        }

        const existing = allPosts[index];
        const revisions = await readPostRevisions(id);
        const targetRevision = revisions.find(revision => revision.id === revisionId);

        if (!targetRevision?.snapshot) {
            return { success: false, error: '리비전을 찾을 수 없습니다.', code: 'not_found' };
        }

        const { error, data } = normalizePostData(
            { ...targetRevision.snapshot, id: existing.id },
            existing
        );

        if (error) {
            return { success: false, error, code: 'validation_error' };
        }

        if (data.slug !== existing.slug) {
            if (allPosts.some(post => post.slug === data.slug && post.id !== id)) {
                return { success: false, error: '슬러그가 이미 존재합니다.', code: 'duplicate_slug' };
            }
        }

        await createCategoryUnlocked(data.category);

        const shouldCreateBaselineRevision = revisions.length === 0
            || !arePostsEquivalent(revisions[0]?.snapshot, existing);

        const restoredPost = {
            ...existing,
            ...data,
            id: existing.id
        };
        restoredPost.updatedAt = new Date().toISOString();

        allPosts[index] = restoredPost;
        await writePosts(allPosts);

        if (shouldCreateBaselineRevision) {
            await createPostRevision(existing, 'baseline');
        }
        await createPostRevision(restoredPost, 'restored');

        return { success: true, data: restoredPost };
    });
}

export async function deletePostService(id) {
    return runWithDataStoreLock(async () => {
        const allPosts = await readPosts();
        const next = allPosts.filter(post => post.id !== id);

        if (next.length === allPosts.length) {
            return { success: false, error: '포스트를 찾을 수 없습니다.', code: 'not_found' };
        }

        await writePosts(next);
        await deletePostRevisions(id);
        return { success: true };
    });
}
