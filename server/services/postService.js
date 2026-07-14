import { randomUUID } from 'crypto';
import { readPosts, writePosts } from '../models/postModel.js';
import {
    createPostRevision,
    readPostRevisions,
    deletePostRevisions
} from '../models/revisionModel.js';
import { createCategoryUnlocked } from './categoryService.js';
import { normalizePostData } from '../utils/postHelpers.js';
import { filterPublicPosts, isPostPublicVisible } from '../utils/postVisibility.js';
import { normalizePostViews } from '../utils/normalizers/postNormalizers.js';
import { runWithDataStoreLock } from '../utils/storeLock.js';
import {
    applyPostViews,
    deletePostView,
    incrementPostView,
    readPostViews
} from '../models/postViewModel.js';
import { toPostSummaries } from '../utils/postSummaries.js';
import { deleteCommentsByPostIdUnlocked } from '../models/commentModel.js';

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

const readPostsWithViews = async () => {
    const [posts, views] = await Promise.all([readPosts(), readPostViews()]);
    return applyPostViews(posts, views);
};

export async function getAllPostsService(includeAll = false, summaryOnly = false) {
    const posts = await readPostsWithViews();
    const visiblePosts = includeAll ? posts : filterPublicPosts(posts);
    return {
        success: true,
        data: summaryOnly ? toPostSummaries(visiblePosts) : visiblePosts
    };
}

export async function getPostBySlugService(slug) {
    const posts = await readPostsWithViews();
    const post = posts.find(item => item.slug === String(slug ?? '').trim());

    if (!post || !isPostPublicVisible(post)) {
        return { success: false, error: '포스트를 찾을 수 없습니다.', code: 'not_found' };
    }

    return { success: true, data: post };
}

export async function createPostService(rawData) {
    return runWithDataStoreLock(async () => {
        // 1. Normalize & Validate Input
        const { error, data } = normalizePostData(rawData);

        if (error) {
            return { success: false, error, code: 'validation_error' };
        }

        // 2. Check Slug Uniqueness
        const allPosts = await readPostsWithViews();
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

export async function recordPostViewService(slug) {
    return runWithDataStoreLock(async () => {
        const normalizedSlug = String(slug ?? '').trim();
        if (!normalizedSlug) {
            return { success: false, error: '포스트를 찾을 수 없습니다.', code: 'not_found' };
        }

        const allPosts = await readPosts();
        const index = allPosts.findIndex(post => post.slug === normalizedSlug);

        if (index === -1 || !isPostPublicVisible(allPosts[index])) {
            return { success: false, error: '포스트를 찾을 수 없습니다.', code: 'not_found' };
        }

        const targetPost = allPosts[index];
        const nextViews = await incrementPostView(
            targetPost.id,
            normalizePostViews(targetPost.views)
        );

        return {
            success: true,
            data: {
                slug: targetPost.slug,
                views: nextViews
            }
        };
    });
}

export async function updatePostService(id, rawData) {
    return runWithDataStoreLock(async () => {
        const allPosts = await readPostsWithViews();
        const index = allPosts.findIndex(post => post.id === id);

        if (index === -1) {
            return { success: false, error: '포스트를 찾을 수 없습니다.', code: 'not_found' };
        }

        const existing = allPosts[index];

        if (rawData.expectedUpdatedAt !== undefined) {
            const expectedUpdatedAt = String(rawData.expectedUpdatedAt ?? '');
            const currentUpdatedAt = String(existing.updatedAt ?? '');

            if (expectedUpdatedAt !== currentUpdatedAt) {
                return {
                    success: false,
                    error: '다른 탭 또는 세션에서 글이 먼저 수정되었습니다. 최신 글을 다시 불러온 뒤 저장해 주세요.',
                    code: 'edit_conflict'
                };
            }
        }

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
        const allPosts = await readPostsWithViews();
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
        const allPosts = await readPostsWithViews();
        const next = allPosts.filter(post => post.id !== id);

        if (next.length === allPosts.length) {
            return { success: false, error: '포스트를 찾을 수 없습니다.', code: 'not_found' };
        }

        await writePosts(next);
        await deletePostRevisions(id);
        await deletePostView(id);
        await deleteCommentsByPostIdUnlocked(id);
        return { success: true };
    });
}
