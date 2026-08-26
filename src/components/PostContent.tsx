import React, { Suspense, lazy, useState } from 'react';
import DOMPurify from 'dompurify';
import parse from 'html-react-parser';
import type { DOMNode, HTMLReactParserOptions, Element } from 'html-react-parser';
import type { ChildNode } from 'domhandler';
import { Copy, Check, Terminal } from 'lucide-react';
import { resolveMeaningfulImageAlt } from '../editor/utils/imageAlt';
import { buildImageVariantSrcSet, buildImageVariantUrl } from '../utils/imageUrl';
import { resolveMermaidCodeBlockSource } from '../utils/mermaid';

interface PostContentProps {
  contentHtml?: string;
}

const sanitizeHtml = (html: string) =>
  DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    ADD_ATTR: [
      'data-size',
      'data-width',
      'style',
      'width',
      'class',
      'colspan',
      'rowspan',
      'colwidth',
      'data-caption',
      'id',
      'url',
      'description',
      'image',
      'domain'
    ],
    ADD_TAGS: ['figure', 'figcaption', 'link-card']
  });

type HtmlNode = DOMNode | ChildNode;

const isElementNode = (node: HtmlNode): node is Element => node.type === 'tag';

const getNodeText = (node: HtmlNode): string => {
  if (node.type === 'text' && 'data' in node) return node.data;
  if (!isElementNode(node)) return '';
  return (node.children ?? []).map(child => getNodeText(child)).join('');
};

const getCodeText = (node: HtmlNode): string => {
  if (node.type === 'text' && 'data' in node) return node.data;
  if (!isElementNode(node)) return '';
  if (node.name === 'br') return '\n';

  const content = (node.children ?? []).map(child => getCodeText(child)).join('');
  if (['p', 'div', 'li', 'tr'].includes(node.name)) {
    return `${content}\n`;
  }
  return content;
};

const cleanContextText = (value = '') => value.replace(/\s+/g, ' ').trim().slice(0, 140);

const getElementParent = (node: Element) => {
  const parent = node.parent;
  return parent && parent.type === 'tag' ? parent as Element : null;
};

const getImageCaption = (node: Element) => {
  const dataCaption = cleanContextText(node.attribs['data-caption']);
  if (dataCaption) return dataCaption;

  const parent = getElementParent(node);
  if (parent?.name !== 'figure') return '';
  const caption = (parent.children ?? []).find(
    (child): child is Element => isElementNode(child) && child.name === 'figcaption'
  );
  return caption ? cleanContextText(getNodeText(caption)) : '';
};

const getNearbyImageContext = (node: Element) => {
  const parent = getElementParent(node);
  if (parent && ['p', 'a'].includes(parent.name)) {
    const inlineContext = cleanContextText(getNodeText(parent));
    if (inlineContext) return inlineContext;
  }

  const anchorNode = parent?.name === 'figure' ? parent : node;
  const container = getElementParent(anchorNode);
  if (!container) return '';
  const siblings = container.children ?? [];
  const anchorIndex = siblings.indexOf(anchorNode);
  if (anchorIndex < 0) return '';

  for (let distance = 1; distance <= 3; distance += 1) {
    for (const index of [anchorIndex - distance, anchorIndex + distance]) {
      const sibling = siblings[index];
      if (!sibling || !isElementNode(sibling)) continue;
      if (!['h1', 'h2', 'h3', 'p', 'figcaption'].includes(sibling.name)) continue;
      const context = cleanContextText(getNodeText(sibling));
      if (context) return context;
    }
  }

  return '';
};

const resolveImageAlt = (node: Element) => resolveMeaningfulImageAlt({
  existingAlt: node.attribs.alt,
  caption: getImageCaption(node),
  context: getNearbyImageContext(node),
  src: node.attribs.src
});

const normalizeHttpOrLocalUrl = (value = '') => {
  const candidate = String(value).trim();
  if (candidate.startsWith('/') && !candidate.startsWith('//')) return candidate;

  try {
    const parsed = new URL(candidate);
    return ['http:', 'https:'].includes(parsed.protocol) ? parsed.href : '';
  } catch {
    return '';
  }
};

const getSafeImageDisplayWidth = (value = '') => {
  const match = String(value).trim().match(/^(\d+(?:\.\d+)?)%$/);
  if (!match) return '';
  const percentage = Math.round(Number(match[1]));
  return percentage >= 25 && percentage <= 100 ? `${percentage}%` : '';
};

interface SyntaxHighlighterProps {
  language: string;
  children: string;
  showLineNumbers: boolean;
  customStyle: React.CSSProperties;
  lineNumberStyle: React.CSSProperties;
}

type SyntaxHighlighterComponent = React.ComponentType<
  SyntaxHighlighterProps & { style: unknown }
> & {
  registerLanguage: (name: string, language: unknown) => void;
};

const SyntaxHighlighter = lazy(async () => {
  const [
    syntaxModule,
    styleModule,
    markup,
    bash,
    css,
    javascript,
    json,
    typescript
  ] = await Promise.all([
    import('react-syntax-highlighter/dist/esm/prism-light'),
    import('react-syntax-highlighter/dist/esm/styles/prism'),
    import('react-syntax-highlighter/dist/esm/languages/prism/markup'),
    import('react-syntax-highlighter/dist/esm/languages/prism/bash'),
    import('react-syntax-highlighter/dist/esm/languages/prism/css'),
    import('react-syntax-highlighter/dist/esm/languages/prism/javascript'),
    import('react-syntax-highlighter/dist/esm/languages/prism/json'),
    import('react-syntax-highlighter/dist/esm/languages/prism/typescript')
  ]);
  const PrismHighlighter = syntaxModule.default as SyntaxHighlighterComponent;

  PrismHighlighter.registerLanguage('markup', markup.default);
  PrismHighlighter.registerLanguage('html', markup.default);
  PrismHighlighter.registerLanguage('bash', bash.default);
  PrismHighlighter.registerLanguage('shell', bash.default);
  PrismHighlighter.registerLanguage('css', css.default);
  PrismHighlighter.registerLanguage('javascript', javascript.default);
  PrismHighlighter.registerLanguage('js', javascript.default);
  PrismHighlighter.registerLanguage('json', json.default);
  PrismHighlighter.registerLanguage('typescript', typescript.default);
  PrismHighlighter.registerLanguage('ts', typescript.default);

  return {
    default: (props: SyntaxHighlighterProps) => (
      <PrismHighlighter {...props} style={styleModule.vscDarkPlus} />
    )
  };
});

const MathContent = lazy(() => import('./MathContent'));
const MermaidContent = lazy(() => import('./MermaidContent'));

const CodeBlock = ({ language, code }: { language: string; code: string }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="group relative my-6 overflow-hidden rounded-xl border border-[color:var(--border)] bg-[#1e1e1e]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 bg-white/5 px-4 py-2">
        <div className="flex items-center gap-2">
          <Terminal size={14} className="text-white/40" />
          <span className="text-xs font-medium text-white/60">
            {language || 'plaintext'}
          </span>
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 rounded-md bg-white/5 px-2 py-1 text-[10px] font-medium text-white/60 transition-colors hover:bg-white/10 hover:text-white"
          aria-label="Copy code"
        >
          {copied ? (
            <>
              <Check size={12} className="text-green-400" />
              <span className="text-green-400">Copied</span>
            </>
          ) : (
            <>
              <Copy size={12} />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      {/* Editor Area */}
      <div className="relative text-sm">
        <Suspense
          fallback={(
            <pre className="m-0 overflow-x-auto bg-transparent p-6 text-sm leading-6 text-white/80">
              <code>{code}</code>
            </pre>
          )}
        >
          <SyntaxHighlighter
            language={language}
            showLineNumbers={true}
            customStyle={{
              margin: 0,
              padding: '1.5rem',
              background: 'transparent',
              fontSize: '0.875rem',
              lineHeight: '1.5',
            }}
            lineNumberStyle={{
              minWidth: '2.5em',
              paddingRight: '1em',
              color: '#6e7681',
              textAlign: 'right'
            }}
          >
            {code}
          </SyntaxHighlighter>
        </Suspense>
      </div>
    </div>
  );
};

const PostContent: React.FC<PostContentProps> = ({ contentHtml }) => {
  if (!contentHtml || !contentHtml.trim()) {
    return null;
  }

  const sanitized = sanitizeHtml(contentHtml);

  const options: HTMLReactParserOptions = {
    replace: (domNode: DOMNode) => {
      if (!isElementNode(domNode)) return undefined;

      // 1. Handle Headings: Add IDs for TOC
      if (['h1', 'h2', 'h3'].includes(domNode.name)) {
        if (!domNode.attribs.id) {
          const text = getNodeText(domNode).trim() || 'heading';

          const slug = text
            .toLowerCase()
            .replace(/[^a-z0-9가-힣\s-]/g, '')
            .replace(/\s+/g, '-')
            .slice(0, 30);

          domNode.attribs.id = `heading-${domNode.startIndex ?? ''}-${slug}`;
        }
      }

      if (domNode.name === 'img') {
        const displayWidth = getSafeImageDisplayWidth(domNode.attribs['data-width']);
        if (displayWidth) {
          domNode.attribs.style = `width: ${displayWidth}; height: auto; margin: 0 auto`;
        }
        const originalSrc = domNode.attribs.src;
        const responsiveSrcSet = buildImageVariantSrcSet(originalSrc, [
          { width: 480, descriptor: '480w' },
          { width: 800, descriptor: '800w' },
          { width: 1200, descriptor: '1200w' }
        ]);
        domNode.attribs.alt = resolveImageAlt(domNode);
        domNode.attribs.src = buildImageVariantUrl(originalSrc, { width: 1200 });
        if (responsiveSrcSet) {
          domNode.attribs.srcset = responsiveSrcSet;
          domNode.attribs.sizes = '(min-width: 1024px) 880px, 100vw';
        }
        domNode.attribs.loading = 'lazy';
        domNode.attribs.decoding = 'async';
        domNode.attribs.fetchpriority = 'low';
      }

      if (domNode.name === 'figure') {
        const displayWidth = getSafeImageDisplayWidth(domNode.attribs['data-width']);
        if (displayWidth) {
          domNode.attribs.style = `width: ${displayWidth}; height: auto; margin: 0 auto`;
        }
      }

      if (domNode.name === 'link-card') {
        const href = normalizeHttpOrLocalUrl(domNode.attribs.url);
        const title = cleanContextText(domNode.attribs.title) || cleanContextText(domNode.attribs.domain) || href;
        const description = cleanContextText(domNode.attribs.description);
        const domain = cleanContextText(domNode.attribs.domain);
        const originalImage = normalizeHttpOrLocalUrl(domNode.attribs.image);
        const image = buildImageVariantUrl(originalImage, { width: 320, height: 192 });
        const imageSrcSet = buildImageVariantSrcSet(originalImage, [
          { width: 160, height: 96, descriptor: '1x' },
          { width: 320, height: 192, descriptor: '2x' }
        ]);

        if (!href) {
          return title ? <p>{title}</p> : <></>;
        }

        const isExternal = /^https?:\/\//i.test(href);
        return (
          <a
            href={href}
            target={isExternal ? '_blank' : undefined}
            rel={isExternal ? 'noopener noreferrer' : undefined}
            className="group my-4 flex overflow-hidden rounded-xl border border-[color:var(--border)] bg-[var(--surface)] no-underline transition-all hover:border-[color:var(--accent)]"
          >
            {image && (
              <span className="relative hidden h-24 w-40 shrink-0 sm:block">
                <img
                  src={image}
                  srcSet={imageSrcSet}
                  sizes="160px"
                  alt=""
                  width={160}
                  height={96}
                  loading="lazy"
                  decoding="async"
                  fetchPriority="low"
                  className="absolute inset-0 h-full w-full object-cover"
                />
              </span>
            )}
            <span className="flex min-w-0 flex-1 flex-col justify-center p-4">
              <span className="line-clamp-1 text-sm font-semibold text-[var(--text)] group-hover:text-[var(--accent-strong)]">
                {title}
              </span>
              {description && (
                <span className="mt-1 line-clamp-2 text-xs text-[var(--text-muted)]">
                  {description}
                </span>
              )}
              {domain && (
                <span className="mt-2 text-[10px] text-[var(--text-muted)]">
                  {domain}
                </span>
              )}
            </span>
          </a>
        );
      }

      if (domNode.name === 'span' && domNode.attribs['data-type'] === 'math') {
        const latex = domNode.attribs['data-latex'] || getNodeText(domNode).trim();
        return (
          <Suspense fallback={<span className="math-src">{latex}</span>}>
            <MathContent latex={latex} />
          </Suspense>
        );
      }

      if (domNode.name === 'div' && domNode.attribs['data-type'] === 'mermaid') {
        const source = getCodeText(domNode).trim();
        return (
          <Suspense fallback={<div className="mermaid-status">다이어그램을 불러오는 중...</div>}>
            <MermaidContent source={source} />
          </Suspense>
        );
      }

      // 2. Handle Code Blocks
      if (domNode.name === 'pre') {
        const codeNode = (domNode.children ?? []).find(
          (child): child is Element => isElementNode(child) && child.name === 'code'
        );

        if (codeNode) {
          const className = codeNode.attribs.class || '';
          const languageMatch = className.match(/language-(\w+)/);
          const language = languageMatch ? languageMatch[1] : 'plaintext';

          let codeContent = (codeNode.children ?? []).map(getCodeText).join('');
          codeContent = codeContent
            .replace(/&gt;/g, '>')
            .replace(/&lt;/g, '<')
            .replace(/&quot;/g, '"')
            .replace(/&amp;/g, '&');

          const normalizedCode = codeContent.trimEnd();
          const mermaidSource = resolveMermaidCodeBlockSource(language, normalizedCode);
          if (mermaidSource !== null) {
            return (
              <Suspense fallback={<div className="mermaid-status">다이어그램을 불러오는 중...</div>}>
                <MermaidContent source={mermaidSource} />
              </Suspense>
            );
          }

          return <CodeBlock language={language} code={normalizedCode} />;
        }
      }
      return undefined;
    }
  };

  return (
    <div className="rich-content">
      {parse(sanitized, options)}
    </div>
  );
};

export default PostContent;
