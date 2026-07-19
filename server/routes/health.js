import express from 'express';

const router = express.Router();

router.get('/health', (_req, res) => {
  const version = process.env.APP_VERSION?.trim();
  res.set('Cache-Control', 'no-store');
  res.json({
    status: 'ok',
    ...(version ? { version } : {})
  });
});

export const healthRouter = router;
