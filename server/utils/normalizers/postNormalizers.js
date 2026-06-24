export const allowedPostStatuses = new Set(['draft', 'scheduled', 'published']);

export const allowedSectionTypes = new Set([
    'heading',
    'paragraph',
    'list',
    'code',
    'quote',
    'callout',
    'image'
]);

export function normalizeTags(tags) {
    if (!Array.isArray(tags)) return [];
    return tags.map(tag => String(tag).trim()).filter(Boolean);
}

export function normalizePostStatus(status) {
    const normalized = status ? String(status).toLowerCase().trim() : '';
    if (allowedPostStatuses.has(normalized)) return normalized;
    return 'published';
}

export function normalizePostViews(value) {
    const parsed = Number.parseInt(String(value ?? ''), 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

export function normalizeScheduledAt(value) {
    if (!value) return '';
    const timestamp = new Date(String(value)).getTime();
    if (Number.isNaN(timestamp)) return '';
    return new Date(timestamp).toISOString();
}

export function normalizeSeo(seo) {
    if (!seo || typeof seo !== 'object') return undefined;
    const result = {};

    if (seo.title !== undefined) {
        const title = String(seo.title).trim();
        if (title) result.title = title;
    }
    if (seo.description !== undefined) {
        const description = String(seo.description).trim();
        if (description) result.description = description;
    }
    if (seo.ogImage !== undefined) {
        const ogImage = String(seo.ogImage).trim();
        if (ogImage) result.ogImage = ogImage;
    }
    if (seo.canonicalUrl !== undefined) {
        const canonicalUrl = String(seo.canonicalUrl).trim();
        if (canonicalUrl) result.canonicalUrl = canonicalUrl;
    }
    if (seo.keywords !== undefined) {
        const keywords = Array.isArray(seo.keywords)
            ? seo.keywords
            : String(seo.keywords).split(',');
        const normalized = keywords
            .map(item => String(item).trim())
            .filter(Boolean);
        if (normalized.length > 0) {
            result.keywords = normalized;
        }
    }

    return Object.keys(result).length > 0 ? result : undefined;
}

export function normalizeContentHtml(contentHtml) {
    if (!contentHtml) return '';
    return String(contentHtml).trim();
}

export function normalizeContentJson(contentJson) {
    if (!contentJson || typeof contentJson !== 'object' || Array.isArray(contentJson)) {
        return undefined;
    }

    try {
        const normalized = JSON.parse(JSON.stringify(contentJson));
        return Object.keys(normalized).length > 0 ? normalized : undefined;
    } catch {
        return undefined;
    }
}

function hasMeaningfulContentNode(node) {
    if (!node || typeof node !== 'object') return false;

    if (node.type === 'text') {
        return typeof node.text === 'string' && node.text.trim().length > 0;
    }

    if (node.type === 'hardBreak' || node.type === 'horizontalRule') {
        return true;
    }

    if (node.type === 'image') {
        return typeof node.attrs?.src === 'string' && node.attrs.src.trim().length > 0;
    }

    if (node.type === 'linkCard') {
        return typeof node.attrs?.url === 'string' && node.attrs.url.trim().length > 0;
    }

    if (node.type === 'youtube') {
        return typeof node.attrs?.src === 'string' && node.attrs.src.trim().length > 0;
    }

    if (node.type === 'math') {
        return typeof node.attrs?.latex === 'string' && node.attrs.latex.trim().length > 0;
    }

    if (node.type === 'table' || node.type === 'imageGallery' || node.type === 'columns') {
        return true;
    }

    if (Array.isArray(node.content)) {
        return node.content.some(child => hasMeaningfulContentNode(child));
    }

    return false;
}

export function hasContentJsonContent(contentJson) {
    return Boolean(
        contentJson
        && typeof contentJson === 'object'
        && hasMeaningfulContentNode(contentJson)
    );
}

export function normalizeSections(sections) {
    if (!Array.isArray(sections)) return [];

    return sections
        .map((section) => {
            if (!section || typeof section !== 'object') return null;
            const type = String(section.type);
            if (!allowedSectionTypes.has(type)) return null;

            if (type === 'list') {
                const items = Array.isArray(section.content) ? section.content : [];
                const cleaned = items.map(item => String(item).trim()).filter(Boolean);
                return cleaned.length ? { type, content: cleaned } : null;
            }

            if (type === 'code') {
                const content = section.content ? String(section.content) : '';
                if (!content.trim()) return null;
                const language = section.language ? String(section.language).trim() : '';
                return {
                    type,
                    content,
                    language: language || undefined
                };
            }

            if (type === 'image') {
                const content = section.content ? String(section.content).trim() : '';
                if (!content) return null;
                const alt = section.alt ? String(section.alt).trim() : '';
                const caption = section.caption ? String(section.caption).trim() : '';
                return {
                    type,
                    content,
                    alt: alt || undefined,
                    caption: caption || undefined
                };
            }

            const content = section.content ? String(section.content).trim() : '';
            if (!content) return null;
            return { type, content };
        })
        .filter(Boolean);
}
