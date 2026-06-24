import {
    normalizePostStatus,
    normalizeScheduledAt,
    normalizeSeo,
    normalizeTags,
    normalizeSections,
    normalizeContentHtml,
    normalizeContentJson,
    hasContentJsonContent,
    normalizePostViews
} from './normalizers/postNormalizers.js';
import { normalizeCategory } from './normalizers/categoryNormalizers.js';
import { parseHtmlToContentJson, renderContentJsonToHtml } from './contentRenderer.js';

/**
 * Normalizes and validates post data for creation or update.
 * @param {Object} body - Request body
 * @param {Object} [existing] - Existing post object (for updates)
 * @returns {{ error: string|null, data: Object|null }}
 */
export function normalizePostData(body, existing = {}) {
    // Destructure inputs, falling back to existing values if update, or undefined if create
    const {
        slug, title, summary, contentJson, contentHtml, category, status,
        scheduledAt, seo, publishedAt, tags,
        series, featured, cover, sections
    } = body;

    // 1. Basic Fields
    const normalizedSlug = slug !== undefined ? String(slug).trim() : existing.slug || '';
    const normalizedTitle = title !== undefined ? String(title).trim() : existing.title || '';

    // Validation: Slug and Title are required
    if (!normalizedSlug || !normalizedTitle) {
        return { error: '슬러그와 제목이 필요합니다.', data: null };
    }

    // 2. Content & Sections
    const normalizedSections = sections !== undefined
        ? normalizeSections(sections)
        : existing.sections || [];

    const normalizedContentHtml = contentHtml !== undefined
        ? normalizeContentHtml(contentHtml)
        : normalizeContentHtml(existing.contentHtml);

    let normalizedContentJson = contentJson !== undefined
        ? normalizeContentJson(contentJson)
        : normalizeContentJson(existing.contentJson);

    if (!hasContentJsonContent(normalizedContentJson) && normalizedContentHtml) {
        try {
            normalizedContentJson = normalizeContentJson(
                parseHtmlToContentJson(normalizedContentHtml)
            );
        } catch (error) {
            console.error('Failed to parse HTML to content JSON', error);
            return { error: '본문 JSON 변환에 실패했습니다.', data: null };
        }
    }

    let effectiveContentHtml = normalizedContentHtml;
    if (hasContentJsonContent(normalizedContentJson)) {
        try {
            effectiveContentHtml = renderContentJsonToHtml(normalizedContentJson);
        } catch (error) {
            console.error('Failed to render content JSON to HTML', error);
            return { error: '본문 HTML 생성에 실패했습니다.', data: null };
        }
    }

    // 3. Status
    const normalizedStatus = status !== undefined
        ? normalizePostStatus(status)
        : normalizePostStatus(existing.status);

    // Validation: Content required unless draft
    if (
        normalizedStatus !== 'draft'
        && normalizedSections.length === 0
        && !effectiveContentHtml
        && !hasContentJsonContent(normalizedContentJson)
    ) {
        return { error: '본문 내용이 필요합니다.', data: null };
    }

    // 4. Other Fields
    const normalizedSummary = summary !== undefined ? String(summary).trim() : existing.summary || '요약이 없습니다.';
    const normalizedCategory = category !== undefined ? normalizeCategory(category) : normalizeCategory(existing.category);
    const normalizedTags = tags !== undefined ? normalizeTags(tags) : existing.tags || [];
    const normalizedSeries = series !== undefined ? String(series).trim() : existing.series || '';
    const normalizedCover = cover !== undefined ? String(cover).trim() : existing.cover || '';
    const normalizedFeatured = featured !== undefined ? Boolean(featured) : existing.featured || false;
    const normalizedViews = normalizePostViews(existing.views);
    const normalizedSeo = seo !== undefined ? normalizeSeo(seo) : normalizeSeo(existing.seo || {});

    // 5. Scheduling & Publishing
    const normalizedScheduledAt = scheduledAt !== undefined
        ? normalizeScheduledAt(scheduledAt)
        : normalizeScheduledAt(existing.scheduledAt);

    // Validation: Scheduled date required for scheduled status
    if (normalizedStatus === 'scheduled' && !normalizedScheduledAt) {
        return { error: '예약 발행 날짜가 필요합니다.', data: null };
    }

    const inputPublishedAt = publishedAt !== undefined ? String(publishedAt) : existing.publishedAt;
    // If Creating (no existing.publishedAt) and no input, use Date.now()
    // If Updating, keep existing unless changed
    const basePublishedAt = inputPublishedAt || new Date().toISOString().slice(0, 10);

    const effectivePublishedAt = (normalizedStatus === 'scheduled' && normalizedScheduledAt)
        ? normalizedScheduledAt.slice(0, 10)
        : basePublishedAt;

    return {
        error: null,
        data: {
            slug: normalizedSlug,
            title: normalizedTitle,
            summary: normalizedSummary,
            category: normalizedCategory,
            contentJson: normalizedContentJson,
            contentHtml: effectiveContentHtml || undefined,
            status: normalizedStatus,
            scheduledAt: normalizedScheduledAt || undefined,
            publishedAt: effectivePublishedAt,
            tags: normalizedTags,
            series: normalizedSeries || undefined,
            featured: normalizedFeatured,
            views: normalizedViews,
            cover: normalizedCover || undefined,
            seo: normalizedSeo,
            sections: normalizedSections
        }
    };
}
