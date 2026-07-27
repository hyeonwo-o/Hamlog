export function toPostSummaries(posts) {
    return posts.map(post => {
        const { contentJson, contentHtml, sections, ...summary } = post;
        void contentJson;
        void contentHtml;
        void sections;
        return summary;
    });
}
