import test from 'node:test';
import assert from 'node:assert/strict';

import {
  advancedProviderSummary,
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
