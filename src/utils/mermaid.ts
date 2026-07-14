import DOMPurify from 'dompurify';

export const DEFAULT_MERMAID_SOURCE = `flowchart TD
    A[시작] --> B{조건}
    B -->|예| C[처리]
    B -->|아니오| D[종료]`;

export const MAX_MERMAID_SOURCE_LENGTH = 20_000;

type MermaidApi = (typeof import('mermaid'))['default'];

let mermaidPromise: Promise<MermaidApi> | null = null;
let renderSequence = 0;

const loadMermaid = () => {
  if (!mermaidPromise) {
    mermaidPromise = import('mermaid').then(({ default: mermaid }) => {
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: 'strict',
        secure: [
          'secure',
          'securityLevel',
          'startOnLoad',
          'maxTextSize',
          'suppressErrorRendering'
        ],
        maxTextSize: MAX_MERMAID_SOURCE_LENGTH,
        suppressErrorRendering: true,
        theme: 'neutral',
        flowchart: {
          htmlLabels: false,
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
  const normalizedSource = source.trim();
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
