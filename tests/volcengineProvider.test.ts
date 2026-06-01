import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const volcengine = require('../backend/src/providers/volcengine.js');

function jsonResponse(body: any, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async text() {
      return JSON.stringify(body);
    },
    async json() {
      return body;
    },
  };
}

test('Volcengine image generation posts Seedream-style payload to Ark images endpoint', async () => {
  const calls: any[] = [];
  const provider = {
    id: 'volcengine',
    protocol: 'volcengine',
    baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    apiKey: 'ark-secret',
    imageModels: ['doubao-seedream-4-0-250828'],
  };

  const result = await volcengine.generateImage(provider, {
    prompt: 'court',
    size: '1344x768',
    images: ['data:image/png;base64,AAA'],
  }, {
    fetchImpl: async (url: string, init: any) => {
      calls.push({ url, init, body: JSON.parse(init.body) });
      return jsonResponse({ data: [{ url: 'https://volc.example.com/out.png' }] });
    },
  });

  assert.equal(result.ok, true);
  assert.equal(calls[0].url, 'https://ark.cn-beijing.volces.com/api/v3/images/generations');
  assert.equal(calls[0].init.headers.Authorization, 'Bearer ark-secret');
  assert.equal(calls[0].body.model, 'doubao-seedream-4-0-250828');
  assert.equal(calls[0].body.size, '1344x768');
  assert.deepEqual(calls[0].body.image, ['data:image/png;base64,AAA']);
  assert.deepEqual(result.imageUrls, ['https://volc.example.com/out.png']);
});

test('Volcengine video generation submits content array and polls returned task id', async () => {
  const calls: any[] = [];
  const provider = {
    id: 'volcengine',
    protocol: 'volcengine',
    baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    apiKey: 'ark-secret',
    videoModels: ['doubao-seedance-2-0-fast-260128'],
  };

  const result = await volcengine.generateVideo(provider, {
    prompt: 'pass the ball',
    model: 'doubao-seedance-2-0-fast-260128',
    aspect_ratio: '16:9',
    duration: 5,
    resolution: '720p',
    images: ['data:image/png;base64,AAA'],
  }, {
    pollIntervalMs: 1,
    fetchImpl: async (url: string, init: any = {}) => {
      if (init.method === 'POST') {
        calls.push({ url, init, body: JSON.parse(init.body) });
        return jsonResponse({ id: 'task-123' });
      }
      calls.push({ url, init });
      return jsonResponse({ status: 'SUCCESS', data: { video_url: 'https://volc.example.com/out.mp4' } });
    },
  });

  assert.equal(result.ok, true);
  assert.equal(calls[0].url, 'https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks');
  assert.equal(calls[0].body.model, 'doubao-seedance-2-0-fast-260128');
  assert.equal(calls[0].body.duration, 5);
  assert.equal(calls[0].body.resolution, '720p');
  assert.equal(calls[0].body.content[0].type, 'text');
  assert.equal(calls[0].body.content[1].type, 'image_url');
  assert.match(calls[1].url, /\/contents\/generations\/tasks\/task-123$/);
  assert.deepEqual(result.videoUrls, ['https://volc.example.com/out.mp4']);
});
