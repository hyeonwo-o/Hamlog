import { Link, useLocation } from 'react-router-dom';
import type { Post } from '../types/blog';
import { isPostVisible } from '../utils/postStatus';

interface Props {
    post: Post;
    posts: Post[];
}

export default function PostSeriesNavigation({ post, posts }: Props) {
    const location = useLocation();
    const series = post.series?.trim();
    if (!series || !isPostVisible(post)) return null;
    const members = Array.from(new Map([...posts, post]
        .filter(item => isPostVisible(item) && item.series?.trim() === series)
        .map(item => [item.id, item])).values()).sort((left, right) => {
            const leftTime = Date.parse(left.publishedAt);
            const rightTime = Date.parse(right.publishedAt);
            const dateDifference = (Number.isFinite(leftTime) ? leftTime : Infinity)
                - (Number.isFinite(rightTime) ? rightTime : Infinity);
            if (dateDifference) return dateDifference;
            const leftKey = `${left.id}\u0000${left.slug}`;
            const rightKey = `${right.id}\u0000${right.slug}`;
            return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0;
        });
    const currentIndex = members.findIndex(item => item.id === post.id);
    const previous = members[currentIndex - 1];
    const next = members[currentIndex + 1];
    const seriesUrl = `/?${new URLSearchParams({ series })}#writing`;
    const requestedReturnTo = location.state?.returnTo;
    const returnTo = typeof requestedReturnTo === 'string' && /^\/(?:[?#]|$)/.test(requestedReturnTo)
        ? requestedReturnTo : seriesUrl;
    const linkClass = 'block min-h-11 min-w-0 break-words rounded-lg border border-[color:var(--border)] px-3 py-3 text-sm transition-colors hover:bg-[var(--surface-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)]';

    return <nav aria-label="시리즈 탐색" className="my-8 min-w-0 space-y-4 rounded-xl border border-[color:var(--border)] bg-[var(--surface)] p-4 text-[var(--text)] sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
            <h2 className="min-w-0 break-words text-lg font-semibold">{series}</h2>
            <span className="text-xs text-[var(--text-muted)]">발행일 순 · {currentIndex + 1}/{members.length}편</span>
        </div>
        <Link to={seriesUrl} className="inline-block min-h-11 max-w-full break-words py-2 text-sm text-[var(--accent-strong)] underline underline-offset-4">시리즈 전체 글 보기</Link>
        <ol aria-label="시리즈 목차" className="list-inside list-decimal space-y-2 text-sm">
            {members.map(item => <li key={item.id} className="break-words">
                <Link to={`/posts/${encodeURIComponent(item.slug)}`} state={{ returnTo }} aria-current={item.id === post.id ? 'page' : undefined}
                    className={`inline-block max-w-full break-words py-2 underline-offset-4 hover:underline ${item.id === post.id ? 'font-semibold text-[var(--accent-strong)]' : 'text-[var(--text-muted)]'}`}>
                    {item.title}{item.id === post.id ? ' · 현재 글' : ''}
                </Link>
            </li>)}
        </ol>
        {(previous || next) && <div className="grid min-w-0 gap-3 sm:grid-cols-2">
            {previous && <Link to={`/posts/${encodeURIComponent(previous.slug)}`} state={{ returnTo }} className={linkClass}>
                <span className="mb-1 block text-xs text-[var(--text-muted)]">이전 글</span>{previous.title}
            </Link>}
            {next && <Link to={`/posts/${encodeURIComponent(next.slug)}`} state={{ returnTo }} className={`${linkClass} sm:col-start-2`}>
                <span className="mb-1 block text-xs text-[var(--text-muted)]">다음 글</span>{next.title}
            </Link>}
        </div>}
    </nav>;
}
