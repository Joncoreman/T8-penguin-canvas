const openaiCompatible = require('./openaiCompatible');
const { resolveMediaRef } = require('./mediaResolver');

const SUCCESS_STATUSES = new Set(['SUCCESS', 'SUCCEED', 'SUCCEEDED', 'COMPLETED', 'COMPLETE', 'DONE', 'FINISHED', 'OK', 'READY']);
const FAILURE_STATUSES = new Set(['FAILURE', 'FAILED', 'FAIL', 'ERROR', 'ERRORED', 'CANCELED', 'CANCELLED', 'TIMEOUT', 'REJECTED', 'EXPIRED']);

function cleanBaseUrl(value) {
  return String(value || '').trim().replace(/\/+$/, '') || 'https://ark.cn-beijing.volces.com/api/v3';
}

function endpointUrl(provider, defaultPath, overrideKeys = []) {
  return openaiCompatible.providerEndpointUrl({ ...provider, baseUrl: cleanBaseUrl(provider?.baseUrl) }, defaultPath, overrideKeys);
}

function bearerHeaders(provider) {
  return {
    Accept: 'application/json',
    Authorization: `Bearer ${String(provider?.apiKey || '').trim()}`,
    'Content-Type': 'application/json',
  };
}

function selectedModel(requested, models, fallback) {
  const fromList = Array.isArray(models) ? models.find((item) => String(item || '').trim()) : '';
  const model = String(requested || fromList || fallback || '').trim();
  if (!model) throw new Error('模型名称不能为空。');
  if (model.length > 240 || /[\x00-\x1f\x7f]/.test(model)) throw new Error('模型名称不合法。');
  return model;
}

async function responseJson(res) {
  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

function collectMediaUrls(value, out = []) {
  if (!value) return out;
  if (typeof value === 'string') {
    const text = value.trim();
    if (/^(https?:\/\/|data:(?:image|video)\/|\/files\/output\/)/i.test(text)) out.push(text);
    return out;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectMediaUrls(item, out);
    return out;
  }
  if (typeof value !== 'object') return out;
  for (const key of [
    'url', 'uri', 'value',
    'video_url', 'videoUrl', 'video_urls', 'videoUrls', 'videos',
    'file_url', 'fileUrl', 'download_url', 'downloadUrl',
    'data', 'output', 'outputs', 'results',
  ]) {
    if (Object.prototype.hasOwnProperty.call(value, key)) collectMediaUrls(value[key], out);
  }
  return out;
}

function extractTaskId(raw) {
  return String(raw?.id || raw?.task_id || raw?.taskId || raw?.data?.id || raw?.data?.task_id || raw?.data?.taskId || '').trim();
}

function extractStatus(raw) {
  const data = raw?.data && typeof raw.data === 'object' ? raw.data : raw;
  return String(data?.status || data?.task_status || raw?.status || raw?.task_status || '').trim().toUpperCase();
}

async function resolveRefs(refs, options = {}) {
  const out = [];
  for (const ref of Array.isArray(refs) ? refs : []) {
    const value = typeof ref === 'string' ? ref : ref?.url || ref?.imageUrl || ref?.value;
    if (!value) continue;
    const resolved = await resolveMediaRef(value, {
      target: 'data-url',
      baseUrl: options.baseUrl,
    });
    out.push(resolved.dataUrl || resolved.url || value);
  }
  return out;
}

async function generateImage(provider, input = {}, options = {}) {
  const validation = openaiCompatible.validateProvider(provider, { apiKeyRequired: true });
  if (!validation.ok) return validation;
  const prompt = String(input.prompt || '').trim();
  if (!prompt) {
    return { ok: false, code: 'missing_prompt', providerId: provider.id, protocol: 'volcengine', error: '请输入图像提示词。' };
  }
  let model;
  try {
    model = selectedModel(input.model || input.providerModel, provider.imageModels, provider.defaults?.imageModel || 'doubao-seedream-4-0-250828');
  } catch (e) {
    return { ok: false, code: 'invalid_model', providerId: provider.id, protocol: 'volcengine', error: e.message };
  }

  const body = {
    model,
    prompt,
    size: String(input.size || '1024x1024'),
    response_format: input.response_format || 'url',
  };
  if (input.n != null) body.n = Number(input.n);
  try {
    const images = await resolveRefs(input.images || input.referenceImages || input.reference_images, options);
    if (images.length) body.image = images.slice(0, 10);
  } catch (e) {
    return { ok: false, code: 'invalid_reference', providerId: provider.id, protocol: 'volcengine', error: e?.message || '参考图解析失败。' };
  }

  try {
    const res = await openaiCompatible.fetchWithTimeout(endpointUrl(provider, '/images/generations', ['imageGenerationEndpoint', 'image_generation_endpoint']), {
      method: 'POST',
      headers: bearerHeaders(provider),
      body: JSON.stringify(body),
      timeoutMs: options.timeoutMs || 1800000,
      fetchImpl: options.fetchImpl,
    });
    const raw = await responseJson(res);
    if (!res.ok) {
      return { ok: false, code: 'http_error', providerId: provider.id, protocol: 'volcengine', error: `火山图像调用失败：HTTP ${res.status}`, raw };
    }
    const imageUrls = openaiCompatible.extractImageUrls(raw);
    if (!imageUrls.length) {
      return { ok: false, code: 'empty_image', providerId: provider.id, protocol: 'volcengine', error: '火山图像接口没有返回图片。', raw };
    }
    return { ok: true, kind: 'image', code: 'completed', providerId: provider.id, protocol: 'volcengine', model, imageUrls, raw };
  } catch (e) {
    return { ok: false, code: e?.name === 'AbortError' ? 'timeout' : 'network_error', providerId: provider.id, protocol: 'volcengine', error: e?.message || '火山图像调用失败。' };
  }
}

async function pollVideoTask(provider, taskId, options = {}) {
  const pollUrl = endpointUrl(provider, `/contents/generations/tasks/${encodeURIComponent(taskId)}`, ['videoTaskEndpoint', 'video_task_endpoint']).replace(/\/tasks\/[^/]+\/contents\/generations\/tasks\//, '/contents/generations/tasks/');
  const maxPoll = Number(options.maxPoll || 600);
  const interval = Number(options.pollIntervalMs || 5000);
  let lastRaw = null;
  for (let i = 0; i < maxPoll; i += 1) {
    if (i > 0 && interval > 0) await new Promise((resolve) => setTimeout(resolve, interval));
    const res = await openaiCompatible.fetchWithTimeout(pollUrl, {
      method: 'GET',
      headers: bearerHeaders(provider),
      timeoutMs: options.timeoutMs,
      fetchImpl: options.fetchImpl,
    });
    const raw = await responseJson(res);
    lastRaw = raw;
    if (!res.ok) throw new Error(`火山视频任务查询失败：HTTP ${res.status}`);
    const status = extractStatus(raw);
    const urls = [...new Set(collectMediaUrls(raw))];
    if (SUCCESS_STATUSES.has(status) || (!status && urls.length)) return { raw, videoUrls: urls };
    if (FAILURE_STATUSES.has(status)) {
      const data = raw?.data && typeof raw.data === 'object' ? raw.data : raw;
      throw new Error(data?.message || data?.error?.message || raw?.message || '火山视频任务失败。');
    }
  }
  throw new Error(`火山视频任务超时：${JSON.stringify(lastRaw || taskId).slice(0, 500)}`);
}

async function generateVideo(provider, input = {}, options = {}) {
  const validation = openaiCompatible.validateProvider(provider, { apiKeyRequired: true });
  if (!validation.ok) return validation;
  const prompt = String(input.prompt || '').trim();
  if (!prompt) {
    return { ok: false, code: 'missing_prompt', providerId: provider.id, protocol: 'volcengine', error: '请输入视频提示词。' };
  }
  let model;
  try {
    model = selectedModel(input.model || input.providerModel, provider.videoModels, provider.defaults?.videoModel || 'doubao-seedance-2-0-fast-260128');
  } catch (e) {
    return { ok: false, code: 'invalid_model', providerId: provider.id, protocol: 'volcengine', error: e.message };
  }

  let images = [];
  try {
    images = await resolveRefs(input.images || input.referenceImages || input.reference_images, options);
  } catch (e) {
    return { ok: false, code: 'invalid_reference', providerId: provider.id, protocol: 'volcengine', error: e?.message || '参考图解析失败。' };
  }
  const content = [{ type: 'text', text: prompt }];
  for (const url of images.slice(0, 8)) {
    content.push({ type: 'image_url', image_url: { url } });
  }
  const body = {
    model,
    content,
  };
  if (input.duration != null) body.duration = Number(input.duration);
  if (input.resolution) body.resolution = String(input.resolution);
  if (input.aspect_ratio || input.ratio) body.ratio = String(input.aspect_ratio || input.ratio);
  if (input.seed != null && Number(input.seed) >= 0) body.seed = Number(input.seed);

  try {
    const res = await openaiCompatible.fetchWithTimeout(endpointUrl(provider, '/contents/generations/tasks', ['videoGenerationEndpoint', 'video_generation_endpoint']), {
      method: 'POST',
      headers: bearerHeaders(provider),
      body: JSON.stringify(body),
      timeoutMs: options.timeoutMs,
      fetchImpl: options.fetchImpl,
    });
    const raw = await responseJson(res);
    if (!res.ok) {
      return { ok: false, code: 'http_error', providerId: provider.id, protocol: 'volcengine', error: `火山视频提交失败：HTTP ${res.status}`, raw };
    }
    const taskId = extractTaskId(raw);
    const directUrls = [...new Set(collectMediaUrls(raw))];
    if (directUrls.length) {
      return { ok: true, kind: 'video', code: 'completed', providerId: provider.id, protocol: 'volcengine', model, taskId, videoUrls: directUrls, raw };
    }
    if (!taskId) {
      return { ok: false, code: 'missing_task_id', providerId: provider.id, protocol: 'volcengine', error: '火山视频提交后未返回 task id。', raw };
    }
    const polled = await pollVideoTask(provider, taskId, options);
    if (!polled.videoUrls.length) {
      return { ok: false, code: 'empty_video', providerId: provider.id, protocol: 'volcengine', error: '火山视频任务完成但没有返回视频。', raw: polled.raw };
    }
    return { ok: true, kind: 'video', code: 'completed', providerId: provider.id, protocol: 'volcengine', model, taskId, videoUrls: polled.videoUrls, raw: polled.raw };
  } catch (e) {
    return { ok: false, code: e?.name === 'AbortError' ? 'timeout' : 'network_error', providerId: provider.id, protocol: 'volcengine', error: e?.message || '火山视频调用失败。' };
  }
}

async function generateChat(provider, input = {}, options = {}) {
  const result = await openaiCompatible.generateChat({ ...provider, protocol: 'volcengine', baseUrl: cleanBaseUrl(provider?.baseUrl) }, input, options);
  return { ...result, providerId: provider.id, protocol: 'volcengine' };
}

async function testProvider(provider, options = {}) {
  const result = await openaiCompatible.testProvider({ ...provider, protocol: 'volcengine', baseUrl: cleanBaseUrl(provider?.baseUrl) }, options);
  return {
    ...result,
    providerId: provider.id,
    protocol: 'volcengine',
  };
}

module.exports = {
  generateChat,
  generateImage,
  generateVideo,
  testProvider,
};
