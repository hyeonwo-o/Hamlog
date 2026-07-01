import {
    getCommentsByPostId,
    createComment as createCommentModel,
    deleteComment as deleteCommentModel
} from '../models/commentModel.js';
import { readPosts } from '../models/postModel.js';
import { isPostPublicVisible } from '../utils/postVisibility.js';

export const COMMENT_LIMITS = {
    postId: 160,
    author: 80,
    password: 72,
    content: 2000
};

const isUnsafeControlCharacter = (character, { preserveLineBreaks = false } = {}) => {
    const code = character.codePointAt(0) ?? 0;
    if (code === 0x7F) return true;
    if (code >= 0x20) return false;
    if (preserveLineBreaks && (code === 0x09 || code === 0x0A || code === 0x0D)) return false;
    return true;
};

const stripUnsafeControls = (value, options) => (
    Array.from(value)
        .filter(character => !isUnsafeControlCharacter(character, options))
        .join('')
);

const normalizeInlineText = (value) => (
    stripUnsafeControls(String(value ?? '').replace(/\s+/g, ' '))
        .trim()
);

const normalizeCommentContent = (value) => (
    stripUnsafeControls(String(value ?? ''), { preserveLineBreaks: true })
        .replace(/\r\n?/g, '\n')
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim()
);

const normalizePassword = (value) => (
    stripUnsafeControls(String(value ?? ''))
        .trim()
);

const exceedsLimit = (value, limit) => value.length > limit;

const validateLength = (value, limit, label) => {
    if (exceedsLimit(value, limit)) {
        return `${label}은(는) ${limit}자 이내로 입력해 주세요.`;
    }
    return '';
};

const validateVisiblePost = async (postId) => {
    const posts = await readPosts();
    return posts.some(post => post.id === postId && isPostPublicVisible(post));
};

export async function getCommentsService(postId) {
    const normalizedPostId = normalizeInlineText(postId);
    if (!normalizedPostId) {
        return { success: false, error: '포스트 ID가 필요합니다.', code: 'validation_error' };
    }

    const postIdError = validateLength(normalizedPostId, COMMENT_LIMITS.postId, '포스트 ID');
    if (postIdError) {
        return { success: false, error: postIdError, code: 'validation_error' };
    }

    if (!(await validateVisiblePost(normalizedPostId))) {
        return { success: false, error: '댓글을 볼 수 있는 공개 글을 찾을 수 없습니다.', code: 'not_found' };
    }

    const comments = await getCommentsByPostId(normalizedPostId);

    // Exclude password from response
    // eslint-disable-next-line no-unused-vars
    const safeComments = comments.map(({ password, ...rest }) => rest);

    return { success: true, data: safeComments };
}

export async function createCommentService({ postId, author, password, content }) {
    const normalizedPostId = normalizeInlineText(postId);
    const normalizedAuthor = normalizeInlineText(author);
    const normalizedPassword = normalizePassword(password);
    const normalizedContent = normalizeCommentContent(content);

    if (!normalizedPostId || !normalizedAuthor || !normalizedPassword || !normalizedContent) {
        return { success: false, error: '이름, 비밀번호, 댓글 내용을 모두 입력해 주세요.', code: 'validation_error' };
    }

    const lengthError = [
        validateLength(normalizedPostId, COMMENT_LIMITS.postId, '포스트 ID'),
        validateLength(normalizedAuthor, COMMENT_LIMITS.author, '이름'),
        validateLength(normalizedPassword, COMMENT_LIMITS.password, '비밀번호'),
        validateLength(normalizedContent, COMMENT_LIMITS.content, '댓글')
    ].find(Boolean);

    if (lengthError) {
        return { success: false, error: lengthError, code: 'validation_error' };
    }

    if (!(await validateVisiblePost(normalizedPostId))) {
        return { success: false, error: '댓글을 남길 수 있는 공개 글을 찾을 수 없습니다.', code: 'not_found' };
    }

    const newComment = await createCommentModel({
        postId: normalizedPostId,
        author: normalizedAuthor,
        password: normalizedPassword,
        content: normalizedContent
    });

    // eslint-disable-next-line no-unused-vars
    const { password: _, ...safeComment } = newComment;

    return { success: true, data: safeComment };
}

export async function deleteCommentService(id, password) {
    const normalizedPassword = normalizePassword(password);
    if (!normalizedPassword) {
        return { success: false, error: '비밀번호를 입력해 주세요.', code: 'validation_error' };
    }

    const passwordError = validateLength(normalizedPassword, COMMENT_LIMITS.password, '비밀번호');
    if (passwordError) {
        return { success: false, error: passwordError, code: 'validation_error' };
    }

    const result = await deleteCommentModel(id, normalizedPassword);

    if (!result.success) {
        if (result.reason === 'not_found') {
            return { success: false, error: '댓글을 찾을 수 없습니다.', code: 'not_found' };
        }
        if (result.reason === 'wrong_password') {
            return { success: false, error: '비밀번호가 일치하지 않습니다.', code: 'forbidden' };
        }
        return { success: false, error: '댓글을 삭제하지 못했습니다.', code: 'internal_error' };
    }

    return { success: true };
}
