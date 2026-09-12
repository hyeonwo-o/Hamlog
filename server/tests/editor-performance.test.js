import test from 'node:test';
import assert from 'node:assert/strict';
import { Schema } from '@tiptap/pm/model';
import { EditorState, Plugin, TextSelection } from '@tiptap/pm/state';
import { history, undo, redo } from '@tiptap/pm/history';
import { collectEditorToc, updateEditorToc } from '../../src/editor/utils/editorToc.ts';
import { getEditorContentSnapshot } from '../../src/editor/utils/editorContentSnapshot.ts';

const schema = new Schema({
  nodes: {
    doc: { content: 'block+' },
    paragraph: { group: 'block', content: 'text*' },
    heading: { group: 'block', content: 'text*', attrs: { level: { default: 2 } } },
    blockquote: { group: 'block', content: 'block+' },
    text: {}
  },
  marks: { strong: {} }
});
const paragraph = text => schema.nodes.paragraph.create(null, text ? schema.text(text) : null);
const heading = (text, level = 2) => schema.nodes.heading.create({ level }, schema.text(text));
const quote = (...content) => schema.nodes.blockquote.create(null, content);
const stateFor = (...content) => EditorState.create({
  schema,
  doc: schema.nodes.doc.create(null, content),
  plugins: [history()]
});
const find = (doc, text) => {
  let position;
  doc.descendants((node, pos) => {
    if (node.isTextblock && node.textContent === text) position = pos;
  });
  assert.notEqual(position, undefined, `missing textblock: ${text}`);
  return position;
};
const tracker = initial => {
  let state = initial;
  let index = collectEditorToc(state.doc);
  return {
    get state() { return state; },
    get index() { return index; },
    apply(transaction) {
      const applied = state.applyTransaction(transaction);
      const next = updateEditorToc(index, applied.transactions, applied.state.doc);
      assert.deepEqual(next.items, collectEditorToc(applied.state.doc).items);
      index = next;
      state = applied.state;
      return next;
    }
  };
};

test('incremental ToC matches a full scan for typing, heading conversion and nested changes', () => {
  const tracked = tracker(stateFor(
    paragraph('before'), heading('first'), quote(heading('nested', 3), paragraph('body')), paragraph('after')
  ));
  tracked.apply(tracked.state.tr.insertText('!', 2));
  tracked.apply(tracked.state.tr.insertText(' more', find(tracked.state.doc, 'first') + 3));
  tracked.apply(tracked.state.tr.setNodeMarkup(find(tracked.state.doc, 'after'), schema.nodes.heading, { level: 3 }));
  tracked.apply(tracked.state.tr.setNodeMarkup(find(tracked.state.doc, 'nested'), schema.nodes.paragraph));
  tracked.apply(tracked.state.tr.insert(0, quote(heading('inserted'), paragraph('nested body'))));
  const pos = find(tracked.state.doc, 'inserted');
  tracked.apply(tracked.state.tr.delete(pos, pos + tracked.state.doc.nodeAt(pos).nodeSize));
  const headingPos = find(tracked.state.doc, 'after');
  tracked.apply(tracked.state.tr.setNodeAttribute(headingPos, 'level', 2));
  assert.equal(tracked.index.items.at(-1).level, 2);
});

test('ToC merges multi-step mappings and handles splitting/joining headings', () => {
  const tracked = tracker(stateFor(paragraph('prefix'), heading('alphabet'), paragraph('tail')));
  let tr = tracked.state.tr.insertText('A', 1).insertText('B', 2);
  tr = tr.insert(0, heading('new first', 3));
  tracked.apply(tr);
  const pos = find(tracked.state.doc, 'alphabet');
  tracked.apply(tracked.state.tr.split(pos + 4));
  const secondPos = find(tracked.state.doc, 'habet');
  tracked.apply(tracked.state.tr.join(secondPos));
  assert.equal(tracked.index.items.at(-1).text, 'alphabet');
});

test('ToC preserves array identity for selection-only and unrelated trailing paragraph changes', () => {
  const tracked = tracker(stateFor(heading('title'), paragraph('trailing text')));
  const items = tracked.index.items;
  tracked.apply(tracked.state.tr.setSelection(TextSelection.create(tracked.state.doc, 2)));
  assert.equal(tracked.index.items, items);
  tracked.apply(tracked.state.tr.addStoredMark(schema.marks.strong.create()));
  assert.equal(tracked.index.items, items);
  tracked.apply(tracked.state.tr.insertText('!', tracked.state.doc.content.size - 1));
  assert.equal(tracked.index.items, items);
  tracked.apply(tracked.state.tr.addMark(1, 3, schema.marks.strong.create()));
  assert.equal(tracked.index.items, items);
});

test('ToC handles plugin-appended transactions and silent full-document resets', () => {
  const normalize = new Plugin({
    appendTransaction(transactions, _oldState, state) {
      if (!transactions.some(tr => tr.docChanged) || state.doc.firstChild.attrs.level === 3) return null;
      return state.tr.setNodeAttribute(0, 'level', 3);
    }
  });
  const initial = EditorState.create({ schema, doc: stateFor(heading('original')).doc, plugins: [normalize] });
  const tracked = tracker(initial);
  tracked.apply(tracked.state.tr.insertText('x', 2));
  assert.equal(tracked.index.items[0].level, 3);
  tracked.apply(tracked.state.tr.replaceWith(0, tracked.state.doc.content.size, [heading('restored'), paragraph('body')]).setMeta('preventUpdate', true));
  assert.equal(tracked.index.items[0].text, 'restored');
  // A missed/replaced source state safely rebuilds instead of mapping stale positions.
  const elsewhere = stateFor(paragraph('elsewhere'), heading('another'));
  const next = updateEditorToc(tracked.index, [], elsewhere.doc);
  assert.deepEqual(next.items, collectEditorToc(elsewhere.doc).items);
});

test('ToC remains correct across undo/redo and a document without headings', () => {
  const tracked = tracker(stateFor(heading('old title'), paragraph('body')));
  const before = tracked.index.items;
  tracked.apply(tracked.state.tr.insertText('changed ', 1));
  assert.equal(undo(tracked.state, tr => tracked.apply(tr)), true);
  assert.deepEqual(tracked.index.items, before);
  assert.equal(redo(tracked.state, tr => tracked.apply(tr)), true);
  assert.equal(tracked.index.items[0].text, 'changed old title');
  tracked.apply(tracked.state.tr.replaceWith(0, tracked.state.doc.content.size, paragraph('no headings')));
  assert.deepEqual(tracked.index.items, []);
});

test('mixed deterministic edits keep the incremental outline identical to a fresh traversal', () => {
  const tracked = tracker(stateFor(heading('start'), quote(paragraph('nested body'), heading('nested')), paragraph('end')));
  let seed = 71;
  const pick = max => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed % max;
  };
  for (let edit = 0; edit < 300; edit += 1) {
    const blocks = [];
    tracked.state.doc.descendants((node, pos) => {
      if (node.isTextblock) blocks.push({ node, pos });
    });
    const { node, pos } = blocks[pick(blocks.length)];
    let tr = tracked.state.tr;
    switch (pick(6)) {
      case 0:
        tr = tr.insertText('한', pos + 1 + pick(node.content.size + 1));
        break;
      case 1:
        tr = tr.setNodeMarkup(pos, node.type === schema.nodes.heading ? schema.nodes.paragraph : schema.nodes.heading);
        break;
      case 2:
        tr = tr.insert(0, edit % 2 ? quote(heading(`nested ${edit}`)) : heading(`heading ${edit}`));
        break;
      case 3:
        if (tracked.state.doc.childCount > 1) tr = tr.delete(0, tracked.state.doc.firstChild.nodeSize);
        break;
      case 4:
        if (node.content.size > 0) {
          const start = pos + 1 + pick(node.content.size);
          tr = tr.delete(start, start + 1);
        }
        break;
      default:
        tr = tr.insertText('a', pos + 1).insertText('b', pos + 2);
    }
    tracked.apply(tr);
  }
});

test('long-post typing visits changed ranges instead of rescanning every block', t => {
  const blocks = Array.from({ length: 1_000 }, (_, index) => (
    index % 50 === 0 ? heading(`section ${index}`) : paragraph(`paragraph ${index} with body text`)
  ));
  let state = stateFor(...blocks);
  let index = collectEditorToc(state.doc);
  let fullScanVisits = 0;
  let incrementalVisits = 0;
  for (let edit = 0; edit < 100; edit += 1) {
    const tr = state.tr.insertText('x', state.doc.content.size - 1);
    const doc = tr.doc;
    const nodesBetween = doc.nodesBetween;
    let visits = 0;
    doc.nodesBetween = function (from, to, callback, ...rest) {
      return nodesBetween.call(this, from, to, (...args) => {
        visits += 1;
        return callback(...args);
      }, ...rest);
    };
    const next = updateEditorToc(index, [tr], doc);
    incrementalVisits += visits;
    visits = 0;
    const full = collectEditorToc(doc);
    fullScanVisits += visits;
    delete doc.nodesBetween;
    assert.deepEqual(next.items, full.items);
    assert.equal(next.items, index.items);
    index = next;
    state = state.apply(tr);
  }
  assert.ok(incrementalVisits < fullScanVisits / 100);
  t.diagnostic(`100 edits / 1,000 blocks: full-scan ${fullScanVisits} node visits; incremental ${incrementalVisits}`);
});

test('content snapshots serialize once per document and survive selection state updates', () => {
  let htmlReads = 0;
  let jsonReads = 0;
  const editor = {
    state: stateFor(heading('first'), paragraph('body')),
    getHTML() { htmlReads += 1; return this.state.doc.textContent; },
    getJSON() { jsonReads += 1; return this.state.doc.toJSON(); }
  };
  const snapshot = getEditorContentSnapshot(editor);
  for (let move = 0; move < 100; move += 1) {
    editor.state = editor.state.apply(editor.state.tr.setSelection(TextSelection.create(editor.state.doc, 1 + move % 4)));
    assert.equal(getEditorContentSnapshot(editor), snapshot);
  }
  assert.equal(htmlReads, 1);
  assert.equal(jsonReads, 1);
  assert.equal(snapshot.contentJsonKey, JSON.stringify(editor.state.doc.toJSON()));
  editor.state = editor.state.apply(editor.state.tr.insertText('new ', 1));
  const updated = getEditorContentSnapshot(editor);
  assert.notEqual(updated, snapshot);
  assert.equal(updated.contentHtml, 'new firstbody');
  assert.deepEqual(updated.contentJson, editor.state.doc.toJSON());
  assert.equal(htmlReads, 2);
  assert.equal(jsonReads, 2);
  assert.equal(snapshot.contentHtml, 'firstbody');
});
