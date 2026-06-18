import {
    deleteUnusedUploads,
    processImageUpload,
    scanUnusedUploads
} from '../services/uploadService.js';

export const uploadImage = async (req, res) => {
    try {
        const { dataUrl } = req.body ?? {};

        const result = await processImageUpload(dataUrl);

        if (!result.success) {
            const status = result.code === 'too_large' ? 413 : 400;
            return res.status(status).json({ message: result.error });
        }

        res.status(201).json(result.data);
    } catch (error) {
        console.error('Failed to upload image', error);
        res.status(500).json({ message: '이미지 업로드에 실패했습니다.' });
    }
};

export const getUnusedUploads = async (_req, res) => {
    try {
        res.json(await scanUnusedUploads());
    } catch (error) {
        console.error('Failed to scan unused uploads', error);
        res.status(500).json({ message: '미사용 이미지를 확인하지 못했습니다.' });
    }
};

export const deleteUnusedUploadFiles = async (req, res) => {
    try {
        const { filenames } = req.body ?? {};
        res.json(await deleteUnusedUploads(filenames));
    } catch (error) {
        console.error('Failed to delete unused uploads', error);
        res.status(500).json({ message: '미사용 이미지를 삭제하지 못했습니다.' });
    }
};
