import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { VIDEO_FAL_REGISTRY, VIDEO_MODELS, isFalVideoModel } from '../src/providers/models.ts';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('video model type order defaults to Grok Video then Veo then Sora2', () => {
  const visibleVideoModels = VIDEO_MODELS.filter((model) => model.kind !== 'seedance');

  assert.deepEqual(
    visibleVideoModels.map((model) => model.label),
    ['Grok Video', 'Veo', 'Sora2'],
  );
  assert.equal(VIDEO_MODELS[0].kind, 'grok');
});

test('grok video tab defaults to Grok Video 1.5 FAL model', () => {
  const grok = VIDEO_MODELS.find((model) => model.kind === 'grok');

  assert.ok(grok);
  assert.equal(grok.apiModelOptions[0].value, 'grok-imagine-video-1.5');
});

test('Veo category defaults to veo-omni-10s without removing legacy Veo options', () => {
  const veo = VIDEO_MODELS.find((model) => model.kind === 'veo');

  assert.ok(veo);
  assert.equal(veo.label, 'Veo');
  assert.equal(veo.apiModelOptions[0].value, 'veo-omni-10s');
  assert.ok(veo.apiModelOptions.some((option) => option.value === 'veo3.1'));
  assert.ok(veo.apiModelOptions.some((option) => option.value === 'veo3.1-fal'));
});

test('Grok Video 1.5 uses the v1.5 image-to-video FAL endpoint with base64 images', () => {
  const fal = VIDEO_FAL_REGISTRY['grok-imagine-video-1.5'];

  assert.ok(fal);
  assert.equal(fal.paramKind, 'grok-fal');
  assert.equal(fal.endpoint, 'xai/grok-imagine-video/v1.5/image-to-video');
  assert.equal(fal.maxRefImages, 1);
  assert.equal(fal.defaultImageMode, 'base64');
});

test('Sora2 keeps the existing FAL option and adds a separate Zhenzhen API option', () => {
  const sora = VIDEO_MODELS.find((model) => model.kind === 'sora');

  assert.ok(sora);
  assert.deepEqual(
    sora.apiModelOptions.map((option) => option.value),
    ['sora-2', 'sora-2-zhenzhen'],
  );
  assert.equal(isFalVideoModel('sora-2'), true);
  assert.equal(isFalVideoModel('sora-2-zhenzhen'), false);
  assert.deepEqual(sora.ratios, ['16:9', '9:16']);
  assert.deepEqual(sora.durations, [15]);
  assert.equal(sora.maxRefImages, 1);
});

test('Sora2 has an independent classified API key field', () => {
  const apiSettings = read('../src/components/ApiSettings.tsx');
  const settingsRoute = read('../backend/src/routes/settings.js');
  const proxyRoute = read('../backend/src/routes/proxy.js');

  assert.match(apiSettings, /'soraApiKey'/);
  assert.match(apiSettings, /label: 'sora2 系列'/);
  assert.match(settingsRoute, /soraApiKey: ''/);
  assert.match(settingsRoute, /'soraApiKey'/);
  assert.match(proxyRoute, /m\.includes\('sora'\)\) return settings\.soraApiKey \|\| fb/);
});

test('Sora2 Zhenzhen API channel maps to upstream sora-2 without touching FAL sora-2', () => {
  const proxyRoute = read('../backend/src/routes/proxy.js');

  assert.match(proxyRoute, /const isSoraZhenzhen = lowerModel === 'sora-2-zhenzhen'/);
  assert.match(proxyRoute, /model: 'sora-2'/);
  assert.match(proxyRoute, /private: privateVideo !== false && is_private !== false/);
  assert.match(proxyRoute, /images\.slice\(0,\s*1\)\.map\(stripDataUrlPrefix\)/);
  assert.match(proxyRoute, /getUpstreamErrorMessage\(data, text, r\.status\)/);
});

test('Veo Omni uses the Comfly /v1/videos multipart protocol', () => {
  const proxyRoute = read('../backend/src/routes/proxy.js');
  const videoNode = read('../src/components/nodes/VideoNode.tsx');

  assert.match(proxyRoute, /const VEO_OMNI_PUBLIC_MODEL = 'veo-omni-10s'/);
  assert.match(proxyRoute, /const VEO_OMNI_UPSTREAM_MODEL = 'omni_flash-10s'/);
  assert.match(proxyRoute, /\/v1\/videos/);
  assert.match(proxyRoute, /form\.append\('input_reference'/);
  assert.match(proxyRoute, /rememberTaskKey\(taskId, apiKey, \{ model: VEO_OMNI_PUBLIC_MODEL \}\)/);
  assert.match(proxyRoute, /isVeoOmniModel\(queryModel\)/);
  assert.ok(videoNode.includes('payload.duration = 10'));
  assert.match(videoNode, /veo-omni-10s 需要 1 张参考图/);
});
