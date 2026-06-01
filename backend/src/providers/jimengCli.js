const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn, spawnSync } = require('child_process');
const config = require('../config');
const { resolveMediaRef, mimeFromPath } = require('./mediaResolver');

function cleanExecutablePath(provider) {
  return String(provider?.jimengConfig?.executablePath || '').trim();
}

function pollSeconds(provider) {
  const n = Number(provider?.jimengConfig?.pollSeconds || 900);
  return Math.max(1, Math.min(3600, Number.isFinite(n) ? Math.round(n) : 900));
}

function commandExists(command) {
  if (!command) return false;
  if (path.isAbsolute(command)) return fs.existsSync(command);
  const checker = process.platform === 'win32' ? 'where' : 'which';
  const result = spawnSync(checker, [command], {
    encoding: 'utf-8',
    timeout: 3000,
    windowsHide: true,
  });
  return result.status === 0;
}

function selectedModel(requested, models, fallback) {
  const fromList = Array.isArray(models) ? models.find((item) => String(item || '').trim()) : '';
  return String(requested || fromList || fallback || '').trim();
}

function parseSize(value) {
  const match = String(value || '').match(/(\d{2,5})\s*[x×]\s*(\d{2,5})/i);
  if (!match) return [1024, 1024];
  return [Math.max(1, Number(match[1])), Math.max(1, Number(match[2]))];
}

function ratioFromSize(size, fallback = '1:1') {
  const [w, h] = parseSize(size);
  const choices = [[21, 9], [16, 9], [3, 2], [4, 3], [1, 1], [3, 4], [2, 3], [9, 16]];
  const best = choices.reduce((acc, item) => (
    Math.abs((item[0] / item[1]) - (w / h)) < Math.abs((acc[0] / acc[1]) - (w / h)) ? item : acc
  ), choices[4]);
  return best ? `${best[0]}:${best[1]}` : fallback;
}

function imageResolution(model, size) {
  const text = String(model || '').toLowerCase();
  if (text.includes('4k')) return '4k';
  if (text.includes('1k')) return '1k';
  if (text.includes('2k')) return '2k';
  const [w, h] = parseSize(size);
  return Math.max(w, h) > 2048 ? '4k' : '2k';
}

function videoResolution(model, resolution) {
  const value = String(resolution || '').trim().toUpperCase();
  if (['480P', '720P', '1080P'].includes(value)) return value;
  const text = String(model || '').toLowerCase();
  if (text.includes('1080')) return '1080P';
  if (text.includes('480')) return '480P';
  return '720P';
}

function videoDuration(value) {
  const n = Number(value || 5);
  return Math.max(4, Math.min(15, Number.isFinite(n) ? Math.round(n) : 5));
}

function videoModelVersion(model) {
  const low = String(model || '').toLowerCase();
  const aliases = [
    ['seedance2.0fast_vip', 'seedance2.0fast_vip'],
    ['seedance2.0_vip', 'seedance2.0_vip'],
    ['seedance2.0fast', 'seedance2.0fast'],
    ['seedance2.0', 'seedance2.0'],
    ['3.0_fast', '3.0fast'],
    ['3.0fast', '3.0fast'],
    ['3.0_pro', '3.0pro'],
    ['3.0pro', '3.0pro'],
    ['3.5_pro', '3.5pro'],
    ['3.5pro', '3.5pro'],
  ];
  const found = aliases.find(([key]) => low.includes(key));
  return found ? found[1] : '';
}

function videoRatio(value) {
  const ratio = String(value || '').trim();
  return new Set(['1:1', '3:4', '16:9', '4:3', '9:16', '21:9']).has(ratio) ? ratio : '';
}

function wslPath(provider, value) {
  if (!provider?.jimengConfig?.useWsl) return value;
  const text = String(value || '').replace(/\\/g, '/');
  const match = text.match(/^([A-Za-z]):\/(.*)$/);
  return match ? `/mnt/${match[1].toLowerCase()}/${match[2]}` : text;
}

function cliCommand(provider) {
  const exe = cleanExecutablePath(provider);
  if (!provider?.jimengConfig?.useWsl) return { command: exe, argsPrefix: [] };
  const distro = String(provider.jimengConfig.wslDistro || '').trim();
  return {
    command: 'wsl.exe',
    argsPrefix: [...(distro ? ['-d', distro] : []), '-e', 'sh', '-lc'],
    shell: true,
    dreamina: exe || 'dreamina',
  };
}

function extractJson(text) {
  const raw = String(text || '').trim();
  if (!raw) return {};
  for (let i = 0; i < raw.length; i += 1) {
    const ch = raw[i];
    if (ch !== '{' && ch !== '[') continue;
    try {
      return JSON.parse(raw.slice(i));
    } catch {
      // keep scanning
    }
  }
  return { text: raw };
}

async function spawnCli(command, args, timeoutMs = 120000) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { windowsHide: true, cwd: process.cwd() });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error('即梦 CLI 执行超时。'));
    }, timeoutMs);
    child.stdout?.on('data', (chunk) => { stdout += chunk.toString('utf8'); });
    child.stderr?.on('data', (chunk) => { stderr += chunk.toString('utf8'); });
    child.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        reject(new Error((stderr || stdout || `exit=${code}`).slice(0, 1000)));
        return;
      }
      resolve(extractJson(`${stdout}\n${stderr}`));
    });
  });
}

async function runCli(provider, args, options = {}, extraTimeout = 120) {
  if (options.runCli) return options.runCli(cleanExecutablePath(provider) || 'dreamina', args);
  const exe = cleanExecutablePath(provider);
  if (!exe) throw new Error('请先填写 dreamina / 即梦 CLI 可执行路径。');
  if (provider?.jimengConfig?.useWsl) {
    const prefix = cliCommand(provider);
    const line = `${prefix.dreamina || 'dreamina'} ${args.map((arg) => `'${String(arg).replace(/'/g, "'\\''")}'`).join(' ')}`;
    return spawnCli(prefix.command, [...prefix.argsPrefix, line], (pollSeconds(provider) + extraTimeout) * 1000);
  }
  return spawnCli(exe, args, (pollSeconds(provider) + extraTimeout) * 1000);
}

function collectOutputs(value, out = []) {
  if (!value) return out;
  if (typeof value === 'string') {
    const text = value.trim();
    if (/^(https?:\/\/|file:\/\/|[A-Za-z]:\\|\/|.*\.(?:png|jpe?g|webp|gif|bmp|mp4|webm|mov|m4v)(?:\?|#)?$)/i.test(text)) out.push(text);
    return out;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectOutputs(item, out);
    return out;
  }
  if (typeof value !== 'object') return out;
  for (const key of [
    'url', 'urls', 'image', 'images', 'image_url', 'image_urls',
    'video', 'videos', 'video_url', 'video_urls', 'output', 'outputs',
    'result', 'results', 'file', 'files', 'path', 'paths',
    'download_url', 'download_urls', 'downloadUrl', 'file_path', 'filePath',
  ]) {
    if (Object.prototype.hasOwnProperty.call(value, key)) collectOutputs(value[key], out);
  }
}

function submitId(raw) {
  const found = [];
  const visit = (value) => {
    if (!value) return;
    if (Array.isArray(value)) return value.forEach(visit);
    if (typeof value !== 'object') return;
    for (const [key, item] of Object.entries(value)) {
      if (['submit_id', 'submitid', 'task_id', 'taskid'].includes(String(key).toLowerCase()) && item) found.push(String(item));
      else visit(item);
    }
  };
  visit(raw);
  return found[0] || '';
}

function outputExtFromMime(mime, fallback) {
  const text = String(mime || '').toLowerCase();
  if (text.includes('mp4')) return '.mp4';
  if (text.includes('webm')) return '.webm';
  if (text.includes('quicktime')) return '.mov';
  if (text.includes('jpeg')) return '.jpg';
  if (text.includes('webp')) return '.webp';
  if (text.includes('png')) return '.png';
  return fallback;
}

async function defaultStoreOutput(value, kind, options = {}) {
  const text = String(value || '').trim();
  if (!text) return '';
  if (text.startsWith('/files/output/')) return text;
  if (!fs.existsSync(config.OUTPUT_DIR)) fs.mkdirSync(config.OUTPUT_DIR, { recursive: true });
  const prefix = kind === 'video' ? 'jimeng_video' : 'jimeng';
  let ext = kind === 'video' ? '.mp4' : '.png';
  let buf = null;
  let localPath = text;
  if (text.startsWith('file://')) {
    localPath = decodeURIComponent(new URL(text).pathname || '');
    if (process.platform === 'win32' && /^\/[A-Za-z]:\//.test(localPath)) localPath = localPath.slice(1);
  }
  if (/^https?:\/\//i.test(text)) {
    const fetchImpl = options.fetchImpl || fetch;
    const res = await fetchImpl(text);
    if (!res.ok) throw new Error(`即梦结果下载失败：HTTP ${res.status}`);
    const contentType = typeof res.headers?.get === 'function' ? res.headers.get('content-type') : '';
    ext = outputExtFromMime(contentType, ext);
    buf = Buffer.from(await res.arrayBuffer());
  } else if (fs.existsSync(localPath)) {
    ext = path.extname(localPath) || ext;
    buf = fs.readFileSync(localPath);
  } else {
    return text;
  }
  const filename = `${prefix}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}${ext}`;
  fs.writeFileSync(path.join(config.OUTPUT_DIR, filename), buf);
  return `/files/output/${filename}`;
}

async function resolveLocalMedia(value, kind, provider, options = {}) {
  if (options.resolveLocalMedia) return options.resolveLocalMedia(value, kind);
  const resolved = await resolveMediaRef(value, {
    target: 'local-path',
    baseUrl: options.baseUrl,
  });
  return wslPath(provider, resolved.path);
}

async function storeOutputs(raw, kind, options = {}) {
  const values = [];
  collectOutputs(raw, values);
  const urls = [];
  for (const value of values) {
    const local = options.storeOutput
      ? await options.storeOutput(value, kind)
      : await defaultStoreOutput(value, kind, options);
    if (local && !urls.includes(local)) urls.push(local);
  }
  return urls;
}

async function generateImage(provider, input = {}, options = {}) {
  const prompt = String(input.prompt || '').trim();
  if (!prompt) return { ok: false, code: 'missing_prompt', providerId: provider.id, protocol: 'jimeng-cli', error: '请输入图像提示词。' };
  const model = selectedModel(input.model || input.providerModel, provider.imageModels, 'jimeng-image-2k');
  const refs = Array.isArray(input.images) ? input.images : [];
  const args = [];
  if (refs.length) {
    const refPath = await resolveLocalMedia(refs[0], 'image', provider, options);
    args.push('image2image', `--images=${refPath}`, `--prompt=${prompt}`);
  } else {
    args.push('text2image', `--prompt=${prompt}`, `--ratio=${ratioFromSize(input.size || '1024x1024')}`);
  }
  args.push(`--resolution_type=${imageResolution(model, input.size || '1024x1024')}`, `--poll=${pollSeconds(provider)}`);
  try {
    const raw = await runCli(provider, args, options, 120);
    const imageUrls = await storeOutputs(raw, 'image', options);
    if (!imageUrls.length) return { ok: false, code: 'empty_image', providerId: provider.id, protocol: 'jimeng-cli', error: '即梦 CLI 没有返回图片。', raw };
    return { ok: true, kind: 'image', code: 'completed', providerId: provider.id, protocol: 'jimeng-cli', model, imageUrls, taskId: submitId(raw), raw };
  } catch (e) {
    return { ok: false, code: 'cli_failed', providerId: provider.id, protocol: 'jimeng-cli', error: e?.message || '即梦 CLI 调用失败。' };
  }
}

async function generateVideo(provider, input = {}, options = {}) {
  const prompt = String(input.prompt || '').trim();
  if (!prompt) return { ok: false, code: 'missing_prompt', providerId: provider.id, protocol: 'jimeng-cli', error: '请输入视频提示词。' };
  const model = selectedModel(input.model || input.providerModel, provider.videoModels, 'seedance2.0fast_vip');
  const refs = Array.isArray(input.images) ? input.images : [];
  const duration = videoDuration(input.duration);
  const ratio = videoRatio(input.aspect_ratio || input.ratio);
  const args = [];
  if (refs.length >= 2) {
    const paths = [];
    for (const ref of refs.slice(0, 8)) paths.push(await resolveLocalMedia(ref, 'image', provider, options));
    args.push('multiframe2video', `--images=${paths.join(',')}`, `--prompt=${prompt}`, `--duration=${duration}`);
  } else if (refs.length === 1) {
    const refPath = await resolveLocalMedia(refs[0], 'image', provider, options);
    args.push('multimodal2video', `--image=${refPath}`, `--prompt=${prompt}`, `--duration=${duration}`);
    if (ratio) args.push(`--ratio=${ratio}`);
  } else {
    args.push('text2video', `--prompt=${prompt}`, `--duration=${duration}`, `--ratio=${ratio || '16:9'}`);
  }
  const modelVersion = videoModelVersion(model);
  if (modelVersion) args.push(`--model_version=${modelVersion}`);
  args.push(`--video_resolution=${videoResolution(model, input.resolution).toLowerCase()}`, `--poll=${pollSeconds(provider)}`);
  try {
    const raw = await runCli(provider, args, options, 180);
    const videoUrls = await storeOutputs(raw, 'video', options);
    if (!videoUrls.length) return { ok: false, code: 'empty_video', providerId: provider.id, protocol: 'jimeng-cli', error: '即梦 CLI 没有返回视频。', raw };
    return { ok: true, kind: 'video', code: 'completed', providerId: provider.id, protocol: 'jimeng-cli', model, videoUrls, taskId: submitId(raw), raw };
  } catch (e) {
    return { ok: false, code: 'cli_failed', providerId: provider.id, protocol: 'jimeng-cli', error: e?.message || '即梦 CLI 调用失败。' };
  }
}

async function testProvider(provider, options = {}) {
  const executablePath = cleanExecutablePath(provider);
  if (!executablePath) {
    return {
      ok: false,
      code: 'missing_cli_path',
      providerId: provider.id,
      protocol: 'jimeng-cli',
      error: '请先填写 dreamina / 即梦 CLI 可执行路径。',
    };
  }
  if (!commandExists(executablePath)) {
    return {
      ok: false,
      code: 'cli_not_found',
      providerId: provider.id,
      protocol: 'jimeng-cli',
      error: '未找到即梦 CLI，请检查路径或 PATH。',
    };
  }
  return {
    ok: true,
    code: options.dryRun ? 'dry_run_ok' : 'cli_found',
    providerId: provider.id,
    protocol: 'jimeng-cli',
    message: '即梦 CLI 路径可用。',
  };
}

module.exports = {
  generateImage,
  generateVideo,
  testProvider,
};
