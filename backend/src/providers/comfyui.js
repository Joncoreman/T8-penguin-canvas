const DEFAULT_TIMEOUT_MS = 5000;
const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '::1']);
const SUCCESS_STATUSES = new Set(['SUCCESS', 'SUCCEEDED', 'COMPLETED', 'DONE', 'OK']);
const FAILURE_STATUSES = new Set(['FAILED', 'FAILURE', 'ERROR', 'CANCELED', 'CANCELLED']);

function cleanBaseUrl(value) {
  return String(value || '').trim().replace(/\/+$/, '') || 'http://127.0.0.1:8188';
}

function isLocalUrl(value) {
  try {
    const parsed = new URL(value);
    return ['http:', 'https:'].includes(parsed.protocol) && LOCAL_HOSTS.has(parsed.hostname.toLowerCase());
  } catch {
    return false;
  }
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs || DEFAULT_TIMEOUT_MS);
  const fetchImpl = options.fetchImpl || fetch;
  const { fetchImpl: _fetchImpl, timeoutMs: _timeoutMs, ...fetchOptions } = options;
  void _fetchImpl;
  void _timeoutMs;
  try {
    return await fetchImpl(url, { ...fetchOptions, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function parseSize(value) {
  const match = String(value || '').match(/(\d{2,5})\s*[x×]\s*(\d{2,5})/i);
  if (!match) return { width: 1024, height: 1024 };
  return {
    width: Math.max(64, Number(match[1])),
    height: Math.max(64, Number(match[2])),
  };
}

function responseJson(res) {
  return res.text().then((text) => {
    if (!text) return {};
    try {
      return JSON.parse(text);
    } catch {
      return { text };
    }
  });
}

function cloneWorkflow(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return JSON.parse(JSON.stringify(value));
}

function workflowList(provider) {
  return Array.isArray(provider?.comfyuiConfig?.workflows) ? provider.comfyuiConfig.workflows : [];
}

function findWorkflow(provider, input = {}) {
  const requested = String(input.providerModel || input.model || '').trim();
  const workflows = workflowList(provider);
  if (!workflows.length) return null;
  if (requested) {
    const exact = workflows.find((item) => item?.id === requested || item?.name === requested);
    if (exact) return exact;
  }
  return workflows[0];
}

function sourceValue(source, input, size) {
  const key = String(source || '').trim();
  if (key === 'prompt' || key === 'positive') return String(input.prompt || '');
  if (key === 'negative') return String(input.negativePrompt || input.negative || '');
  if (key === 'width') return size.width;
  if (key === 'height') return size.height;
  if (key === 'seed') return Number.isFinite(Number(input.seed)) ? Number(input.seed) : Math.floor(Math.random() * 2147483647);
  if (key && Object.prototype.hasOwnProperty.call(input, key)) return input[key];
  return input.providerParams && Object.prototype.hasOwnProperty.call(input.providerParams, key) ? input.providerParams[key] : undefined;
}

function patchByFields(prompt, fields, input, size) {
  if (!Array.isArray(fields)) return;
  for (const field of fields) {
    if (!field || typeof field !== 'object') continue;
    const nodeId = String(field.nodeId || field.node || '').trim();
    const fieldName = String(field.fieldName || field.input || field.name || '').trim();
    if (!nodeId || !fieldName || !prompt[nodeId]?.inputs) continue;
    const value = field.value !== undefined ? field.value : sourceValue(field.source || fieldName, input, size);
    if (value !== undefined) prompt[nodeId].inputs[fieldName] = value;
  }
}

function patchByHeuristics(prompt, input, size) {
  let promptPatched = false;
  for (const node of Object.values(prompt)) {
    if (!node || typeof node !== 'object' || !node.inputs || typeof node.inputs !== 'object') continue;
    const classType = String(node.class_type || '').toLowerCase();
    if (!promptPatched && classType.includes('cliptextencode') && typeof node.inputs.text !== 'undefined') {
      node.inputs.text = String(input.prompt || '');
      promptPatched = true;
    }
    for (const key of Object.keys(node.inputs)) {
      const low = key.toLowerCase();
      if (low === 'width') node.inputs[key] = size.width;
      if (low === 'height') node.inputs[key] = size.height;
      if ((low === 'seed' || low === 'noise_seed') && input.seed != null) node.inputs[key] = Number(input.seed);
    }
  }
}

function patchWorkflow(workflow, input = {}) {
  const prompt = cloneWorkflow(workflow?.workflowJson || workflow?.workflow || workflow?.raw || workflow);
  if (!prompt) return null;
  const size = parseSize(input.size || `${input.width || 1024}x${input.height || 1024}`);
  patchByFields(prompt, workflow?.fields, input, size);
  patchByHeuristics(prompt, input, size);
  return prompt;
}

function viewUrl(baseUrl, item, defaultType = 'output') {
  const filename = String(item?.filename || item?.file || item?.name || '').trim();
  if (!filename) return '';
  const type = String(item?.type || defaultType || 'output').trim();
  const subfolder = String(item?.subfolder || '').trim();
  return `${baseUrl}/view?filename=${encodeURIComponent(filename)}&type=${encodeURIComponent(type)}&subfolder=${encodeURIComponent(subfolder)}`;
}

function collectComfyOutputs(raw, promptId, baseUrl) {
  const source = raw?.[promptId] || raw?.data?.[promptId] || raw?.data || raw;
  const outputs = source?.outputs || source?.output || {};
  const imageUrls = [];
  const videoUrls = [];
  const audioUrls = [];
  const texts = [];
  for (const output of Object.values(outputs || {})) {
    if (!output || typeof output !== 'object') continue;
    for (const item of Array.isArray(output.images) ? output.images : []) {
      const url = viewUrl(baseUrl, item, 'output');
      if (url && !imageUrls.includes(url)) imageUrls.push(url);
    }
    for (const item of Array.isArray(output.videos) ? output.videos : []) {
      const url = viewUrl(baseUrl, item, 'output');
      if (url && !videoUrls.includes(url)) videoUrls.push(url);
    }
    for (const item of Array.isArray(output.audio) ? output.audio : []) {
      const url = viewUrl(baseUrl, item, 'output');
      if (url && !audioUrls.includes(url)) audioUrls.push(url);
    }
    for (const key of ['text', 'texts', 'string', 'strings']) {
      const value = output[key];
      if (typeof value === 'string') texts.push(value);
      if (Array.isArray(value)) texts.push(...value.filter((item) => typeof item === 'string'));
    }
  }
  return { imageUrls, videoUrls, audioUrls, text: texts.join('\n').trim() };
}

function extractPromptId(raw) {
  return String(raw?.prompt_id || raw?.promptId || raw?.id || raw?.data?.prompt_id || raw?.data?.id || '').trim();
}

function extractStatus(raw) {
  const value = raw?.status || raw?.data?.status || raw?.state || raw?.data?.state || '';
  if (typeof value === 'object') return String(value?.status_str || value?.status || '').trim().toUpperCase();
  return String(value || '').trim().toUpperCase();
}

async function pollHistory(baseUrl, promptId, options = {}) {
  const maxPoll = Number(options.maxPoll || 600);
  const interval = Number(options.pollIntervalMs || 1000);
  let lastRaw = null;
  for (let i = 0; i < maxPoll; i += 1) {
    if (i > 0 && interval > 0) await new Promise((resolve) => setTimeout(resolve, interval));
    const res = await fetchWithTimeout(`${baseUrl}/history/${encodeURIComponent(promptId)}`, {
      method: 'GET',
      timeoutMs: options.timeoutMs || 30000,
      fetchImpl: options.fetchImpl,
    });
    const raw = await responseJson(res);
    lastRaw = raw;
    if (!res.ok) throw new Error(`ComfyUI history 查询失败：HTTP ${res.status}`);
    const outputs = collectComfyOutputs(raw, promptId, baseUrl);
    if (outputs.imageUrls.length || outputs.videoUrls.length || outputs.audioUrls.length || outputs.text) {
      return { raw, ...outputs };
    }
    const status = extractStatus(raw);
    if (SUCCESS_STATUSES.has(status)) return { raw, ...outputs };
    if (FAILURE_STATUSES.has(status)) throw new Error(raw?.message || raw?.error || 'ComfyUI 工作流执行失败。');
  }
  throw new Error(`ComfyUI 工作流超时：${JSON.stringify(lastRaw || promptId).slice(0, 500)}`);
}

async function generateImage(provider, input = {}, options = {}) {
  const baseUrl = cleanBaseUrl(provider?.baseUrl || provider?.comfyuiConfig?.instances?.[0]);
  if (!isLocalUrl(baseUrl)) {
    return {
      ok: false,
      code: 'non_local_comfyui',
      providerId: provider.id,
      protocol: 'comfyui',
      error: 'ComfyUI 默认只允许 localhost/127.0.0.1 地址。',
    };
  }
  const promptText = String(input.prompt || '').trim();
  if (!promptText) {
    return { ok: false, code: 'missing_prompt', providerId: provider.id, protocol: 'comfyui', error: '请输入 ComfyUI 工作流提示词。' };
  }
  const workflow = findWorkflow(provider, input);
  if (!workflow) {
    return { ok: false, code: 'missing_workflow', providerId: provider.id, protocol: 'comfyui', error: '请先在扩展平台设置中保存 ComfyUI 工作流。' };
  }
  const prompt = patchWorkflow(workflow, input);
  if (!prompt) {
    return { ok: false, code: 'invalid_workflow', providerId: provider.id, protocol: 'comfyui', error: 'ComfyUI 工作流 JSON 无效。' };
  }

  try {
    const res = await fetchWithTimeout(`${baseUrl}/prompt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, client_id: input.clientId || `t8-${Date.now()}` }),
      timeoutMs: options.timeoutMs || 30000,
      fetchImpl: options.fetchImpl,
    });
    const raw = await responseJson(res);
    if (!res.ok) {
      return { ok: false, code: 'http_error', providerId: provider.id, protocol: 'comfyui', error: `ComfyUI 提交失败：HTTP ${res.status}`, raw };
    }
    const promptId = extractPromptId(raw);
    if (!promptId) {
      return { ok: false, code: 'missing_prompt_id', providerId: provider.id, protocol: 'comfyui', error: 'ComfyUI 未返回 prompt_id。', raw };
    }
    const polled = await pollHistory(baseUrl, promptId, options);
    if (!polled.imageUrls.length) {
      return { ok: false, code: 'empty_image', providerId: provider.id, protocol: 'comfyui', error: 'ComfyUI 工作流完成但没有返回图片。', raw: polled.raw };
    }
    return {
      ok: true,
      kind: 'image',
      code: 'completed',
      providerId: provider.id,
      protocol: 'comfyui',
      model: workflow.id || workflow.name,
      taskId: promptId,
      imageUrls: polled.imageUrls,
      videoUrls: polled.videoUrls,
      audioUrls: polled.audioUrls,
      text: polled.text,
      raw: polled.raw,
    };
  } catch (e) {
    return { ok: false, code: e?.name === 'AbortError' ? 'timeout' : 'comfyui_failed', providerId: provider.id, protocol: 'comfyui', error: e?.message || 'ComfyUI 调用失败。' };
  }
}

async function testProvider(provider, options = {}) {
  const baseUrl = cleanBaseUrl(provider?.baseUrl || provider?.comfyuiConfig?.instances?.[0]);
  if (!isLocalUrl(baseUrl)) {
    return {
      ok: false,
      code: 'non_local_comfyui',
      providerId: provider.id,
      protocol: 'comfyui',
      error: 'ComfyUI 默认只允许 localhost/127.0.0.1 地址。',
    };
  }

  if (options.dryRun) {
    return {
      ok: true,
      code: 'dry_run_ok',
      providerId: provider.id,
      protocol: 'comfyui',
      message: '本地 ComfyUI 地址格式可用，已跳过真实请求。',
    };
  }

  try {
    const res = await fetchWithTimeout(`${baseUrl}/queue`, { timeoutMs: options.timeoutMs });
    if (!res.ok) {
      return {
        ok: false,
        code: 'http_error',
        providerId: provider.id,
        protocol: 'comfyui',
        error: `ComfyUI 队列接口不可用：HTTP ${res.status}`,
      };
    }
    return {
      ok: true,
      code: 'connected',
      providerId: provider.id,
      protocol: 'comfyui',
      message: 'ComfyUI 已连接。',
    };
  } catch (e) {
    return {
      ok: false,
      code: e?.name === 'AbortError' ? 'timeout' : 'network_error',
      providerId: provider.id,
      protocol: 'comfyui',
      error: e?.name === 'AbortError' ? 'ComfyUI 连接超时。' : (e?.message || 'ComfyUI 不在线。'),
    };
  }
}

module.exports = {
  generateImage,
  testProvider,
};
