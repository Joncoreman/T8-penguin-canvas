import type { AdvancedProviderConfig, AdvancedProviderSummary, CanvasProviderSource } from '../types/canvas';

const MASKED_RE = /^\*{2,}/;

export function parseAdvancedProviderModelText(value: string): string[] {
  const out: string[] = [];
  for (const raw of String(value || '').split(/[\n,]/)) {
    const item = raw.trim();
    if (!item || out.includes(item)) continue;
    out.push(item);
  }
  return out;
}

export function stringifyAdvancedProviderModels(values?: string[]): string {
  return (Array.isArray(values) ? values : [])
    .map((item) => String(item || '').trim())
    .filter(Boolean)
    .join('\n');
}

export function hasAdvancedProviderSecret(value?: string): boolean {
  const text = String(value || '').trim();
  return !!text && (MASKED_RE.test(text) || text.length > 0);
}

export function advancedProviderSummary(providers?: AdvancedProviderConfig[]): AdvancedProviderSummary {
  const list = Array.isArray(providers) ? providers : [];
  return list.reduce<AdvancedProviderSummary>((summary, provider) => {
    if (provider?.enabled) summary.enabledCount += 1;
    if (hasAdvancedProviderSecret(provider?.apiKey)) summary.configuredKeyCount += 1;
    if (hasAdvancedProviderSecret(provider?.volcengineConfig?.accessKeyId)) summary.configuredKeyCount += 1;
    if (hasAdvancedProviderSecret(provider?.volcengineConfig?.secretAccessKey)) summary.configuredKeyCount += 1;
    if (provider?.protocol === 'comfyui' && (provider.baseUrl || provider.comfyuiConfig?.instances?.length)) {
      summary.comfyuiConfigured = true;
    }
    if (provider?.protocol === 'jimeng-cli' && provider.jimengConfig?.executablePath) {
      summary.jimengConfigured = true;
    }
    return summary;
  }, {
    enabledCount: 0,
    configuredKeyCount: 0,
    comfyuiConfigured: false,
    jimengConfigured: false,
  });
}

export type AdvancedProviderNodeKind = 'image' | 'video' | 'llm';

export interface AdvancedProviderSelection {
  providerSource: CanvasProviderSource;
  providerId: string;
  providerModel: string;
  provider: AdvancedProviderConfig | null;
  available: boolean;
}

const IMAGE_PROTOCOLS = new Set(['openai-compatible', 'modelscope', 'volcengine', 'comfyui', 'jimeng-cli']);
const VIDEO_PROTOCOLS = new Set(['openai-compatible', 'volcengine', 'jimeng-cli']);
const LLM_PROTOCOLS = new Set(['openai-compatible', 'modelscope', 'volcengine']);

const FALLBACK_MODELS: Record<AdvancedProviderNodeKind, Partial<Record<string, string[]>>> = {
  image: {
    'openai-compatible': ['gpt-image-1'],
    modelscope: ['MusePublic/489_ckpt_FLUX_1'],
    volcengine: ['doubao-seedream-4-0-250828'],
    'jimeng-cli': ['jimeng-image-2k'],
  },
  video: {
    'openai-compatible': [],
    volcengine: ['doubao-seedance-2-0-pro-250528'],
    'jimeng-cli': ['seedance2.0fast_vip'],
  },
  llm: {
    'openai-compatible': ['gpt-4o-mini'],
    modelscope: ['Qwen/Qwen3-Coder-480B-A35B-Instruct'],
    volcengine: ['doubao-seed-1-6-250615'],
  },
};

function uniqueCompact(values: unknown[]): string[] {
  const out: string[] = [];
  for (const value of values) {
    const item = String(value || '').trim();
    if (!item || out.includes(item)) continue;
    out.push(item);
  }
  return out;
}

function listForKind(provider: AdvancedProviderConfig, kind: AdvancedProviderNodeKind): string[] {
  if (kind === 'image') return Array.isArray(provider.imageModels) ? provider.imageModels : [];
  if (kind === 'video') return Array.isArray(provider.videoModels) ? provider.videoModels : [];
  return Array.isArray(provider.chatModels) ? provider.chatModels : [];
}

function defaultModelForKind(provider: AdvancedProviderConfig, kind: AdvancedProviderNodeKind): string {
  const defaults = provider.defaults || {};
  const key = kind === 'llm' ? 'chatModel' : `${kind}Model`;
  return String(defaults[key] || defaults.model || '').trim();
}

function supportsNodeKind(provider: AdvancedProviderConfig, kind: AdvancedProviderNodeKind): boolean {
  if (!provider?.enabled) return false;
  const protocol = String(provider.protocol || '');
  if (kind === 'image' && !IMAGE_PROTOCOLS.has(protocol)) return false;
  if (kind === 'video' && !VIDEO_PROTOCOLS.has(protocol)) return false;
  if (kind === 'llm' && !LLM_PROTOCOLS.has(protocol)) return false;
  if (protocol === 'comfyui') {
    return kind === 'image' && !!provider.comfyuiConfig?.workflows?.length;
  }
  return advancedProviderModelOptions(provider, kind).length > 0;
}

export function advancedProviderModelOptions(
  provider: AdvancedProviderConfig,
  kind: AdvancedProviderNodeKind,
): string[] {
  if (!provider) return [];
  if (provider.protocol === 'comfyui' && kind === 'image') {
    return uniqueCompact((provider.comfyuiConfig?.workflows || []).map((workflow) => workflow.id || workflow.name));
  }
  const explicit = uniqueCompact(listForKind(provider, kind));
  if (explicit.length) return explicit;
  return uniqueCompact([
    defaultModelForKind(provider, kind),
    ...(FALLBACK_MODELS[kind][provider.protocol] || []),
  ]);
}

export function advancedProvidersForNode(
  providers: AdvancedProviderConfig[] | undefined,
  kind: AdvancedProviderNodeKind,
): AdvancedProviderConfig[] {
  return (Array.isArray(providers) ? providers : []).filter((provider) => supportsNodeKind(provider, kind));
}

export function resolveAdvancedProviderSelection(
  providers: AdvancedProviderConfig[] | undefined,
  kind: AdvancedProviderNodeKind,
  current?: {
    providerSource?: CanvasProviderSource;
    providerId?: string;
    providerModel?: string;
  },
): AdvancedProviderSelection {
  const available = advancedProvidersForNode(providers, kind);
  const currentSource = current?.providerSource || 'zhenzhen';
  const currentId = String(current?.providerId || '').trim();
  if (currentSource !== 'zhenzhen' && currentId) {
    const provider = available.find((item) => item.id === currentId && item.protocol === currentSource);
    if (provider) {
      const models = advancedProviderModelOptions(provider, kind);
      const requested = String(current?.providerModel || '').trim();
      return {
        providerSource: provider.protocol,
        providerId: provider.id,
        providerModel: requested && models.includes(requested) ? requested : (models[0] || ''),
        provider,
        available: true,
      };
    }
  }
  return {
    providerSource: 'zhenzhen',
    providerId: '',
    providerModel: '',
    provider: null,
    available: false,
  };
}

const EXTERNAL_SIZE_BASE: Record<string, number> = {
  '1K': 1024,
  '2K': 2048,
  '4K': 4096,
};

const EXTERNAL_RATIO_DIMS: Record<string, [number, number]> = {
  '1:1': [1024, 1024],
  '4:3': [1152, 864],
  '3:4': [864, 1152],
  '16:9': [1344, 768],
  '9:16': [768, 1344],
  '3:2': [1216, 832],
  '2:3': [832, 1216],
  '21:9': [1536, 640],
};

export function externalImageSizeFor(aspectRatio?: string, sizeLevel?: string): string {
  const ratio = String(aspectRatio || '').trim();
  const dims = EXTERNAL_RATIO_DIMS[ratio] || EXTERNAL_RATIO_DIMS['1:1'];
  const base = EXTERNAL_SIZE_BASE[String(sizeLevel || '').trim()] || 1024;
  const scale = base / 1024;
  const w = Math.max(256, Math.round((dims[0] * scale) / 64) * 64);
  const h = Math.max(256, Math.round((dims[1] * scale) / 64) * 64);
  return `${w}x${h}`;
}
