import Image from '@tiptap/extension-image';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { ImageComponent } from '../../components/editor/extensions/ImageComponent';

const getElementTagName = (element: HTMLElement) => element.tagName.toLowerCase();

const getImageElement = (element: HTMLElement) => (
    getElementTagName(element) === 'figure'
        ? element.querySelector<HTMLImageElement>('img[src]')
        : element
);

const getOwningFigure = (element: HTMLElement) => {
    if (getElementTagName(element) === 'figure') return element;
    const parent = element.parentElement || element.parentNode;
    if (!(parent instanceof HTMLElement) || parent.tagName.toLowerCase() !== 'figure') return null;
    return parent;
};

const getImageDisplayWidth = (attributes: Record<string, unknown>) => {
    const candidate = String(attributes.dataWidth || attributes['data-width'] || attributes.width || '').trim();
    const match = candidate.match(/^(\d+(?:\.\d+)?)%$/);
    if (!match) return '';
    const percentage = Math.round(Number(match[1]));
    if (percentage < 25 || percentage > 100) return '';
    return `${percentage}%`;
};

const withImageDisplayWidth = (attributes: Record<string, unknown>) => {
    const displayWidth = getImageDisplayWidth(attributes);
    if (!displayWidth) return attributes;

    const imageAttributes = { ...attributes };
    delete imageAttributes.width;
    imageAttributes['data-size'] = 'custom';
    imageAttributes['data-width'] = displayWidth;
    imageAttributes.style = `width: ${displayWidth}; height: auto`;
    return imageAttributes;
};

export const CustomImage = Image.extend({
    draggable: false,
    addAttributes() {
        return {
            ...this.parent?.(),
            size: {
                default: 'full',
                parseHTML: element => getImageElement(element)?.getAttribute('data-size') || 'full',
                renderHTML: attributes => ({
                    'data-size': attributes.size
                })
            },
            dataWidth: {
                default: null,
                parseHTML: element => (
                    getImageElement(element)?.getAttribute('data-width')
                    || getOwningFigure(element)?.getAttribute('data-width')
                ),
                renderHTML: attributes =>
                    attributes.dataWidth ? { 'data-width': attributes.dataWidth } : {}
            },
            width: {
                default: null,
                parseHTML: element => getImageElement(element)?.getAttribute('width'),
                renderHTML: attributes =>
                    attributes.width ? { width: attributes.width } : {}
            },
            style: {
                default: null,
                parseHTML: element => getImageElement(element)?.getAttribute('style'),
                renderHTML: attributes =>
                    attributes.style ? { style: attributes.style } : {}
            },
            caption: {
                default: null,
                parseHTML: element => (
                    getOwningFigure(element)?.querySelector('figcaption')?.textContent
                    || getImageElement(element)?.getAttribute('data-caption')
                ),
                renderHTML: attributes => {
                    if (!attributes.caption) return {};
                    return { 'data-caption': attributes.caption };
                }
            }
        };
    },
    parseHTML() {
        const imageSelector = this.options.allowBase64
            ? 'img[src]'
            : 'img[src]:not([src^="data:"])';
        return [
            {
                tag: 'figure',
                getAttrs: element => {
                    const image = element.querySelector<HTMLImageElement>('img[src]');
                    const source = image?.getAttribute('src') || '';
                    if (!image || (!this.options.allowBase64 && source.startsWith('data:'))) return false;
                    return {
                        src: source,
                        alt: image.getAttribute('alt'),
                        title: image.getAttribute('title')
                    };
                }
            },
            { tag: imageSelector }
        ];
    },
    renderHTML({ node, HTMLAttributes }) {
        const { caption } = node.attrs;
        const imageAttributes = withImageDisplayWidth(HTMLAttributes);
        const displayWidth = getImageDisplayWidth(imageAttributes);

        // This is for Tiptap's output (saving to HTML)
        // We render a figure with caption if it exists
        if (caption) {
            const captionImageAttributes = { ...imageAttributes };
            delete captionImageAttributes['data-width'];
            delete captionImageAttributes.style;
            return [
                'figure',
                {
                    class: 'post-image local-image',
                    ...(displayWidth ? { 'data-width': displayWidth } : {})
                },
                ['img', captionImageAttributes],
                ['figcaption', {}, caption]
            ];
        }
        return ['img', imageAttributes];
    },
    addNodeView() {
        return ReactNodeViewRenderer(ImageComponent);
    }
});
