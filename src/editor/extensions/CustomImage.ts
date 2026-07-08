import Image from '@tiptap/extension-image';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { ImageComponent } from '../../components/editor/extensions/ImageComponent';

export const CustomImage = Image.extend({
    addAttributes() {
        return {
            ...this.parent?.(),
            size: {
                default: 'full',
                parseHTML: element => element.getAttribute('data-size') || 'full',
                renderHTML: attributes => ({
                    'data-size': attributes.size
                })
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
                renderHTML: attributes =>
                    attributes.width ? { width: attributes.width } : {}
            },
            style: {
                default: null,
                parseHTML: element => element.getAttribute('style'),
                renderHTML: attributes =>
                    attributes.style ? { style: attributes.style } : {}
            },
            caption: {
                default: null,
                parseHTML: element => element.querySelector('figcaption')?.innerText || element.getAttribute('data-caption'),
                renderHTML: attributes => {
                    if (!attributes.caption) return {};
                    return { 'data-caption': attributes.caption };
                }
            }
        };
    },
    renderHTML({ node, HTMLAttributes }) {
        const { caption } = node.attrs;

        // This is for Tiptap's output (saving to HTML)
        // We render a figure with caption if it exists
        if (caption) {
            return [
                'figure',
                { class: 'post-image local-image' },
                ['img', HTMLAttributes],
                ['figcaption', {}, caption]
            ];
        }
        return ['img', HTMLAttributes];
    },
    addNodeView() {
        return ReactNodeViewRenderer(ImageComponent);
    }
});
