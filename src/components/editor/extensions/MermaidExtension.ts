import { mergeAttributes, Node } from '@tiptap/core';
import { promptForText } from '../../../utils/editorDialog';
import { DEFAULT_MERMAID_SOURCE, renderMermaidToSvg } from '../../../utils/mermaid';

const readMermaidSource = (element: HTMLElement) => (
  element.querySelector('code')?.textContent
  || element.getAttribute('data-source')
  || DEFAULT_MERMAID_SOURCE
);

export const MermaidExtension = Node.create({
  name: 'mermaid',

  group: 'block',

  atom: true,

  draggable: true,

  isolating: true,

  addAttributes() {
    return {
      source: {
        default: DEFAULT_MERMAID_SOURCE,
        parseHTML: readMermaidSource,
        renderHTML: () => ({})
      }
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="mermaid"]' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, { 'data-type': 'mermaid' }),
      ['pre', { class: 'mermaid-source' }, ['code', { class: 'language-mermaid' }, node.attrs.source]]
    ];
  },

  addNodeView() {
    return ({ node, editor, getPos }) => {
      let currentNode = node;
      let renderVersion = 0;
      let destroyed = false;

      const dom = document.createElement('div');
      dom.classList.add('mermaid-node');
      dom.setAttribute('data-type', 'mermaid');
      dom.setAttribute('title', '더블 클릭하면 Mermaid 소스를 편집할 수 있습니다.');

      const header = document.createElement('div');
      header.classList.add('mermaid-node__header');
      header.contentEditable = 'false';

      const label = document.createElement('span');
      label.textContent = 'Mermaid';

      const editButton = document.createElement('button');
      editButton.type = 'button';
      editButton.textContent = '소스 편집';
      editButton.setAttribute('aria-label', 'Mermaid 소스 편집');
      editButton.contentEditable = 'false';

      const preview = document.createElement('div');
      preview.classList.add('mermaid-render');
      preview.contentEditable = 'false';
      preview.setAttribute('aria-live', 'polite');

      header.append(label, editButton);
      dom.append(header, preview);

      const renderDiagram = async () => {
        const version = ++renderVersion;
        preview.classList.remove('mermaid-render--error');
        preview.textContent = '다이어그램을 렌더링하는 중...';

        try {
          const svg = await renderMermaidToSvg(String(currentNode.attrs.source || ''));
          if (destroyed || version !== renderVersion) return;
          preview.innerHTML = svg;
        } catch (error) {
          if (destroyed || version !== renderVersion) return;
          preview.classList.add('mermaid-render--error');
          preview.textContent = error instanceof Error
            ? `Mermaid 오류: ${error.message}`
            : 'Mermaid 다이어그램을 렌더링하지 못했습니다.';
        }
      };

      const editMermaid = async () => {
        const source = await promptForText({
          title: 'Mermaid 다이어그램 편집',
          description: 'Mermaid 문법을 입력하세요. Ctrl/Cmd + Enter로 적용할 수 있습니다.',
          defaultValue: String(currentNode.attrs.source || DEFAULT_MERMAID_SOURCE),
          confirmText: '적용',
          multiline: true
        });
        const normalizedSource = source?.trim();
        if (!normalizedSource || typeof getPos !== 'function') return;
        const position = getPos();
        if (typeof position !== 'number') return;

        editor
          .chain()
          .focus()
          .setNodeSelection(position)
          .updateAttributes('mermaid', { source: normalizedSource })
          .run();
      };

      const handleEditClick = () => void editMermaid();
      const handleEditMouseDown = (event: MouseEvent) => event.preventDefault();
      const handleDoubleClick = (event: MouseEvent) => {
        if (event.target === editButton) return;
        event.preventDefault();
        void editMermaid();
      };

      editButton.addEventListener('mousedown', handleEditMouseDown);
      editButton.addEventListener('click', handleEditClick);
      dom.addEventListener('dblclick', handleDoubleClick);
      void renderDiagram();

      return {
        dom,
        update: updatedNode => {
          if (updatedNode.type !== currentNode.type) return false;
          currentNode = updatedNode;
          void renderDiagram();
          return true;
        },
        selectNode: () => dom.classList.add('ProseMirror-selectednode'),
        deselectNode: () => dom.classList.remove('ProseMirror-selectednode'),
        stopEvent: event => event.target === editButton,
        ignoreMutation: () => true,
        destroy: () => {
          destroyed = true;
          renderVersion += 1;
          editButton.removeEventListener('mousedown', handleEditMouseDown);
          editButton.removeEventListener('click', handleEditClick);
          dom.removeEventListener('dblclick', handleDoubleClick);
        }
      };
    };
  }
});
