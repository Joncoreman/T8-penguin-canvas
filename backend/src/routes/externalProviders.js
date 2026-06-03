const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const config = require('../config');
const settingsRouter = require('./settings');
const { maskAdvancedProviders, normalizeAdvancedProviders } = require('../providers/registry');
const {
  generateChatWithProvider,
  generateImageWithProvider,
  generateVideoWithProvider,
  testProviderConnection,
} = require('../providers/adapters');

const router = express.Router();
const EXTERNAL_GENERATION_TIMEOUT_MS = 60 * 60 * 1000;

function generationTimeoutMs(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return EXTERNAL_GENERATION_TIMEOUT_MS;
  return Math.max(EXTERNAL_GENERATION_TIMEOUT_MS, Math.round(n));
}

function safeProviderForResponse(provider) {
  const masked = maskAdvancedProviders([provider]);
  const id = String(provider?.id || '').trim();
  const protocol = String(provider?.protocol || '').trim();
  return masked.find((item) => item.id === id && item.protocol === protocol) || masked[0] || null;
}

function resolveProvider(body, currentProviders) {
  if (body?.provider && typeof body.provider === 'object') {
    const normalized = normalizeAdvancedProviders([body.provider], currentProviders);
    const id = String(body.provider.id || '').trim();
    return normalized.find((provider) => provider.id === id) || normalized[0] || null;
  }
  const providerId = String(body?.providerId || '').trim();
  if (!providerId) return null;
  return currentProviders.find((provider) => provider.id === providerId) || null;
}

function resolveRunnableProvider(body, currentProviders) {
  const provider = resolveProvider(body, currentProviders);
  if (!provider) {
    return { ok: false, code: 'provider_not_found', error: '未找到扩展平台配置。' };
  }
  if (!provider.enabled) {
    return { ok: false, code: 'provider_disabled', error: '扩展平台未启用，请先在 API 设置中启用。', provider };
  }
  return { ok: true, provider };
}

function outputExtFromMime(mime, fallback = '.png') {
  const text = String(mime || '').toLowerCase();
  if (text.includes('mp4')) return '.mp4';
  if (text.includes('webm')) return '.webm';
  if (text.includes('quicktime')) return '.mov';
  if (text.includes('mpeg') || text.includes('mp3')) return '.mp3';
  if (text.includes('wav')) return '.wav';
  if (text.includes('ogg')) return '.ogg';
  if (text.includes('jpeg') || text.includes('jpg')) return '.jpg';
  if (text.includes('webp')) return '.webp';
  if (text.includes('gif')) return '.gif';
  if (text.includes('bmp')) return '.bmp';
  if (text.includes('png')) return '.png';
  return fallback;
}

function outputExtFromUrl(url, fallback = '.png') {
  try {
    const parsed = new URL(url);
    const ext = path.extname(parsed.pathname).toLowerCase();
    if (['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp', '.mp4', '.webm', '.mov', '.m4v', '.mp3', '.wav', '.ogg'].includes(ext)) return ext;
  } catch {
    // ignore
  }
  return fallback;
}

function writeOutputBuffer(buffer, ext) {
  if (!fs.existsSync(config.OUTPUT_DIR)) fs.mkdirSync(config.OUTPUT_DIR, { recursive: true });
  const suffix = crypto.randomBytes(4).toString('hex');
  const filename = `external_${Date.now()}_${suffix}${ext || '.png'}`;
  fs.writeFileSync(path.join(config.OUTPUT_DIR, filename), buffer);
  return `/files/output/${filename}`;
}

function defaultExtForKind(kind) {
  if (kind === 'video') return '.mp4';
  if (kind === 'audio') return '.mp3';
  return '.png';
}

async function saveOneMediaOutput(url, kind = 'image', options = {}) {
  const text = String(url || '').trim();
  if (!text) return '';
  const dataMatch = text.match(/^data:([^;,]+);base64,(.+)$/i);
  if (dataMatch) {
    const ext = outputExtFromMime(dataMatch[1], defaultExtForKind(kind));
    return writeOutputBuffer(Buffer.from(dataMatch[2], 'base64'), ext);
  }
  if (/^https?:\/\//i.test(text)) {
    const fetchImpl = options.fetchImpl || fetch;
    const res = await fetchImpl(text);
    if (!res.ok) throw new Error(`下载扩展平台输出失败：HTTP ${res.status}`);
    const mime = typeof res.headers?.get === 'function' ? res.headers.get('content-type') : '';
    const ext = outputExtFromMime(mime, outputExtFromUrl(text, defaultExtForKind(kind)));
    const buf = Buffer.from(await res.arrayBuffer());
    return writeOutputBuffer(buf, ext);
  }
  if (text.startsWith('/files/output/')) return text;
  return text;
}

async function saveImageOutputs(urls, options = {}) {
  const out = [];
  for (const url of Array.isArray(urls) ? urls : []) {
    const saved = await saveOneMediaOutput(url, 'image', options);
    if (saved) out.push(saved);
  }
  return out;
}

async function saveVideoOutputs(urls, options = {}) {
  const out = [];
  for (const url of Array.isArray(urls) ? urls : []) {
    const saved = await saveOneMediaOutput(url, 'video', options);
    if (saved) out.push(saved);
  }
  return out;
}

function resultResponse(res, result, provider, dataPatch = {}) {
  const payload = {
    ...result,
    ...dataPatch,
    provider: safeProviderForResponse(provider),
  };
  return res.json({
    success: !!result.ok,
    code: result.code,
    error: result.ok ? undefined : result.error,
    data: payload,
  });
}

router.post('/test-provider', async (req, res) => {
  try {
    const settings = settingsRouter.loadSettings({ persistMigrations: false });
    const currentProviders = normalizeAdvancedProviders(settings.advancedProviders);
    const provider = resolveProvider(req.body || {}, currentProviders);
    if (!provider) {
      return res.json({
        success: false,
        code: 'provider_not_found',
        error: '未找到扩展平台配置。',
      });
    }

    const result = await testProviderConnection(provider, {
      dryRun: !!req.body?.dryRun,
      timeoutMs: Number(req.body?.timeoutMs) || undefined,
    });
    const data = {
      ...result,
      provider: safeProviderForResponse(provider),
    };
    return res.json({
      success: !!result.ok,
      code: result.code,
      error: result.ok ? undefined : result.error,
      data,
    });
  } catch (e) {
    return res.status(500).json({
      success: false,
      code: 'provider_test_failed',
      error: e?.message || String(e),
    });
  }
});

router.post('/llm', async (req, res) => {
  try {
    const settings = settingsRouter.loadSettings({ persistMigrations: false });
    const currentProviders = normalizeAdvancedProviders(settings.advancedProviders);
    const resolved = resolveRunnableProvider(req.body || {}, currentProviders);
    if (!resolved.ok) {
      return res.json({
        success: false,
        code: resolved.code,
        error: resolved.error,
        data: resolved.provider ? { provider: safeProviderForResponse(resolved.provider) } : undefined,
      });
    }
    const result = await generateChatWithProvider(resolved.provider, req.body || {}, {
      timeoutMs: Number(req.body?.timeoutMs) || undefined,
      baseUrl: `http://127.0.0.1:${config.PORT}`,
    });
    return resultResponse(res, result, resolved.provider);
  } catch (e) {
    return res.status(500).json({
      success: false,
      code: 'external_llm_failed',
      error: e?.message || String(e),
    });
  }
});

router.post('/image', async (req, res) => {
  try {
    const settings = settingsRouter.loadSettings({ persistMigrations: false });
    const currentProviders = normalizeAdvancedProviders(settings.advancedProviders);
    const resolved = resolveRunnableProvider(req.body || {}, currentProviders);
    if (!resolved.ok) {
      return res.json({
        success: false,
        code: resolved.code,
        error: resolved.error,
        data: resolved.provider ? { provider: safeProviderForResponse(resolved.provider) } : undefined,
      });
    }
    const result = await generateImageWithProvider(resolved.provider, req.body || {}, {
      timeoutMs: generationTimeoutMs(req.body?.timeoutMs),
      baseUrl: `http://127.0.0.1:${config.PORT}`,
    });
    if (!result.ok) return resultResponse(res, result, resolved.provider);
    const remoteImageUrls = Array.isArray(result.imageUrls) ? result.imageUrls : [];
    const imageUrls = await saveImageOutputs(remoteImageUrls);
    return resultResponse(res, result, resolved.provider, {
      remoteImageUrls,
      imageUrls,
    });
  } catch (e) {
    return res.status(500).json({
      success: false,
      code: 'external_image_failed',
      error: e?.message || String(e),
    });
  }
});

router.post('/video', async (req, res) => {
  try {
    const settings = settingsRouter.loadSettings({ persistMigrations: false });
    const currentProviders = normalizeAdvancedProviders(settings.advancedProviders);
    const resolved = resolveRunnableProvider(req.body || {}, currentProviders);
    if (!resolved.ok) {
      return res.json({
        success: false,
        code: resolved.code,
        error: resolved.error,
        data: resolved.provider ? { provider: safeProviderForResponse(resolved.provider) } : undefined,
      });
    }
    const result = await generateVideoWithProvider(resolved.provider, req.body || {}, {
      timeoutMs: generationTimeoutMs(req.body?.timeoutMs),
      baseUrl: `http://127.0.0.1:${config.PORT}`,
    });
    if (!result.ok) return resultResponse(res, result, resolved.provider);
    const remoteVideoUrls = Array.isArray(result.videoUrls) ? result.videoUrls : [];
    const videoUrls = await saveVideoOutputs(remoteVideoUrls);
    return resultResponse(res, result, resolved.provider, {
      remoteVideoUrls,
      videoUrls,
    });
  } catch (e) {
    return res.status(500).json({
      success: false,
      code: 'external_video_failed',
      error: e?.message || String(e),
    });
  }
});

module.exports = router;
