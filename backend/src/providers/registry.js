const DEFAULT_MODELSCOPE_BASE_URL = 'https://api-inference.modelscope.cn/v1';
const DEFAULT_VOLCENGINE_BASE_URL = 'https://ark.cn-beijing.volces.com/api/v3';

const SUPPORTED_PROTOCOLS = new Set([
  'openai-compatible',
  'modelscope',
  'volcengine',
  'comfyui',
  'jimeng-cli',
]);

const PROVIDER_ID_RE = /^[a-z0-9][a-z0-9_-]{1,47}$/;
const CONTROL_CHAR_RE = /[\x00-\x1f\x7f]/;

const DEFAULT_ADVANCED_PROVIDERS = [
  {
    id: 'openai-compatible',
    label: 'OpenAI 兼容',
    protocol: 'openai-compatible',
    baseUrl: '',
    enabled: false,
    imageModels: [],
    videoModels: [],
    chatModels: [],
    defaults: {},
  },
  {
    id: 'modelscope',
    label: 'ModelScope',
    protocol: 'modelscope',
    baseUrl: DEFAULT_MODELSCOPE_BASE_URL,
    enabled: false,
    imageModels: [],
    videoModels: [],
    chatModels: [],
    defaults: {},
  },
  {
    id: 'volcengine',
    label: '火山引擎',
    protocol: 'volcengine',
    baseUrl: DEFAULT_VOLCENGINE_BASE_URL,
    enabled: false,
    imageModels: [],
    videoModels: [],
    chatModels: [],
    defaults: {},
    volcengineConfig: {
      project: 'default',
      region: 'cn-beijing',
    },
  },
  {
    id: 'comfyui',
    label: '本地 ComfyUI',
    protocol: 'comfyui',
    baseUrl: 'http://127.0.0.1:8188',
    enabled: false,
    imageModels: [],
    videoModels: [],
    chatModels: [],
    defaults: {},
    comfyuiConfig: {
      instances: ['http://127.0.0.1:8188'],
      workflows: [],
    },
  },
  {
    id: 'jimeng-cli',
    label: '即梦 CLI',
    protocol: 'jimeng-cli',
    baseUrl: '',
    enabled: false,
    imageModels: ['jimeng-image-2k', 'jimeng-image-4k'],
    videoModels: ['jimeng-video-720p', 'jimeng-video-1080p', 'seedance2.0fast_vip', 'seedance2.0_vip'],
    chatModels: [],
    defaults: {},
    jimengConfig: {
      executablePath: '',
      useWsl: false,
      wslDistro: '',
      pollSeconds: 900,
    },
  },
];

const DEFAULT_ADVANCED_PROVIDER_IDS = DEFAULT_ADVANCED_PROVIDERS.map((provider) => provider.id);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function cleanText(value, maxLen) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen);
}

function cleanId(value) {
  const id = String(value || '').trim().toLowerCase();
  return PROVIDER_ID_RE.test(id) ? id : '';
}

function cleanProtocol(value) {
  const protocol = String(value || '').trim().toLowerCase();
  return SUPPORTED_PROTOCOLS.has(protocol) ? protocol : '';
}

function isMaskedSecret(value) {
  return typeof value === 'string' && /^\*{2,}/.test(value.trim());
}

function cleanSecret(value, previous = '') {
  if (typeof value !== 'string') return previous || '';
  const trimmed = value.trim();
  if (!trimmed || isMaskedSecret(trimmed)) return previous || '';
  if (CONTROL_CHAR_RE.test(trimmed)) return previous || '';
  return trimmed.slice(0, 4096);
}

function maskSecret(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  return `****${text.slice(-4)}`;
}

function normalizeModelList(values) {
  const out = [];
  for (const value of Array.isArray(values) ? values : []) {
    const item = String(value || '').trim();
    if (!item || item.length > 240 || CONTROL_CHAR_RE.test(item)) continue;
    if (!out.includes(item)) out.push(item);
  }
  return out;
}

function normalizeUrl(value) {
  const text = String(value || '').trim().replace(/\/+$/, '');
  if (!text) return '';
  let parsed;
  try {
    parsed = new URL(text);
  } catch {
    return '';
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) return '';
  return text;
}

function isLocalUrl(url) {
  if (!url) return true;
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    return host === 'localhost' || host === '127.0.0.1' || host === '::1';
  } catch {
    return false;
  }
}

function normalizeBoolean(value, fallback = false) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const v = value.trim().toLowerCase();
    if (['1', 'true', 'yes', 'on'].includes(v)) return true;
    if (['0', 'false', 'no', 'off'].includes(v)) return false;
  }
  return fallback;
}

function normalizeNumber(value, fallback, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}

function normalizePlainObject(value, maxEntries = 64) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const out = {};
  for (const [key, item] of Object.entries(value).slice(0, maxEntries)) {
    const cleanKey = cleanText(key, 80);
    if (!cleanKey || CONTROL_CHAR_RE.test(cleanKey)) continue;
    if (item == null) continue;
    if (['string', 'number', 'boolean'].includes(typeof item)) out[cleanKey] = item;
  }
  return out;
}

function cloneJsonValue(value, maxBytes = 2 * 1024 * 1024) {
  if (value == null) return undefined;
  try {
    const text = JSON.stringify(value);
    if (!text || text.length > maxBytes) return undefined;
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function normalizeComfyFields(value) {
  const out = [];
  for (const raw of Array.isArray(value) ? value : []) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
    const nodeId = cleanText(raw.nodeId || raw.node || '', 80);
    const fieldName = cleanText(raw.fieldName || raw.input || raw.name || '', 80);
    const source = cleanText(raw.source || fieldName, 80);
    if (!nodeId || !fieldName) continue;
    const field = { nodeId, fieldName, source };
    const fixedValue = cloneJsonValue(raw.value, 64 * 1024);
    if (fixedValue !== undefined) field.value = fixedValue;
    out.push(field);
  }
  return out.slice(0, 200);
}

function normalizeVolcengineConfig(value, previous = {}) {
  const raw = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return {
    project: cleanText(raw.project || raw.projectName || previous.project || 'default', 80) || 'default',
    region: cleanText(raw.region || previous.region || 'cn-beijing', 40) || 'cn-beijing',
    accessKeyId: cleanSecret(raw.accessKeyId || raw.accessKeyID || raw.ak, previous.accessKeyId),
    secretAccessKey: cleanSecret(raw.secretAccessKey || raw.secretKey || raw.sk, previous.secretAccessKey),
  };
}

function normalizeComfyuiConfig(value) {
  const raw = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const instances = [];
  const rawInstances = Array.isArray(raw.instances) ? raw.instances : [];
  for (const item of rawInstances) {
    const url = normalizeUrl(item);
    if (url && isLocalUrl(url) && !instances.includes(url)) instances.push(url);
  }
  const workflows = Array.isArray(raw.workflows)
    ? raw.workflows
        .map((item) => {
          if (!item || typeof item !== 'object') return null;
          const workflowJson = cloneJsonValue(item.workflowJson || item.workflow || item.raw);
          const workflow = {
            id: cleanText(item.id || item.name, 80),
            name: cleanText(item.name || item.id, 120),
          };
          if (workflowJson !== undefined) workflow.workflowJson = workflowJson;
          const fields = normalizeComfyFields(item.fields);
          if (fields.length) workflow.fields = fields;
          return workflow;
        })
        .filter((item) => item && item.id && item.name)
        .slice(0, 80)
    : [];
  return { instances, workflows };
}

function normalizeJimengConfig(value) {
  const raw = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return {
    executablePath: cleanText(raw.executablePath || raw.binPath || '', 260),
    useWsl: normalizeBoolean(raw.useWsl, false),
    wslDistro: cleanText(raw.wslDistro || '', 80),
    pollSeconds: normalizeNumber(raw.pollSeconds, 900, 1, 3600),
  };
}

function normalizeProvider(raw, previous = null) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const id = cleanId(raw.id);
  if (!id) return null;
  const protocol = cleanProtocol(raw.protocol);
  if (!protocol) return null;

  const previousConfig = previous || {};
  let baseUrl = normalizeUrl(raw.baseUrl || raw.base_url || '');
  if (!baseUrl && protocol === 'modelscope') baseUrl = DEFAULT_MODELSCOPE_BASE_URL;
  if (!baseUrl && protocol === 'volcengine') baseUrl = DEFAULT_VOLCENGINE_BASE_URL;
  if (protocol === 'jimeng-cli') baseUrl = '';
  if (protocol === 'comfyui') {
    if (!baseUrl) baseUrl = 'http://127.0.0.1:8188';
    if (!isLocalUrl(baseUrl) && !normalizeBoolean(raw.allowRemote, false)) return null;
  } else if (baseUrl && !normalizeUrl(baseUrl)) {
    return null;
  }

  const provider = {
    id,
    label: cleanText(raw.label || raw.name || previousConfig.label || id, 60) || id,
    protocol,
    baseUrl,
    enabled: normalizeBoolean(raw.enabled, false),
    apiKey: cleanSecret(raw.apiKey || raw.api_key, previousConfig.apiKey),
    imageModels: normalizeModelList(raw.imageModels || raw.image_models),
    videoModels: normalizeModelList(raw.videoModels || raw.video_models),
    chatModels: normalizeModelList(raw.chatModels || raw.chat_models),
    defaults: normalizePlainObject(raw.defaults),
  };

  if (protocol === 'volcengine') {
    provider.volcengineConfig = normalizeVolcengineConfig(raw.volcengineConfig || raw.volcengine_config, previousConfig.volcengineConfig);
  }
  if (protocol === 'comfyui') {
    provider.comfyuiConfig = normalizeComfyuiConfig(raw.comfyuiConfig || raw.comfyui_config);
  }
  if (protocol === 'jimeng-cli') {
    provider.jimengConfig = normalizeJimengConfig(raw.jimengConfig || raw.jimeng_config);
  }

  return provider;
}

function normalizeAdvancedProviders(rawProviders, currentProviders = []) {
  const previousById = new Map(
    (Array.isArray(currentProviders) ? currentProviders : [])
      .filter((item) => item && typeof item === 'object')
      .map((item) => [cleanId(item.id), item])
      .filter(([id]) => !!id),
  );
  const byId = new Map();

  for (const template of DEFAULT_ADVANCED_PROVIDERS) {
    const previous = previousById.get(template.id);
    const provider = normalizeProvider({ ...clone(template), ...(previous || {}) }, previous);
    if (provider) byId.set(provider.id, provider);
  }

  for (const raw of Array.isArray(rawProviders) ? rawProviders : []) {
    const id = cleanId(raw?.id);
    const previous = previousById.get(id) || byId.get(id) || null;
    const provider = normalizeProvider(raw, previous);
    if (provider) byId.set(provider.id, provider);
  }

  return [...byId.values()];
}

function maskAdvancedProviders(providers) {
  return normalizeAdvancedProviders(providers).map((provider) => {
    const masked = { ...provider };
    masked.hasApiKey = !!provider.apiKey;
    masked.apiKey = maskSecret(provider.apiKey);
    if (provider.volcengineConfig) {
      masked.volcengineConfig = {
        ...provider.volcengineConfig,
        hasAccessKeyId: !!provider.volcengineConfig.accessKeyId,
        hasSecretAccessKey: !!provider.volcengineConfig.secretAccessKey,
        accessKeyId: maskSecret(provider.volcengineConfig.accessKeyId),
        secretAccessKey: maskSecret(provider.volcengineConfig.secretAccessKey),
      };
    }
    return masked;
  });
}

function summarizeAdvancedProviders(providers) {
  const normalized = normalizeAdvancedProviders(providers);
  let configuredKeyCount = 0;
  let comfyuiConfigured = false;
  let jimengConfigured = false;
  for (const provider of normalized) {
    if (provider.apiKey) configuredKeyCount += 1;
    if (provider.volcengineConfig?.accessKeyId) configuredKeyCount += 1;
    if (provider.volcengineConfig?.secretAccessKey) configuredKeyCount += 1;
    if (provider.protocol === 'comfyui' && (provider.baseUrl || provider.comfyuiConfig?.instances?.length)) {
      comfyuiConfigured = true;
    }
    if (provider.protocol === 'jimeng-cli' && provider.jimengConfig?.executablePath) {
      jimengConfigured = true;
    }
  }
  return {
    enabledCount: normalized.filter((provider) => provider.enabled).length,
    configuredKeyCount,
    comfyuiConfigured,
    jimengConfigured,
  };
}

function getEnabledAdvancedProviders(providers) {
  return normalizeAdvancedProviders(providers).filter((provider) => provider.enabled);
}

module.exports = {
  DEFAULT_ADVANCED_PROVIDERS,
  DEFAULT_ADVANCED_PROVIDER_IDS,
  DEFAULT_MODELSCOPE_BASE_URL,
  DEFAULT_VOLCENGINE_BASE_URL,
  SUPPORTED_PROTOCOLS,
  getEnabledAdvancedProviders,
  maskAdvancedProviders,
  normalizeAdvancedProviders,
  summarizeAdvancedProviders,
};
