import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const openaiCompatible = require('../backend/src/providers/openaiCompatible.js');

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

test('OpenAI compatible chat posts to chat/completions and normalizes assistant text', async () => {
  const calls: any[] = [];
  const provider = {
    id: 'custom-openai',
    protocol: 'openai-compatible',
    baseUrl: 'https://api.example.com/v1/',
    apiKey: 'sk-secret',
    chatModels: ['gpt-4o-mini'],
  };

  const result = await openaiCompatible.generateChat(provider, {
    prompt: 'hello',
    temperature: 0.25,
  }, {
    fetchImpl: async (url: string, init: any) => {
      calls.push({ url, init, body: JSON.parse(init.body) });
      return jsonResponse({
        choices: [
          { message: { content: 'world' } },
        ],
      });
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.kind, 'llm');
  assert.equal(result.text, 'world');
  assert.equal(calls[0].url, 'https://api.example.com/v1/chat/completions');
  assert.equal(calls[0].init.headers.Authorization, 'Bearer sk-secret');
  assert.equal(calls[0].body.model, 'gpt-4o-mini');
  assert.deepEqual(calls[0].body.messages, [{ role: 'user', content: 'hello' }]);
  assert.equal(calls[0].body.temperature, 0.25);
});

test('OpenAI compatible chat preserves remote video_url multimodal parts', async () => {
  const calls: any[] = [];
  const provider = {
    id: 'custom-openai',
    protocol: 'openai-compatible',
    baseUrl: 'https://api.example.com/v1',
    apiKey: 'sk-secret',
    chatModels: ['gpt-4o-mini'],
  };

  const result = await openaiCompatible.generateChat(provider, {
    model: 'gpt-4o-mini',
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: 'describe motion' },
        { type: 'video_url', video_url: { url: 'https://cdn.example.com/clip.mp4' } },
      ],
    }],
    llmVideoMode: 'compressed-base64',
  }, {
    fetchImpl: async (url: string, init: any) => {
      calls.push({ url, init, body: JSON.parse(init.body) });
      return jsonResponse({ choices: [{ message: { content: 'moving' } }] });
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.text, 'moving');
  assert.equal(calls[0].body.messages[0].content[1].type, 'video_url');
  assert.equal(calls[0].body.messages[0].content[1].video_url.url, 'https://cdn.example.com/clip.mp4');
});

test('OpenAI compatible image generation normalizes url and b64_json results', async () => {
  const calls: any[] = [];
  const provider = {
    id: 'custom-openai',
    protocol: 'openai-compatible',
    baseUrl: 'https://api.example.com/v1',
    apiKey: 'sk-secret',
    imageModels: ['gpt-image-1'],
  };

  const result = await openaiCompatible.generateImage(provider, {
    prompt: 'a tiny penguin',
    size: '1024x1024',
    n: 2,
  }, {
    fetchImpl: async (url: string, init: any) => {
      calls.push({ url, init, body: JSON.parse(init.body) });
      return jsonResponse({
        data: [
          { url: 'https://cdn.example.com/penguin.png' },
          { b64_json: 'QUJD', mime_type: 'image/png' },
        ],
      });
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.kind, 'image');
  assert.deepEqual(result.imageUrls, [
    'https://cdn.example.com/penguin.png',
    'data:image/png;base64,QUJD',
  ]);
  assert.equal(calls[0].url, 'https://api.example.com/v1/images/generations');
  assert.equal(calls[0].init.headers.Authorization, 'Bearer sk-secret');
  assert.equal(calls[0].body.model, 'gpt-image-1');
  assert.equal(calls[0].body.prompt, 'a tiny penguin');
  assert.equal(calls[0].body.size, '1024x1024');
  assert.equal(calls[0].body.n, 2);
});

test('OpenAI compatible video generation posts to video endpoint and normalizes returned media urls', async () => {
  const calls: any[] = [];
  const provider = {
    id: 'custom-openai',
    protocol: 'openai-compatible',
    baseUrl: 'https://api.example.com/v1',
    apiKey: 'sk-secret',
    videoModels: ['video-model'],
  };

  const result = await openaiCompatible.generateVideo(provider, {
    prompt: 'a quick pass',
    model: 'video-model',
    aspect_ratio: '16:9',
    duration: 6,
    resolution: '720p',
    images: ['data:image/png;base64,AAA'],
  }, {
    fetchImpl: async (url: string, init: any) => {
      calls.push({ url, init, body: JSON.parse(init.body) });
      return jsonResponse({
        data: {
          video_url: 'https://cdn.example.com/video.mp4',
          task_id: 'vid-1',
        },
      });
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.kind, 'video');
  assert.deepEqual(result.videoUrls, ['https://cdn.example.com/video.mp4']);
  assert.equal(result.taskId, 'vid-1');
  assert.equal(calls[0].url, 'https://api.example.com/v1/videos/generations');
  assert.equal(calls[0].init.headers.Authorization, 'Bearer sk-secret');
  assert.equal(calls[0].body.model, 'video-model');
  assert.equal(calls[0].body.prompt, 'a quick pass');
  assert.equal(calls[0].body.aspect_ratio, '16:9');
  assert.equal(calls[0].body.duration, 6);
  assert.deepEqual(calls[0].body.images, ['data:image/png;base64,AAA']);
});
