import katex from 'katex';
import 'katex/dist/katex.min.css';

interface MathContentProps {
  latex: string;
}

const MathContent = ({ latex }: MathContentProps) => (
  <span
    className="math-render"
    dangerouslySetInnerHTML={{
      __html: katex.renderToString(latex || 'x', {
        throwOnError: false,
        output: 'html'
      })
    }}
  />
);

export default MathContent;
