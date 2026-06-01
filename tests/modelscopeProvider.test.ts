import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const modelscope = require('../backend/src/providers/modelscope.js');

function jsonResponse(body: any, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return body;
    },
    async text() {
      return JSON.stringify(body);
    },
  };
}

test('ModelScope image generation submits async task, polls, and normalizes output images', async () => {
  const calls: any[] = [];
  const provider = {
    id: 'modelscope',
    protocol: 'modelscope',
    baseUrl: 'https://api-inference.modelscope.cn/v1/',
    apiKey: 'ms-secret',
    imageModels: ['Tongyi-MAI/Z-Image-Turbo'],
  };

  const result = await modelscope.generateImage(provider, {
    prompt: 'a warm studio portrait',
    size: '832x1216',
  }, {
    pollIntervalMs: 1,
    timeoutMs: 100,
    fetchImpl: async (url: string, init: any) => {
      const parsedBody = init.body ? JSON.parse(init.body) : null;
      calls.push({ url, init, body: parsedBody });
      if (init.method === 'POST') {
        return jsonResponse({ task_id: 'task-123' });
      }
      if (calls.filter((call) => call.init.method === 'GET').length === 1) {
        return jsonResponse({ task_status: 'RUNNING' });
      }
      return jsonResponse({
        task_status: 'SUCCEED',
        output_images: ['https://modelscope.example.com/out.png'],
      });
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.kind, 'image');
  assert.equal(result.taskId, 'task-123');
  assert.deepEqual(result.imageUrls, ['https://modelscope.example.com/out.png']);
  assert.equal(calls[0].url, 'https://api-inference.modelscope.cn/v1/images/generations');
  assert.equal(calls[0].init.headers.Authorization, 'Bearer ms-secret');
  assert.equal(calls[0].init.headers['X-ModelScope-Async-Mode'], 'true');
  assert.equal(calls[0].body.model, 'Tongyi-MAI/Z-Image-Turbo');
  assert.equal(calls[0].body.width, 832);
  assert.equal(calls[0].body.height, 1216);
  assert.equal(calls[1].url, 'https://api-inference.modelscope.cn/v1/tasks/task-123');
  assert.equal(calls[1].init.headers['X-ModelScope-Task-Type'], 'image_generation');
});
