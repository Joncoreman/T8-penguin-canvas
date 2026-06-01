import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

async function listen(app: any) {
  return new Promise<any>((resolve) => {
    const server = app.listen(0, '127.0.0.1', () => resolve(server));
  });
}

test('external provider generation routes run enabled OpenAI compatible LLM and image calls', async (t) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 't8-external-generation-'));
  t.after(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  const upstreamApp = express();
  upstreamApp.use(express.json({ limit: '4mb' }));
  const upstreamCalls: any[] = [];
  upstreamApp.post('/v1/chat/completions', (req, res) => {
    upstreamCalls.push({ path: req.path, body: req.body, auth: req.header('authorization') });
    res.json({ choices: [{ message: { content: 'external hello' } }] });
  });
  upstreamApp.post('/v1/images/generations', (req, res) => {
    upstreamCalls.push({ path: req.path, body: req.body, auth: req.header('authorization') });
    res.json({ data: [{ b64_json: Buffer.from('PNGDATA').toString('base64'), mime_type: 'image/png' }] });
  });
  upstreamApp.post('/v1/videos/generations', (req, res) => {
    upstreamCalls.push({ path: req.path, body: req.body, auth: req.header('authorization') });
    res.json({ data: { video_url: 'data:video/mp4;base64,TVA0REFUQQ==', task_id: 'video-route-1' } });
  });
  const upstreamServer = await listen(upstreamApp);
  t.after(() => upstreamServer.close());

  const config = require('../backend/src/config.js');
  const oldConfig = {
    SETTINGS_FILE: config.SETTINGS_FILE,
    OUTPUT_DIR: config.OUTPUT_DIR,
    DEFAULT_LOCAL_SAVE_DIR: config.DEFAULT_LOCAL_SAVE_DIR,
    DEFAULT_CANVAS_AUTO_SAVE_DIR: config.DEFAULT_CANVAS_AUTO_SAVE_DIR,
    DEFAULT_RESOURCE_LIBRARY_DIR: config.DEFAULT_RESOURCE_LIBRARY_DIR,
    DEFAULT_THEME_TEMPLATE_DIR: config.DEFAULT_THEME_TEMPLATE_DIR,
  };
  t.after(() => Object.assign(config, oldConfig));
  config.SETTINGS_FILE = path.join(tmpDir, 'settings.json');
  config.OUTPUT_DIR = path.join(tmpDir, 'output');
  config.DEFAULT_LOCAL_SAVE_DIR = path.join(tmpDir, 'save');
  config.DEFAULT_CANVAS_AUTO_SAVE_DIR = path.join(tmpDir, 'canvas');
  config.DEFAULT_RESOURCE_LIBRARY_DIR = path.join(tmpDir, 'resources');
  config.DEFAULT_THEME_TEMPLATE_DIR = path.join(tmpDir, 'themes');
  fs.mkdirSync(config.OUTPUT_DIR, { recursive: true });

  const settingsRouter = require('../backend/src/routes/settings.js');
  const externalProvidersRouter = require('../backend/src/routes/externalProviders.js');
  const app = express();
  app.use(express.json({ limit: '4mb' }));
  app.use('/api/settings', settingsRouter);
  app.use('/api/proxy/external', externalProvidersRouter);
  const server = await listen(app);
  t.after(() => server.close());

  const base = `http://127.0.0.1:${server.address().port}`;
  const upstreamBase = `http://127.0.0.1:${upstreamServer.address().port}/v1`;
  await fetch(`${base}/api/settings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      advancedProviders: [
        {
          id: 'openai-compatible',
          protocol: 'openai-compatible',
          enabled: true,
          baseUrl: upstreamBase,
          apiKey: 'sk-route-secret',
          imageModels: ['gpt-image-test'],
          videoModels: ['video-test'],
          chatModels: ['gpt-chat-test'],
        },
      ],
    }),
  }).then((res) => res.json());

  const llm = await fetch(`${base}/api/proxy/external/llm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ providerId: 'openai-compatible', prompt: 'hello route' }),
  }).then((res) => res.json());

  assert.equal(llm.success, true);
  assert.equal(llm.data.text, 'external hello');
  assert.equal(JSON.stringify(llm).includes('sk-route-secret'), false);

  const image = await fetch(`${base}/api/proxy/external/image`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ providerId: 'openai-compatible', prompt: 'draw route', size: '512x512' }),
  }).then((res) => res.json());

  assert.equal(image.success, true);
  assert.equal(image.data.imageUrls.length, 1);
  assert.match(image.data.imageUrls[0], /^\/files\/output\/external_/);
  assert.equal(fs.existsSync(path.join(config.OUTPUT_DIR, path.basename(image.data.imageUrls[0]))), true);

  const video = await fetch(`${base}/api/proxy/external/video`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      providerId: 'openai-compatible',
      model: 'video-test',
      prompt: 'video route',
      aspect_ratio: '16:9',
      duration: 6,
    }),
  }).then((res) => res.json());

  assert.equal(video.success, true);
  assert.equal(video.data.taskId, 'video-route-1');
  assert.equal(video.data.videoUrls.length, 1);
  assert.match(video.data.videoUrls[0], /^\/files\/output\/external_/);
  assert.equal(fs.existsSync(path.join(config.OUTPUT_DIR, path.basename(video.data.videoUrls[0]))), true);
  assert.equal(upstreamCalls[0].auth, 'Bearer sk-route-secret');
  assert.equal(upstreamCalls[1].auth, 'Bearer sk-route-secret');
  assert.equal(upstreamCalls[2].auth, 'Bearer sk-route-secret');
});
