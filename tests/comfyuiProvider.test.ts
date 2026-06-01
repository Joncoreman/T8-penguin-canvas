import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const comfyui = require('../backend/src/providers/comfyui.js');

function jsonResponse(body: any, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => 'image/png' },
    async text() {
      return JSON.stringify(body);
    },
    async json() {
      return body;
    },
    async arrayBuffer() {
      return Buffer.from('PNG').buffer;
    },
  };
}

test('ComfyUI image generation patches workflow, submits prompt, polls history and returns view urls', async () => {
  const calls: any[] = [];
  const provider = {
    id: 'comfyui',
    protocol: 'comfyui',
    baseUrl: 'http://127.0.0.1:8188',
    enabled: true,
    comfyuiConfig: {
      workflows: [
        {
          id: 'workflow-1',
          name: 'Flux Workflow',
          workflowJson: {
            '1': { class_type: 'CLIPTextEncode', inputs: { text: '' } },
            '2': { class_type: 'KSampler', inputs: { seed: 1 } },
            '3': { class_type: 'EmptyLatentImage', inputs: { width: 512, height: 512 } },
          },
          fields: [
            { nodeId: '1', fieldName: 'text', source: 'prompt' },
            { nodeId: '3', fieldName: 'width', source: 'width' },
            { nodeId: '3', fieldName: 'height', source: 'height' },
          ],
        },
      ],
    },
  };

  const result = await comfyui.generateImage(provider, {
    prompt: 'a court',
    providerModel: 'workflow-1',
    size: '1024x768',
  }, {
    pollIntervalMs: 1,
    fetchImpl: async (url: string, init: any = {}) => {
      if (String(url).endsWith('/prompt')) {
        calls.push({ url, init, body: JSON.parse(init.body) });
        return jsonResponse({ prompt_id: 'pid-1' });
      }
      calls.push({ url, init });
      return jsonResponse({
        'pid-1': {
          outputs: {
            '9': { images: [{ filename: 'out.png', type: 'output', subfolder: '' }] },
          },
        },
      });
    },
  });

  assert.equal(result.ok, true);
  assert.equal(calls[0].body.prompt['1'].inputs.text, 'a court');
  assert.equal(calls[0].body.prompt['3'].inputs.width, 1024);
  assert.equal(calls[0].body.prompt['3'].inputs.height, 768);
  assert.deepEqual(result.imageUrls, ['http://127.0.0.1:8188/view?filename=out.png&type=output&subfolder=']);
});
