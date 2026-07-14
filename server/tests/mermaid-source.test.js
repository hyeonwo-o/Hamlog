import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extractMermaidFencedSource,
  normalizeMermaidSource,
  resolveMermaidCodeBlockSource
} from '../../src/utils/mermaid.ts';

test('Mermaid source normalization removes Markdown fences and normalizes line endings', () => {
  const source = [
    '```mermaid',
    'flowchart TD',
    '    A[시작] --> B[종료]',
    '```'
  ].join('\r\n');

  assert.equal(
    normalizeMermaidSource(source),
    'flowchart TD\n    A[시작] --> B[종료]'
  );
});

test('Mermaid source normalization accepts tilde fences and preserves raw source', () => {
  const fencedSource = '~~~mermaid\nsequenceDiagram\n    A->>B: 요청\n~~~';
  const rawSource = '  flowchart LR\n    A --> B  ';

  assert.equal(
    extractMermaidFencedSource(fencedSource),
    'sequenceDiagram\n    A->>B: 요청'
  );
  assert.equal(normalizeMermaidSource(rawSource), 'flowchart LR\n    A --> B');
  assert.equal(extractMermaidFencedSource('```javascript\nalert(1)\n```'), null);
});

test('Mermaid code blocks accept language metadata or a complete fenced source', () => {
  const rawSource = 'flowchart LR\n    A --> B';
  const fencedSource = `\`\`\`mermaid\n${rawSource}\n\`\`\``;

  assert.equal(resolveMermaidCodeBlockSource('mermaid', rawSource), rawSource);
  assert.equal(resolveMermaidCodeBlockSource('plaintext', fencedSource), rawSource);
  assert.equal(resolveMermaidCodeBlockSource('markdown', rawSource), null);
});
