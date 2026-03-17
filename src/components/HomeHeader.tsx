import { Sun, Moon, Github, Linkedin, Mail, Twitter, Instagram, AtSign, Send } from 'lucide-react';
import { useTheme } from '../hooks/useTheme';
import type { SiteMeta } from '../types/blog';

interface HomeHeaderProps {
    profile: SiteMeta;
    postCount: number;
    tagCount: number;
    categoryCount: number;
    seriesCount: number;
}

export const HomeHeader = ({ profile, postCount, tagCount, categoryCount, seriesCount }: HomeHeaderProps) => {
    const { theme, toggleTheme } = useTheme();
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
            <div className="mx-auto max-w-6xl px-4 py-10">
                <nav className="flex flex-wrap items-center justify-between gap-4 text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">
                    <span className="font-display text-base font-semibold text-[var(--text)]">
                        {profile.title}
                    </span>
                    <button
                        onClick={toggleTheme}
                        className="angular-control rounded-lg border border-[color:var(--border)] bg-[var(--surface)] p-2 text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--text)]"
                        aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                    >
                        {theme === 'dark' ? <Sun size={20} strokeWidth={1.5} /> : <Moon size={20} strokeWidth={1.5} />}
                    </button>
                </nav>

                <div className="mt-10 grid gap-10 lg:grid-cols-[1.6fr_1fr]">
                    <div className="space-y-8">
                        <div>
                            <h1 className="break-keep font-display text-2xl font-bold leading-tight tracking-tight text-[var(--text)] sm:text-3xl lg:text-4xl">
                                {profile.tagline}
                            </h1>
                            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-[var(--text-muted)] break-keep">
                                {profile.description}
                            </p>
                        </div>

                        {profile.display.showEmail && profile.email && (
                            <div className="flex flex-wrap gap-3">
                                <a
                                    href={`mailto:${profile.email}`}
                                    className="angular-control group inline-flex items-center gap-2 rounded-lg border border-[color:var(--border)] bg-transparent px-5 py-2.5 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] transition-all hover:translate-x-1 hover:-translate-y-1 hover:border-[var(--text)] hover:text-[var(--text)] active:scale-95"
                                >
                                    메일 보내기
                                </a>
                            </div>
                        )}

                        <div className="pt-4">
                            <dl className="grid grid-cols-4 gap-6 border-t border-[color:var(--border)] pt-6">
                                <div className="angular-control border border-[color:var(--border)] bg-[var(--surface-muted)] p-3">
                                    <dt className="text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--text-muted)]">Post</dt>
                                    <dd className="mt-1 font-display text-xl font-bold text-[var(--text)]">{postCount}</dd>
                                </div>
                                <div className="angular-control border border-[color:var(--border)] bg-[var(--surface-muted)] p-3">
                                    <dt className="text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--text-muted)]">Tag</dt>
                                    <dd className="mt-1 font-display text-xl font-bold text-[var(--text)]">{tagCount}</dd>
                                </div>
                                <div className="angular-control border border-[color:var(--border)] bg-[var(--surface-muted)] p-3">
                                    <dt className="text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--text-muted)]">Category</dt>
                                    <dd className="mt-1 font-display text-xl font-bold text-[var(--text)]">{categoryCount}</dd>
                                </div>
                                <div className="angular-control border border-[color:var(--border)] bg-[var(--surface-muted)] p-3">
                                    <dt className="text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--text-muted)]">Series</dt>
                                    <dd className="mt-1 font-display text-xl font-bold text-[var(--text)]">{seriesCount}</dd>
                                </div>
                            </dl>
                        </div>
                    </div>

                    <div>
                        <div className="angular-panel-strong space-y-6 rounded-xl border border-[color:var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow)]">
                            <div className="flex items-center gap-4">
                                {profile.display.showProfileImage && profile.profileImage && (
                                    <img
                                        src={profile.profileImage}
                                        alt={`${profile.name} portrait`}
                                        className="angular-control h-16 w-16 rounded-lg object-cover"
                                        loading="lazy"
                                    />
                                )}
                                <div>
                                    <p className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">
                                        작성자
                                    </p>
                                    <p className="font-display text-lg font-semibold">{profile.name}</p>
                                    <p className="text-sm text-[var(--text-muted)]">{profile.role}</p>
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
                                    <p className="mt-2 text-sm text-[var(--text-muted)]">{profile.now}</p>
                                </div>
                            )}
                            {profile.display.showStack && profile.stack.length > 0 && (
                                <div>
                                    <p className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">
                                        주력 스택
                                    </p>
                                    <div className="mt-3 flex flex-wrap gap-2">
                                        {profile.stack.map(item => (
                                            <span
                                                key={item}
                                                className="angular-chip rounded-lg border border-[color:var(--border)] bg-[var(--surface-muted)] px-3 py-1 text-[11px] text-[var(--text-muted)]"
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
