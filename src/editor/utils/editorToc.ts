import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import type { Transaction } from '@tiptap/pm/state';

export interface EditorTocItem {
  id: string;
  text: string;
  level: number;
}

export interface EditorTocIndex {
  doc: ProseMirrorNode;
  items: EditorTocItem[];
}

const headingItem = (node: ProseMirrorNode, pos: number): EditorTocItem => ({
  id: `heading-${pos}`,
  text: node.textContent,
  level: node.attrs.level
});

function reuseUnchangedItems(previous: EditorTocItem[], next: EditorTocItem[]) {
  return previous.length === next.length && previous.every((item, index) => (
    item.id === next[index].id
    && item.text === next[index].text
    && item.level === next[index].level
  )) ? previous : next;
}

export function collectEditorToc(doc: ProseMirrorNode): EditorTocIndex {
  const items: EditorTocItem[] = [];
  doc.nodesBetween(0, doc.content.size, (node, pos) => {
    if (node.type.name !== 'heading') return;
    items.push(headingItem(node, pos));
    return false;
  });
  return { doc, items };
}

function applyTocTransaction(index: EditorTocIndex, transaction: Transaction): EditorTocIndex {
  if (!transaction.docChanged) return index;
  const doc = transaction.doc;
  if (index.doc !== transaction.before) return collectEditorToc(doc);

  const byPosition = new Map<number, EditorTocItem>();
  for (const item of index.items) {
    const mapped = transaction.mapping.mapResult(Number(item.id.slice('heading-'.length)), 1);
    if (mapped.deleted || mapped.pos < 0 || mapped.pos >= doc.content.size) continue;
    const node = doc.nodeAt(mapped.pos);
    if (node?.type.name === 'heading') byPosition.set(mapped.pos, headingItem(node, mapped.pos));
  }

  const ranges: Array<{ from: number; to: number }> = [];
  transaction.mapping.maps.forEach((stepMap, stepIndex) => {
    const remaining = transaction.mapping.slice(stepIndex + 1);
    stepMap.forEach((_oldStart, _oldEnd, newStart, newEnd) => {
      // A collapsed deletion range must also inspect its newly joined block.
      ranges.push({
        from: Math.max(0, remaining.map(newStart, -1) - 1),
        to: Math.min(doc.content.size, remaining.map(newEnd, 1) + 1)
      });
    });
  });

  // Custom/attribute-only steps may change the document without positional maps.
  if (ranges.length === 0) {
    const refreshed = collectEditorToc(doc);
    return { doc, items: reuseUnchangedItems(index.items, refreshed.items) };
  }

  ranges.sort((a, b) => a.from - b.from);
  const merged: typeof ranges = [];
  for (const range of ranges) {
    const last = merged.at(-1);
    if (last && range.from <= last.to) last.to = Math.max(last.to, range.to);
    else merged.push(range);
  }
  for (const { from, to } of merged) {
    doc.nodesBetween(from, to, (node, pos) => {
      if (node.type.name !== 'heading') return;
      byPosition.set(pos, headingItem(node, pos));
      return false;
    });
  }

  const items = [...byPosition.entries()].sort(([a], [b]) => a - b).map(([, item]) => item);
  return { doc, items: reuseUnchangedItems(index.items, items) };
}

/** Apply all plugin-appended transactions as well as silent setContent resets. */
export function updateEditorToc(
  index: EditorTocIndex,
  transactions: readonly Transaction[],
  finalDoc: ProseMirrorNode
): EditorTocIndex {
  let next = index;
  for (const transaction of transactions) next = applyTocTransaction(next, transaction);
  if (next.doc !== finalDoc) next = collectEditorToc(finalDoc);
  return { doc: next.doc, items: reuseUnchangedItems(index.items, next.items) };
}
