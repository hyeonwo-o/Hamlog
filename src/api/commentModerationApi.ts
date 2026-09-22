import { requestJson, requestVoid } from './client';
import type { CommentModerationPage, CommentVisibilityFilter, ModeratedComment } from '../types/comment';

export function fetchModerationComments(
  { page, visibility }: { page: number; visibility: CommentVisibilityFilter },
  signal?: AbortSignal
): Promise<CommentModerationPage> {
  const query = new URLSearchParams({ page: String(page), pageSize: '20', visibility });
  return requestJson(`/comments/moderation?${query}`, { cache: 'no-store', signal });
}

export async function setCommentHidden(comment: ModeratedComment, hidden: boolean): Promise<ModeratedComment> {
  const response = await requestJson<{ comment: ModeratedComment }>(`/comments/moderation/${encodeURIComponent(comment.id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hidden, expectedVersion: comment.moderation.version })
  });
  return response.comment;
}

export function deleteModeratedComment(comment: ModeratedComment): Promise<void> {
  return requestVoid(`/comments/moderation/${encodeURIComponent(comment.id)}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ expectedVersion: comment.moderation.version })
  });
}
