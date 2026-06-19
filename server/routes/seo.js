import express from 'express';
import { getRobots, getRss, getSitemap } from '../controllers/seoController.js';

const router = express.Router();

router.get('/robots.txt', getRobots);
router.get('/rss.xml', getRss);
router.get('/sitemap.xml', getSitemap);

export const seoRouter = router;
