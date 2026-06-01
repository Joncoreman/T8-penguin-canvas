import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const loadGridEditorUtils = async () => import('../src/utils/gridEditor.ts');

test('grid editor node is registered as a visible image-to-image utility node', () => {
  const registry = readFileSync(new URL('../src/config/nodeRegistry.ts', import.meta.url), 'utf8');
  const ports = readFileSync(new URL('../src/config/portTypes.ts', import.meta.url), 'utf8');
  const types = readFileSync(new URL('../src/types/canvas.ts', import.meta.url), 'utf8');

  assert.match(registry, /type:\s*'grid-editor'[\s\S]*label:\s*'宫格编辑'[\s\S]*category:\s*'utility'/);
  assert.match(ports, /'grid-editor':\s*\{\s*inputs:\s*\['image'\],\s*outputs:\s*\['image'\]\s*\}/);
  assert.match(types, /\|\s*'grid-editor'/);
});

test('grid editor normalizes layout config and preserves user ordering', async () => {
  const {
    GRID_EDITOR_PRESETS,
    buildGridEditorItems,
    createGridEditorSlots,
    moveGridEditorItem,
    normalizeGridEditorConfig,
  } = await loadGridEditorUtils();

  const config = normalizeGridEditorConfig({
    rows: 0,
    cols: 99,
    width: 99999,
    height: 12,
    gap: -4,
    background: 'not-a-color',
    fit: 'bad-fit',
    showIndexes: true,
  });

  assert.deepEqual(config, {
    rows: 1,
    cols: 12,
    width: 4096,
    height: 64,
    gap: 0,
    background: '#111827',
    fit: 'adaptive',
    showIndexes: true,
  });

  const items = buildGridEditorItems(
    [
      { id: 'up-a', url: '/files/input/a.png', title: 'A', origin: 'upstream' },
      { id: 'up-b', url: '/files/input/b.png', title: 'B', origin: 'upstream' },
    ],
    [{ id: 'local-c', url: '/files/input/c.png', title: 'C', origin: 'local' }],
    ['local-c', 'missing', 'up-b'],
  );

  assert.deepEqual(items.map((item) => item.id), ['local-c', 'up-b', 'up-a']);
  assert.deepEqual(moveGridEditorItem(items.map((item) => item.id), 'up-a', 'local-c'), ['up-a', 'local-c', 'up-b']);

  const slots = createGridEditorSlots(items, { ...config, rows: 2, cols: 2 });
  assert.equal(slots.length, 4);
  assert.deepEqual(slots.map((slot) => slot?.id || null), ['local-c', 'up-b', 'up-a', null]);
  assert.deepEqual(
    GRID_EDITOR_PRESETS.map((preset) => [preset.label, preset.cols, preset.rows]),
    [
      ['2×2', 2, 2],
      ['3×3', 3, 3],
      ['3×4', 3, 4],
      ['4×3', 4, 3],
      ['1×4', 1, 4],
      ['4×1', 4, 1],
    ],
  );
});

test('grid editor compose request keeps empty cells and split output keeps filled cells only', async () => {
  const {
    buildGridComposeRequest,
    splitGridEditorItems,
    normalizeGridEditorConfig,
  } = await loadGridEditorUtils();

  const config = normalizeGridEditorConfig({
    rows: 2,
    cols: 2,
    width: 800,
    height: 600,
    gap: 8,
    background: '#222222',
    fit: 'contain',
    showIndexes: true,
  });
  const items = [
    { id: 'a', url: '/files/input/a.png', title: 'A', origin: 'upstream' },
    { id: 'b', url: '/files/input/b.png', title: 'B', origin: 'local' },
  ];

  const request = buildGridComposeRequest(items, config);

  assert.equal(request.cells.length, 4);
  assert.deepEqual(request.cells.map((cell) => cell?.imageUrl || null), [
    '/files/input/a.png',
    '/files/input/b.png',
    null,
    null,
  ]);
  assert.equal(request.fit, 'contain');
  assert.equal(request.showIndexes, true);
  assert.deepEqual(splitGridEditorItems(items), ['/files/input/a.png', '/files/input/b.png']);
});

test('grid editor supports adaptive full-image fit without constraining the preview grid itself', async () => {
  const {
    buildGridComposeRequest,
    normalizeGridEditorConfig,
  } = await loadGridEditorUtils();
  const node = readFileSync(new URL('../src/components/nodes/GridEditorNode.tsx', import.meta.url), 'utf8');
  const backend = readFileSync(new URL('../backend/src/routes/imageOps.js', import.meta.url), 'utf8');

  const config = normalizeGridEditorConfig({
    rows: 1,
    cols: 4,
    width: 1080,
    height: 1920,
    fit: 'adaptive',
  });
  const request = buildGridComposeRequest(
    [
      { id: 'a', url: '/files/input/a.png', origin: 'upstream' },
      { id: 'b', url: '/files/input/b.png', origin: 'upstream' },
    ],
    config,
  );

  assert.equal(config.fit, 'adaptive');
  assert.equal(request.fit, 'adaptive');
  assert.equal(request.cells[0]?.fit, 'adaptive');
  assert.match(node, /value="adaptive"/);
  assert.match(node, /fit === 'adaptive'/);
  assert.match(node, /overflow-auto/);
  assert.doesNotMatch(node, /maxHeight:\s*360/);
  assert.match(backend, /s === 'adaptive'/);
  assert.match(backend, /cell\.fit === 'adaptive'\s*\?\s*'contain'\s*:\s*cell\.fit/);
});

test('grid editor keeps custom ratio selectable and avoids clamping active dimension drafts', async () => {
  const {
    GRID_EDITOR_CUSTOM_RATIO_VALUE,
    gridEditorRatioSelectValue,
  } = await loadGridEditorUtils();
  const node = readFileSync(new URL('../src/components/nodes/GridEditorNode.tsx', import.meta.url), 'utf8');

  assert.equal(gridEditorRatioSelectValue(1920, 1080), '1920:1080');
  assert.equal(gridEditorRatioSelectValue(1920, 1080, 'custom'), GRID_EDITOR_CUSTOM_RATIO_VALUE);
  assert.equal(gridEditorRatioSelectValue(1500, 1200), GRID_EDITOR_CUSTOM_RATIO_VALUE);
  assert.match(node, /gridDimensionDrafts/);
  assert.match(node, /commitGridDimensionDraft\('width'\)/);
  assert.match(node, /commitGridDimensionDraft\('height'\)/);
  assert.match(node, /value=\{ratioSelectValue\}/);
  assert.match(node, /value=\{GRID_EDITOR_CUSTOM_RATIO_VALUE\}/);
});

test('grid compose backend and service expose the compose endpoint', () => {
  const backend = readFileSync(new URL('../backend/src/routes/imageOps.js', import.meta.url), 'utf8');
  const service = readFileSync(new URL('../src/services/imageOps.ts', import.meta.url), 'utf8');

  assert.match(backend, /router\.post\('\/grid-compose'/);
  assert.match(service, /opGridCompose/);
  assert.match(service, /'grid-compose'/);
});
