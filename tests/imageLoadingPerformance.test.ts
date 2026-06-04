import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

function read(path: string) {
  return readFileSync(new URL(path, import.meta.url), 'utf8');
}

test('local canvas image previews use cached backend thumbnails', () => {
  const smartImage = read('../src/components/SmartImage.tsx');
  const mediaPreview = read('../src/utils/mediaPreview.ts');
  const filesRoute = read('../backend/src/routes/files.js');

  assert.match(smartImage, /previewImageUrl\(src,\s*thumbSize\)/);
  assert.match(smartImage, /loading = 'lazy'/);
  assert.match(smartImage, /decoding = 'async'/);
  assert.match(smartImage, /data-full-src=\{src\}/);
  assert.match(smartImage, /IntersectionObserver/);
  assert.match(smartImage, /rootMargin:\s*'720px 720px'/);
  assert.match(smartImage, /setFallback\(true\)/);

  assert.match(mediaPreview, /\/api\/files\/thumbnail\?size=\$\{safeSize\}&url=/);
  assert.match(mediaPreview, /LOCAL_FILE_PREFIX_RE/);

  assert.match(filesRoute, /router\.get\('\/thumbnail'/);
  assert.match(filesRoute, /sharp\(sourcePath/);
  assert.match(filesRoute, /thumbnailInflight/);
  assert.match(filesRoute, /MAX_THUMBNAIL_JOBS/);
  assert.match(filesRoute, /Cache-Control', 'public, max-age=31536000, immutable'/);
  assert.match(filesRoute, /THUMBNAILS_DIR/);
});

test('initial canvas boot keeps heavy nodes behind lazy boundaries', () => {
  const app = read('../src/App.tsx');
  const canvas = read('../src/components/Canvas.tsx');

  assert.match(app, /const Canvas = lazy\(\(\) => import\('\.\/components\/Canvas'\)\)/);
  assert.match(app, /CanvasBootFallback/);
  assert.match(canvas, /function lazyCanvasNode/);
  assert.match(canvas, /const Panorama3DNode = lazyCanvasNode\(\(\) => import\('\.\/nodes\/Panorama3DNode'\)/);
  assert.match(canvas, /const ImageNode = lazyCanvasNode\(\(\) => import\('\.\/nodes\/ImageNode'\)/);
  assert.doesNotMatch(canvas, /import ImageNode from '\.\/nodes\/ImageNode'/);
});

test('high-traffic node previews render through SmartImage', () => {
  const expectedSmartImageNodes = [
    '../src/components/nodes/MaterialThumbnail.tsx',
    '../src/components/nodes/OutputNode.tsx',
    '../src/components/nodes/UploadNode.tsx',
    '../src/components/nodes/ImageNode.tsx',
    '../src/components/nodes/GridEditorNode.tsx',
    '../src/components/nodes/Panorama3DNode.tsx',
    '../src/components/nodes/LoopNode.tsx',
    '../src/components/nodes/MaterialSetNode.tsx',
    '../src/components/nodes/VideoNode.tsx',
    '../src/components/nodes/SeedanceNode.tsx',
    '../src/components/nodes/LLMNode.tsx',
  ];

  for (const file of expectedSmartImageNodes) {
    const source = read(file);
    assert.match(source, /import SmartImage from '\.\.\/SmartImage'/, `${file} imports SmartImage`);
    assert.match(source, /<SmartImage[\s\S]*thumbSize=/, `${file} uses bounded preview size`);
  }
});

test('sports theme edge motion degrades while the canvas is busy', () => {
  const canvas = read('../src/components/Canvas.tsx');
  const edge = read('../src/components/edges/DeletableEdge.tsx');
  const css = read('../src/styles/index.css');
  const main = read('../src/main.tsx');

  assert.match(canvas, /EDGE_MOTION_HEAVY_EDGE_COUNT/);
  assert.match(canvas, /data-t8-edge-motion/);
  assert.match(canvas, /onMoveStart=\{handleViewportMoveStart\}/);
  assert.match(canvas, /if \(isDraggingRef\.current\) return;/);
  assert.match(canvas, /setDragSaveTick\(\(tick\) => tick \+ 1\)/);

  assert.match(edge, /DECORATIVE_EDGE_MOTION_LIMIT/);
  assert.match(edge, /shouldRenderPassBall/);
  assert.match(edge, /shouldRenderSoccerBall/);
  assert.match(edge, /\{shouldRenderPassBall && \(/);
  assert.match(edge, /\{shouldRenderSoccerBall && \(/);

  assert.match(css, /html\[data-t8-edge-motion="reduced"\]/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(main, /VITE_T8_STRICT_MODE/);
});
