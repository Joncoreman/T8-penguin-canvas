import test from 'node:test';
import assert from 'node:assert/strict';

import {
  advancedProviderSummary,
  advancedProvidersForNode,
  advancedProviderModelOptions,
  resolveAdvancedProviderSelection,
  externalImageSizeFor,
  parseAdvancedProviderModelText,
  stringifyAdvancedProviderModels,
} from '../src/utils/advancedProviders.ts';

test('parseAdvancedProviderModelText accepts commas and new lines while removing duplicates', () => {
  assert.deepEqual(
    parseAdvancedProviderModelText('gpt-image-1, seedream-4\nseedream-4\n  veo-3.1  '),
    ['gpt-image-1', 'seedream-4', 'veo-3.1'],
  );
});

test('stringifyAdvancedProviderModels keeps compact one-model-per-line output', () => {
  assert.equal(
    stringifyAdvancedProviderModels(['gpt-image-1', '', 'seedream-4']),
    'gpt-image-1\nseedream-4',
  );
});

test('advancedProviderSummary mirrors settings folded header counts', () => {
  const summary = advancedProviderSummary([
    { id: 'modelscope', protocol: 'modelscope', enabled: true, apiKey: '****1234' },
    { id: 'comfyui', protocol: 'comfyui', enabled: false, baseUrl: 'http://127.0.0.1:8188' },
    { id: 'jimeng', protocol: 'jimeng-cli', enabled: true, jimengConfig: { executablePath: 'dreamina' } },
  ] as any);

  assert.equal(summary.enabledCount, 2);
  assert.equal(summary.configuredKeyCount, 1);
  assert.equal(summary.comfyuiConfigured, true);
  assert.equal(summary.jimengConfigured, true);
});

test('advancedProvidersForNode only exposes enabled providers supported by each node kind', () => {
  const providers = [
    { id: 'openai-compatible', label: 'OpenAI', protocol: 'openai-compatible', enabled: true, imageModels: ['gpt-image-1'], chatModels: ['gpt-4o-mini'] },
    { id: 'modelscope', label: 'ModelScope', protocol: 'modelscope', enabled: true, imageModels: ['MusePublic/489_ckpt_FLUX_1'], chatModels: ['Qwen/Qwen3-Coder'] },
    { id: 'volcengine', label: 'Volc', protocol: 'volcengine', enabled: false, imageModels: ['seedream'], videoModels: ['seedance'], chatModels: ['doubao'] },
    { id: 'comfyui', label: 'ComfyUI', protocol: 'comfyui', enabled: true, comfyuiConfig: { workflows: [] } },
    { id: 'jimeng-cli', label: 'Jimeng', protocol: 'jimeng-cli', enabled: true, imageModels: ['jimeng-image'], videoModels: ['jimeng-video'] },
  ] as any;

  assert.deepEqual(advancedProvidersForNode(providers, 'image').map((p) => p.id), [
    'openai-compatible',
    'modelscope',
    'jimeng-cli',
  ]);
  assert.deepEqual(advancedProvidersForNode(providers, 'llm').map((p) => p.id), [
    'openai-compatible',
    'modelscope',
  ]);
  assert.deepEqual(advancedProvidersForNode(providers, 'video').map((p) => p.id), [
    'jimeng-cli',
  ]);
});

test('advanced provider selection preserves valid saved provider and falls back to zhenzhen safely', () => {
  const providers = [
    { id: 'modelscope', label: 'ModelScope', protocol: 'modelscope', enabled: true, imageModels: ['flux-dev'] },
  ] as any;

  assert.deepEqual(resolveAdvancedProviderSelection(providers, 'image', {
    providerSource: 'modelscope',
    providerId: 'modelscope',
    providerModel: 'flux-dev',
  }), {
    providerSource: 'modelscope',
    providerId: 'modelscope',
    providerModel: 'flux-dev',
    provider: providers[0],
    available: true,
  });

  assert.deepEqual(resolveAdvancedProviderSelection(providers, 'image', {
    providerSource: 'openai-compatible',
    providerId: 'missing',
    providerModel: 'old-model',
  }), {
    providerSource: 'zhenzhen',
    providerId: '',
    providerModel: '',
    provider: null,
    available: false,
  });
});

test('advancedProviderModelOptions uses explicit lists before safe provider defaults', () => {
  assert.deepEqual(
    advancedProviderModelOptions({ id: 'openai-compatible', protocol: 'openai-compatible', imageModels: ['custom-image'] } as any, 'image'),
    ['custom-image'],
  );
  assert.deepEqual(
    advancedProviderModelOptions({ id: 'modelscope', protocol: 'modelscope' } as any, 'llm'),
    ['Qwen/Qwen3-Coder-480B-A35B-Instruct'],
  );
});

test('externalImageSizeFor maps T8 ratio and size labels to stable WxH values', () => {
  assert.equal(externalImageSizeFor('1:1', '1K'), '1024x1024');
  assert.equal(externalImageSizeFor('16:9', '1K'), '1344x768');
  assert.equal(externalImageSizeFor('9:16', '2K'), '1536x2688');
  assert.equal(externalImageSizeFor('bad', 'unknown'), '1024x1024');
});
