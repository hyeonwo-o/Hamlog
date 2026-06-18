import axios from 'axios';
import * as cheerio from 'cheerio';
import { createSafeLookup } from '../utils/urlSafety.js';

const safeLookup = createSafeLookup();

export const fetchOpenGraphData = async (url) => {
    try {
        const { data } = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; HamLogBot/1.0; +http://localhost:3000)',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8'
            },
            timeout: 5000,
            maxRedirects: 0,
            maxContentLength: 1024 * 1024,
            maxBodyLength: 1024 * 1024,
            responseType: 'text',
            lookup: safeLookup
        });

        const $ = cheerio.load(data);

        const ogTitle = $('meta[property="og:title"]').attr('content');
        const twitterTitle = $('meta[name="twitter:title"]').attr('content');
        const title = ogTitle || twitterTitle || $('title').text() || '';

        const ogDescription = $('meta[property="og:description"]').attr('content');
        const twitterDescription = $('meta[name="twitter:description"]').attr('content');
        const description = ogDescription || twitterDescription || $('meta[name="description"]').attr('content') || '';

        const ogImage = $('meta[property="og:image"]').attr('content');
        const twitterImage = $('meta[name="twitter:image"]').attr('content');
        const image = ogImage || twitterImage || '';

        const domain = new URL(url).hostname;

        return {
            url,
            title: title.trim(),
            description: description.trim(),
            image: image,
            domain
        };
    } catch (error) {
        console.error('Error fetching OG data:', error.message);
        // Fallback if fetching fails
        return {
            url,
            title: url,
            description: '',
            image: '',
            domain: new URL(url).hostname
        };
    }
};
