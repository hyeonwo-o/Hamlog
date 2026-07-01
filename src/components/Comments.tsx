import React, { useCallback, useEffect, useState } from 'react';
import { formatDate } from '../utils/formatDate';
import type { Comment } from '../types/comment';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';
const COMMENT_LIMITS = {
    author: 80,
    password: 72,
    content: 2000
};

interface CommentsProps {
    postId: string;
}

export const Comments: React.FC<CommentsProps> = ({ postId }) => {
    const [comments, setComments] = useState<Comment[]>([]);
    const [loading, setLoading] = useState(false);

    // Form State
    const [author, setAuthor] = useState('');
    const [password, setPassword] = useState('');
    const [content, setContent] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState('');

    // Delete State
    const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
    const [deletePassword, setDeletePassword] = useState('');
    const [deleting, setDeleting] = useState(false);
    const [deleteError, setDeleteError] = useState('');

    const fetchComments = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE}/comments?postId=${postId}`);
            if (res.ok) {
                const data = await res.json();
                setComments(data.comments || []);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    }, [postId]);

    useEffect(() => {
        if (postId) {
            void fetchComments();
        }
    }, [postId, fetchComments]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!author.trim() || !password.trim() || !content.trim()) return;

        setSubmitting(true);
        setSubmitError('');
        try {
            const res = await fetch(`${API_BASE}/comments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ postId, author, password, content })
            });
            if (res.ok) {
                await fetchComments();
                setAuthor('');
                setPassword('');
                setContent('');
            } else {
                const data = await res.json().catch(() => null);
                setSubmitError(data?.message || '댓글 등록에 실패했습니다.');
            }
        } catch (error) {
            console.error(error);
            setSubmitError('오류가 발생했습니다.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async () => {
        if (!deleteTargetId || !deletePassword) return;

        setDeleting(true);
        setDeleteError('');
        try {
            const res = await fetch(`${API_BASE}/comments/${deleteTargetId}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password: deletePassword })
            });
            if (res.ok) {
                setDeleteTargetId(null);
                setDeletePassword('');
                await fetchComments();
            } else {
                const data = await res.json();
                setDeleteError(data.message || '삭제 실패');
            }
        } catch (error: unknown) {
            console.error(error);
            setDeleteError('오류가 발생했습니다.');
        } finally {
            setDeleting(false);
        }
    };

    const canSubmit = Boolean(author.trim() && password.trim() && content.trim()) && !submitting;

    return (
        <div className="mt-16 border-t border-[var(--border)] pt-10">
            <h3 className="font-display text-xl font-semibold mb-6">
                댓글 {comments.length}
            </h3>

            {/* List */}
            <div className="space-y-6 mb-10">
                {loading ? (
                    <p className="text-sm text-[var(--text-muted)]">불러오는 중...</p>
                ) : comments.length > 0 ? (
                    comments.map(comment => (
                        <div key={comment.id} className="group">
                            <div className="flex items-center justify-between text-xs text-[var(--text-muted)] mb-2">
                                <span className="font-semibold text-[var(--text)]">{comment.author}</span>
                                <div className="flex items-center gap-2">
                                    <span>{formatDate(comment.createdAt)}</span>
                                    <button
                                        onClick={() => {
                                            setDeleteTargetId(comment.id);
                                            setDeletePassword('');
                                            setDeleteError('');
                                        }}
                                        className="text-[10px] uppercase opacity-0 group-hover:opacity-100 transition-opacity hover:text-[var(--accent-strong)]"
                                    >
                                        삭제
                                    </button>
                                </div>
                            </div>
                            <p className="text-sm leading-relaxed whitespace-pre-wrap">{comment.content}</p>
                        </div>
                    ))
                ) : (
                    <p className="text-sm text-[var(--text-muted)]">첫 번째 댓글을 남겨보세요.</p>
                )}
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-3 rounded-lg bg-[var(--surface-muted)] p-4">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">댓글 쓰기</h4>
                <div className="grid gap-3 sm:grid-cols-2">
                    <input
                        type="text"
                        placeholder="이름"
                        value={author}
                        onChange={e => setAuthor(e.target.value)}
                        maxLength={COMMENT_LIMITS.author}
                        className="w-full bg-[var(--bg)] border border-[var(--border)] rounded px-3 py-2 text-sm focus:outline-none focus:border-[var(--accent)]"
                        required
                    />
                    <input
                        type="password"
                        placeholder="비밀번호"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        maxLength={COMMENT_LIMITS.password}
                        className="w-full bg-[var(--bg)] border border-[var(--border)] rounded px-3 py-2 text-sm focus:outline-none focus:border-[var(--accent)]"
                        required
                    />
                </div>
                <textarea
                    placeholder="내용을 입력하세요..."
                    value={content}
                    onChange={e => setContent(e.target.value)}
                    maxLength={COMMENT_LIMITS.content}
                    aria-describedby="comment-form-help"
                    className="w-full bg-[var(--bg)] border border-[var(--border)] rounded px-3 py-2 text-sm h-24 resize-none focus:outline-none focus:border-[var(--accent)]"
                    required
                />
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-h-4">
                        {submitError ? (
                            <p id="comment-form-help" className="text-xs text-red-500">{submitError}</p>
                        ) : (
                            <p id="comment-form-help" className="text-xs text-[var(--text-muted)]">
                                {content.length}/{COMMENT_LIMITS.content}
                            </p>
                        )}
                    </div>
                    <button
                        type="submit"
                        disabled={!canSubmit}
                        className="bg-[var(--text)] text-[var(--bg)] px-4 py-2 rounded text-xs font-bold uppercase tracking-wider hover:opacity-80 disabled:opacity-50"
                    >
                        {submitting ? '등록 중...' : '등록'}
                    </button>
                </div>
            </form>

            {/* Delete Modal (Simple Inline) */}
            {deleteTargetId && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-[var(--bg)] rounded-xl p-6 w-full max-w-xs border border-[var(--border)]">
                        <h4 className="text-sm font-semibold mb-4">댓글 삭제</h4>
                        <input
                            type="password"
                            placeholder="비밀번호 입력"
                            value={deletePassword}
                            onChange={e => setDeletePassword(e.target.value)}
                            maxLength={COMMENT_LIMITS.password}
                            className="w-full bg-[var(--surface-muted)] border border-[var(--border)] rounded px-3 py-2 text-sm mb-2 focus:outline-none"
                            autoFocus
                        />
                        {deleteError && <p className="text-xs text-red-500 mb-2">{deleteError}</p>}
                        <div className="flex justify-end gap-2 mt-4">
                            <button
                                onClick={() => setDeleteTargetId(null)}
                                className="px-3 py-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text)]"
                            >
                                취소
                            </button>
                            <button
                                onClick={handleDelete}
                                disabled={deleting}
                                className="px-3 py-1.5 bg-red-500 text-white rounded text-xs hover:bg-red-600 disabled:opacity-50"
                            >
                                {deleting ? '삭제 중...' : '삭제'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
