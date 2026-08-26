import { Node, mergeAttributes } from '@tiptap/core';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { closeHistory } from '@tiptap/pm/history';
import { Selection } from '@tiptap/pm/state';

declare module '@tiptap/core' {
    interface Commands<ReturnType> {
        columns: {
            setColumnsLayout: (layout: 'two-column' | 'three-column') => ReturnType;
            moveColumnLeft: () => ReturnType;
            moveColumnRight: () => ReturnType;
            unsetColumns: () => ReturnType;
        };
    }
}

export const Columns = Node.create({
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
                renderHTML: attributes => ({ 'data-layout': attributes.layout }),
            },
        };
    },

    addCommands() {
        return {
            setColumnsLayout: (layout: 'two-column' | 'three-column') => ({ state, dispatch }) => {
                const { selection } = state;
                const { $from } = selection;

                // Find the parent `columns` node position
                let columnsPos = -1;
                let columns = null;

                // Traverse up
                for (let d = $from.depth; d > 0; d--) {
                    const node = $from.node(d);
                    if (node.type.name === 'columns') {
                        columns = node;
                        columnsPos = $from.before(d);
                        break;
                    }
                }

                if (!columns || columnsPos === -1) return false;

                if (dispatch) {
                    const currentLayout = columns.attrs.layout;
                    if (currentLayout === layout) return true;

                    // Execute logic
                    const tr = state.tr;

                    // Update attribute first
                    tr.setNodeMarkup(columnsPos, undefined, { ...columns.attrs, layout });

                    // Check children
                    const childCount = columns.childCount;

                    if (layout === 'three-column' && childCount < 3) {
                        // Add columns
                        const needed = 3 - childCount;
                        const nodes = [];
                        for (let i = 0; i < needed; i++) {
                            const node = state.schema.nodes.column.createAndFill();
                            if (node) nodes.push(node);
                        }
                        if (nodes.length > 0) {
                            tr.insert(columnsPos + columns.nodeSize - 1, nodes);
                        }
                    } else if (layout === 'two-column' && childCount > 2) {
                        const firstColumn = columns.child(0);
                        const secondColumn = columns.child(1);
                        let mergedContent = secondColumn.content;
                        for (let index = 2; index < childCount; index += 1) {
                            mergedContent = mergedContent.append(columns.child(index).content);
                        }
                        const mergedSecondColumn = secondColumn.copy(mergedContent);
                        const replacement = columns.type.create(
                            { ...columns.attrs, layout: 'two-column' },
                            [firstColumn, mergedSecondColumn]
                        );
                        tr.replaceWith(columnsPos, columnsPos + columns.nodeSize, replacement);
                    }

                    dispatch(closeHistory(tr));
                }
                return true;
            },
            moveColumnLeft: () => ({ state, dispatch }) => {
                const { selection } = state;
                const { $from } = selection;

                let columnIndex = -1;
                let columnsPos = -1;
                let columnsNode = null;

                // Find 'column' and 'columns'
                for (let d = $from.depth; d > 0; d--) {
                    const node = $from.node(d);
                    if (node.type.name === 'column') {
                        // Parent should be columns
                        const parent = $from.node(d - 1);
                        if (parent && parent.type.name === 'columns') {
                            columnsNode = parent;
                            columnsPos = $from.before(d - 1);
                            columnIndex = $from.index(d - 1);
                        }
                        break;
                    }
                }

                if (columnIndex <= 0 || !columnsNode) return false;

                if (dispatch) {
                    const columns = Array.from(
                        { length: columnsNode.childCount },
                        (_, index) => columnsNode.child(index)
                    );
                    const [columnNode] = columns.splice(columnIndex, 1);
                    const nextIndex = columnIndex - 1;
                    columns.splice(nextIndex, 0, columnNode);
                    const replacement = columnsNode.type.create(columnsNode.attrs, columns);
                    const tr = state.tr.replaceWith(
                        columnsPos,
                        columnsPos + columnsNode.nodeSize,
                        replacement
                    );
                    let nextColumnPos = columnsPos + 1;
                    for (let index = 0; index < nextIndex; index += 1) {
                        nextColumnPos += columns[index].nodeSize;
                    }
                    tr.setSelection(Selection.near(tr.doc.resolve(nextColumnPos + 1), 1));
                    dispatch(closeHistory(tr));
                }
                return true;
            },
            moveColumnRight: () => ({ state, dispatch }) => {
                const { selection } = state;
                const { $from } = selection;

                let columnIndex = -1;
                let columnsPos = -1;
                let columnsNode = null;

                // Find 'column' and 'columns'
                for (let d = $from.depth; d > 0; d--) {
                    const node = $from.node(d);
                    if (node.type.name === 'column') {
                        const parent = $from.node(d - 1);
                        if (parent && parent.type.name === 'columns') {
                            columnsNode = parent;
                            columnsPos = $from.before(d - 1);
                            columnIndex = $from.index(d - 1);
                        }
                        break;
                    }
                }

                if (!columnsNode || columnIndex === -1 || columnIndex >= columnsNode.childCount - 1) return false;

                if (dispatch) {
                    const columns = Array.from(
                        { length: columnsNode.childCount },
                        (_, index) => columnsNode.child(index)
                    );
                    const [columnNode] = columns.splice(columnIndex, 1);
                    const nextIndex = columnIndex + 1;
                    columns.splice(nextIndex, 0, columnNode);
                    const replacement = columnsNode.type.create(columnsNode.attrs, columns);
                    const tr = state.tr.replaceWith(
                        columnsPos,
                        columnsPos + columnsNode.nodeSize,
                        replacement
                    );
                    let nextColumnPos = columnsPos + 1;
                    for (let index = 0; index < nextIndex; index += 1) {
                        nextColumnPos += columns[index].nodeSize;
                    }
                    tr.setSelection(Selection.near(tr.doc.resolve(nextColumnPos + 1), 1));
                    dispatch(closeHistory(tr));
                }
                return true;
            },
            unsetColumns: () => ({ state, dispatch }) => {
                const { $from } = state.selection;
                let columnsPos = -1;
                let columnsNode = null;

                for (let depth = $from.depth; depth > 0; depth -= 1) {
                    const node = $from.node(depth);
                    if (node.type.name !== 'columns') continue;
                    columnsNode = node;
                    columnsPos = $from.before(depth);
                    break;
                }

                if (!columnsNode || columnsPos < 0) return false;
                if (dispatch) {
                    const blocks: ProseMirrorNode[] = [];
                    columnsNode.forEach(column => {
                        column.forEach(block => blocks.push(block));
                    });
                    if (blocks.length === 0) return false;
                    const tr = state.tr.replaceWith(
                        columnsPos,
                        columnsPos + columnsNode.nodeSize,
                        blocks
                    );
                    const selectionPos = Math.min(columnsPos + 1, tr.doc.content.size);
                    tr.setSelection(Selection.near(tr.doc.resolve(selectionPos), 1));
                    dispatch(closeHistory(tr));
                }
                return true;
            }
        };
    },

    parseHTML() {
        return [
            {
                tag: 'div[data-type="columns"]',
            },
        ];
    },

    renderHTML({ HTMLAttributes }) {
        return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'columns', class: 'flex gap-4 my-4 flex-col sm:flex-row' }), 0];
    },
});

export const Column = Node.create({
    name: 'column',
    content: 'block+',
    isolating: true,
    defining: true,

    parseHTML() {
        return [
            {
                tag: 'div[data-type="column"]',
            },
        ];
    },

    renderHTML({ HTMLAttributes }) {
        return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'column', class: 'flex-1 min-w-0' }), 0];
    },
});
