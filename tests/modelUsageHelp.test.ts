import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const canvasSource = readFileSync(new URL('../src/components/Canvas.tsx', import.meta.url), 'utf8');

test('model usage help text includes current image, video, audio and LLM notes', () => {
  assert.match(canvasSource, /如果不小心网页崩溃等，但是实际任务没失败，需要去网站异步任务看下/);
  assert.match(canvasSource, /gpt-image-2模型（default分组）可以出1K，2K，4K图，2K，4K不一定稳定/);
  assert.match(canvasSource, /veo-omni模型，需要使用default分组（veo-omnii模型是2026\.06\.06刚上架的）/);
  assert.match(canvasSource, /sora-2模型，支持sora-vip分组以及default默认分组的FAL模型/);
  assert.match(canvasSource, /suno v5\.5模型（Default分组）支持生成，翻唱，延长，一次生成两首歌/);
  assert.match(canvasSource, /LLM模型有时候因为官方问题会出现速度慢，失败等现象/);
});

test('model usage help no longer warns that Sora2 is unavailable', () => {
  assert.doesNotMatch(canvasSource, /sora-2模型，由于官方下架了/);
  assert.doesNotMatch(canvasSource, /目前有问题，先不要用/);
});
