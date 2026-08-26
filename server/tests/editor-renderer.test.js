import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseHtmlToContentJson, renderContentJsonToHtml } from '../utils/contentRenderer.js';

const readProjectFile = (path) => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');

test('frontend editor config and server renderer keep core extensions aligned', async () => {
  const [frontendConfig, serverRenderer] = await Promise.all([
    readProjectFile('src/editor/editorConfig.ts'),
    readProjectFile('server/utils/contentRenderer.js')
  ]);
  const sharedExtensionNames = [
    'StarterKit',
    'CodeBlockLowlight',
    'TextStyle',
    'Color',
    'Highlight',
    'FontSize',
    'Underline',
    'LinkExtension',
    'TextAlign',
    'Table',
    'TableRow',
    'TableHeader',
    'TableCell',
    'MathExtension',
    'MermaidExtension',
    'Typography',
    'ImageGallery',
    'Youtube',
    'LinkCard',
    'Columns',
    'Column',
    'CustomImage'
  ];

  for (const extensionName of sharedExtensionNames) {
    assert.match(
      frontendConfig,
      new RegExp(`\\b${extensionName}\\b`),
      `frontend editor config should register ${extensionName}`
    );
    assert.match(
      serverRenderer,
      new RegExp(`\\b${extensionName}\\b`),
      `server content renderer should register ${extensionName}`
    );
  }
});

test('server renderer handles rich editor custom nodes used by the frontend', () => {
  const contentJson = {
    type: 'doc',
    content: [
      {
        type: 'heading',
        attrs: { level: 2 },
        content: [{ type: 'text', text: 'Renderer contract' }]
      },
      {
        type: 'paragraph',
        content: [
          { type: 'text', text: 'Inline math ' },
          {
            type: 'math',
            attrs: { latex: 'x^2' }
          }
        ]
      },
      {
        type: 'image',
        attrs: {
          src: '/uploads/example.png',
          alt: 'example',
          title: null,
          size: 'full',
          dataWidth: null,
          width: null,
          style: null,
          caption: 'Example caption'
        }
      },
      {
        type: 'mermaid',
        attrs: {
          source: 'flowchart TD\n    A[Start] --> B{Done?}'
        }
      },
      {
        type: 'columns',
        attrs: { layout: 'two-column' },
        content: [
          {
            type: 'column',
            content: [
              {
                type: 'paragraph',
                content: [{ type: 'text', text: 'Left column' }]
              }
            ]
          },
          {
            type: 'column',
            content: [
              {
                type: 'paragraph',
                content: [{ type: 'text', text: 'Right column' }]
              }
            ]
          }
        ]
      },
      {
        type: 'linkCard',
        attrs: {
          url: 'https://example.com',
          title: 'Example',
          description: 'Example description',
          image: '',
          domain: 'example.com'
        }
      }
    ]
  };

  const html = renderContentJsonToHtml(contentJson);

  assert.match(html, /<h2>Renderer contract<\/h2>/);
  assert.match(html, /data-type="math"/);
  assert.match(html, /data-latex="x\^2"/);
  assert.match(html, /data-type="mermaid"/);
  assert.match(html, /class="language-mermaid"/);
  assert.match(html, /A\[Start\] --&gt; B\{Done\?\}/);
  assert.match(html, /<figure class="post-image local-image">/);
  assert.match(html, /<figcaption>Example caption<\/figcaption>/);
  assert.match(html, /data-type="columns"/);
  assert.match(html, /data-layout="two-column"/);
  assert.match(html, /data-type="column"/);
  assert.match(html, /<link-card/);
  assert.match(html, /url="https:\/\/example.com"/);

  const parsed = parseHtmlToContentJson(html);
  const mermaidNode = parsed.content?.find(node => node.type === 'mermaid');
  assert.equal(mermaidNode?.attrs?.source, 'flowchart TD\n    A[Start] --> B{Done?}');
});

test('image width and caption survive editor JSON and HTML round trips', () => {
  const contentJson = {
    type: 'doc',
    content: [
      {
        type: 'image',
        attrs: {
          src: '/uploads/resizable.png',
          alt: '크기 조절 이미지',
          title: null,
          size: 'custom',
          dataWidth: '63%',
          width: null,
          style: null,
          caption: '크기 조절 캡션'
        }
      },
      {
        type: 'image',
        attrs: {
          src: '/uploads/resizable-without-caption.png',
          alt: '캡션 없는 크기 조절 이미지',
          title: null,
          size: 'custom',
          dataWidth: '47%',
          width: null,
          style: null,
          caption: null
        }
      },
      {
        type: 'columns',
        attrs: { layout: 'two-column' },
        content: [
          {
            type: 'column',
            content: [{
              type: 'image',
              attrs: {
                src: '/uploads/column-a.png',
                alt: '열 이미지 A',
                size: 'custom',
                dataWidth: '63%',
                caption: '열 캡션 A'
              }
            }]
          },
          {
            type: 'column',
            content: [{
              type: 'image',
              attrs: {
                src: '/uploads/column-b.png',
                alt: '열 이미지 B',
                size: 'full',
                dataWidth: null,
                caption: '열 캡션 B'
              }
            }]
          }
        ]
      }
    ]
  };

  const html = renderContentJsonToHtml(contentJson);
  assert.match(html, /<figure class="post-image local-image" data-width="63%">/);
  assert.match(html, /<img[^>]+data-size="custom"/);
  assert.doesNotMatch(html, /<img[^>]+data-width="63%"/);
  assert.match(html, /<img src="\/uploads\/resizable-without-caption\.png"[^>]+data-width="47%"/);

  const parsed = parseHtmlToContentJson(html);
  const imageNodes = parsed.content?.filter(node => node.type === 'image') ?? [];
  const imageNode = imageNodes.find(node => node.attrs?.src === '/uploads/resizable.png');
  assert.equal(imageNode?.attrs?.src, '/uploads/resizable.png');
  assert.equal(imageNode?.attrs?.alt, '크기 조절 이미지');
  assert.equal(imageNode?.attrs?.dataWidth, '63%');
  assert.equal(imageNode?.attrs?.caption, '크기 조절 캡션');
  const imageWithoutCaption = imageNodes.find(
    node => node.attrs?.src === '/uploads/resizable-without-caption.png'
  );
  assert.equal(imageWithoutCaption?.attrs?.dataWidth, '47%');
  assert.equal(imageWithoutCaption?.attrs?.caption, null);
  assert.deepEqual(parsed.content?.map(node => node.type), ['image', 'image', 'columns']);
  const parsedColumns = parsed.content?.find(node => node.type === 'columns');
  assert.deepEqual(
    parsedColumns?.content?.map(columnNode => columnNode.content?.map(node => node.type)),
    [['image'], ['image']]
  );
  assert.deepEqual(
    parsedColumns?.content?.map(columnNode => columnNode.content?.[0]?.attrs?.caption),
    ['열 캡션 A', '열 캡션 B']
  );
});
