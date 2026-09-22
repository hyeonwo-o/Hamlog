export function toPostSummaries(posts) {
    return posts.map(post => {
        const { contentJson, contentHtml, sections, previousSlugs, ...summary } = post;
        void contentJson;
        void contentHtml;
        void sections;
        void previousSlugs;
        return summary;
    });
}
