import { listModeratedComments, moderateComment } from '../services/commentModerationService.js';

const respondError = (res, result) => res.status({ not_found: 404, precondition_required: 428, edit_conflict: 409, validation_error: 400 }[result.code] ?? 500)
    .json({ message: result.error });

export const listCommentsForModeration = async (req, res) => {
    try {
        const result = await listModeratedComments(req.query);
        if (!result.success) return respondError(res, result);
        return res.set('Cache-Control', 'no-store').json(result.data);
    } catch (error) {
        console.error('Failed to list comments for moderation', error);
        return res.status(500).json({ message: '댓글 목록을 불러오지 못했습니다.' });
    }
};

const mutation = permanent => async (req, res) => {
    try {
        const result = await moderateComment(req.params.id, req.body, permanent);
        if (!result.success) return respondError(res, result);
        if (permanent) return res.status(204).send();
        return res.set('Cache-Control', 'no-store').json({ comment: result.data });
    } catch (error) {
        console.error('Comment moderation failed', error);
        return res.status(500).json({ message: '댓글 관리 작업에 실패했습니다. 목록을 새로고침해 확인해 주세요.' });
    }
};

export const setCommentHidden = mutation(false);
export const deleteCommentAsAdmin = mutation(true);
