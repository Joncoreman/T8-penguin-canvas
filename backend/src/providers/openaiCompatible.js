const { resolveMediaRef } = require('./mediaResolver');
const { normalizeLlmMessageMedia } = require('./llmMedia');

const DEFAULT_TIMEOUT_MS = 8000;

function cleanBaseUrl(value) {
  return String(value || '').trim().replace(/\/+$/, '');
}

function hasApiKey(provider) {
  return typeof provider?.apiKey === 'string' && provider.apiKey.trim().length > 0;
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs || DEFAULT_TIMEOUT_MS);
  const fetchImpl = options.fetchImpl || fetch;
  const { timeoutMs, fetchImpl: _fetchImpl, ...fetchOptions } = options;
  try {
    return await fetchImpl(url, { ...fetchOptions, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function validateProvider(provider, { apiKeyRequired = true } = {}) {
  const baseUrl = cleanBaseUrl(provider?.baseUrl);
  if (!baseUrl) {
    return { ok: false, code: 'missing_base_url', error: '请先填写 Base URL。' };
  }
  if (apiKeyRequired && !hasApiKey(provider)) {
    return { ok: false, code: 'missing_api_key', error: '请先填写 API Key。' };
  }
  return { ok: true, baseUrl };
}

function providerEndpointUrl(provider, defaultPath, overrideKeys = []) {
  const baseUrl = cleanBaseUrl(provider?.baseUrl);
  const defaults = provider?.defaults || {};
  const override = overrideKeys
    .map((key) => defaults[key])
    .find((value) => typeof value === 'string' && value.trim());
  const rawPath = String(override || defaultPath || '').trim();
  if (/^https?:\/\//i.test(rawPath)) return rawPath.replace(/\/+$/, '');
  const path = rawPath.startsWith('/') ? rawPath : `/${rawPath}`;
  return `${baseUrl}${path}`;
}

function selectedModel(requested, providerModels, fallback) {
  const fromList = Array.isArray(providerModels) ? providerModels.find((item) => String(item || '').trim()) : '';
  const model = String(requested || fromList || fallback || '').trim();
  if (!model) throw new Error('模型名称不能为空。');
  if (model.length > 240 || /[\x00-\x1f\x7f]/.test(model)) throw new Error('模型名称不合法。');
  return model;
}

function bearerHeaders(provider) {
  return {
    Accept: 'application/json',
    Authorization: `Bearer ${provider.apiKey}`,
    'Content-Type': 'application/json',
  };
}

function trimBodyForError(text) {
  return String(text || '').replace(/\s+/g, ' ').trim().slice(0, 300);
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

function unwrapOpenAIResponse(raw) {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    if (raw.data && typeof raw.data === 'object' && !Array.isArray(raw.data) && !raw.choices && !raw.data?.url && !raw.data?.b64_json) {
      return raw.data;
    }
  }
  return raw;
}

function textFromContent(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') return part;
        if (part?.type === 'text') return part.text || '';
        if (typeof part?.text === 'string') return part.text;
        return '';
      })
      .filter(Boolean)
      .join('\n');
  }
  return '';
}

function extractChatText(raw) {
  const data = unwrapOpenAIResponse(raw);
  const choice = Array.isArray(data?.choices) ? data.choices[0] : null;
  const content = choice?.message?.content ?? choice?.delta?.content ?? choice?.text ?? data?.output_text ?? data?.text;
  return textFromContent(content).trim();
}

function normalizeBase64Image(value, mime = 'image/png') {
  const text = String(value || '').trim();
  if (!text) return '';
  if (/^data:image\//i.test(text)) return text;
  return `data:${mime || 'image/png'};base64,${text}`;
}

function collectImageUrls(value, out = []) {
  if (!value) return out;
  if (typeof value === 'string') {
    const text = value.trim();
    if (/^(https?:\/\/|data:image\/)/i.test(text)) out.push(text);
    return out;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectImageUrls(item, out);
    return out;
  }
  if (typeof value !== 'object') return out;

  const mime = value.mime_type || value.mime || value.content_type || 'image/png';
  const direct = value.url || value.image_url || value.imageUrl || value.uri || value.value;
  if (direct) collectImageUrls(direct, out);
  if (value.b64_json || value.base64) out.push(normalizeBase64Image(value.b64_json || value.base64, mime));

  for (const key of ['data', 'images', 'image_urls', 'imageUrls', 'output_images', 'outputs', 'results']) {
    if (Object.prototype.hasOwnProperty.call(value, key)) collectImageUrls(value[key], out);
  }
  return out;
}

function extractImageUrls(raw) {
  const data = unwrapOpenAIResponse(raw);
  return [...new Set(collectImageUrls(data))];
}

function collectVideoUrls(value, out = []) {
  if (!value) return out;
  if (typeof value === 'string') {
    const text = value.trim();
    if (/^(https?:\/\/|data:video\/|\/files\/output\/)/i.test(text)) out.push(text);
    return out;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectVideoUrls(item, out);
    return out;
  }
  if (typeof value !== 'object') return out;

  const direct = value.video_url || value.videoUrl || value.url || value.uri || value.value || value.download_url || value.downloadUrl;
  if (direct) collectVideoUrls(direct, out);
  for (const key of ['data', 'videos', 'video_urls', 'videoUrls', 'output_videos', 'outputs', 'results', 'files']) {
    if (Object.prototype.hasOwnProperty.call(value, key)) collectVideoUrls(value[key], out);
  }
  return out;
}

function extractVideoUrls(raw) {
  const data = unwrapOpenAIResponse(raw);
  return [...new Set(collectVideoUrls(data))];
}

function extractTaskId(raw) {
  const data = unwrapOpenAIResponse(raw);
  return String(
    data?.task_id ||
    data?.taskId ||
    data?.id ||
    raw?.task_id ||
    raw?.taskId ||
    raw?.id ||
    '',
  ).trim();
}

async function resolveReferenceImages(refs, options = {}) {
  const out = [];
  for (const ref of Array.isArray(refs) ? refs : []) {
    const value = typeof ref === 'string' ? ref : ref?.url || ref?.imageUrl || ref?.value;
    if (!value) continue;
    const resolved = await resolveMediaRef(value, {
      target: options.referenceTarget || 'data-url',
      baseUrl: options.baseUrl,
    });
    out.push(resolved.dataUrl || resolved.url || resolved.path || value);
  }
  return out;
}

async function generateChat(provider, input = {}, options = {}) {
  const validation = validateProvider(provider, { apiKeyRequired: true });
  if (!validation.ok) return validation;

  let model;
  try {
    model = selectedModel(input.model || input.providerModel, provider.chatModels, provider.defaults?.chatModel || 'gpt-4o-mini');
  } catch (e) {
    return { ok: false, code: 'invalid_model', providerId: provider.id, protocol: provider.protocol, error: e.message };
  }

  const messages = Array.isArray(input.messages) && input.messages.length
    ? input.messages
    : [{ role: 'user', content: String(input.prompt || '').trim() }];
  if (!messages.some((message) => String(message?.content || '').trim())) {
    return { ok: false, code: 'missing_prompt', providerId: provider.id, protocol: provider.protocol, error: '请输入要发送给 LLM 的内容。' };
  }

  let normalizedMessages;
  try {
    normalizedMessages = await normalizeLlmMessageMedia(messages, input, {
      baseUrl: options.baseUrl,
      ffmpegPath: options.ffmpegPath,
      ffmpegTimeoutMs: options.ffmpegTimeoutMs,
    });
  } catch (e) {
    return {
      ok: false,
      code: 'invalid_multimodal_reference',
      providerId: provider.id,
      protocol: provider.protocol,
      error: e?.message || 'LLM 多模态素材预处理失败。',
    };
  }

  const body = {
    model,
    messages: normalizedMessages,
  };
  if (input.temperature != null) body.temperature = Number(input.temperature);
  if (input.maxTokens != null) body.max_tokens = Number(input.maxTokens);
  if (input.max_tokens != null) body.max_tokens = Number(input.max_tokens);
  if (input.stream != null) body.stream = !!input.stream;

  const url = providerEndpointUrl(provider, '/chat/completions', ['chatEndpoint', 'chat_endpoint']);
  try {
    const res = await fetchWithTimeout(url, {
      method: 'POST',
      headers: bearerHeaders(provider),
      body: JSON.stringify(body),
      timeoutMs: options.timeoutMs,
      fetchImpl: options.fetchImpl,
    });
    const raw = await responseJson(res);
    if (!res.ok) {
      return {
        ok: false,
        code: 'http_error',
        providerId: provider.id,
        protocol: provider.protocol,
        error: `扩展 LLM 调用失败：HTTP ${res.status}${raw?.message ? ` ${trimBodyForError(raw.message)}` : ''}`,
        raw,
      };
    }
    const text = extractChatText(raw);
    if (!text) {
      return { ok: false, code: 'empty_text', providerId: provider.id, protocol: provider.protocol, error: '扩展 LLM 没有返回文本。', raw };
    }
    return { ok: true, kind: 'llm', code: 'completed', providerId: provider.id, protocol: provider.protocol, model, text, raw };
  } catch (e) {
    return {
      ok: false,
      code: e?.name === 'AbortError' ? 'timeout' : 'network_error',
      providerId: provider.id,
      protocol: provider.protocol,
      error: e?.name === 'AbortError' ? '扩展 LLM 调用超时。' : (e?.message || '扩展 LLM 调用失败。'),
    };
  }
}

async function generateImage(provider, input = {}, options = {}) {
  const validation = validateProvider(provider, { apiKeyRequired: true });
  if (!validation.ok) return validation;

  const prompt = String(input.prompt || '').trim();
  if (!prompt) {
    return { ok: false, code: 'missing_prompt', providerId: provider.id, protocol: provider.protocol, error: '请输入图像提示词。' };
  }

  let model;
  try {
    model = selectedModel(input.model || input.providerModel, provider.imageModels, provider.defaults?.imageModel || 'gpt-image-1');
  } catch (e) {
    return { ok: false, code: 'invalid_model', providerId: provider.id, protocol: provider.protocol, error: e.message };
  }

  const body = {
    model,
    prompt,
  };
  if (input.size) body.size = String(input.size);
  if (input.n != null) body.n = Number(input.n);
  if (input.quality) body.quality = String(input.quality);
  if (input.response_format) body.response_format = String(input.response_format);

  try {
    const refs = await resolveReferenceImages(input.images || input.referenceImages || input.reference_images, {
      baseUrl: options.baseUrl,
      referenceTarget: input.referenceTarget || provider.defaults?.referenceTarget || 'data-url',
    });
    if (refs.length) body.image = refs;
  } catch (e) {
    return { ok: false, code: 'invalid_reference', providerId: provider.id, protocol: provider.protocol, error: e?.message || '参考图解析失败。' };
  }

  const url = providerEndpointUrl(provider, '/images/generations', ['imageGenerationEndpoint', 'image_generation_endpoint']);
  try {
    const res = await fetchWithTimeout(url, {
      method: 'POST',
      headers: bearerHeaders(provider),
      body: JSON.stringify(body),
      timeoutMs: options.timeoutMs,
      fetchImpl: options.fetchImpl,
    });
    const raw = await responseJson(res);
    if (!res.ok) {
      return {
        ok: false,
        code: 'http_error',
        providerId: provider.id,
        protocol: provider.protocol,
        error: `扩展图像调用失败：HTTP ${res.status}${raw?.message ? ` ${trimBodyForError(raw.message)}` : ''}`,
        raw,
      };
    }
    const imageUrls = extractImageUrls(raw);
    if (!imageUrls.length) {
      return { ok: false, code: 'empty_image', providerId: provider.id, protocol: provider.protocol, error: '扩展图像接口没有返回图片。', raw };
    }
    return { ok: true, kind: 'image', code: 'completed', providerId: provider.id, protocol: provider.protocol, model, imageUrls, raw };
  } catch (e) {
    return {
      ok: false,
      code: e?.name === 'AbortError' ? 'timeout' : 'network_error',
      providerId: provider.id,
      protocol: provider.protocol,
      error: e?.name === 'AbortError' ? '扩展图像调用超时。' : (e?.message || '扩展图像调用失败。'),
    };
  }
}

async function generateVideo(provider, input = {}, options = {}) {
  const validation = validateProvider(provider, { apiKeyRequired: true });
  if (!validation.ok) return validation;

  const prompt = String(input.prompt || '').trim();
  if (!prompt) {
    return { ok: false, code: 'missing_prompt', providerId: provider.id, protocol: provider.protocol, error: '请输入视频提示词。' };
  }

  let model;
  try {
    model = selectedModel(input.model || input.providerModel, provider.videoModels, provider.defaults?.videoModel || '');
  } catch (e) {
    return { ok: false, code: 'invalid_model', providerId: provider.id, protocol: provider.protocol, error: e.message };
  }

  const body = { model, prompt };
  if (input.aspect_ratio) body.aspect_ratio = String(input.aspect_ratio);
  if (input.ratio) body.ratio = String(input.ratio);
  if (input.duration != null) body.duration = Number(input.duration);
  if (input.resolution) body.resolution = String(input.resolution);
  if (input.seed != null && Number(input.seed) >= 0) body.seed = Number(input.seed);

  try {
    const refs = await resolveReferenceImages(input.images || input.referenceImages || input.reference_images, {
      baseUrl: options.baseUrl,
      referenceTarget: input.referenceTarget || provider.defaults?.videoReferenceTarget || provider.defaults?.referenceTarget || 'data-url',
    });
    if (refs.length) body.images = refs;
  } catch (e) {
    return { ok: false, code: 'invalid_reference', providerId: provider.id, protocol: provider.protocol, error: e?.message || '参考图解析失败。' };
  }

  const url = providerEndpointUrl(provider, '/videos/generations', ['videoGenerationEndpoint', 'video_generation_endpoint']);
  try {
    const res = await fetchWithTimeout(url, {
      method: 'POST',
      headers: bearerHeaders(provider),
      body: JSON.stringify(body),
      timeoutMs: options.timeoutMs,
      fetchImpl: options.fetchImpl,
    });
    const raw = await responseJson(res);
    if (!res.ok) {
      return {
        ok: false,
        code: 'http_error',
        providerId: provider.id,
        protocol: provider.protocol,
        error: `扩展视频调用失败：HTTP ${res.status}${raw?.message ? ` ${trimBodyForError(raw.message)}` : ''}`,
        raw,
      };
    }
    const videoUrls = extractVideoUrls(raw);
    if (!videoUrls.length) {
      return { ok: false, code: 'empty_video', providerId: provider.id, protocol: provider.protocol, error: '扩展视频接口没有返回视频。', taskId: extractTaskId(raw), raw };
    }
    return { ok: true, kind: 'video', code: 'completed', providerId: provider.id, protocol: provider.protocol, model, taskId: extractTaskId(raw), videoUrls, raw };
  } catch (e) {
    return {
      ok: false,
      code: e?.name === 'AbortError' ? 'timeout' : 'network_error',
      providerId: provider.id,
      protocol: provider.protocol,
      error: e?.name === 'AbortError' ? '扩展视频调用超时。' : (e?.message || '扩展视频调用失败。'),
    };
  }
}

async function testProvider(provider, options = {}) {
  const validation = validateProvider(provider, { apiKeyRequired: true });
  if (!validation.ok) return validation;

  if (options.dryRun) {
    return {
      ok: true,
      code: 'dry_run_ok',
      providerId: provider.id,
      protocol: provider.protocol,
      message: '配置格式可用，已跳过真实网络请求。',
    };
  }

  const url = `${validation.baseUrl}/models`;
  try {
    const res = await fetchWithTimeout(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${provider.apiKey}` },
      timeoutMs: options.timeoutMs,
      fetchImpl: options.fetchImpl,
    });
    if (!res.ok) {
      return {
        ok: false,
        code: 'http_error',
        providerId: provider.id,
        protocol: provider.protocol,
        error: `测试连接失败：HTTP ${res.status}`,
      };
    }
    return {
      ok: true,
      code: 'connected',
      providerId: provider.id,
      protocol: provider.protocol,
      message: '连接成功。',
    };
  } catch (e) {
    return {
      ok: false,
      code: e?.name === 'AbortError' ? 'timeout' : 'network_error',
      providerId: provider.id,
      protocol: provider.protocol,
      error: e?.name === 'AbortError' ? '测试连接超时。' : (e?.message || '测试连接失败。'),
    };
  }
}

module.exports = {
  cleanBaseUrl,
  extractChatText,
  extractImageUrls,
  extractVideoUrls,
  fetchWithTimeout,
  generateChat,
  generateImage,
  generateVideo,
  providerEndpointUrl,
  testProvider,
  validateProvider,
};
