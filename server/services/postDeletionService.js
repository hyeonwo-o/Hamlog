import { readPosts, writePosts } from '../models/postModel.js';
import { readPostDeletionIntents, finishPostDeletion } from '../models/postDeletionModel.js';
import { deletePostRevisions } from '../models/revisionModel.js';
import { deletePostView } from '../models/postViewModel.js';
import { deleteCommentsByPostIdUnlocked } from '../models/commentModel.js';
import { runWithDataStoreLock } from '../utils/storeLock.js';

// Caller holds the shared mutation lock. Every step is safe to repeat after an
// interrupted request or restart; the intent is always removed last.
export async function completePostDeletionUnlocked(id) {
    await deletePostRevisions(id);
    await deletePostView(id);
    await deleteCommentsByPostIdUnlocked(id);
    await writePosts((await readPosts()).filter(post => post.id !== id));
    await finishPostDeletion(id);
}

export async function recoverPendingPostDeletions() {
    return runWithDataStoreLock(async () => {
        for (const intent of await readPostDeletionIntents()) {
            try {
                await completePostDeletionUnlocked(intent.id);
            } catch (error) {
                // Serve the retained, private trash entry so an admin can retry.
                console.error(`[PostDeletion] Cleanup remains pending for ${intent.id}:`, error);
            }
        }
    });
}
