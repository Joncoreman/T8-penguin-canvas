import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

test('external provider test endpoint resolves saved providers without leaking secrets', async (t) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 't8-external-providers-'));
  t.after(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  const config = require('../backend/src/config.js');
  const oldConfig = {
    SETTINGS_FILE: config.SETTINGS_FILE,
    DEFAULT_LOCAL_SAVE_DIR: config.DEFAULT_LOCAL_SAVE_DIR,
    DEFAULT_CANVAS_AUTO_SAVE_DIR: config.DEFAULT_CANVAS_AUTO_SAVE_DIR,
    DEFAULT_RESOURCE_LIBRARY_DIR: config.DEFAULT_RESOURCE_LIBRARY_DIR,
    DEFAULT_THEME_TEMPLATE_DIR: config.DEFAULT_THEME_TEMPLATE_DIR,
  };
  t.after(() => Object.assign(config, oldConfig));
  config.SETTINGS_FILE = path.join(tmpDir, 'settings.json');
  config.DEFAULT_LOCAL_SAVE_DIR = path.join(tmpDir, 'save');
  config.DEFAULT_CANVAS_AUTO_SAVE_DIR = path.join(tmpDir, 'canvas');
  config.DEFAULT_RESOURCE_LIBRARY_DIR = path.join(tmpDir, 'resources');
  config.DEFAULT_THEME_TEMPLATE_DIR = path.join(tmpDir, 'themes');

  const express = require('express');
  const settingsRouter = require('../backend/src/routes/settings.js');
  const externalProvidersRouter = require('../backend/src/routes/externalProviders.js');
  const app = express();
  app.use(express.json({ limit: '1mb' }));
  app.use('/api/settings', settingsRouter);
  app.use('/api/proxy/external', externalProvidersRouter);

  const server = await new Promise<any>((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  t.after(() => server.close());

  const base = `http://127.0.0.1:${server.address().port}`;
  await fetch(`${base}/api/settings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      advancedProviders: [
        {
          id: 'modelscope',
          protocol: 'modelscope',
          enabled: true,
          apiKey: 'ms-secret-abcdef',
          imageModels: ['MusePublic/489_ckpt_FLUX_1'],
        },
      ],
    }),
  }).then((res) => res.json());

  const tested = await fetch(`${base}/api/proxy/external/test-provider`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ providerId: 'modelscope', dryRun: true }),
  }).then((res) => res.json());

  assert.equal(tested.success, true);
  assert.equal(tested.data.ok, true);
  assert.equal(tested.data.providerId, 'modelscope');
  assert.equal(tested.data.protocol, 'modelscope');
  assert.equal(JSON.stringify(tested).includes('ms-secret-abcdef'), false);

  const missing = await fetch(`${base}/api/proxy/external/test-provider`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ providerId: 'nope', dryRun: true }),
  }).then((res) => res.json());

  assert.equal(missing.success, false);
  assert.equal(missing.code, 'provider_not_found');
});
