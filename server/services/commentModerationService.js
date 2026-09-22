import { readComments, writeComments } from '../models/commentModel.js';
import { readPosts } from '../models/postModel.js';
import { isPostPublicVisible, isPostTrashed } from '../utils/postVisibility.js';
import { normalizePostStatus } from '../utils/normalizers/postNormalizers.js';
import { runWithDataStoreLock } from '../utils/storeLock.js';
import { nextPostTimestamp } from '../utils/postVersion.js';

const versionOf = comment => String(comment.updatedAt ?? comment.createdAt ?? '');
const isHidden = comment => Object.hasOwn(comment, 'hiddenAt');
const toAdminComment = (comment, post) => ({
    id: comment.id, postId: comment.postId, author: comment.author,
    content: comment.content, createdAt: comment.createdAt,
    moderation: { hidden: isHidden(comment), version: versionOf(comment), updatedAt: comment.updatedAt },
    post: {
        id: comment.postId, title: post?.title ?? '삭제되었거나 없는 글',
        status: !post ? 'missing' : isPostTrashed(post) ? 'trashed' : normalizePostStatus(post.status),
        publicVisible: Boolean(post && isPostPublicVisible(post))
    }
});

const parsePage = (value, fallback) => {
    if (value === undefined) return fallback;
    if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) return null;
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) ? parsed : null;
};

export async function listModeratedComments(query = {}) {
    const page = parsePage(query.page, 1);
    const requestedSize = parsePage(query.pageSize, 20);
    const visibility = query.visibility ?? 'all';
    if (!page || !requestedSize || !['all', 'visible', 'hidden'].includes(visibility)) {
        return { success: false, code: 'validation_error', error: '댓글 목록 조건이 올바르지 않습니다.' };
    }
    const pageSize = Math.min(requestedSize, 50);
    const [comments, posts] = await Promise.all([readComments(), readPosts()]);
    const postsById = new Map(posts.map(post => [post.id, post]));
    const filtered = comments.filter(comment => visibility === 'all' || (visibility === 'hidden') === isHidden(comment))
        .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)) || String(a.id).localeCompare(String(b.id)));
    const offset = (page - 1) * pageSize;
    return { success: true, data: {
        comments: filtered.slice(offset, offset + pageSize).map(comment => toAdminComment(comment, postsById.get(comment.postId))),
        total: filtered.length, page, pageSize, hasMore: offset + pageSize < filtered.length
    } };
}

export async function moderateComment(id, rawData = {}, permanent = false) {
    return runWithDataStoreLock(async () => {
        const comments = await readComments();
        const index = comments.findIndex(comment => comment.id === id);
        if (index < 0) return { success: false, code: 'not_found', error: '댓글을 찾을 수 없습니다. 목록을 새로고침해 주세요.' };
        const comment = comments[index];
        if (typeof rawData?.expectedVersion !== 'string') {
            return { success: false, code: 'precondition_required', error: '댓글의 최신 상태를 확인한 뒤 다시 시도해 주세요.' };
        }
        if (rawData.expectedVersion !== versionOf(comment)) {
            return { success: false, code: 'edit_conflict', error: '다른 탭에서 댓글 상태가 변경되었습니다. 목록을 새로고침해 주세요.' };
        }
        if (permanent) {
            await writeComments(comments.filter(item => item.id !== id));
            return { success: true };
        }
        if (typeof rawData.hidden !== 'boolean') {
            return { success: false, code: 'validation_error', error: '댓글 숨김 상태가 올바르지 않습니다.' };
        }
        const updated = { ...comment, updatedAt: nextPostTimestamp({ updatedAt: versionOf(comment) }) };
        if (rawData.hidden) updated.hiddenAt = updated.updatedAt;
        else delete updated.hiddenAt;
        const post = (await readPosts()).find(post => post.id === comment.postId);
        comments[index] = updated;
        await writeComments(comments);
        return { success: true, data: toAdminComment(updated, post) };
    });
}
