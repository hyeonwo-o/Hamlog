import { normalizeSearchQuery } from './postSearch.js';

const normalize = (value) => normalizeSearchQuery(value).toLowerCase();

// Prefer the strongest matching field, not the number of repeated keywords.
export function getPostSearchRank(post, query, hasBodyMatch = false) {
    if (!query) return 0;
    const title = normalize(post.title);
    if (title === query) return 6;
    if (title.startsWith(query)) return 5;
    if (title.includes(query)) return 4;

    const metadata = [post.summary, post.slug, post.category, post.series,
        ...(Array.isArray(post.tags) ? post.tags : [])].map(normalize);
    if (metadata.some(value => value === query)) return 3;
    if (metadata.some(value => value.includes(query))) return 2;
    return hasBodyMatch ? 1 : 0;
}

const publishedTimestamp = (post) => {
    const timestamp = Date.parse(post.publishedAt);
    return Number.isFinite(timestamp) ? timestamp : -Infinity;
};

export function compareSearchResults(left, right) {
    if (left.rank !== right.rank) return right.rank - left.rank;
    const leftTime = publishedTimestamp(left.post);
    const rightTime = publishedTimestamp(right.post);
    if (leftTime !== rightTime) return rightTime > leftTime ? 1 : -1;
    const leftId = String(left.post.id ?? '');
    const rightId = String(right.post.id ?? '');
    return leftId < rightId ? -1 : leftId > rightId ? 1 : 0;
}
