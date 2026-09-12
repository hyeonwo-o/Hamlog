import React, { useEffect, useId, useState } from 'react';
import { clsx } from 'clsx';
import { ChevronDown, List } from 'lucide-react';

export interface TocItem {
    id: string;
    text: string;
    level: number;
}

interface TableOfContentsProps {
    contentSelector?: string;
    tocItems?: TocItem[];
    className?: string;
    containerClassName?: string;
    onLinkClick?: (id: string) => void;
    collapsible?: boolean;
}

const readHash = () => {
    try {
        return decodeURIComponent(window.location.hash.slice(1));
    } catch {
        return '';
    }
};

export const TableOfContents: React.FC<TableOfContentsProps> = ({
    contentSelector,
    tocItems: providedItems,
    className,
    containerClassName,
    onLinkClick,
    collapsible = false
}) => {
    const [domItems, setDomItems] = useState<TocItem[]>([]);
    const [activeId, setActiveId] = useState('');
    const [expanded, setExpanded] = useState(false);
    const listId = useId();
    const items = providedItems ?? domItems;

    useEffect(() => {
        if (providedItems || !contentSelector) return;
        const content = document.querySelector(contentSelector);
        const headings = content?.querySelectorAll('h1, h2, h3') ?? [];
        setDomItems(Array.from(headings)
            .filter(heading => heading.id && heading.textContent?.trim())
            .map(heading => ({
                id: heading.id,
                text: heading.textContent?.trim() || '',
                level: Number(heading.tagName.substring(1))
            })));
    }, [contentSelector, providedItems]);

    // Editor navigation is owned by its callback, not public URL fragments.
    useEffect(() => {
        if (onLinkClick || !contentSelector || !items.length) return;
        const content = document.querySelector(contentSelector);
        if (!content) return;
        const headings = items.map(item => document.getElementById(item.id))
            .filter((element): element is HTMLElement => Boolean(element && content.contains(element)));
        let scrollFrame = 0;
        let hashFrame = 0;
        const pathname = window.location.pathname;

        const updateActiveHeading = () => {
            scrollFrame = 0;
            let active = headings[0]?.id ?? '';
            for (const heading of headings) {
                if (heading.getBoundingClientRect().top > 120) break;
                active = heading.id;
            }
            setActiveId(active);
        };
        const onScroll = () => {
            if (!scrollFrame) scrollFrame = window.requestAnimationFrame(updateActiveHeading);
        };
        const followHash = () => {
            window.cancelAnimationFrame(hashFrame);
            hashFrame = window.requestAnimationFrame(() => {
                if (window.location.pathname !== pathname) return;
                const heading = headings.find(element => element.id === readHash());
                if (!heading) return;
                heading.setAttribute('tabindex', '-1');
                heading.focus({ preventScroll: true });
                window.scrollTo({ top: heading.getBoundingClientRect().top + window.scrollY - 96, behavior: 'instant' });
                setActiveId(heading.id);
            });
        };

        updateActiveHeading();
        followHash();
        window.addEventListener('scroll', onScroll, { passive: true });
        window.addEventListener('resize', onScroll);
        window.addEventListener('hashchange', followHash);
        window.addEventListener('popstate', followHash);
        return () => {
            window.cancelAnimationFrame(scrollFrame);
            window.cancelAnimationFrame(hashFrame);
            window.removeEventListener('scroll', onScroll);
            window.removeEventListener('resize', onScroll);
            window.removeEventListener('hashchange', followHash);
            window.removeEventListener('popstate', followHash);
        };
    }, [contentSelector, items, onLinkClick]);

    const handleClick = (event: React.MouseEvent<HTMLAnchorElement>, id: string) => {
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        if (onLinkClick) {
            onLinkClick(id);
            return;
        }
        const element = document.getElementById(id);
        if (!element || (contentSelector && !document.querySelector(contentSelector)?.contains(element))) return;
        if (readHash() !== id) {
            // Keep React Router's history key/index and any search return state.
            window.history.pushState(window.history.state, '', `#${encodeURIComponent(id)}`);
        }
        element.setAttribute('tabindex', '-1');
        element.focus({ preventScroll: true });
        window.scrollTo({
            top: element.getBoundingClientRect().top + window.scrollY - 96,
            behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'
        });
        setActiveId(id);
    };

    if (!items.length) return null;

    const navigation = (
        <nav className={clsx('toc-nav', className)} aria-label="글 목차">
            {collapsible && (
                <button
                    type="button"
                    aria-expanded={expanded}
                    aria-controls={listId}
                    onClick={() => setExpanded(value => !value)}
                    className="flex min-h-11 w-full items-center gap-2 rounded text-left text-sm font-semibold text-[var(--text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)] 2xl:hidden"
                >
                    <List className="h-4 w-4" aria-hidden="true" />
                    <span>목차</span>
                    <span className="text-xs font-normal text-[var(--text-muted)]">{items.length}개 항목</span>
                    <ChevronDown aria-hidden="true" className={clsx('ml-auto h-4 w-4', expanded && 'rotate-180')} />
                </button>
            )}
            <h2 className={clsx('mb-4 text-sm font-bold text-[var(--text-muted)]', collapsible && 'hidden 2xl:block')}>
                목차
            </h2>
            <div id={listId} className={clsx(collapsible && !expanded && 'hidden 2xl:block')}>
                <ul className={clsx('space-y-1 border-l border-[var(--border)]', collapsible && 'mt-3 max-h-[60vh] overflow-y-auto 2xl:mt-0 2xl:max-h-[calc(100vh-8rem)]')}>
                    {items.map(item => (
                        <li key={item.id} className={clsx('relative pl-4', item.level === 3 && 'pl-8')}>
                            <a
                                href={`#${encodeURIComponent(item.id)}`}
                                onClick={event => handleClick(event, item.id)}
                                aria-current={activeId === item.id ? 'location' : undefined}
                                className={clsx(
                                    'block break-words rounded py-2 text-sm hover:text-[var(--accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)] 2xl:py-1',
                                    activeId === item.id ? 'font-medium text-[var(--accent)]' : 'text-[var(--text-muted)]'
                                )}
                            >
                                {activeId === item.id && <span aria-hidden="true" className="absolute -left-px top-0 h-full w-0.5 bg-[var(--accent)]" />}
                                {item.text}
                            </a>
                        </li>
                    ))}
                </ul>
            </div>
        </nav>
    );

    return containerClassName ? <div className={containerClassName}>{navigation}</div> : navigation;
};
