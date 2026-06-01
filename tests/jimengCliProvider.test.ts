import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const jimengCli = require('../backend/src/providers/jimengCli.js');

test('Jimeng image generation builds text2image command and extracts returned media', async () => {
  const commands: any[] = [];
  const provider = {
    id: 'jimeng-cli',
    protocol: 'jimeng-cli',
    imageModels: ['jimeng-image-2k'],
    jimengConfig: { executablePath: 'dreamina', pollSeconds: 20 },
  };

  const result = await jimengCli.generateImage(provider, {
    prompt: 'basketball pose',
    model: 'jimeng-image-2k',
    size: '1344x768',
  }, {
    runCli: async (command: string, args: string[]) => {
      commands.push({ command, args });
      return { images: ['C:\\tmp\\jimeng.png'] };
    },
    storeOutput: async (value: string) => `/files/output/${value.split('\\').pop()}`,
  });

  assert.equal(result.ok, true);
  assert.equal(commands[0].command, 'dreamina');
  assert.equal(commands[0].args[0], 'text2image');
  assert.ok(commands[0].args.includes('--prompt=basketball pose'));
  assert.ok(commands[0].args.includes('--ratio=16:9'));
  assert.ok(commands[0].args.includes('--resolution_type=2k'));
  assert.deepEqual(result.imageUrls, ['/files/output/jimeng.png']);
});

test('Jimeng video generation builds image2video command when one reference image is provided', async () => {
  const commands: any[] = [];
  const provider = {
    id: 'jimeng-cli',
    protocol: 'jimeng-cli',
    videoModels: ['seedance2.0fast_vip'],
    jimengConfig: { executablePath: 'dreamina', pollSeconds: 20 },
  };

  const result = await jimengCli.generateVideo(provider, {
    prompt: 'run',
    model: 'seedance2.0fast_vip',
    aspect_ratio: '9:16',
    duration: 6,
    resolution: '720p',
    images: ['C:\\tmp\\ref.png'],
  }, {
    resolveLocalMedia: async (value: string) => value,
    runCli: async (command: string, args: string[]) => {
      commands.push({ command, args });
      return { videos: ['C:\\tmp\\jimeng.mp4'], submit_id: 'sub-1' };
    },
    storeOutput: async (value: string) => `/files/output/${value.split('\\').pop()}`,
  });

  assert.equal(result.ok, true);
  assert.equal(commands[0].args[0], 'multimodal2video');
  assert.ok(commands[0].args.includes('--image=C:\\tmp\\ref.png'));
  assert.ok(commands[0].args.includes('--ratio=9:16'));
  assert.ok(commands[0].args.includes('--model_version=seedance2.0fast_vip'));
  assert.deepEqual(result.videoUrls, ['/files/output/jimeng.mp4']);
  assert.equal(result.taskId, 'sub-1');
});
