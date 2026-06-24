import PostCard from '../PostCard';
import type { Post } from '../../types/blog';

interface FeaturedSectionProps {
    posts: Post[];
}

export const FeaturedSection = ({ posts }: FeaturedSectionProps) => {
    if (posts.length === 0) return null;

    return (
        <section id="spotlight" className="mx-auto max-w-6xl px-4 py-8">
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                    <h2 className="font-display text-xl font-semibold">
                        인기글
                    </h2>
                </div>
                <span className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">
                    {posts.length}편
                </span>
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {posts.map((post, index) => (
                    <PostCard key={post.id} post={post} variant="featured" index={index} />
                ))}
            </div>
        </section>
    );
};
