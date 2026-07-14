import { Github, Linkedin, Mail, Twitter, Instagram, AtSign, Send } from 'lucide-react';
import type { SiteMeta } from '../types/blog';
import { PublicNavigation } from './PublicNavigation';

interface HomeHeaderProps {
    profile: SiteMeta;
    postCount: number;
    categoryCount: number;
}

export const HomeHeader = ({ profile, postCount, categoryCount }: HomeHeaderProps) => {
    const showContactLinks = (
        (profile.display.showSocialLinks && (
            profile.social.github
            || profile.social.linkedin
            || profile.social.twitter
            || profile.social.instagram
            || profile.social.threads
            || profile.social.telegram
        ))
        || (profile.display.showEmail && profile.email)
    );

    return (
        <header className="border-b border-[color:var(--border)]">
            <div className="mx-auto max-w-6xl px-4 py-6">
                <div className="mb-6 flex justify-end">
                    <PublicNavigation />
                </div>
                <div className="grid gap-6 lg:grid-cols-[1.7fr_0.9fr]">
                    <div className="space-y-5">
                        <div>
                            <h1 className="break-keep font-display text-2xl font-bold leading-tight tracking-tight text-[var(--text)] sm:text-3xl">
                                {profile.tagline}
                            </h1>
                            <p className="mt-3 max-w-2xl break-keep text-base leading-relaxed text-[var(--text-muted)]">
                                {profile.description}
                            </p>
                        </div>

                        {profile.display.showEmail && profile.email && (
                            <div className="flex flex-wrap gap-3">
                                <a
                                    href={`mailto:${profile.email}`}
                                    className="angular-control inline-flex items-center gap-2 border border-[color:var(--border)] bg-transparent px-4 py-2 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] transition-colors hover:border-[var(--text)] hover:text-[var(--text)]"
                                >
                                    메일 보내기
                                </a>
                            </div>
                        )}

                        <div>
                            <dl className="grid grid-cols-2 gap-3 border-t border-[color:var(--border)] pt-4">
                                <div className="angular-control flex min-h-[72px] flex-col justify-center border border-[color:var(--border)] bg-[var(--surface-muted)] px-3 py-2">
                                    <dt className="text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--text-muted)]">Post</dt>
                                    <dd className="mt-0.5 font-display text-lg font-bold text-[var(--text)]">{postCount}</dd>
                                </div>
                                <div className="angular-control flex min-h-[72px] flex-col justify-center border border-[color:var(--border)] bg-[var(--surface-muted)] px-3 py-2">
                                    <dt className="text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--text-muted)]">Category</dt>
                                    <dd className="mt-0.5 font-display text-lg font-bold text-[var(--text)]">{categoryCount}</dd>
                                </div>
                            </dl>
                        </div>
                    </div>

                    <div>
                        <div className="space-y-4 border border-[color:var(--border)] bg-[var(--surface)] p-4">
                            <div className="flex items-center gap-3">
                                {profile.display.showProfileImage && profile.profileImage && (
                                    <img
                                        src={profile.profileImage}
                                        alt={`${profile.name} portrait`}
                                        className="angular-control h-12 w-12 rounded-lg object-cover"
                                        loading="lazy"
                                    />
                                )}
                                <div>
                                    <p className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">
                                        작성자
                                    </p>
                                    <p className="font-display text-base font-semibold">{profile.name}</p>
                                    <p className="text-xs text-[var(--text-muted)]">{profile.role}</p>
                                </div>
                            </div>

                            {showContactLinks && (
                                <div className="flex gap-3">
                                    {profile.display.showSocialLinks && profile.social.github && (
                                        <a
                                            href={profile.social.github}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="angular-control rounded-lg border border-[color:var(--border)] bg-[var(--surface-muted)] p-2 text-[var(--text-muted)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
                                            aria-label="GitHub"
                                        >
                                            <Github size={18} />
                                        </a>
                                    )}
                                    {profile.display.showSocialLinks && profile.social.linkedin && (
                                        <a
                                            href={profile.social.linkedin}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="angular-control rounded-lg border border-[color:var(--border)] bg-[var(--surface-muted)] p-2 text-[var(--text-muted)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
                                            aria-label="LinkedIn"
                                        >
                                            <Linkedin size={18} />
                                        </a>
                                    )}
                                    {profile.display.showSocialLinks && profile.social.twitter && (
                                        <a
                                            href={profile.social.twitter}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="angular-control rounded-lg border border-[color:var(--border)] bg-[var(--surface-muted)] p-2 text-[var(--text-muted)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
                                            aria-label="Twitter"
                                        >
                                            <Twitter size={18} />
                                        </a>
                                    )}
                                    {profile.display.showSocialLinks && profile.social.instagram && (
                                        <a
                                            href={profile.social.instagram}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="angular-control rounded-lg border border-[color:var(--border)] bg-[var(--surface-muted)] p-2 text-[var(--text-muted)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
                                            aria-label="Instagram"
                                        >
                                            <Instagram size={18} />
                                        </a>
                                    )}
                                    {profile.display.showSocialLinks && profile.social.threads && (
                                        <a
                                            href={profile.social.threads}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="angular-control rounded-lg border border-[color:var(--border)] bg-[var(--surface-muted)] p-2 text-[var(--text-muted)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
                                            aria-label="Threads"
                                        >
                                            <AtSign size={18} />
                                        </a>
                                    )}
                                    {profile.display.showSocialLinks && profile.social.telegram && (
                                        <a
                                            href={profile.social.telegram}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="angular-control rounded-lg border border-[color:var(--border)] bg-[var(--surface-muted)] p-2 text-[var(--text-muted)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
                                            aria-label="Telegram"
                                        >
                                            <Send size={18} />
                                        </a>
                                    )}
                                    {profile.display.showEmail && profile.email && (
                                        <a
                                            href={`mailto:${profile.email}`}
                                            className="angular-control rounded-lg border border-[color:var(--border)] bg-[var(--surface-muted)] p-2 text-[var(--text-muted)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
                                            aria-label="Email"
                                        >
                                            <Mail size={18} />
                                        </a>
                                    )}
                                </div>
                            )}

                            {profile.display.showNow && profile.now && (
                                <div>
                                    <p className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">
                                        지금
                                    </p>
                                    <p className="mt-1 text-xs text-[var(--text-muted)]">{profile.now}</p>
                                </div>
                            )}
                            {profile.display.showStack && profile.stack.length > 0 && (
                                <div>
                                    <p className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">
                                        주력 스택
                                    </p>
                                    <div className="mt-2 flex flex-wrap gap-1.5">
                                        {profile.stack.map(item => (
                                            <span
                                                key={item}
                                                className="angular-chip rounded-md border border-[color:var(--border)] bg-[var(--surface-muted)] px-2 py-0.5 text-[11px] text-[var(--text-muted)]"
                                            >
                                                {item}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {profile.display.showLocation && profile.location && (
                                <div className="text-xs text-[var(--text-muted)]">
                                    {profile.location} 기반
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </header>
    );
};
