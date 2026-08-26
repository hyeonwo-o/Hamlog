import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { closeHistory } from '@tiptap/pm/history';
import { NodeSelection, type EditorState, type Transaction } from '@tiptap/pm/state';
import type { Editor } from '@tiptap/react';
import type { DropSide } from './dragDropUtils';

export const MAX_IMAGE_LAYOUT_COLUMNS = 3;

export interface ImageLayoutContext {
  imageNode: ProseMirrorNode;
  imagePos: number;
  columnNode: ProseMirrorNode | null;
  columnPos: number | null;
  columnIndex: number;
  columnsNode: ProseMirrorNode | null;
  columnsPos: number | null;
  insideImageGallery: boolean;
  autoLayoutEligible: boolean;
  imageOnlyColumn: boolean;
}

export interface ImageLayoutControlState {
  inLayout: boolean;
  canMoveLeft: boolean;
  canMoveRight: boolean;
  previousImagePos: number | null;
  nextImagePos: number | null;
}

const childNodes = (node: ProseMirrorNode) => (
  Array.from({ length: node.childCount }, (_, index) => node.child(index))
);

const createColumnsNode = (
  state: EditorState,
  columns: ProseMirrorNode[],
  previousAttributes: Record<string, unknown> = {}
) => state.schema.nodes.columns.create(
  {
    ...previousAttributes,
    layout: columns.length >= 3 ? 'three-column' : 'two-column'
  },
  columns
);

const createImageColumn = (state: EditorState, imageNode: ProseMirrorNode) => (
  state.schema.nodes.column.create(null, [imageNode])
);

const dispatchLayoutTransaction = (
  editor: Editor,
  tr: Transaction,
  selectedImage: ProseMirrorNode
) => {
  let selectedPos: number | null = null;
  tr.doc.descendants((node, pos) => {
    if (selectedPos === null && node === selectedImage) selectedPos = pos;
    return selectedPos === null;
  });
  if (selectedPos !== null && NodeSelection.isSelectable(selectedImage)) {
    tr.setSelection(NodeSelection.create(tr.doc, selectedPos));
  }
  editor.view.dispatch(closeHistory(tr).scrollIntoView());
};

export const resolveImageLayoutContext = (
  doc: ProseMirrorNode,
  imagePos: number
): ImageLayoutContext | null => {
  if (!Number.isInteger(imagePos) || imagePos < 0 || imagePos > doc.content.size) return null;
  const imageNode = doc.nodeAt(imagePos);
  if (!imageNode || imageNode.type.name !== 'image') return null;

  const $pos = doc.resolve(imagePos);
  let columnNode: ProseMirrorNode | null = null;
  let columnPos: number | null = null;
  let columnIndex = -1;
  let columnsNode: ProseMirrorNode | null = null;
  let columnsPos: number | null = null;
  let insideImageGallery = false;

  for (let depth = $pos.depth; depth > 0; depth -= 1) {
    const ancestor = $pos.node(depth);
    if (ancestor.type.name === 'imageGallery') {
      insideImageGallery = true;
    }
    if (ancestor.type.name !== 'column') continue;

    const parent = $pos.node(depth - 1);
    if (parent.type.name !== 'columns') continue;
    columnNode = ancestor;
    columnPos = $pos.before(depth);
    columnIndex = $pos.index(depth - 1);
    columnsNode = parent;
    columnsPos = $pos.before(depth - 1);
    break;
  }

  return {
    imageNode,
    imagePos,
    columnNode,
    columnPos,
    columnIndex,
    columnsNode,
    columnsPos,
    insideImageGallery,
    autoLayoutEligible: $pos.parent.type.name === 'doc'
      || Boolean(columnNode && $pos.parent === columnNode),
    imageOnlyColumn: Boolean(
      columnNode
      && columnNode.childCount === 1
      && columnNode.firstChild?.type.name === 'image'
    )
  };
};

export const canPlaceImageBeside = (
  doc: ProseMirrorNode,
  sourcePos: number,
  targetPos: number
) => {
  if (sourcePos === targetPos) return false;
  const source = resolveImageLayoutContext(doc, sourcePos);
  const target = resolveImageLayoutContext(doc, targetPos);
  if (
    !source
    || !target
    || source.insideImageGallery
    || target.insideImageGallery
    || !source.autoLayoutEligible
    || !target.autoLayoutEligible
  ) return false;

  const sourceContainsTarget = source.columnsNode
    && source.columnsPos !== null
    && targetPos > source.columnsPos
    && targetPos < source.columnsPos + source.columnsNode.nodeSize;
  const targetContainsSource = target.columnsNode
    && target.columnsPos !== null
    && sourcePos > target.columnsPos
    && sourcePos < target.columnsPos + target.columnsNode.nodeSize;
  if (
    source.columnsPos !== target.columnsPos
    && (sourceContainsTarget || targetContainsSource)
  ) return false;

  if (source.columnsPos !== null && source.columnsPos === target.columnsPos) {
    return source.imageOnlyColumn && source.columnIndex !== target.columnIndex;
  }
  return !target.columnsNode || target.columnsNode.childCount < MAX_IMAGE_LAYOUT_COLUMNS;
};

const removeSourceImage = (
  state: EditorState,
  tr: Transaction,
  source: ImageLayoutContext
) => {
  if (!source.columnsNode || !source.columnNode || source.columnsPos === null) {
    tr.delete(source.imagePos, source.imagePos + source.imageNode.nodeSize);
    return;
  }

  if (source.columnNode.childCount > 1) {
    tr.delete(source.imagePos, source.imagePos + source.imageNode.nodeSize);
    return;
  }

  const remainingColumns = childNodes(source.columnsNode).filter(
    (_, index) => index !== source.columnIndex
  );
  if (remainingColumns.length === 1) {
    tr.replaceWith(
      source.columnsPos,
      source.columnsPos + source.columnsNode.nodeSize,
      remainingColumns[0].content
    );
    return;
  }
  if (remainingColumns.length === 0) {
    tr.delete(source.columnsPos, source.columnsPos + source.columnsNode.nodeSize);
    return;
  }

  const replacement = createColumnsNode(state, remainingColumns, source.columnsNode.attrs);
  tr.replaceWith(
    source.columnsPos,
    source.columnsPos + source.columnsNode.nodeSize,
    replacement
  );
};

const reorderWithinColumns = (
  state: EditorState,
  source: ImageLayoutContext,
  target: ImageLayoutContext,
  side: Exclude<DropSide, null>
) => {
  if (
    !source.columnsNode
    || source.columnsPos === null
    || source.columnsPos !== target.columnsPos
    || source.columnIndex === target.columnIndex
  ) return null;

  const columns = childNodes(source.columnsNode);
  const [sourceColumn] = columns.splice(source.columnIndex, 1);
  const targetColumn = source.columnsNode.child(target.columnIndex);
  const mappedTargetIndex = columns.indexOf(targetColumn);
  const insertIndex = side === 'left' ? mappedTargetIndex : mappedTargetIndex + 1;
  columns.splice(insertIndex, 0, sourceColumn);

  const unchanged = columns.every((column, index) => column === source.columnsNode?.child(index));
  if (unchanged) return state.tr;

  const replacement = createColumnsNode(state, columns, source.columnsNode.attrs);
  return state.tr.replaceWith(
    source.columnsPos,
    source.columnsPos + source.columnsNode.nodeSize,
    replacement
  );
};

export const createPlaceImageBesideTransaction = (
  state: EditorState,
  sourcePos: number,
  targetPos: number,
  side: Exclude<DropSide, null>
) => {
  if (!canPlaceImageBeside(state.doc, sourcePos, targetPos)) return null;
  const source = resolveImageLayoutContext(state.doc, sourcePos);
  const target = resolveImageLayoutContext(state.doc, targetPos);
  if (!source || !target) return null;

  if (source.columnsPos !== null && source.columnsPos === target.columnsPos) {
    return reorderWithinColumns(state, source, target, side);
  }

  const tr = state.tr;
  removeSourceImage(state, tr, source);
  const mappedTargetPos = tr.mapping.map(targetPos, -1);
  const mappedTarget = resolveImageLayoutContext(tr.doc, mappedTargetPos);
  if (!mappedTarget) return null;

  const sourceColumn = createImageColumn(state, source.imageNode);
  if (mappedTarget.columnsNode && mappedTarget.columnsPos !== null) {
    const columns = childNodes(mappedTarget.columnsNode);
    const insertIndex = side === 'left'
      ? mappedTarget.columnIndex
      : mappedTarget.columnIndex + 1;
    columns.splice(insertIndex, 0, sourceColumn);
    const replacement = createColumnsNode(state, columns, mappedTarget.columnsNode.attrs);
    tr.replaceWith(
      mappedTarget.columnsPos,
      mappedTarget.columnsPos + mappedTarget.columnsNode.nodeSize,
      replacement
    );
    return tr;
  }

  const targetColumn = createImageColumn(state, mappedTarget.imageNode);
  const columns = side === 'left'
    ? [sourceColumn, targetColumn]
    : [targetColumn, sourceColumn];
  const replacement = createColumnsNode(state, columns);
  tr.replaceWith(
    mappedTarget.imagePos,
    mappedTarget.imagePos + mappedTarget.imageNode.nodeSize,
    replacement
  );
  return tr;
};

export const createInsertImageBesideTransaction = (
  state: EditorState,
  targetPos: number,
  side: Exclude<DropSide, null>,
  imageNode: ProseMirrorNode
) => {
  if (imageNode.type.name !== 'image') return null;
  const target = resolveImageLayoutContext(state.doc, targetPos);
  if (!target || target.insideImageGallery || !target.autoLayoutEligible) return null;
  if (target.columnsNode && target.columnsNode.childCount >= MAX_IMAGE_LAYOUT_COLUMNS) return null;

  const sourceColumn = createImageColumn(state, imageNode);
  if (target.columnsNode && target.columnsPos !== null) {
    const columns = childNodes(target.columnsNode);
    const insertIndex = side === 'left' ? target.columnIndex : target.columnIndex + 1;
    columns.splice(insertIndex, 0, sourceColumn);
    const replacement = createColumnsNode(state, columns, target.columnsNode.attrs);
    return state.tr.replaceWith(
      target.columnsPos,
      target.columnsPos + target.columnsNode.nodeSize,
      replacement
    );
  }

  const targetColumn = createImageColumn(state, target.imageNode);
  const columns = side === 'left'
    ? [sourceColumn, targetColumn]
    : [targetColumn, sourceColumn];
  const replacement = createColumnsNode(state, columns);
  return state.tr.replaceWith(
    target.imagePos,
    target.imagePos + target.imageNode.nodeSize,
    replacement
  );
};

export const insertImageBeside = (
  editor: Editor,
  targetPos: number,
  side: Exclude<DropSide, null>,
  imageNode: ProseMirrorNode
) => {
  const tr = createInsertImageBesideTransaction(editor.state, targetPos, side, imageNode);
  if (!tr) return false;
  dispatchLayoutTransaction(editor, tr, imageNode);
  return true;
};

export const placeImageBeside = (
  editor: Editor,
  sourcePos: number,
  targetPos: number,
  side: Exclude<DropSide, null>
) => {
  const sourceImage = editor.state.doc.nodeAt(sourcePos);
  if (!sourceImage || sourceImage.type.name !== 'image') return false;
  const tr = createPlaceImageBesideTransaction(editor.state, sourcePos, targetPos, side);
  if (!tr) return false;
  dispatchLayoutTransaction(editor, tr, sourceImage);
  return true;
};

export const moveImageColumn = (
  editor: Editor,
  imagePos: number,
  direction: 'left' | 'right'
) => {
  const imageNode = editor.state.doc.nodeAt(imagePos);
  if (!imageNode || imageNode.type.name !== 'image') return false;
  const tr = createMoveImageColumnTransaction(editor.state, imagePos, direction);
  if (!tr) return false;
  dispatchLayoutTransaction(editor, tr, imageNode);
  return true;
};

export const createMoveImageColumnTransaction = (
  state: EditorState,
  imagePos: number,
  direction: 'left' | 'right'
) => {
  const context = resolveImageLayoutContext(state.doc, imagePos);
  if (!context?.columnsNode || context.columnsPos === null) return false;
  if (!context.imageOnlyColumn) return false;
  const nextIndex = direction === 'left' ? context.columnIndex - 1 : context.columnIndex + 1;
  if (nextIndex < 0 || nextIndex >= context.columnsNode.childCount) return false;

  const columns = childNodes(context.columnsNode);
  const [column] = columns.splice(context.columnIndex, 1);
  columns.splice(nextIndex, 0, column);
  const replacement = createColumnsNode(state, columns, context.columnsNode.attrs);
  return state.tr.replaceWith(
    context.columnsPos,
    context.columnsPos + context.columnsNode.nodeSize,
    replacement
  );
};

export const unwrapImageLayout = (editor: Editor, imagePos: number) => {
  const imageNode = editor.state.doc.nodeAt(imagePos);
  if (!imageNode || imageNode.type.name !== 'image') return false;
  const tr = createUnwrapImageLayoutTransaction(editor.state, imagePos);
  if (!tr) return false;
  dispatchLayoutTransaction(editor, tr, imageNode);
  return true;
};

export const createUnwrapImageLayoutTransaction = (
  state: EditorState,
  imagePos: number
) => {
  const context = resolveImageLayoutContext(state.doc, imagePos);
  if (!context?.columnsNode || context.columnsPos === null) return false;

  const blocks: ProseMirrorNode[] = [];
  context.columnsNode.forEach(column => {
    column.forEach(block => blocks.push(block));
  });
  if (blocks.length === 0) return false;

  return state.tr.replaceWith(
    context.columnsPos,
    context.columnsPos + context.columnsNode.nodeSize,
    blocks
  );
};

const findEligibleImagePositions = (doc: ProseMirrorNode) => {
  const positions: number[] = [];
  doc.descendants((node, pos) => {
    if (node.type.name !== 'image') return true;
    const context = resolveImageLayoutContext(doc, pos);
    if (context && !context.insideImageGallery) positions.push(pos);
    return false;
  });
  return positions;
};

export const getImageLayoutControlState = (
  doc: ProseMirrorNode,
  imagePos: number
): ImageLayoutControlState => {
  const context = resolveImageLayoutContext(doc, imagePos);
  if (!context || context.insideImageGallery || !context.autoLayoutEligible) {
    return {
      inLayout: false,
      canMoveLeft: false,
      canMoveRight: false,
      previousImagePos: null,
      nextImagePos: null
    };
  }

  if (context.columnsNode) {
    return {
      inLayout: true,
      canMoveLeft: context.imageOnlyColumn && context.columnIndex > 0,
      canMoveRight: context.imageOnlyColumn && context.columnIndex < context.columnsNode.childCount - 1,
      previousImagePos: null,
      nextImagePos: null
    };
  }

  const positions = findEligibleImagePositions(doc);
  const currentIndex = positions.indexOf(imagePos);
  const previousCandidates = positions.slice(0, currentIndex).reverse();
  const nextCandidates = positions.slice(currentIndex + 1);
  const previousImagePos = previousCandidates.find(
    candidate => canPlaceImageBeside(doc, imagePos, candidate)
  ) ?? null;
  const nextImagePos = nextCandidates.find(
    candidate => canPlaceImageBeside(doc, imagePos, candidate)
  ) ?? null;

  return {
    inLayout: false,
    canMoveLeft: false,
    canMoveRight: false,
    previousImagePos,
    nextImagePos
  };
};
