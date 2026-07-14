import DOMPurify from 'dompurify';

export const DEFAULT_MERMAID_SOURCE = `flowchart TD
    A[시작] --> B{조건}
    B -->|예| C[처리]
    B -->|아니오| D[종료]`;

export const MAX_MERMAID_SOURCE_LENGTH = 20_000;

const normalizeLineEndings = (source: string) => source.replace(/\r\n?/g, '\n').trim();

export const extractMermaidFencedSource = (source: string) => {
  const normalizedSource = normalizeLineEndings(source);
  const openingFence = normalizedSource.match(/^[ \t]*(`{3,}|~{3,})[ \t]*mermaid[ \t]*\n/i);
  if (!openingFence) return null;

  const fence = openingFence[1];
  const bodyLines = normalizedSource.slice(openingFence[0].length).split('\n');
  if (bodyLines.at(-1)?.trim() === fence) bodyLines.pop();

  return bodyLines.join('\n').trim();
};

export const normalizeMermaidSource = (source: string) => (
  extractMermaidFencedSource(source) ?? normalizeLineEndings(source)
);

export const resolveMermaidCodeBlockSource = (language: string, source: string) => {
  const fencedSource = extractMermaidFencedSource(source);
  if (language.toLowerCase() === 'mermaid') return fencedSource ?? normalizeMermaidSource(source);
  return fencedSource;
};

type MermaidApi = (typeof import('mermaid'))['default'];

let mermaidPromise: Promise<MermaidApi> | null = null;
let renderSequence = 0;

const loadMermaid = () => {
  if (!mermaidPromise) {
    mermaidPromise = import('mermaid').then(({ default: mermaid }) => {
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: 'strict',
        htmlLabels: false,
        secure: [
          'secure',
          'securityLevel',
          'startOnLoad',
          'htmlLabels',
          'maxTextSize',
          'suppressErrorRendering'
        ],
        maxTextSize: MAX_MERMAID_SOURCE_LENGTH,
        suppressErrorRendering: true,
        theme: 'neutral',
        flowchart: {
          useMaxWidth: true
        },
        sequence: {
          useMaxWidth: true,
          wrap: true
        }
      });
      return mermaid;
    });
  }

  return mermaidPromise;
};

export const renderMermaidToSvg = async (source: string) => {
  const normalizedSource = normalizeMermaidSource(source);
  if (!normalizedSource) {
    throw new Error('Mermaid 소스가 비어 있습니다.');
  }
  if (normalizedSource.length > MAX_MERMAID_SOURCE_LENGTH) {
    throw new Error(`Mermaid 소스는 ${MAX_MERMAID_SOURCE_LENGTH.toLocaleString()}자 이하만 지원합니다.`);
  }

  const mermaid = await loadMermaid();
  const id = `hamlog-mermaid-${Date.now()}-${++renderSequence}`;
  const { svg } = await mermaid.render(id, normalizedSource);

  return String(DOMPurify.sanitize(svg, {
    USE_PROFILES: { svg: true, svgFilters: true }
  }));
};
