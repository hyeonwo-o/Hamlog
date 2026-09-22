import { randomUUID } from 'crypto';
import { readPosts, writePosts } from '../models/postModel.js';
import {
    createPostRevision,
    readPostRevisions
} from '../models/revisionModel.js';
import { createCategoryUnlocked } from './categoryService.js';
import { normalizePostData } from '../utils/postHelpers.js';
import { filterPublicPosts, findPublicPostBySlug, isPostPublicVisible, isPostTrashed, isPostDeletionPending } from '../utils/postVisibility.js';
import { aliasesAfterSlugChange, postOwnsSlug, withoutPostAliases } from '../utils/postSlugAliases.js';
import { normalizePostViews } from '../utils/normalizers/postNormalizers.js';
import { runWithDataStoreLock } from '../utils/storeLock.js';
import {
    applyPostViews,
    incrementPostView,
    readPostViews
} from '../models/postViewModel.js';
import { toPostSummaries } from '../utils/postSummaries.js';
import { nextPostTimestamp } from '../utils/postVersion.js';
import { beginPostDeletion } from '../models/postDeletionModel.js';
import { completePostDeletionUnlocked } from './postDeletionService.js';

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
    const visiblePosts = includeAll ? posts.filter(post => !isPostTrashed(post)) : filterPublicPosts(posts);
    return {
        success: true,
        data: summaryOnly ? toPostSummaries(visiblePosts) : includeAll ? visiblePosts : visiblePosts.map(withoutPostAliases)
    };
}

export async function getPostBySlugService(slug) {
    const posts = await readPostsWithViews();
    const post = findPublicPostBySlug(posts, String(slug ?? '').trim());

    if (!post || !isPostPublicVisible(post)) {
        return { success: false, error: '포스트를 찾을 수 없습니다.', code: 'not_found' };
    }

    return { success: true, data: withoutPostAliases(post) };
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
        if (allPosts.some(post => postOwnsSlug(post, data.slug))) {
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

export async function getPostRevisionService(id, revisionId) {
    const allPosts = await readPosts();
    if (!allPosts.some(post => post.id === id)) {
        return { success: false, error: '포스트를 찾을 수 없습니다.', code: 'not_found' };
    }
    const revisions = await readPostRevisions(id);
    const revision = revisions.find(item => item.id === revisionId && item.snapshot);
    if (!revision) {
        return { success: false, error: '리비전을 찾을 수 없습니다.', code: 'not_found' };
    }
    return { success: true, data: { ...toRevisionSummary(revision), snapshot: revision.snapshot } };
}

export async function recordPostViewService(slug) {
    return runWithDataStoreLock(async () => {
        const normalizedSlug = String(slug ?? '').trim();
        if (!normalizedSlug) {
            return { success: false, error: '포스트를 찾을 수 없습니다.', code: 'not_found' };
        }

        const allPosts = await readPosts();
        const index = allPosts.findIndex(post => postOwnsSlug(post, normalizedSlug));

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

        if (isPostTrashed(existing)) {
            return { success: false, error: '휴지통의 글은 먼저 복원해 주세요.', code: 'edit_conflict' };
        }

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
            if (allPosts.some(post => post.id !== id && postOwnsSlug(post, data.slug))) {
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
            ...data,
            previousSlugs: aliasesAfterSlugChange(existing, data.slug)
        };
        updatedPost.updatedAt = nextPostTimestamp(existing);

        allPosts[index] = updatedPost;
        await writePosts(allPosts);
        if (needsBaselineRevision) {
            await createPostRevision(existing, 'baseline');
        }
        await createPostRevision(updatedPost, 'updated');

        return { success: true, data: updatedPost };
    });
}

export async function restorePostRevisionService(id, revisionId, rawData = {}) {
    return runWithDataStoreLock(async () => {
        const allPosts = await readPostsWithViews();
        const index = allPosts.findIndex(post => post.id === id);

        if (index === -1) {
            return { success: false, error: '포스트를 찾을 수 없습니다.', code: 'not_found' };
        }

        const existing = allPosts[index];
        if (isPostTrashed(existing)) {
            return { success: false, error: '휴지통의 글은 먼저 복원해 주세요.', code: 'edit_conflict' };
        }
        if (typeof rawData?.expectedUpdatedAt !== 'string') {
            return { success: false, error: '현재 저장본의 버전을 확인한 뒤 복구해 주세요.', code: 'precondition_required' };
        }
        if (rawData.expectedUpdatedAt !== String(existing.updatedAt ?? '')) {
            return { success: false, error: '다른 탭 또는 세션에서 글이 먼저 수정되었습니다. 최신 글을 다시 불러온 뒤 복구해 주세요.', code: 'edit_conflict' };
        }
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
            if (allPosts.some(post => post.id !== id && postOwnsSlug(post, data.slug))) {
                return { success: false, error: '슬러그가 이미 존재합니다.', code: 'duplicate_slug' };
            }
        }

        await createCategoryUnlocked(data.category);

        const shouldCreateBaselineRevision = revisions.length === 0
            || !arePostsEquivalent(revisions[0]?.snapshot, existing);

        const restoredPost = {
            ...existing,
            ...data,
            id: existing.id,
            // Keep all current reservations, never replace them with the older
            // revision's alias list or client-controlled metadata.
            previousSlugs: aliasesAfterSlugChange(existing, data.slug)
        };
        restoredPost.updatedAt = nextPostTimestamp(existing);

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
        const existing = allPosts.find(post => post.id === id);
        if (!existing) {
            return { success: false, error: '포스트를 찾을 수 없습니다.', code: 'not_found' };
        }
        if (isPostTrashed(existing)) return { success: true };
        const deletedAt = nextPostTimestamp(existing);
        // Keep it private even if an older server that does not know deletedAt is rolled back into service.
        await writePosts(allPosts.map(post => post.id === id ? { ...post, status: 'draft', deletedAt, updatedAt: deletedAt } : post));
        return { success: true };
    });
}

export async function getTrashedPostsService() {
    const posts = await readPostsWithViews();
    return { success: true, data: toPostSummaries(posts.filter(isPostTrashed)
        .sort((left, right) => Date.parse(right.deletedAt) - Date.parse(left.deletedAt))) };
}

const checkTrashVersion = (post, rawData) => {
    if (!post || !isPostTrashed(post)) {
        return { success: false, error: '휴지통에서 글을 찾을 수 없습니다.', code: 'not_found' };
    }
    if (typeof rawData?.expectedDeletedAt !== 'string') {
        return { success: false, error: '휴지통의 최신 상태를 확인해 주세요.', code: 'precondition_required' };
    }
    if (rawData.expectedDeletedAt !== post.deletedAt) {
        return { success: false, error: '휴지통 상태가 변경되었습니다. 목록을 새로고침해 주세요.', code: 'edit_conflict' };
    }
    return null;
};

export async function restoreTrashedPostService(id, rawData = {}) {
    return runWithDataStoreLock(async () => {
        const posts = await readPostsWithViews();
        const existing = posts.find(post => post.id === id);
        const error = checkTrashVersion(existing, rawData);
        if (error) return error;
        if (isPostDeletionPending(existing)) {
            return { success: false, error: '영구삭제가 시작된 글은 복원할 수 없습니다. 영구삭제를 다시 시도해 주세요.', code: 'edit_conflict' };
        }
        // Never unexpectedly publish an old published/scheduled post on restore.
        const restored = { ...existing, status: 'draft', updatedAt: nextPostTimestamp(existing) };
        delete restored.deletedAt;
        delete restored.scheduledAt;
        await writePosts(posts.map(post => post.id === id ? restored : post));
        return { success: true, data: restored };
    });
}

export async function permanentlyDeletePostService(id, rawData = {}) {
    return runWithDataStoreLock(async () => {
        const posts = await readPostsWithViews();
        const existing = posts.find(post => post.id === id);
        const error = checkTrashVersion(existing, rawData);
        if (error) return error;
        if (rawData.confirmTitle !== existing.title) {
            return { success: false, error: '영구삭제하려면 글 제목을 정확히 입력해 주세요.', code: 'validation_error' };
        }

        const pending = await beginPostDeletion(existing);
        await writePosts(posts.map(post => post.id === id ? pending : post));
        await completePostDeletionUnlocked(id);
        return { success: true };
    });
}
