import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const imageNodeSource = fs.readFileSync(path.join(root, 'src/components/nodes/ImageNode.tsx'), 'utf8');
const comfyAppsSource = fs.readFileSync(path.join(root, 'src/utils/comfyuiApps.ts'), 'utf8');

test('ImageNode exposes ComfyUI prompt and image mapped fields in the ComfyUI panel', () => {
  assert.match(imageNodeSource, /canonicalizeComfyFieldsByWorkflow/);
  assert.match(imageNodeSource, /COMFY_NODE_FIELD_SOURCES[\s\S]*'prompt'[\s\S]*'positive'[\s\S]*'negative'[\s\S]*'image1'/);
  assert.match(imageNodeSource, /source === 'prompt' \|\| source === 'positive'/);
  assert.match(imageNodeSource, /title="ComfyUI 输入素材 · 上游\+本地"/);
  assert.match(imageNodeSource, /negativePrompt: externalNegativePrompt \|\| undefined/);
});

test('ImageNode hides default image prompt and reference UI when ComfyUI is selected', () => {
  assert.match(imageNodeSource, /\(!isComfyExternal && \(isExternalSelected \|\| modelDef\.supportsReference\)\)/);
  assert.match(imageNodeSource, /\{!isComfyExternal && <div>[\s\S]*本地 Prompt\(可选,优先取上游 text\)/);
});

test('ComfyUI source labels include positive prompt and media inputs', () => {
  assert.match(comfyAppsSource, /positive: '正向 Prompt'/);
  assert.match(comfyAppsSource, /image1: '图片输入 1'/);
  assert.match(comfyAppsSource, /video1: '视频输入 1'/);
  assert.match(comfyAppsSource, /audio1: '音频输入 1'/);
});
