import { readPosts, writePosts } from '../../models/postModel.js';
import { nextPostTimestamp } from '../../utils/postVersion.js';
import { isPostDeletionPending } from '../../utils/postVisibility.js';
import {
  DEFAULT_CATEGORY,
  normalizeCategoryKey
} from '../../utils/normalizers/categoryNormalizers.js';

export async function replaceCategoryInPosts(previousName, nextName) {
  const posts = await readPosts();
  let updatedCount = 0;

  const nextPosts = posts.map(post => {
    if (!isPostDeletionPending(post) && normalizeCategoryKey(post.category) === normalizeCategoryKey(previousName)) {
      updatedCount += 1;
      return { ...post, category: nextName, updatedAt: nextPostTimestamp(post) };
    }
    return post;
  });

  if (updatedCount > 0) {
    await writePosts(nextPosts);
  }

  return updatedCount;
}

export async function moveCategoryPostsToDefault(categoryName) {
  return replaceCategoryInPosts(categoryName, DEFAULT_CATEGORY);
}
