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
import { compareSearchResults, getPostSearchRank } from '../utils/searchRanking.js';

export const SEARCH_QUERY_MAX_LENGTH = 120;
export const SEARCH_RESULT_LIMIT = 25;
export const SEARCH_PAGE_SIZE_MAX = 50;

const parsePageInteger = (value, fallback) => {
    if (value === undefined) return fallback;
    if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) return null;
    const integer = Number(value);
    return Number.isSafeInteger(integer) ? integer : null;
};

export const searchPosts = async (req, res) => {
    try {
        const { q, category, tag, series } = req.query;
        if ([q, category, tag, series].some(value => value !== undefined && typeof value !== 'string')) {
            return res.status(400).json({ message: '검색 조건은 하나의 문자열로 입력해 주세요.' });
        }
        const paginated = Object.hasOwn(req.query, 'page') || Object.hasOwn(req.query, 'pageSize');
        const page = parsePageInteger(req.query.page, 1);
        const requestedPageSize = parsePageInteger(req.query.pageSize, SEARCH_RESULT_LIMIT);
        if (page === null || requestedPageSize === null) {
            return res.status(400).json({ message: '페이지와 페이지 크기는 양의 정수로 입력해 주세요.' });
        }
        const pageSize = Math.min(requestedPageSize, SEARCH_PAGE_SIZE_MAX);
        const respond = results => {
            if (!paginated) return res.json(toPostSummaries(results.slice(0, SEARCH_RESULT_LIMIT)));
            const offset = Math.min((page - 1) * pageSize, results.length);
            return res.json({
                posts: toPostSummaries(results.slice(offset, offset + pageSize)),
                total: results.length,
                page,
                pageSize,
                hasMore: offset + pageSize < results.length
            });
        };
        const normalizedQuery = normalizeSearchQuery(q);
        const tagName = String(tag ?? '').trim();
        const seriesName = String(series ?? '').trim();

        if (normalizedQuery.length > SEARCH_QUERY_MAX_LENGTH) {
            return res.status(400).json({
                message: `검색어는 ${SEARCH_QUERY_MAX_LENGTH}자 이내로 입력해 주세요.`
            });
        }

        if (!normalizedQuery && !tagName && !seriesName) return respond([]);

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
            if (tagName && (!Array.isArray(post.tags) || !post.tags.some(value => String(value).trim() === tagName))) continue;
            if (seriesName && String(post.series ?? '').trim() !== seriesName) continue;
            const searchExcerpt = query ? createSearchExcerpt(extractSearchBodyText(post), query) : undefined;
            const rank = getPostSearchRank(post, query, Boolean(searchExcerpt));

            if (!query || rank > 0) {
                results.push({ post: { ...post, ...(searchExcerpt ? { searchExcerpt } : {}) }, rank });
            }
        }

        results.sort(compareSearchResults);

        return respond(results.map(result => result.post));
    } catch (error) {
        console.error('Search error:', error);
        res.status(500).json({ message: '검색 중 오류가 발생했습니다.' });
    }
};
