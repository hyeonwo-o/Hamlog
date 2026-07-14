import React, { Suspense, lazy, useState } from 'react';
import DOMPurify from 'dompurify';
import parse from 'html-react-parser';
import type { DOMNode, HTMLReactParserOptions, Element } from 'html-react-parser';
import type { ChildNode } from 'domhandler';
import { Copy, Check, Terminal } from 'lucide-react';

interface PostContentProps {
  contentHtml?: string;
}

const sanitizeHtml = (html: string) =>
  DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    ADD_ATTR: ['data-size', 'data-width', 'style', 'width', 'class', 'colspan', 'rowspan', 'colwidth', 'data-caption', 'id'],
    ADD_TAGS: ['figure', 'figcaption']
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
          if (language === 'mermaid') {
            return (
              <Suspense fallback={<div className="mermaid-status">다이어그램을 불러오는 중...</div>}>
                <MermaidContent source={normalizedCode} />
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
