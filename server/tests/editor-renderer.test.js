import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { renderContentJsonToHtml } from '../utils/contentRenderer.js';

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
  assert.match(html, /<figure class="post-image local-image">/);
  assert.match(html, /<figcaption>Example caption<\/figcaption>/);
  assert.match(html, /data-type="columns"/);
  assert.match(html, /data-layout="two-column"/);
  assert.match(html, /data-type="column"/);
  assert.match(html, /<link-card/);
  assert.match(html, /url="https:\/\/example.com"/);
});
