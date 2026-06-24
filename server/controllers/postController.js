import {
    getAllPostsService,
    createPostService,
    updatePostService,
    deletePostService,
    getPostRevisionsService,
    restorePostRevisionService,
    recordPostViewService
} from '../services/postService.js';

export const getPosts = async (req, res) => {
    try {
        const result = await getAllPostsService(Boolean(req.user));
        res.json({ posts: result.data, total: result.data.length });
    } catch (error) {
        console.error('Failed to fetch posts', error);
        res.status(500).json({ message: '포스트를 불러오지 못했습니다.' });
    }
};

export const createPost = async (req, res) => {
    try {
        const result = await createPostService(req.body);

        if (!result.success) {
            const status = result.code === 'validation_error' ? 400
                : result.code === 'duplicate_slug' ? 409
                    : 500;
            return res.status(status).json({ message: result.error });
        }

        res.status(201).json(result.data);
    } catch (error) {
        console.error('Failed to create post', error);
        res.status(500).json({ message: '포스트 생성에 실패했습니다.' });
    }
};

export const recordPostView = async (req, res) => {
    try {
        const { slug } = req.params;
        const result = await recordPostViewService(slug);

        if (!result.success) {
            return res.status(404).json({ message: result.error });
        }

        res.json(result.data);
    } catch (error) {
        console.error('Failed to record post view', error);
        res.status(500).json({ message: '조회수를 기록하지 못했습니다.' });
    }
};

export const updatePost = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await updatePostService(id, req.body);

        if (!result.success) {
            const status = result.code === 'not_found' ? 404
                : result.code === 'validation_error' ? 400
                    : result.code === 'duplicate_slug' || result.code === 'edit_conflict' ? 409
                        : 500;
            return res.status(status).json({ message: result.error });
        }

        res.json(result.data);
    } catch (error) {
        console.error('Failed to update post', error);
        res.status(500).json({ message: '포스트 수정에 실패했습니다.' });
    }
};

export const getPostRevisions = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await getPostRevisionsService(id);

        if (!result.success) {
            return res.status(404).json({ message: result.error });
        }

        res.json(result.data);
    } catch (error) {
        console.error('Failed to fetch post revisions', error);
        res.status(500).json({ message: '리비전을 불러오지 못했습니다.' });
    }
};

export const restorePostRevision = async (req, res) => {
    try {
        const { id, revisionId } = req.params;
        const result = await restorePostRevisionService(id, revisionId);

        if (!result.success) {
            const status = result.code === 'not_found' ? 404
                : result.code === 'validation_error' ? 400
                    : result.code === 'duplicate_slug' ? 409
                        : 500;
            return res.status(status).json({ message: result.error });
        }

        res.json(result.data);
    } catch (error) {
        console.error('Failed to restore post revision', error);
        res.status(500).json({ message: '리비전 복구에 실패했습니다.' });
    }
};

export const deletePost = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await deletePostService(id);

        if (!result.success) {
            return res.status(404).json({ message: result.error });
        }

        res.status(204).send();
    } catch (error) {
        console.error('Failed to delete post', error);
        res.status(500).json({ message: '포스트 삭제에 실패했습니다.' });
    }
};
