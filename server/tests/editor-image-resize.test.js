import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateImageWidthPercent,
  clampImageWidthPercent,
  getKeyboardImageWidthPercent,
  parseImageWidthPercent
} from '../../src/editor/utils/imageResize.ts';

test('image resize calculations stay responsive and within the supported range', () => {
  assert.equal(calculateImageWidthPercent({
    startWidthPx: 500,
    deltaX: 100,
    containerWidthPx: 1000
  }), 70);
  assert.equal(calculateImageWidthPercent({
    startWidthPx: 500,
    deltaX: 100,
    containerWidthPx: 1000,
    centered: false
  }), 60);
  assert.equal(calculateImageWidthPercent({
    startWidthPx: 250,
    deltaX: -500,
    containerWidthPx: 1000
  }), 25);
  assert.equal(calculateImageWidthPercent({
    startWidthPx: 900,
    deltaX: 500,
    containerWidthPx: 1000
  }), 100);
  assert.equal(calculateImageWidthPercent({
    startWidthPx: 500,
    deltaX: 50,
    containerWidthPx: 0
  }), 100);
});

test('image width parsing and keyboard controls use stable percentage steps', () => {
  assert.equal(parseImageWidthPercent('63%'), 63);
  assert.equal(parseImageWidthPercent('5%'), 25);
  assert.equal(parseImageWidthPercent('invalid'), 100);
  assert.equal(clampImageWidthPercent(Number.NaN), 100);
  assert.equal(getKeyboardImageWidthPercent(50, 'ArrowRight'), 55);
  assert.equal(getKeyboardImageWidthPercent(50, 'ArrowLeft', true), 40);
  assert.equal(getKeyboardImageWidthPercent(50, 'Home'), 25);
  assert.equal(getKeyboardImageWidthPercent(50, 'End'), 100);
  assert.equal(getKeyboardImageWidthPercent(50, 'Enter'), null);
});
