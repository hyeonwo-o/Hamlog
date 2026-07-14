import { mergeAttributes, Node, nodeInputRule } from '@tiptap/core';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { promptForText } from '../../../utils/editorDialog';

export const MathExtension = Node.create({
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
                renderHTML: attributes => {
                    return {
                        'data-latex': attributes.latex,
                    };
                },
            },
        };
    },

    parseHTML() {
        return [
            {
                tag: 'span[data-type="math"]',
            },
        ];
    },

    renderHTML({ node, HTMLAttributes }) {
        return ['span', mergeAttributes(HTMLAttributes, { 'data-type': 'math' }), ['span', { class: 'math-render' }], ['span', { class: 'math-src' }, node.attrs.latex]];
    },

    addInputRules() {
        return [
            nodeInputRule({
                find: /(?:^|\s)\$(.+?)\$$/,
                type: this.type,
                getAttributes: match => {
                    return {
                        latex: match[1],
                    };
                },
            }),
        ];
    },

    addNodeView() {
        return ({ node, editor, getPos }) => {
            let currentNode = node;
            const dom = document.createElement('span');
            dom.classList.add('math-node');
            dom.tabIndex = 0;
            dom.setAttribute('role', 'button');
            dom.setAttribute('aria-label', '수식 편집');
            dom.title = '더블 클릭하거나 Enter를 눌러 수식을 편집하세요.';

            const renderSpan = document.createElement('span');
            renderSpan.classList.add('math-render');

            const renderMath = () => {
                try {
                    katex.render(currentNode.attrs.latex || 'x', renderSpan, {
                        throwOnError: false,
                        output: 'html'
                    });
                } catch {
                    renderSpan.innerText = 'Error';
                }
            };

            const editMath = async () => {
                const latex = await promptForText({
                    title: 'LaTeX 수식 편집',
                    defaultValue: currentNode.attrs.latex || 'x'
                });
                if (latex === null || typeof getPos !== 'function') return;
                const position = getPos();
                if (typeof position !== 'number') return;
                editor
                    .chain()
                    .focus()
                    .setNodeSelection(position)
                    .updateAttributes('math', { latex: latex.trim() || 'x' })
                    .run();
            };

            const handleDoubleClick = () => void editMath();
            const handleKeyDown = (event: KeyboardEvent) => {
                if (!['Enter', ' '].includes(event.key)) return;
                event.preventDefault();
                void editMath();
            };

            renderMath();

            dom.appendChild(renderSpan);
            dom.addEventListener('dblclick', handleDoubleClick);
            dom.addEventListener('keydown', handleKeyDown);

            return {
                dom,
                update: updatedNode => {
                    if (updatedNode.type !== currentNode.type) return false;
                    currentNode = updatedNode;
                    renderMath();
                    return true;
                },
                selectNode: () => {
                    dom.classList.add('ProseMirror-selectednode');
                },
                deselectNode: () => {
                    dom.classList.remove('ProseMirror-selectednode');
                },
                destroy: () => {
                    dom.removeEventListener('dblclick', handleDoubleClick);
                    dom.removeEventListener('keydown', handleKeyDown);
                }
            }
        }
    }
});
