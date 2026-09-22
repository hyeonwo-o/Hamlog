// Wall clocks can stand still or move backwards. Versions must still advance.
export const nextPostTimestamp = (post = {}) => new Date(
    Math.max(Date.now(), (Date.parse(post.updatedAt) || 0) + 1)
).toISOString();
