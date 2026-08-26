import test from 'node:test';
import assert from 'node:assert/strict';
import { Schema } from '@tiptap/pm/model';
import { EditorState } from '@tiptap/pm/state';
import { history, undo } from '@tiptap/pm/history';
import { getHorizontalImageDropCandidate } from '../../src/editor/utils/dragDropUtils.ts';
import {
  createInsertImageBesideTransaction,
  createPlaceImageBesideTransaction,
  createUnwrapImageLayoutTransaction
} from '../../src/editor/utils/imageLayout.ts';

const schema = new Schema({
  nodes: {
    doc: { content: 'block+' },
    paragraph: { group: 'block', content: 'text*' },
    blockquote: { group: 'block', content: 'block+' },
    text: {},
    image: {
      group: 'block',
      atom: true,
      draggable: true,
      attrs: {
        src: { default: '' },
        alt: { default: null },
        caption: { default: null },
        size: { default: 'full' },
        dataWidth: { default: null }
      }
    },
    columns: {
      group: 'block',
      content: 'column+',
      attrs: { layout: { default: 'two-column' } }
    },
    column: { content: 'block+' }
  }
});

const paragraph = (text) => schema.nodes.paragraph.create(null, schema.text(text));
const image = (src, attrs = {}) => schema.nodes.image.create({
  src,
  alt: `${src} 대체 텍스트`,
  caption: `${src} 캡션`,
  size: 'custom',
  dataWidth: '63%',
  ...attrs
});
const column = (...blocks) => schema.nodes.column.create(null, blocks);
const columns = (...columnNodes) => schema.nodes.columns.create({
  layout: columnNodes.length === 3 ? 'three-column' : 'two-column'
}, columnNodes);
const createState = (...blocks) => EditorState.create({
  schema,
  doc: schema.nodes.doc.create(null, blocks),
  plugins: [history()]
});

const findImagePos = (doc, src) => {
  let found = null;
  doc.descendants((node, pos) => {
    if (node.type.name === 'image' && node.attrs.src === src) found = pos;
  });
  if (found === null) throw new Error(`Image not found: ${src}`);
  return found;
};

const getColumnImageOrder = (doc) => {
  const layout = doc.firstChild?.type.name === 'columns'
    ? doc.firstChild
    : doc.content.content.find(node => node.type.name === 'columns');
  if (!layout) return [];
  return Array.from({ length: layout.childCount }, (_, index) => (
    layout.child(index).content.content.find(node => node.type.name === 'image')?.attrs.src
  ));
};

test('image drop geometry chooses the nearest edge and excludes the center', () => {
  const leftRect = { left: 0, right: 200, top: 0, bottom: 120, width: 200 };
  const rightRect = { left: 220, right: 420, top: 0, bottom: 120, width: 200 };

  assert.deepEqual(getHorizontalImageDropCandidate(leftRect, 40, 60), {
    side: 'left',
    distance: 40
  });
  assert.deepEqual(getHorizontalImageDropCandidate(rightRect, 230, 60), {
    side: 'left',
    distance: 10
  });
  assert.equal(getHorizontalImageDropCandidate(leftRect, 100, 60), null);
  assert.equal(getHorizontalImageDropCandidate(leftRect, -101, 60), null);
  assert.equal(getHorizontalImageDropCandidate(leftRect, 40, 140), null);
});

test('moving standalone images creates one undoable two-column layout without losing attrs', () => {
  const initial = createState(
    paragraph('앞 문단'),
    image('a.png'),
    image('b.png'),
    paragraph('뒤 문단')
  );
  const original = initial.doc.toJSON();
  const tr = createPlaceImageBesideTransaction(
    initial,
    findImagePos(initial.doc, 'a.png'),
    findImagePos(initial.doc, 'b.png'),
    'right'
  );
  assert.ok(tr);
  const arranged = initial.apply(tr);

  assert.deepEqual(getColumnImageOrder(arranged.doc), ['b.png', 'a.png']);
  assert.equal(arranged.doc.child(0).textContent, '앞 문단');
  assert.equal(arranged.doc.lastChild?.textContent, '뒤 문단');
  const movedImage = arranged.doc.nodeAt(findImagePos(arranged.doc, 'a.png'));
  assert.equal(movedImage?.attrs.alt, 'a.png 대체 텍스트');
  assert.equal(movedImage?.attrs.caption, 'a.png 캡션');
  assert.equal(movedImage?.attrs.dataWidth, '63%');

  let undone = arranged;
  assert.equal(undo(arranged, undoTr => { undone = arranged.apply(undoTr); }), true);
  assert.deepEqual(undone.doc.toJSON(), original);
});

test('image layouts expand to three columns and reorder without duplication', () => {
  const initial = createState(
    columns(column(image('a.png')), column(image('b.png'))),
    image('c.png')
  );
  const expand = createPlaceImageBesideTransaction(
    initial,
    findImagePos(initial.doc, 'c.png'),
    findImagePos(initial.doc, 'a.png'),
    'right'
  );
  assert.ok(expand);
  const expanded = initial.apply(expand);
  assert.deepEqual(getColumnImageOrder(expanded.doc), ['a.png', 'c.png', 'b.png']);

  const reorder = createPlaceImageBesideTransaction(
    expanded,
    findImagePos(expanded.doc, 'c.png'),
    findImagePos(expanded.doc, 'b.png'),
    'right'
  );
  assert.ok(reorder);
  const reordered = expanded.apply(reorder);
  assert.deepEqual(getColumnImageOrder(reordered.doc), ['a.png', 'b.png', 'c.png']);
  const allImages = [];
  reordered.doc.descendants(node => {
    if (node.type.name === 'image') allImages.push(node.attrs.src);
  });
  assert.deepEqual(allImages.sort(), ['a.png', 'b.png', 'c.png']);

  const external = image('external.png', { dataWidth: null, size: 'full' });
  assert.equal(createInsertImageBesideTransaction(
    reordered,
    findImagePos(reordered.doc, 'b.png'),
    'right',
    external
  ), null);
});

test('moving images across layouts normalizes the source and maps the target safely', () => {
  const initial = createState(
    columns(column(image('a.png')), column(image('b.png')), column(image('c.png'))),
    paragraph('사이 문단'),
    columns(column(image('d.png')), column(image('e.png')))
  );
  const original = initial.doc.toJSON();
  const move = createPlaceImageBesideTransaction(
    initial,
    findImagePos(initial.doc, 'b.png'),
    findImagePos(initial.doc, 'd.png'),
    'left'
  );
  assert.ok(move);
  const moved = initial.apply(move);
  const layouts = moved.doc.content.content.filter(node => node.type.name === 'columns');

  assert.equal(layouts.length, 2);
  assert.deepEqual(
    layouts.map(layout => Array.from({ length: layout.childCount }, (_, index) => (
      layout.child(index).content.content.find(node => node.type.name === 'image')?.attrs.src
    ))),
    [['a.png', 'c.png'], ['b.png', 'd.png', 'e.png']]
  );
  assert.equal(moved.doc.child(1).textContent, '사이 문단');

  let undone = moved;
  assert.equal(undo(moved, undoTr => { undone = moved.apply(undoTr); }), true);
  assert.deepEqual(undone.doc.toJSON(), original);
});

test('moving the sole image out of a two-column layout unwraps the remaining content', () => {
  const initial = createState(
    columns(column(image('a.png')), column(paragraph('남은 설명'), image('b.png'))),
    image('c.png')
  );
  const move = createPlaceImageBesideTransaction(
    initial,
    findImagePos(initial.doc, 'a.png'),
    findImagePos(initial.doc, 'c.png'),
    'right'
  );
  assert.ok(move);
  const moved = initial.apply(move);

  assert.deepEqual(
    moved.doc.content.content.map(node => node.type.name === 'image' ? node.attrs.src : node.type.name),
    ['paragraph', 'b.png', 'columns']
  );
  assert.deepEqual(getColumnImageOrder(moved.doc), ['c.png', 'a.png']);
});

test('nested column images are rejected without removing surrounding content', () => {
  const nested = schema.nodes.blockquote.create(null, [
    paragraph('반드시 보존할 설명'),
    image('nested.png')
  ]);
  const initial = createState(
    columns(column(nested), column(image('b.png'))),
    image('target.png')
  );

  assert.equal(createPlaceImageBesideTransaction(
    initial,
    findImagePos(initial.doc, 'nested.png'),
    findImagePos(initial.doc, 'target.png'),
    'right'
  ), null);
  assert.equal(createInsertImageBesideTransaction(
    initial,
    findImagePos(initial.doc, 'nested.png'),
    'left',
    image('external.png')
  ), null);
  assert.equal(initial.doc.textContent.includes('반드시 보존할 설명'), true);
});

test('overlapping nested layouts reject cross-layout moves without targeting a decoy image', () => {
  const nestedLayout = columns(column(image('target.png')), column(image('other.png')));
  const outerLayout = columns(
    column(image('source.png')),
    column(image('decoy.png'), nestedLayout)
  );
  const initial = createState(outerLayout);
  const original = initial.doc.toJSON();

  assert.equal(createPlaceImageBesideTransaction(
    initial,
    findImagePos(initial.doc, 'source.png'),
    findImagePos(initial.doc, 'target.png'),
    'right'
  ), null);
  assert.deepEqual(initial.doc.toJSON(), original);
});

test('same-layout drag rejects a source column that contains accompanying blocks', () => {
  const initial = createState(columns(
    column(image('source.png'), paragraph('함께 움직이면 안 되는 설명')),
    column(image('target.png'))
  ));
  const original = initial.doc.toJSON();

  assert.equal(createPlaceImageBesideTransaction(
    initial,
    findImagePos(initial.doc, 'source.png'),
    findImagePos(initial.doc, 'target.png'),
    'right'
  ), null);
  assert.deepEqual(initial.doc.toJSON(), original);
});

test('unwrapping a layout preserves every block in left-to-right order', () => {
  const initial = createState(
    columns(
      column(paragraph('왼쪽 설명'), image('a.png')),
      column(image('b.png'), paragraph('오른쪽 설명'))
    ),
    paragraph('레이아웃 뒤')
  );
  const tr = createUnwrapImageLayoutTransaction(initial, findImagePos(initial.doc, 'a.png'));
  assert.ok(tr);
  const unwrapped = initial.apply(tr);

  assert.deepEqual(
    unwrapped.doc.content.content.map(node => node.type.name === 'image' ? node.attrs.src : node.textContent),
    ['왼쪽 설명', 'a.png', 'b.png', '오른쪽 설명', '레이아웃 뒤']
  );
  assert.equal(unwrapped.doc.content.content.some(node => node.type.name === 'columns'), false);
});
