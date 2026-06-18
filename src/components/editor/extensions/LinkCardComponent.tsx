import React from 'react';
import { NodeViewWrapper } from '@tiptap/react';
import { ExternalLink } from 'lucide-react';

interface LinkCardProps {
    node: {
        attrs: {
            url: string;
            title: string;
            description: string;
            image: string;
            domain: string;
        };
    };
    selected: boolean;
}

export const LinkCardComponent: React.FC<LinkCardProps> = ({ node, selected }) => {
    const { url, title, description, image, domain } = node.attrs;

    return (
        <NodeViewWrapper className="my-4">
            <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className={`group flex overflow-hidden rounded-xl border border-[color:var(--border)] bg-[var(--surface)] no-underline transition-all hover:border-[color:var(--accent)] ${selected ? 'ring-2 ring-[var(--accent)]' : ''
                    }`}
                contentEditable={false} // Make it read-only
                draggable="false"
            >
                {image && (
                    <div className="relative h-auto w-[120px] shrink-0 sm:w-[160px]">
                        <img
                            src={image}
                            alt=""
                            className="absolute inset-0 h-full w-full object-cover"
                        />
                    </div>
                )}
                <div className="flex min-w-0 flex-1 flex-col justify-center p-4">
                    <p className="line-clamp-1 text-sm font-semibold text-[var(--text)] group-hover:text-[var(--accent-strong)]">
                        {title}
                    </p>
                    <p className="mt-1 line-clamp-2 text-xs text-[var(--text-muted)]">
                        {description}
                    </p>
                    <div className="mt-2 flex items-center gap-1 text-[10px] text-[var(--text-muted)]">
                        <ExternalLink size={10} />
                        <span>{domain}</span>
                    </div>
                </div>
            </a>
        </NodeViewWrapper>
    );
};
