import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mergeAttributes } from '@tiptap/core';

const require = createRequire(import.meta.url);
const expressRequire = createRequire(require.resolve('express'));
const bodyParserRequire = createRequire(expressRequire.resolve('body-parser'));

// GHSA-cp6q-959q-f8rh: cover the ESM and CommonJS entry points used by
// frontend code and server-side HTML extensions respectively.
for (const [entry, merge] of [
  ['ESM', mergeAttributes],
  ['CommonJS', require('@tiptap/core').mergeAttributes]
]) {
  test(`Tiptap ${entry} rejects prototype-changing DOM attributes`, () => {
    const untrusted = JSON.parse('{"__proto__":{"onerror":"alert(1)","data-inherited":"unsafe"},"alt":"safe"}');
    for (const attrs of [merge(untrusted), merge({ class: 'image' }, untrusted)]) {
      assert.equal(Object.getPrototypeOf(attrs), Object.prototype);
      // The fixed helper preserves this key as an inert own data property.
      assert.equal(Object.getOwnPropertyDescriptor(attrs, '__proto__')?.value, untrusted.__proto__);
      assert.equal('onerror' in attrs, false);
      assert.equal('data-inherited' in attrs, false);
      assert.equal(attrs.alt, 'safe');
    }
    assert.deepEqual(merge({ class: 'one' }, { class: 'two', title: 'safe' }), {
      class: 'one two', title: 'safe'
    });
  });
}

for (const [consumer, load] of [['express', expressRequire], ['body-parser', bodyParserRequire]]) {
  const qs = load('qs');

  test(`${consumer} qs enforces comma-array limits for bracket keys`, () => {
    // GHSA-x5fp-wj9c-mxmx: a tiny payload exercises the limit without allocating a large array.
    const options = { comma: true, arrayLimit: 3, throwOnLimitExceeded: true };
    assert.throws(() => qs.parse('items[]=1,2,3,4', options), RangeError);
    assert.deepEqual(qs.parse('items=1,2,3', options), { items: ['1', '2', '3'] });
  });

  test(`${consumer} qs safely round-trips a user-controlled isBuffer field`, () => {
    // GHSA-4mjr-xmp4-gh2g: the parsed constructor field must not be invoked.
    const input = 'item[constructor][isBuffer]=not-a-function';
    for (const options of [{ plainObjects: true }, { allowPrototypes: true }]) {
      const parsed = qs.parse(input, options);
      assert.doesNotThrow(() => qs.stringify(parsed));
      assert.deepEqual(qs.parse(qs.stringify(parsed), options), parsed);
    }
  });
}
