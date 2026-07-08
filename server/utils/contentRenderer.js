import { Extension, Node, mergeAttributes } from '@tiptap/core';
import { generateHTML, generateJSON } from '@tiptap/html';
import StarterKit from '@tiptap/starter-kit';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import Color from '@tiptap/extension-color';
import FontFamily from '@tiptap/extension-font-family';
import Highlight from '@tiptap/extension-highlight';
import Underline from '@tiptap/extension-underline';
import LinkExtension from '@tiptap/extension-link';
import Youtube from '@tiptap/extension-youtube';
import Table from '@tiptap/extension-table';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import TableRow from '@tiptap/extension-table-row';
import TextStyle from '@tiptap/extension-text-style';
import TextAlign from '@tiptap/extension-text-align';
import Typography from '@tiptap/extension-typography';
import Image from '@tiptap/extension-image';
import { createLowlight, common } from 'lowlight';

const FontSize = Extension.create({
    name: 'fontSize',
    addGlobalAttributes() {
        return [
            {
                types: ['textStyle'],
                attributes: {
                    fontSize: {
                        default: null,
                        parseHTML: element => element.style.fontSize?.replace(/['"]/g, ''),
                        renderHTML: attributes =>
                            attributes.fontSize ? { style: `font-size: ${attributes.fontSize}` } : {}
                    }
                }
            }
        ];
    }
});

const CustomImage = Image.extend({
    addAttributes() {
        return {
            ...this.parent?.(),
            size: {
                default: 'full',
                parseHTML: element => element.getAttribute('data-size') || 'full',
                renderHTML: attributes => ({ 'data-size': attributes.size })
            },
            dataWidth: {
                default: null,
                parseHTML: element => element.getAttribute('data-width'),
                renderHTML: attributes =>
                    attributes.dataWidth ? { 'data-width': attributes.dataWidth } : {}
            },
            width: {
                default: null,
                parseHTML: element => element.getAttribute('width'),
                renderHTML: attributes => (attributes.width ? { width: attributes.width } : {})
            },
            style: {
                default: null,
                parseHTML: element => element.getAttribute('style'),
                renderHTML: attributes => (attributes.style ? { style: attributes.style } : {})
            },
            caption: {
                default: null,
                parseHTML: element =>
                    element.querySelector('figcaption')?.innerText || element.getAttribute('data-caption'),
                renderHTML: attributes => {
                    if (!attributes.caption) return {};
                    return { 'data-caption': attributes.caption };
                }
            }
        };
    },
    renderHTML({ node, HTMLAttributes }) {
        const { caption } = node.attrs;
        if (caption) {
            return [
                'figure',
                { class: 'post-image local-image' },
                ['img', HTMLAttributes],
                ['figcaption', {}, caption]
            ];
        }
        return ['img', HTMLAttributes];
    }
});

const LinkCard = Node.create({
    name: 'linkCard',
    group: 'block',
    atom: true,

    addAttributes() {
        return {
            url: { default: '' },
            title: { default: '' },
            description: { default: '' },
            image: { default: '' },
            domain: { default: '' }
        };
    },

    parseHTML() {
        return [{ tag: 'link-card' }];
    },

    renderHTML({ HTMLAttributes }) {
        return ['link-card', mergeAttributes(HTMLAttributes)];
    }
});

const Columns = Node.create({
    name: 'columns',
    group: 'block',
    content: 'column+',
    isolating: true,
    defining: true,

    addAttributes() {
        return {
            layout: {
                default: 'two-column',
                parseHTML: element => element.getAttribute('data-layout'),
                renderHTML: attributes => ({ 'data-layout': attributes.layout })
            }
        };
    },

    parseHTML() {
        return [{ tag: 'div[data-type="columns"]' }];
    },

    renderHTML({ HTMLAttributes }) {
        return [
            'div',
            mergeAttributes(HTMLAttributes, {
                'data-type': 'columns',
                class: 'flex gap-4 my-4 flex-col sm:flex-row'
            }),
            0
        ];
    }
});

const Column = Node.create({
    name: 'column',
    content: 'block+',
    isolating: true,
    defining: true,

    parseHTML() {
        return [{ tag: 'div[data-type="column"]' }];
    },

    renderHTML({ HTMLAttributes }) {
        return [
            'div',
            mergeAttributes(HTMLAttributes, {
                'data-type': 'column',
                class: 'flex-1 min-w-0'
            }),
            0
        ];
    }
});

const MathExtension = Node.create({
    name: 'math',
    group: 'inline math',
    content: 'text*',
    inline: true,
    atom: true,

    addAttributes() {
        return {
            latex: {
                default: 'x',
                parseHTML: element => element.getAttribute('data-latex'),
                renderHTML: attributes => ({ 'data-latex': attributes.latex })
            }
        };
    },

    parseHTML() {
        return [{ tag: 'span[data-type="math"]' }];
    },

    renderHTML({ node, HTMLAttributes }) {
        return [
            'span',
            mergeAttributes(HTMLAttributes, { 'data-type': 'math' }),
            ['span', { class: 'math-render' }],
            ['span', { class: 'math-src' }, node.attrs.latex]
        ];
    }
});

const ImageGallery = Node.create({
    name: 'imageGallery',
    group: 'block',
    content: 'image+',
    draggable: true,

    addAttributes() {
        return {
            columns: {
                default: 2,
                renderHTML: attributes => ({ 'data-columns': attributes.columns }),
                parseHTML: element => Number.parseInt(element.getAttribute('data-columns') || '2', 10)
            }
        };
    },

    parseHTML() {
        return [{ tag: 'div[class="image-gallery"]' }];
    },

    renderHTML({ HTMLAttributes }) {
        return ['div', mergeAttributes(HTMLAttributes, { class: 'image-gallery' }), 0];
    }
});

const lowlight = createLowlight(common);

const htmlRendererExtensions = [
    StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        codeBlock: false
    }),
    CodeBlockLowlight.configure({ lowlight }),
    TextStyle,
    Color,
    Highlight.configure({ multicolor: true }),
    FontFamily,
    FontSize,
    Underline,
    LinkExtension.configure({ openOnClick: false }),
    CustomImage,
    TextAlign.configure({ types: ['heading', 'paragraph'] }),
    Table.configure({ resizable: true }),
    TableRow,
    TableHeader,
    TableCell,
    MathExtension,
    Typography,
    ImageGallery,
    Youtube.configure({ controls: false }),
    LinkCard,
    Columns,
    Column
];

export function renderContentJsonToHtml(contentJson) {
    if (!contentJson || typeof contentJson !== 'object') {
        return '';
    }

    return generateHTML(contentJson, htmlRendererExtensions).trim();
}

export function parseHtmlToContentJson(contentHtml) {
    if (!contentHtml || !String(contentHtml).trim()) {
        return undefined;
    }

    return generateJSON(String(contentHtml), htmlRendererExtensions);
}
