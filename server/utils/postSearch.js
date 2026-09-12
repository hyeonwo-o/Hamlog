import * as cheerio from 'cheerio';
import { sanitizePostContentHtml } from './seoContent.js';
import { findCategoryByIdentifier } from '../services/category/categoryHelpers.js';
import { normalizeCategoryKey } from './normalizers/categoryNormalizers.js';

export const SEARCH_EXCERPT_MAX_LENGTH = 180;

export const normalizeSearchQuery = (value) => (
    Array.from(String(value ?? ''))
        .filter(character => {
            const code = character.codePointAt(0) ?? 0;
            return code >= 0x20 && code !== 0x7F;
        })
        .join('')
        .replace(/\s+/g, ' ')
        .trim()
);

// Extract rendered copy, not class names, URLs, or executable source. Keep
// paragraph boundaries, while allowing words split by inline marks to match.
export const extractSearchBodyText = (post) => {
    const safeHtml = sanitizePostContentHtml(post.contentHtml, { postTitle: post.title });
    const $ = cheerio.load(safeHtml, {}, false);
    $('br, hr').replaceWith(' ');
    $('p, div, section, article, h1, h2, h3, h4, h5, h6, li, blockquote, pre, figcaption, tr, th, td')
        .append(' ');
    return normalizeSearchQuery($.root().text().replace(/\s+/g, ' '));
};

export const createSearchExcerpt = (text, query) => {
    const searchableText = text.toLowerCase();
    let matchIndex = searchableText.indexOf(query);
    if (matchIndex < 0) return undefined;

    // Some letters expand when lowercased (for example İ). Convert the match
    // offset back to the original copy before selecting surrounding text.
    if (searchableText.length !== text.length) {
        let sourceOffset = 0;
        let searchOffset = 0;
        for (const character of text) {
            const searchLength = character.toLowerCase().length;
            if (searchOffset + searchLength > matchIndex) break;
            searchOffset += searchLength;
            sourceOffset += character.length;
        }
        matchIndex = sourceOffset;
    }

    const contextBefore = Math.min(45, SEARCH_EXCERPT_MAX_LENGTH - query.length - 2);
    let start = Math.max(0, matchIndex - Math.max(0, contextBefore));
    // Avoid cutting a surrogate pair at either edge of the excerpt.
    if (start > 0 && /[\uDC00-\uDFFF]/u.test(text[start])) start -= 1;
    let end = Math.min(text.length, start + SEARCH_EXCERPT_MAX_LENGTH - 2);
    if (end < text.length && /[\uDC00-\uDFFF]/u.test(text[end])) end -= 1;
    return `${start > 0 ? '…' : ''}${text.slice(start, end).trim()}${end < text.length ? '…' : ''}`;
};

export const getSearchCategoryKeys = (categories, identifier) => {
    const selected = findCategoryByIdentifier(categories, identifier);
    const keys = new Set([normalizeCategoryKey(selected?.name ?? identifier)]);
    if (!selected) return keys;

    const childrenByParent = new Map();
    for (const category of categories) {
        const siblings = childrenByParent.get(category.parentId) ?? [];
        siblings.push(category);
        childrenByParent.set(category.parentId, siblings);
    }
    const pending = [selected];
    const visited = new Set();
    while (pending.length > 0) {
        const category = pending.pop();
        if (visited.has(category.id)) continue;
        visited.add(category.id);
        keys.add(normalizeCategoryKey(category.name));
        pending.push(...(childrenByParent.get(category.id) ?? []));
    }
    return keys;
};
