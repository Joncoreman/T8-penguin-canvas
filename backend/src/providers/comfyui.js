const DEFAULT_TIMEOUT_MS = 5000;
const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '::1']);

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
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
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
  testProvider,
};
