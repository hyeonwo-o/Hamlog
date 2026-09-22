// Aliases belong to the stable post ID. They always resolve directly to its
// current slug, so repeated renames and revision restores cannot form chains.
export const previousPostSlugs = (post) => Array.from(new Set(
    (Array.isArray(post?.previousSlugs) ? post.previousSlugs : [])
        .filter(slug => typeof slug === 'string' && slug.trim() && slug !== post.slug)
));

export const postOwnsSlug = (post, slug) => (
    post.slug === slug || previousPostSlugs(post).includes(slug)
);

export const aliasesAfterSlugChange = (post, nextSlug) => Array.from(new Set([
    ...previousPostSlugs(post),
    post.slug
])).filter(slug => typeof slug === 'string' && slug && slug !== nextSlug);

export const withoutPostAliases = (post) => {
    const { previousSlugs, ...publicPost } = post;
    void previousSlugs;
    return publicPost;
};
