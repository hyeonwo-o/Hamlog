import { useEffect, useState } from 'react';
import { renderMermaidToSvg } from '../utils/mermaid';

interface MermaidContentProps {
  source: string;
}

type MermaidRenderState = {
  svg: string;
  error: string;
  loading: boolean;
};

const MermaidContent = ({ source }: MermaidContentProps) => {
  const [state, setState] = useState<MermaidRenderState>({
    svg: '',
    error: '',
    loading: true
  });

  useEffect(() => {
    let cancelled = false;
    setState({ svg: '', error: '', loading: true });

    void renderMermaidToSvg(source)
      .then((svg) => {
        if (!cancelled) setState({ svg, error: '', loading: false });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : '다이어그램을 렌더링하지 못했습니다.';
        setState({ svg: '', error: message, loading: false });
      });

    return () => {
      cancelled = true;
    };
  }, [source]);

  return (
    <figure className="mermaid-block" aria-label="Mermaid 다이어그램">
      {state.loading && (
        <div className="mermaid-status" aria-live="polite">다이어그램을 불러오는 중...</div>
      )}
      {state.error && (
        <div className="mermaid-error" role="alert">
          <strong>Mermaid 문법을 확인해 주세요.</strong>
          <span>{state.error}</span>
          <pre><code>{source}</code></pre>
        </div>
      )}
      {state.svg && (
        <div
          className="mermaid-render"
          role="img"
          aria-label="Mermaid로 생성한 다이어그램"
          dangerouslySetInnerHTML={{ __html: state.svg }}
        />
      )}
    </figure>
  );
};

export default MermaidContent;
