import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const comfyui = require('../backend/src/providers/comfyui.js');
const {
  analyzeComfyWorkflow,
  canonicalizeComfyFieldsByWorkflow,
  compactComfyFields,
  filterComfyFieldsByExcludeRules,
  parseComfyFieldExcludeRules,
} = await import('../src/utils/comfyuiWorkflow.ts');

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
            '4': { class_type: 'LoadImage', inputs: { image: '' } },
          },
          fields: [
            { nodeId: '1', fieldName: 'text', source: 'prompt' },
            { nodeId: '3', fieldName: 'width', source: 'width' },
            { nodeId: '3', fieldName: 'height', source: 'height' },
            { nodeId: '4', fieldName: 'image', source: 'image1' },
          ],
        },
      ],
    },
  };

  const result = await comfyui.generateImage(provider, {
    prompt: 'a court',
    providerModel: 'workflow-1',
    size: '1024x768',
    images: ['/files/input/ref.png'],
  }, {
    baseUrl: 'http://127.0.0.1:18766',
    pollIntervalMs: 1,
    fetchImpl: async (url: string, init: any = {}) => {
      if (String(url).includes('/files/input/ref.png')) {
        calls.push({ url, init });
        return jsonResponse({}, 200);
      }
      if (String(url).endsWith('/upload/image')) {
        calls.push({ url, init, upload: true });
        return jsonResponse({ name: 'ref-uploaded.png' });
      }
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
  const promptCall = calls.find((call) => String(call.url).endsWith('/prompt'));
  assert.equal(promptCall.body.prompt['1'].inputs.text, 'a court');
  assert.equal(promptCall.body.prompt['3'].inputs.width, 1024);
  assert.equal(promptCall.body.prompt['3'].inputs.height, 768);
  assert.equal(promptCall.body.prompt['4'].inputs.image, 'ref-uploaded.png');
  const downloadCall = calls.find((call) => String(call.url).includes('/files/input/ref.png'));
  const uploadCall = calls.find((call) => String(call.url).endsWith('/upload/image'));
  assert.equal(String(downloadCall.url), 'http://127.0.0.1:18766/files/input/ref.png');
  assert.equal(String(uploadCall.url), 'http://127.0.0.1:8188/upload/image');
  assert.deepEqual(result.imageUrls, ['http://127.0.0.1:8188/view?filename=out.png&type=output&subfolder=']);
});

test('ComfyUI field mappings ignore stale value unless source is fixed', async () => {
  const calls: any[] = [];
  const provider = {
    id: 'comfyui',
    protocol: 'comfyui',
    baseUrl: 'http://127.0.0.1:8188',
    enabled: true,
    comfyuiConfig: {
      workflows: [
        {
          id: 'workflow-stale-values',
          name: 'Workflow With Stale Values',
          workflowJson: {
            '1': { class_type: 'CLIPTextEncode', inputs: { text: 'old prompt' } },
            '2': { class_type: 'EmptyLatentImage', inputs: { width: 512, height: 512 } },
            '3': { class_type: 'LoadImage', inputs: { image: 'old.png' } },
            '4': { class_type: 'CustomNode', inputs: { token: '' } },
            '9': { class_type: 'SaveImage', inputs: { images: ['8', 0] } },
          },
          fields: [
            { nodeId: '1', fieldName: 'text', source: 'prompt', value: 'stale prompt must not win' },
            { nodeId: '2', fieldName: 'width', source: 'width', value: 640 },
            { nodeId: '2', fieldName: 'height', source: 'height', value: 640 },
            { nodeId: '3', fieldName: 'image', source: 'image1', value: 'stale-image.png' },
            { nodeId: '4', fieldName: 'token', source: 'fixed', value: 'keep-fixed-token' },
          ],
        },
      ],
    },
  };

  const result = await comfyui.generateImage(provider, {
    prompt: 'fresh runtime prompt',
    providerModel: 'workflow-stale-values',
    size: '1280x720',
    images: ['/files/input/fresh.png'],
  }, {
    baseUrl: 'http://127.0.0.1:18766',
    pollIntervalMs: 1,
    fetchImpl: async (url: string, init: any = {}) => {
      if (String(url).includes('/files/input/fresh.png')) return jsonResponse({}, 200);
      if (String(url).endsWith('/upload/image')) {
        calls.push({ url, init, upload: true });
        return jsonResponse({ name: 'fresh-uploaded.png' });
      }
      if (String(url).endsWith('/prompt')) {
        calls.push({ url, init, body: JSON.parse(init.body) });
        return jsonResponse({ prompt_id: 'pid-stale' });
      }
      return jsonResponse({
        'pid-stale': {
          outputs: {
            '9': { images: [{ filename: 'fresh-out.png', type: 'output', subfolder: '' }] },
          },
        },
      });
    },
  });

  assert.equal(result.ok, true);
  const promptCall = calls.find((call) => String(call.url).endsWith('/prompt'));
  assert.equal(promptCall.body.prompt['1'].inputs.text, 'fresh runtime prompt');
  assert.equal(promptCall.body.prompt['2'].inputs.width, 1280);
  assert.equal(promptCall.body.prompt['2'].inputs.height, 720);
  assert.equal(promptCall.body.prompt['3'].inputs.image, 'fresh-uploaded.png');
  assert.equal(promptCall.body.prompt['4'].inputs.token, 'keep-fixed-token');
});

test('compactComfyFields keeps fixed values but drops stale runtime-source values', () => {
  assert.deepEqual(
    compactComfyFields([
      { nodeId: '1', fieldName: 'text', source: 'prompt', value: 'old prompt' } as any,
      { nodeId: '2', fieldName: 'image', source: 'image1', value: 'old.png' } as any,
      { nodeId: '3', fieldName: 'token', source: 'fixed', value: 'abc' } as any,
      { nodeId: '4', fieldName: 'custom', value: 'manual fixed' } as any,
    ]),
    [
      { nodeId: '1', fieldName: 'text', source: 'prompt' },
      { nodeId: '2', fieldName: 'image', source: 'image1' },
      { nodeId: '3', fieldName: 'token', source: 'fixed', value: 'abc' },
      { nodeId: '4', fieldName: 'custom', source: 'fixed', value: 'manual fixed' },
    ],
  );
});

test('ComfyUI workflow analyzer creates friendly mappings for common API workflow nodes', () => {
  const analysis = analyzeComfyWorkflow({
    '1': { class_type: 'CLIPTextEncode', inputs: { text: '' }, _meta: { title: 'Positive Prompt' } },
    '2': { class_type: 'CLIPTextEncode', inputs: { text: '' }, _meta: { title: 'Negative Prompt' } },
    '3': { class_type: 'LoadImage', inputs: { image: '' } },
    '4': { class_type: 'EmptyLatentImage', inputs: { width: 512, height: 768 } },
    '5': { class_type: 'KSampler', inputs: { seed: 1, steps: 20, cfg: 7, sampler_name: 'euler', scheduler: 'normal' } },
    '6': { class_type: 'SaveImage', inputs: { images: ['x', 0] } },
  });

  assert.equal(analysis.imageInputCount, 1);
  assert.equal(analysis.outputCount, 1);
  assert.deepEqual(
    analysis.fields.map((field) => [field.nodeId, field.fieldName, field.source]),
    [
      ['1', 'text', 'prompt'],
      ['2', 'text', 'negative'],
      ['3', 'image', 'image1'],
      ['4', 'width', 'width'],
      ['4', 'height', 'height'],
      ['5', 'seed', 'seed'],
      ['5', 'steps', 'steps'],
      ['5', 'cfg', 'cfg'],
      ['5', 'sampler_name', 'sampler_name'],
      ['5', 'scheduler', 'scheduler'],
    ],
  );
});

test('ComfyUI workflow analyzer uses sampler links to avoid swapping positive and negative prompt nodes', () => {
  const analysis = analyzeComfyWorkflow({
    '71': {
      class_type: 'KSampler',
      inputs: {
        seed: 528424127902021,
        steps: 40,
        cfg: 4.5,
        sampler_name: 'er_sde',
        scheduler: 'beta',
        denoise: 1,
        positive: ['91', 0],
        negative: ['87', 0],
        latent_image: ['86', 0],
      },
      _meta: { title: 'K采样器' },
    },
    '85': { class_type: 'CLIPLoader', inputs: { clip_name: 'qwen_3_06b_base.safetensors' } },
    '86': { class_type: 'EmptyLatentImage', inputs: { width: 1920, height: 1080, batch_size: 1 } },
    '87': { class_type: 'CLIPTextEncode', inputs: { text: 'bad anatomy', clip: ['85', 0] }, _meta: { title: 'CLIP文本编码' } },
    '88': { class_type: 'SaveImage', inputs: { filename_prefix: 'ComfyUI', images: ['90', 0] } },
    '91': { class_type: 'CLIPTextEncode', inputs: { text: 'masterpiece', clip: ['85', 0] }, _meta: { title: 'CLIP文本编码' } },
    '94': { class_type: 'AnimaBoosterLoader', inputs: { model_name: 'anima-base-v1.0.safetensors' } },
    '95': { class_type: 'VAELoader', inputs: { vae_name: 'qwen_image_vae.safetensors' } },
  });

  const sourceByNodeField = new Map(analysis.fields.map((field) => [`${field.nodeId}.${field.fieldName}`, field.source]));
  assert.equal(sourceByNodeField.get('91.text'), 'prompt');
  assert.equal(sourceByNodeField.get('87.text'), 'negative');
  assert.equal(sourceByNodeField.get('86.batch_size'), 'batch_size');
  assert.equal(sourceByNodeField.get('94.model_name'), 'model_name');
  assert.equal(sourceByNodeField.get('85.clip_name'), 'clip_name');
  assert.equal(sourceByNodeField.get('95.vae_name'), 'vae_name');
});

test('ComfyUI exclude rules filter auto mapped fields by source, class and node input', () => {
  const workflow = {
    '1': { class_type: 'CLIPTextEncode', inputs: { text: 'prompt' }, _meta: { title: 'Positive Prompt' } },
    '2': { class_type: 'KSampler', inputs: { seed: 1, steps: 20, cfg: 7 } },
    '3': { class_type: 'EmptyLatentImage', inputs: { width: 512, height: 768, batch_size: 1 } },
  };
  const fields = analyzeComfyWorkflow(workflow).fields;

  assert.deepEqual(parseComfyFieldExcludeRules('seed, steps\n#3.batch_size'), ['seed', 'steps', '#3.batch_size']);
  assert.deepEqual(
    filterComfyFieldsByExcludeRules(workflow, fields, ['class:KSampler', '#3.batch_size'])
      .map((field) => `${field.nodeId}.${field.fieldName}:${field.source}`),
    [
      '1.text:prompt',
      '3.width:width',
      '3.height:height',
    ],
  );
});

test('ComfyUI image generation respects workflow exclude rules during submit', async () => {
  const calls: any[] = [];
  const provider = {
    id: 'comfyui',
    protocol: 'comfyui',
    baseUrl: 'http://127.0.0.1:8188',
    enabled: true,
    comfyuiConfig: {
      workflows: [
        {
          id: 'workflow-exclude',
          name: 'Workflow exclude',
          workflowJson: {
            '1': { class_type: 'CLIPTextEncode', inputs: { text: 'old prompt' } },
            '2': { class_type: 'KSampler', inputs: { seed: 11, steps: 20 } },
            '3': { class_type: 'EmptyLatentImage', inputs: { width: 512, height: 512 } },
            '9': { class_type: 'SaveImage', inputs: { images: ['8', 0] } },
          },
          excludeRules: ['seed', '#3.width'],
        },
      ],
    },
  };

  const result = await comfyui.generateImage(provider, {
    prompt: 'fresh prompt',
    providerModel: 'workflow-exclude',
    size: '1024x768',
    providerParams: { seed: 999, steps: 40 },
  }, {
    pollIntervalMs: 1,
    fetchImpl: async (url: string, init: any = {}) => {
      if (String(url).endsWith('/prompt')) {
        calls.push({ url, init, body: JSON.parse(init.body) });
        return jsonResponse({ prompt_id: 'pid-exclude' });
      }
      return jsonResponse({
        'pid-exclude': {
          outputs: {
            '9': { images: [{ filename: 'out.png', type: 'output', subfolder: '' }] },
          },
        },
      });
    },
  });

  assert.equal(result.ok, true);
  const promptCall = calls.find((call) => String(call.url).endsWith('/prompt'));
  assert.equal(promptCall.body.prompt['1'].inputs.text, 'fresh prompt');
  assert.equal(promptCall.body.prompt['2'].inputs.seed, 11);
  assert.equal(promptCall.body.prompt['2'].inputs.steps, 40);
  assert.equal(promptCall.body.prompt['3'].inputs.width, 512);
  assert.equal(promptCall.body.prompt['3'].inputs.height, 768);
});

test('ComfyUI canonical fields repair stale saved prompt mapping from sampler links', () => {
  const workflow = {
    '71': {
      class_type: 'KSampler',
      inputs: {
        positive: ['91', 0],
        negative: ['87', 0],
        latent_image: ['86', 0],
      },
    },
    '86': { class_type: 'EmptyLatentImage', inputs: { width: 1920, height: 1080 } },
    '87': { class_type: 'CLIPTextEncode', inputs: { text: 'old negative' }, _meta: { title: 'CLIP文本编码' } },
    '91': { class_type: 'CLIPTextEncode', inputs: { text: 'old positive' }, _meta: { title: 'CLIP文本编码' } },
  };

  const fields = canonicalizeComfyFieldsByWorkflow(workflow, [
    { nodeId: '86', fieldName: 'width', source: 'width' },
    { nodeId: '86', fieldName: 'height', source: 'height' },
    { nodeId: '87', fieldName: 'text', source: 'prompt' },
  ]);

  const sourceByNodeField = new Map(fields.map((field) => [`${field.nodeId}.${field.fieldName}`, field.source]));
  assert.equal(sourceByNodeField.get('87.text'), 'negative');
  assert.equal(sourceByNodeField.get('91.text'), 'prompt');
});

test('ComfyUI image generation repairs stale saved prompt mapping before submit', async () => {
  const calls: any[] = [];
  const provider = {
    id: 'comfyui',
    protocol: 'comfyui',
    baseUrl: 'http://127.0.0.1:8188',
    enabled: true,
    comfyuiConfig: {
      workflows: [
        {
          id: 'anima-stale-fields',
          name: 'Anima stale fields',
          workflowJson: {
            '71': {
              class_type: 'KSampler',
              inputs: {
                seed: 1,
                positive: ['91', 0],
                negative: ['87', 0],
                latent_image: ['86', 0],
              },
            },
            '86': { class_type: 'EmptyLatentImage', inputs: { width: 1920, height: 1080 } },
            '87': { class_type: 'CLIPTextEncode', inputs: { text: 'old negative' }, _meta: { title: 'CLIP文本编码' } },
            '88': { class_type: 'SaveImage', inputs: { images: ['90', 0] } },
            '91': { class_type: 'CLIPTextEncode', inputs: { text: 'old cyberpunk positive' }, _meta: { title: 'CLIP文本编码' } },
          },
          fields: [
            { nodeId: '86', fieldName: 'width', source: 'width' },
            { nodeId: '86', fieldName: 'height', source: 'height' },
            { nodeId: '87', fieldName: 'text', source: 'prompt' },
          ],
        },
      ],
    },
  };

  const result = await comfyui.generateImage(provider, {
    prompt: 'socore_9,score_8,1girl,nsfw,nude body',
    providerModel: 'anima-stale-fields',
    size: '1024x768',
  }, {
    pollIntervalMs: 1,
    fetchImpl: async (url: string, init: any = {}) => {
      if (String(url).endsWith('/prompt')) {
        calls.push({ url, init, body: JSON.parse(init.body) });
        return jsonResponse({ prompt_id: 'pid-stale-map' });
      }
      return jsonResponse({
        'pid-stale-map': {
          outputs: {
            '88': { images: [{ filename: 'out.png', type: 'output', subfolder: '' }] },
          },
        },
      });
    },
  });

  assert.equal(result.ok, true);
  const promptCall = calls.find((call) => String(call.url).endsWith('/prompt'));
  assert.equal(promptCall.body.prompt['91'].inputs.text, 'socore_9,score_8,1girl,nsfw,nude body');
  assert.equal(promptCall.body.prompt['87'].inputs.text, 'old negative');
  assert.equal(promptCall.body.prompt['86'].inputs.width, 1024);
  assert.equal(promptCall.body.prompt['86'].inputs.height, 768);
});

test('ComfyUI image generation preserves sampler-linked negative prompt when heuristic fallback runs', async () => {
  const calls: any[] = [];
  const provider = {
    id: 'comfyui',
    protocol: 'comfyui',
    baseUrl: 'http://127.0.0.1:8188',
    enabled: true,
    comfyuiConfig: {
      workflows: [
        {
          id: 'anima-like',
          name: 'Anima-like',
          workflowJson: {
            '71': {
              class_type: 'KSampler',
              inputs: {
                seed: 1,
                steps: 40,
                cfg: 4.5,
                sampler_name: 'er_sde',
                scheduler: 'beta',
                denoise: 1,
                positive: ['91', 0],
                negative: ['87', 0],
                latent_image: ['86', 0],
              },
            },
            '86': { class_type: 'EmptyLatentImage', inputs: { width: 1920, height: 1080, batch_size: 1 } },
            '87': { class_type: 'CLIPTextEncode', inputs: { text: 'old negative' }, _meta: { title: 'CLIP文本编码' } },
            '88': { class_type: 'SaveImage', inputs: { images: ['90', 0] } },
            '91': { class_type: 'CLIPTextEncode', inputs: { text: 'old prompt' }, _meta: { title: 'CLIP文本编码' } },
            '94': { class_type: 'AnimaBoosterLoader', inputs: { model_name: 'anima-base-v1.0.safetensors' } },
            '95': { class_type: 'VAELoader', inputs: { vae_name: 'qwen_image_vae.safetensors' } },
          },
        },
      ],
    },
  };

  const result = await comfyui.generateImage(provider, {
    prompt: 'fresh positive',
    negativePrompt: 'fresh negative',
    providerModel: 'anima-like',
    size: '512x512',
    providerParams: {
      seed: 123,
      steps: 4,
      cfg: 4,
      sampler_name: 'er_sde',
      scheduler: 'beta',
      denoise: 1,
      batch_size: 1,
    },
  }, {
    pollIntervalMs: 1,
    fetchImpl: async (url: string, init: any = {}) => {
      if (String(url).endsWith('/prompt')) {
        calls.push({ url, init, body: JSON.parse(init.body) });
        return jsonResponse({ prompt_id: 'pid-2' });
      }
      return jsonResponse({
        'pid-2': {
          outputs: {
            '88': { images: [{ filename: 'out.png', type: 'output', subfolder: '' }] },
          },
        },
      });
    },
  });

  assert.equal(result.ok, true);
  const promptCall = calls.find((call) => String(call.url).endsWith('/prompt'));
  assert.equal(promptCall.body.prompt['91'].inputs.text, 'fresh positive');
  assert.equal(promptCall.body.prompt['87'].inputs.text, 'fresh negative');
  assert.equal(promptCall.body.prompt['71'].inputs.seed, 123);
  assert.equal(promptCall.body.prompt['86'].inputs.width, 512);
  assert.equal(promptCall.body.prompt['86'].inputs.height, 512);
});
