import { getAllPostsService } from '../services/postService.js';

export const SEARCH_QUERY_MAX_LENGTH = 120;
export const SEARCH_RESULT_LIMIT = 25;

const isUnsafeControlCharacter = (character) => {
    const code = character.codePointAt(0) ?? 0;
    return code < 0x20 || code === 0x7F;
};

const normalizeSearchQuery = (value) => (
    Array.from(String(value ?? ''))
        .filter(character => !isUnsafeControlCharacter(character))
        .join('')
        .replace(/\s+/g, ' ')
        .trim()
);

const includesQuery = (value, query) => (
    String(value ?? '').toLowerCase().includes(query)
);

export const searchPosts = async (req, res) => {
    try {
        const { q } = req.query;
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
        const { data: publicPosts } = await getAllPostsService(false, false);

        const results = publicPosts.filter(post => {
            const inTitle = includesQuery(post.title, query);
            const inSummary = includesQuery(post.summary, query);
            const inSlug = includesQuery(post.slug, query);
            const inCategory = includesQuery(post.category, query);
            const inTags = Array.isArray(post.tags) && post.tags.some(tag => includesQuery(tag, query));
            const inContent = includesQuery(post.contentHtml, query);

            return inTitle || inSummary || inSlug || inCategory || inTags || inContent;
        });

        results.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

        res.json(results.slice(0, SEARCH_RESULT_LIMIT));
    } catch (error) {
        console.error('Search error:', error);
        res.status(500).json({ message: '검색 중 오류가 발생했습니다.' });
    }
};
