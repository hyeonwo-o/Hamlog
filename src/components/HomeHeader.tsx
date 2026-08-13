import type { SiteMeta } from '../types/blog';
import { buildImageVariantUrl } from '../utils/imageUrl';
import PublicNavigation from './PublicNavigation';

interface HomeHeaderProps {
    profile: SiteMeta;
    postCount: number;
    categoryCount: number;
}

interface SocialLink {
    label: string;
    href?: string;
}

export const HomeHeader = ({ profile, postCount, categoryCount }: HomeHeaderProps) => {
    const displayProfileImage = buildImageVariantUrl(profile.profileImage, { width: 112, height: 112 });
    const socialLinks: SocialLink[] = [
        { label: 'GitHub', href: profile.social.github },
        { label: 'LinkedIn', href: profile.social.linkedin },
        { label: 'Twitter', href: profile.social.twitter },
        { label: 'Instagram', href: profile.social.instagram },
        { label: 'Threads', href: profile.social.threads },
        { label: 'Telegram', href: profile.social.telegram }
    ].filter(link => Boolean(link.href));

    return (
        <header className="border-b border-[color:var(--border)]">
            <PublicNavigation profile={profile} />

            <div className="mx-auto max-w-6xl px-4 py-9 sm:py-12">
                <div className="grid gap-8 lg:grid-cols-[minmax(0,1.55fr)_minmax(280px,0.65fr)] lg:gap-10">
                    <section className="min-w-0">
                        <h1 className="max-w-3xl break-keep font-display text-[1.65rem] font-bold leading-[1.3] tracking-[-0.035em] text-[var(--text)] sm:text-[2rem] lg:text-[2.25rem]">
                            {profile.tagline}
                        </h1>
                        <p className="mt-4 max-w-2xl break-keep text-sm leading-7 text-[var(--text-muted)] sm:text-base">
                            {profile.description}
                        </p>

                        <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-4 border-t border-[color:var(--border)] pt-5">
                            <dl className="flex items-center" aria-label="블로그 현황">
                                <div className="flex items-baseline gap-2 pr-5">
                                    <dt className="text-xs text-[var(--text-muted)]">글</dt>
                                    <dd className="font-display text-xl font-bold leading-none text-[var(--text)]">
                                        {postCount}
                                    </dd>
                                </div>
                                <div className="flex items-baseline gap-2 border-l border-[color:var(--border)] pl-5">
                                    <dt className="text-xs text-[var(--text-muted)]">카테고리</dt>
                                    <dd className="font-display text-xl font-bold leading-none text-[var(--text)]">
                                        {categoryCount}
                                    </dd>
                                </div>
                            </dl>

                            {profile.display.showEmail && profile.email && (
                                <a
                                    href={`mailto:${profile.email}`}
                                    className="ml-auto inline-flex min-h-11 items-center border-b border-[color:var(--text)] text-xs font-semibold text-[var(--text)] transition-colors hover:border-[var(--accent-strong)] hover:text-[var(--accent-strong)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--accent)]"
                                >
                                    이메일로 연락하기
                                    <span className="ml-2" aria-hidden="true">&rarr;</span>
                                </a>
                            )}
                        </div>
                    </section>

                    <aside
                        className="border-t border-[color:var(--border)] pt-6 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0"
                        aria-label="작성자 정보"
                    >
                        <div className="flex items-center gap-3.5">
                            {profile.display.showProfileImage && displayProfileImage && (
                                <img
                                    src={displayProfileImage}
                                    alt={`${profile.name} 프로필 사진`}
                                    className="angular-control h-14 w-14 shrink-0 object-cover"
                                    width={56}
                                    height={56}
                                    loading="eager"
                                    decoding="async"
                                    fetchPriority="auto"
                                />
                            )}
                            <div className="min-w-0">
                                <p className="truncate font-display text-base font-bold text-[var(--text)]">
                                    {profile.name}
                                </p>
                                <p className="mt-0.5 truncate text-xs leading-5 text-[var(--text-muted)]">
                                    {profile.role}
                                    {profile.display.showLocation && profile.location && (
                                        <span> · {profile.location}</span>
                                    )}
                                </p>
                            </div>
                        </div>

                        {profile.display.showNow && profile.now && (
                            <div className="mt-5">
                                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                                    현재
                                </p>
                                <p className="mt-1.5 text-xs leading-5 text-[var(--text)]">{profile.now}</p>
                            </div>
                        )}

                        {profile.display.showStack && profile.stack.length > 0 && (
                            <div className="mt-5">
                                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                                    주력 스택
                                </p>
                                <p className="mt-1.5 text-xs leading-5 text-[var(--text)]">
                                    {profile.stack.join(' · ')}
                                </p>
                            </div>
                        )}

                        {profile.display.showSocialLinks && socialLinks.length > 0 && (
                            <nav
                                className="mt-5 flex flex-wrap gap-x-4 gap-y-2 border-t border-[color:var(--border)] pt-4"
                                aria-label="소셜 링크"
                            >
                                {socialLinks.map(({ label, href }) => (
                                    <a
                                        key={label}
                                        href={href}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex min-h-8 items-center text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)] transition-colors hover:text-[var(--accent-strong)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
                                    >
                                        {label}
                                    </a>
                                ))}
                            </nav>
                        )}
                    </aside>
                </div>
            </div>
        </header>
    );
};
