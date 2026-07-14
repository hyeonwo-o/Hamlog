const extractLinkedPostSlugs = (html, availableSlugs) => {
    const linkedSlugs = new Set();
    if (!html) return [];

    const hrefPattern = /href=["']([^"']+)["']/gi;
    let match = hrefPattern.exec(html);

    while (match) {
        try {
            const parsed = new URL(match[1] ?? '', 'https://hamlog.invalid');
            const slug = parsed.pathname.match(/^\/(?:posts|p)\/([^/?#]+)/)?.[1];
            if (slug && availableSlugs.has(slug)) linkedSlugs.add(slug);
        } catch {
            // Ignore malformed links in stored editor content.
        }
        match = hrefPattern.exec(html);
    }

    return Array.from(linkedSlugs);
};

export function toPostSummaries(posts) {
    const availableSlugs = new Set(posts.map(post => post.slug));

    return posts.map(post => {
        const { contentJson, contentHtml, sections, ...summary } = post;
        void contentJson;
        void sections;

        return {
            ...summary,
            linkedPostSlugs: extractLinkedPostSlugs(contentHtml, availableSlugs)
        };
    });
}
