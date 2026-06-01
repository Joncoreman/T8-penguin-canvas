import test from 'node:test';
import assert from 'node:assert/strict';
import { fitImagePreviewSize, placeImagePreviewPanel } from '../src/utils/imageHoverPreview.ts';

test('image hover preview keeps 100% size until viewport limits apply', () => {
  assert.deepEqual(
    fitImagePreviewSize({ width: 320, height: 240 }, { width: 1000, height: 800 }),
    { width: 320, height: 240 },
  );
  assert.deepEqual(
    fitImagePreviewSize({ width: 2000, height: 1000 }, { width: 1000, height: 800 }),
    { width: 800, height: 400 },
  );
});

test('image hover preview prefers the right side and flips left near the viewport edge', () => {
  assert.deepEqual(
    placeImagePreviewPanel(
      { left: 40, top: 50, right: 68, bottom: 78, width: 28, height: 28 },
      { width: 240, height: 180 },
      { width: 900, height: 700 },
    ),
    { left: 80, top: 50, width: 240, height: 180 },
  );

  assert.deepEqual(
    placeImagePreviewPanel(
      { left: 842, top: 650, right: 870, bottom: 678, width: 28, height: 28 },
      { width: 240, height: 180 },
      { width: 900, height: 700 },
    ),
    { left: 590, top: 508, width: 240, height: 180 },
  );
});
