import { renderPublicImage } from '../services/publicImageService.js';

export const getPublicImage = async (req, res) => {
  try {
    const result = await renderPublicImage({
      filename: req.params.filename,
      width: req.query.width,
      height: req.query.height
    });

    if (!result.success) {
      return res
        .status(result.status)
        .set('Cache-Control', 'no-store')
        .json({ message: result.error });
    }

    const cacheControl = req.params.filename === 'avatar.jpg'
      ? 'public, max-age=3600, must-revalidate'
      : 'public, max-age=31536000, immutable';

    return res
      .set('Content-Type', 'image/webp')
      .set('Cache-Control', cacheControl)
      .set('X-Image-Width', String(result.width))
      .set('X-Image-Height', String(result.height))
      .send(result.data);
  } catch (error) {
    console.error('Failed to render public image', error);
    return res
      .status(500)
      .set('Cache-Control', 'no-store')
      .json({ message: '이미지를 처리하지 못했습니다.' });
  }
};
