import { getAllPostsService } from '../services/postService.js';
import { readCategories } from '../models/categoryModel.js';
import { normalizeCategoryKey } from '../utils/normalizers/categoryNormalizers.js';
import { toPostSummaries } from '../utils/postSummaries.js';
import {
    createSearchExcerpt,
    extractSearchBodyText,
    getSearchCategoryKeys,
    normalizeSearchQuery
} from '../utils/postSearch.js';

export const SEARCH_QUERY_MAX_LENGTH = 120;
export const SEARCH_RESULT_LIMIT = 25;

const includesQuery = (value, query) => (
    normalizeSearchQuery(value).toLowerCase().includes(query)
);

export const searchPosts = async (req, res) => {
    try {
        const { q, category } = req.query;
        const normalizedQuery = normalizeSearchQuery(q);

        if (!normalizedQuery) {
            return res.json([]);
        }

        if (normalizedQuery.length > SEARCH_QUERY_MAX_LENGTH) {
            return res.status(400).json({
                message: `검색어는 ${SEARCH_QUERY_MAX_LENGTH}자 이내로 입력해 주세요.`
            });
        }

        const query = normalizedQuery.toLowerCase();
        const categoryName = String(category ?? '').trim();
        const selectedCategoryKeys = categoryName
            ? getSearchCategoryKeys(await readCategories(), categoryName)
            : null;
        const { data: publicPosts } = await getAllPostsService(false, false);

        const results = [];
        for (const post of publicPosts) {
            if (selectedCategoryKeys && !selectedCategoryKeys.has(normalizeCategoryKey(post.category))) {
                continue;
            }
            const inTitle = includesQuery(post.title, query);
            const inSummary = includesQuery(post.summary, query);
            const inSlug = includesQuery(post.slug, query);
            const inCategory = includesQuery(post.category, query);
            const inTags = Array.isArray(post.tags) && post.tags.some(tag => includesQuery(tag, query));
            const inSeries = includesQuery(post.series, query);
            const bodyText = extractSearchBodyText(post);
            const searchExcerpt = createSearchExcerpt(bodyText, query);

            if (inTitle || inSummary || inSlug || inCategory || inTags || inSeries || searchExcerpt) {
                results.push({ ...post, ...(searchExcerpt ? { searchExcerpt } : {}) });
            }
        }

        results.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

        res.json(toPostSummaries(results.slice(0, SEARCH_RESULT_LIMIT)));
    } catch (error) {
        console.error('Search error:', error);
        res.status(500).json({ message: '검색 중 오류가 발생했습니다.' });
    }
};
