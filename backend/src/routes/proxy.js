/**
 * 上游 API 代理路由
 * 1. 隐藏 API Key,前端只通过 /api/proxy/* 调用
 * 2. 自动注入对应的 Key(贞贞工坊 / LLM 独立)
 * 3. 图像生成结果自动转存到 /output 并返回本地 URL
 */
const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const config = require('../config');
const { getWhitePng } = require('../utils/whitePng');
const { tryDecodeDuckPayload } = require('../utils/duckPayload');
const { normalizeLlmMessageMedia } = require('../providers/llmMedia');

const router = express.Router();

// 音频文件上传中间件(内存存储, 50MB)
const audioUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

function safeOutputExt(ext, fallback = 'png') {
  const s = String(ext || '')
    .trim()
    .toLowerCase()
    .replace(/^\./, '')
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 12);
  return s || fallback;
}

function extFromContentType(contentType) {
  const ct = String(contentType || '').toLowerCase().split(';')[0].trim();
  const map = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'image/bmp': 'bmp',
    'image/avif': 'avif',
    'video/mp4': 'mp4',
    'video/webm': 'webm',
    'video/quicktime': 'mov',
    'audio/mpeg': 'mp3',
    'audio/wav': 'wav',
    'audio/ogg': 'ogg',
    'audio/mp4': 'm4a',
    'audio/flac': 'flac',
  };
  return map[ct] || '';
}

function inferRemoteOutputExt(url, contentType) {
  const tail = String(url || '').split(/[?#]/)[0];
  const m = tail.match(/\.([a-z0-9]{2,8})$/i);
  return safeOutputExt(m ? m[1] : extFromContentType(contentType), 'png');
}

// ========== 工具:加载 Settings 明文 ==========
function loadRawSettings() {
  if (!fs.existsSync(config.SETTINGS_FILE)) return null;
  try {
    return JSON.parse(fs.readFileSync(config.SETTINGS_FILE, 'utf-8'));
  } catch {
    return null;
  }
}

// ========== 工具: 按提示词（模型名 / endpoint / 路由名）选择分类 API Key ==========
// 未填分类 key 时 fallback 到 通用 zhenzhenApiKey。
// hint 例: 'gpt-image-1' / 'nano-banana-pro' / 'mj-fast' / 'veo3.1-fal'
//          / 'grok-video-fal' / 'seedance-v3' / 'suno-v5.5' / 'fal-ai/nano-banana/edit'
function pickApiKey(settings, hint = '') {
  if (!settings) return '';
  const fb = settings.zhenzhenApiKey || '';
  const m = String(hint || '').toLowerCase();
  if (!m) return fb;
  if (m.includes('gpt-image') || m.includes('gpt2') || m.includes('gpt_image') || m.includes('gptimage')) return settings.gptImageApiKey || fb;
  if (m.includes('nano-banana') || m.includes('nano_banana') || m.includes('nanobanana')) return settings.nanoBananaApiKey || fb;
  if (m.includes('midjourney') || /\bmj[-_/]/.test(m) || m.startsWith('mj') || m === 'mj') return settings.mjApiKey || fb;
  if (m.includes('veo')) return settings.veoApiKey || fb;
  if (m.includes('sora')) return settings.veoApiKey || fb;
  if (m.includes('grok')) return settings.grokApiKey || fb;
  if (m.includes('seedance')) return settings.seedanceApiKey || fb;
  if (m.includes('suno') || m.includes('chirp')) return settings.sunoApiKey || fb;
  return fb;
}

// ========== 工具: 以提示词为准，将 settings.zhenzhenApiKey 临时覆盖为分类 key ==========
// 调用后，后续所有 settings.zhenzhenApiKey 引用默认都会拿到分类 key（零侵入原逻辑）。
function applyClassifiedKey(settings, hint) {
  if (!settings) return;
  const picked = pickApiKey(settings, hint);
  if (picked) settings.zhenzhenApiKey = picked;
}

// ========== v1.2.9.15 新增：「专属优先 fallback 通用」一体化 API Key 校验 ==========
// 修复 v1.2.9.14 之前的两类 bug：
//   ① 旧路由先校验 settings.zhenzhenApiKey 非空 → 再 applyClassifiedKey；
//      若用户「只配置了分类专属 key 而通用 key 留空」，会被第一道检查误拦，
//      报「未配置贞贞工坊 API Key」，但其实专属 key 已存在；
//   ② 即使 zhenzhenApiKey 是错误值（如 '123'），按旧顺序通过校验后 applyClassifiedKey
//      仍能用 sunoApiKey 覆盖，但用户错配了 audio/upload 这类「完全没调 applyClassifiedKey」
//      的子路由 → Suno 上传步骤直接用 zhenzhenApiKey='123' 上传 → 上游返回令牌错误。
//
// 用法：
//   const settings = loadRawSettings();
//   if (!ensureKey(settings, res, 'suno', 'Suno')) return;
//   // 此时 settings.zhenzhenApiKey 已是 effective key（专属优先 fallback 通用），
//   // 后续直接 `Bearer ${settings.zhenzhenApiKey}` 即可。
//
// 副作用：成功时（return true）已对 settings 做 applyClassifiedKey；
//        失败时（return false）已通过 res 写入 400 响应，调用方应直接 return。
//
// 设计原则：
//   - 「专属优先」：sunoApiKey 非空 → 用 sunoApiKey；
//   - 「通用 fallback」：sunoApiKey 留空但 zhenzhenApiKey 非空 → 用 zhenzhenApiKey；
//   - 「双空才拒」：两者都空时报「分类专属 + 通用 至少填其一」。
function ensureKey(settings, res, hint, label) {
  if (!settings) {
    res.status(400).json({ success: false, error: '未找到 settings 文件，请先在【设置】中配置 API Key' });
    return false;
  }
  applyClassifiedKey(settings, hint || '');
  if (!settings.zhenzhenApiKey) {
    const tip = label
      ? `未配置 ${label} 专属 API Key，且贞贞工坊通用 API Key 也为空（请在【设置】中至少填写其中一个）`
      : '未配置贞贞工坊 API Key（请在【设置】中填写）';
    res.status(400).json({ success: false, error: tip });
    return false;
  }
  return true;
}

// ========== 工具: taskId → 实际使用的 apiKey 内存映射 ==========
// submit 阶段根据 hint 选了分类 key 后，将 (taskId → key) 记下，
// query/status 阶段优先从该 Map 恢复 key，
// 防止前端未透传 model 时轮询错误 fallback 到通用 key 导致“令牌不合法”。
// 30 分钟过期自清。
const taskKeyMap = new Map();
function rememberTaskKey(taskId, apiKey) {
  if (!taskId || !apiKey) return;
  taskKeyMap.set(String(taskId), apiKey);
  setTimeout(() => taskKeyMap.delete(String(taskId)), 30 * 60 * 1000);
}
function recallTaskKey(taskId) {
  return taskId ? taskKeyMap.get(String(taskId)) : null;
}

// ========== 工具:保存上游返回的图像到本地 ==========
async function saveRemoteImage(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`下载失败: ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    const ext = (url.match(/\.(png|jpe?g|webp|gif)/i)?.[1] || 'png').toLowerCase();
    const filename = `img_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.${ext}`;
    const filePath = path.join(config.OUTPUT_DIR, filename);
    fs.writeFileSync(filePath, buf);
    return `/files/output/${filename}`;
  } catch (e) {
    console.error('⚠ 转存图像失败:', e.message);
    return url; // 退化:返回原 URL
  }
}

// ========== 工具:保存上游返回的音频到本地 ==========
async function saveRemoteAudio(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`下载失败: ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    const ext = (url.match(/\.(mp3|wav|m4a|ogg|flac|aac)/i)?.[1] || 'mp3').toLowerCase();
    const filename = `audio_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.${ext}`;
    const filePath = path.join(config.OUTPUT_DIR, filename);
    fs.writeFileSync(filePath, buf);
    return `/files/output/${filename}`;
  } catch (e) {
    console.error('⚠ 转存音频失败:', e.message);
    return url; // 退化:返回原 URL
  }
}

// 处理 b64_json 格式
function saveBase64Image(b64) {
  try {
    const raw = String(b64 || '');
    const clean = raw.includes(',') ? raw.split(',').pop() : raw;
    const buf = Buffer.from(clean || '', 'base64');
    const filename = `img_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.png`;
    const filePath = path.join(config.OUTPUT_DIR, filename);
    fs.writeFileSync(filePath, buf);
    return `/files/output/${filename}`;
  } catch (e) {
    console.error('⚠ 解析 b64 失败:', e.message);
    return null;
  }
}

// ========== POST /api/proxy/image — 图像生成 ==========
// body: { model, apiModel?, paramKind?, prompt, aspect_ratio?, image_size?, images?[], size?, image?, quality?, n? }
//
// 主项目对齐的双协议路由:
//  1. paramKind === 'gpt-size'
//     - 无参考图 → POST /v1/images/generations (JSON)  body: { model, prompt, size }
//     - 有参考图 → POST /v1/images/edits        (multipart) image 多次 append
//     - size 从 (aspect_ratio + image_size 等级) 映射为像素串(1024x1024/1536x1024/1024x1536/2048x2048…)
//  2. paramKind === 'banana-ratio'
//     - POST /v1/images/generations (JSON) body: { model, prompt, aspect_ratio, image_size:'1K'|'2K'|'4K', image:[base64...]? }

// ========== 主项目 gpt-image-2-web 完整 GPT_SIZE_MAP(line 2173)==========
const GPT_SIZE_MAP = {
  '1:1_1k': '1024x1024', '1:1_2k': '2048x2048', '1:1_4k': '2880x2880',
  '3:2_1k': '1248x832',  '3:2_2k': '2496x1664', '3:2_4k': '3504x2336',
  '2:3_1k': '832x1248',  '2:3_2k': '1664x2496', '2:3_4k': '2336x3504',
  '4:3_1k': '1152x864',  '4:3_2k': '2304x1728', '4:3_4k': '3264x2448',
  '3:4_1k': '864x1152',  '3:4_2k': '1728x2304', '3:4_4k': '2448x3264',
  '5:4_1k': '1120x896',  '5:4_2k': '2240x1792', '5:4_4k': '3200x2560',
  '4:5_1k': '896x1120',  '4:5_2k': '1792x2240', '4:5_4k': '2560x3200',
  '16:9_1k': '1280x720', '16:9_2k': '2560x1440', '16:9_4k': '3840x2160',
  '9:16_1k': '720x1280', '9:16_2k': '1440x2560', '9:16_4k': '2160x3840',
  '2:1_1k': '2048x1024', '2:1_2k': '2688x1344', '2:1_4k': '3840x1920',
  '1:2_1k': '1024x2048', '1:2_2k': '1344x2688', '1:2_4k': '1920x3840',
  '21:9_1k': '1456x624', '21:9_2k': '3024x1296', '21:9_4k': '3696x1584',
  '9:21_1k': '624x1456', '9:21_2k': '1296x3024', '9:21_4k': '1584x3696',
};

// 将 (aspectRatio + sizeLevel) 用主项目 GPT_SIZE_MAP 映射成像素串;Auto 返 'auto'
function aspectToGptSize(aspectRatio, sizeLevel) {
  const ar = String(aspectRatio || '').trim();
  const lvl = String(sizeLevel || '1K').toLowerCase();
  const isAuto = !ar || ar === 'Auto' || ar === 'AUTO' || ar === 'empty';
  if (isAuto) return 'auto';
  const key = `${ar}_${lvl}`;
  return GPT_SIZE_MAP[key] || '1024x1024';
}

// 将 base64 dataURL / http(s) URL 转成 multipart Buffer
async function refToBuffer(ref) {
  if (typeof ref !== 'string' || !ref) return null;
  if (ref.startsWith('data:')) {
    const m = ref.match(/^data:([^;,]+);base64,(.+)$/);
    if (!m) return null;
    const mime = m[1] || 'image/png';
    const buf = Buffer.from(m[2], 'base64');
    const ext = (mime.split('/')[1] || 'png').replace('jpeg', 'jpg');
    return { buf, mime, ext };
  }
  if (ref.startsWith('http://') || ref.startsWith('https://') || ref.startsWith('/files/')) {
    // /files/* 是本地静态,走 127.0.0.1:18766
    const url = ref.startsWith('/') ? `http://127.0.0.1:${config.PORT}${ref}` : ref;
    const r = await fetch(url);
    if (!r.ok) return null;
    const ct = r.headers.get('content-type') || 'image/png';
    const buf = Buffer.from(await r.arrayBuffer());
    const ext = (ct.split('/')[1] || 'png').replace('jpeg', 'jpg');
    return { buf, mime: ct, ext };
  }
  return null;
}

// 将 base64/URL 参考图转成 banana 希望的 dataURL 或保留外部 URL
async function refToBananaImage(ref) {
  if (typeof ref !== 'string' || !ref) return null;
  if (ref.startsWith('data:')) return ref;
  if (ref.startsWith('http://') || ref.startsWith('https://')) return ref;
  if (ref.startsWith('/files/')) {
    // 本地资源 → 转 base64
    try {
      const r = await fetch(`http://127.0.0.1:${config.PORT}${ref}`);
      if (!r.ok) return null;
      const ct = r.headers.get('content-type') || 'image/png';
      const buf = Buffer.from(await r.arrayBuffer());
      return `data:${ct};base64,${buf.toString('base64')}`;
    } catch { return null; }
  }
  return null;
}

// Grok Image 默认按 gpt-image-2-web 的 Base64 方式传参考图,最多 4 张。
async function refToGrokImage(ref) {
  if (typeof ref !== 'string' || !ref) return null;
  if (ref.startsWith('data:')) return ref.startsWith('data:image') ? ref : null;
  if (ref.startsWith('http://') || ref.startsWith('https://') || ref.startsWith('/files/')) {
    try {
      const url = ref.startsWith('/') ? `http://127.0.0.1:${config.PORT}${ref}` : ref;
      const r = await fetch(url);
      if (!r.ok) return ref.startsWith('http') ? ref : null;
      const ct = r.headers.get('content-type') || 'image/png';
      const buf = Buffer.from(await r.arrayBuffer());
      if (!String(ct).toLowerCase().startsWith('image/')) return null;
      return `data:${ct};base64,${buf.toString('base64')}`;
    } catch {
      // 外网图片转 base64 失败时保留 URL,避免破坏已有可公网访问的上游图。
      return ref.startsWith('http') ? ref : null;
    }
  }
  return null;
}

function isImageTaskString(s) {
  return /^[A-Za-z0-9_-]{8,256}$/.test(String(s || '').trim());
}

function imageTaskId(result) {
  if (!result || typeof result !== 'object' || Array.isArray(result)) return '';
  for (const k of ['task_id', 'id', 'request_id']) {
    if (result[k]) return String(result[k]);
  }
  const d = result.data;
  if (typeof d === 'string' && d.trim() && !/^https?:\/\//.test(d) && !d.startsWith('data:image')) return d.trim();
  if (d && typeof d === 'object') {
    for (const k of ['task_id', 'id', 'request_id']) {
      if (d[k]) return String(d[k]);
    }
  }
  return '';
}

function imageError(result) {
  if (!result) return '';
  if (typeof result === 'string') return result.substring(0, 500);
  if (Array.isArray(result)) return JSON.stringify(result.slice(0, 3)).substring(0, 500);
  if (typeof result !== 'object') return '';
  for (const k of ['detail', 'fail_reason', 'error', 'message']) {
    const v = result[k];
    if (!v) continue;
    if (typeof v === 'string') return v.substring(0, 500);
    if (typeof v === 'object') return String(v.message || v.detail || JSON.stringify(v)).substring(0, 500);
  }
  const d = result.data;
  if (d && typeof d === 'object') {
    const nested = imageError(d);
    if (nested) return nested;
  }
  return '';
}

function imageApiFailed(result) {
  if (!result || typeof result !== 'object' || Array.isArray(result)) return false;
  const code = String(result.code ?? '').toLowerCase();
  if (code && !['success', 'ok', '0', '200'].includes(code)) return true;
  if (result.detail || result.error) return true;
  return false;
}

function imageStatus(result) {
  if (!result || typeof result !== 'object') return '';
  for (const k of ['status', 'task_status', 'state']) {
    if (result[k]) return String(result[k]).toUpperCase();
  }
  const d = result.data;
  if (d && typeof d === 'object') {
    for (const k of ['status', 'task_status', 'state']) {
      if (d[k]) return String(d[k]).toUpperCase();
    }
  }
  return '';
}

function imageItems(result) {
  if (!result) return [];
  if (Array.isArray(result)) return result;
  if (typeof result === 'string') {
    const s = result.trim();
    return s && !isImageTaskString(s) ? [s] : [];
  }
  if (typeof result !== 'object') return [];
  if (result.url || result.image_url || result.b64_json || result.base64 || result.image_base64) return [result];
  for (const k of ['data', 'images', 'result', 'results', 'output', 'outputs', 'image', 'url']) {
    const v = result[k];
    if (!v) continue;
    if (Array.isArray(v)) return v;
    if (typeof v === 'string') {
      const s = v.trim();
      if (!s || isImageTaskString(s)) continue;
      return [s];
    }
    if (typeof v === 'object') {
      const nested = imageItems(v);
      if (nested.length) return nested;
    }
  }
  return [];
}

function normalizeImageItems(result) {
  return imageItems(result).map((item) => {
    if (typeof item === 'string') {
      return /^https?:\/\//.test(item) ? { url: item } : { b64_json: item.startsWith('data:image') ? item : item };
    }
    if (item && typeof item === 'object') {
      const url = item.url || item.image_url || (typeof item.image === 'string' && /^https?:\/\//.test(item.image) ? item.image : '');
      const b64 = item.b64_json || item.base64 || item.image_base64 || (!url && typeof item.image === 'string' ? item.image : '');
      if (url) return { url };
      if (b64) return { b64_json: b64 };
    }
    return null;
  }).filter(Boolean);
}

async function saveImageItemsFromResult(result) {
  const urls = [];
  for (const it of normalizeImageItems(result)) {
    if (it?.b64_json) {
      const u = saveBase64Image(it.b64_json);
      if (u) urls.push(u);
    } else if (it?.url) {
      const u = await saveRemoteImage(it.url);
      urls.push(u);
    }
  }
  return urls;
}

// LLM 多模态 image_url 预处理:
//   上游 LLM 服务(贞贞工坊)无法访问本地 /files/* 路径,需提前转成 base64 dataURL inline。
//   - data: 保留
//   - http(s):// 保留(上游可访问)
//   - /files/* → 本地拉 buffer 转 base64 dataURL
//   对齐 gpt-image-2-web chat 模式处理参考图的思路。
//   零破坏:对于 content 为字符串的普通文本消息不动;仅处理 content 为数组且含 image_url 部分。
async function normalizeLlmMessageImages(messages) {
  if (!Array.isArray(messages)) return messages;
  for (const msg of messages) {
    if (!msg || !Array.isArray(msg.content)) continue;
    for (const part of msg.content) {
      if (!part || part.type !== 'image_url' || !part.image_url) continue;
      const url = part.image_url.url;
      if (typeof url !== 'string' || !url) continue;
      // 已是 base64 或外网 URL→不动
      if (url.startsWith('data:') || url.startsWith('http://') || url.startsWith('https://')) continue;
      // 本地路径→转 base64 dataURL
      if (url.startsWith('/files/')) {
        const dataUrl = await refToBananaImage(url);
        if (dataUrl) {
          part.image_url.url = dataUrl;
        } else {
          // 转换失败:报一个明确错误,避免上游 'base64:/files/...' 这种误导报错
          throw new Error(`本地图片读取失败: ${url}`);
        }
      }
      // 其它未知前缀:保留原值,让上游报真错误
    }
  }
  return messages;
}

// ========================================================================
// 核心 helper:完全对齐主项目 gpt-image-2-web 的上游调用
//   - GPT2 始终走 multipart /v1/images/edits?async=true(line 2869)
//   - 文生图时用 1024x1024 白图占位(line 2861)
//   - GPT2 字段: prompt/model/n/quality/moderation/size(像素串)/aspectRatio(camelCase)/resolution(1k|2k|4k)
//   - nano-banana 文生图: JSON /generations?async=true { prompt, model, aspect_ratio, image_size }
//   - nano-banana 图生图: multipart /edits?async=true 添加 image 多个
//   - Grok Image: JSON /generations?async=true { model, prompt, aspect_ratio, image:[base64...]? }
// ========================================================================
async function callImageUpstreamAsync({ apiKey, finalApiModel, paramKind, prompt, n, aspect_ratio, image_size, refs, size, quality }) {
  const upstreamBase = `${config.ZHENZHEN_BASE_URL}/v1/images`;
  const auth = `Bearer ${apiKey}`;
  const ar = String(aspect_ratio || '').trim();
  const isAuto = !ar || ar === 'Auto' || ar === 'AUTO' || ar === 'empty';
  const lvlLower = String(image_size || '1K').toLowerCase();
  const lvlUpper = String(image_size || '2K').toUpperCase();
  const hasRefs = Array.isArray(refs) && refs.length > 0;

  // ===== Grok Image 路径(对齐 gpt-image-2-web Tab 12,默认参考图 Base64) =====
  if (paramKind === 'grok-image') {
    const grokRefs = [];
    if (hasRefs) {
      for (const ref of refs.slice(0, 4)) {
        const converted = await refToGrokImage(ref);
        if (converted) grokRefs.push(converted);
      }
    }
    const body = { model: finalApiModel, prompt, aspect_ratio: isAuto ? '1:1' : ar };
    if (grokRefs.length) body.image = grokRefs;
    const url = `${upstreamBase}/generations?async=true`;
    console.log('[upstream] Grok Image JSON → /generations?async=true model:', finalApiModel, 'aspect_ratio:', body.aspect_ratio, 'refs:', grokRefs.length);
    return await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: auth },
      body: JSON.stringify(body),
    });
  }

  // ===== GPT2 总走 multipart /edits?async=true(文生图加白图占位) =====
  if (paramKind === 'gpt-size') {
    const form = new FormData();
    const px = size || aspectToGptSize(ar, lvlLower);
    form.append('prompt', prompt);
    form.append('model', finalApiModel);
    form.append('n', String(n || 1));
    form.append('quality', quality || 'auto');
    form.append('moderation', 'auto');
    form.append('size', px);
    form.append('aspectRatio', isAuto ? '' : ar); // 主项目用 camelCase
    form.append('resolution', lvlLower);          // 主项目用小写 1k/2k/4k

    if (hasRefs) {
      for (let i = 0; i < refs.length; i++) {
        const conv = await refToBuffer(refs[i]);
        if (!conv) continue;
        const blob = new Blob([conv.buf], { type: conv.mime });
        form.append('image', blob, `image_${i}.${conv.ext}`);
      }
    } else {
      // 主项目 line 2861: 无参考图时创建 1024x1024 白图占位
      const whiteBuf = getWhitePng(1024, 1024);
      const blob = new Blob([whiteBuf], { type: 'image/png' });
      form.append('image', blob, 'blank.png');
    }

    const url = `${upstreamBase}/edits?async=true`;
    console.log('[upstream] GPT2 multipart → /edits?async=true model:', finalApiModel, 'size:', px, 'aspectRatio:', ar, 'resolution:', lvlLower, 'refs:', refs?.length || 0);
    return await fetch(url, { method: 'POST', headers: { Authorization: auth }, body: form });
  }

  // ===== nano-banana 路径 =====
  if (hasRefs) {
    // 图生图 → multipart /edits?async=true
    const form = new FormData();
    form.append('prompt', prompt);
    form.append('model', finalApiModel);
    form.append('aspect_ratio', isAuto ? '1:1' : ar);
    if (String(finalApiModel).includes('nano-banana')) form.append('image_size', lvlUpper);
    for (let i = 0; i < refs.length; i++) {
      const conv = await refToBuffer(refs[i]);
      if (!conv) continue;
      const blob = new Blob([conv.buf], { type: conv.mime });
      form.append('image', blob, `image_${i}.${conv.ext}`);
    }
    const url = `${upstreamBase}/edits?async=true`;
    console.log('[upstream] nano-banana multipart → /edits?async=true model:', finalApiModel, 'aspect_ratio:', ar, 'image_size:', lvlUpper, 'refs:', refs.length);
    return await fetch(url, { method: 'POST', headers: { Authorization: auth }, body: form });
  }
  // 文生图 → JSON /generations?async=true
  const body = { prompt, model: finalApiModel, aspect_ratio: isAuto ? '1:1' : ar };
  if (String(finalApiModel).includes('nano-banana')) body.image_size = lvlUpper;
  const url = `${upstreamBase}/generations?async=true`;
  console.log('[upstream] nano-banana JSON → /generations?async=true model:', finalApiModel, 'aspect_ratio:', body.aspect_ratio, 'image_size:', body.image_size);
  return await fetch(url, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: auth },
    body: JSON.stringify(body),
  });
}

// 将上游响应 normalize 为 { kind: 'sync'|'async', urls?, taskId? }
async function normalizeImageResponse(data) {
  if (imageApiFailed(data)) {
    return { kind: 'failed', error: imageError(data) || '上游图像 API 返回失败' };
  }
  const urls = await saveImageItemsFromResult(data);
  if (urls.length) return { kind: 'sync', urls };
  // 异步任务 task_id
  const taskId = imageTaskId(data);
  if (taskId) return { kind: 'async', taskId };
  return { kind: 'unknown' };
}

router.post('/image', async (req, res) => {
  const settings = loadRawSettings();
  const {
    model, apiModel, paramKind: paramKindIn,
    prompt, n,
    aspect_ratio, image_size,
    images, image, size, quality,
  } = req.body || {};
  // v1.2.9.15: 一体化「专属优先 fallback 通用」校验
  if (!ensureKey(settings, res, apiModel || model || '', '图像')) return;
  if (!prompt) return res.status(400).json({ success: false, error: 'prompt 必填' });
  const m = String(apiModel || model || '');
  const ml = m.toLowerCase();
  const paramKind = paramKindIn || (ml.includes('grok') && ml.includes('image') ? 'grok-image' : (ml.includes('nano-banana') ? 'banana-ratio' : 'gpt-size'));
  const finalApiModel = apiModel || model;
  if (!finalApiModel) return res.status(400).json({ success: false, error: 'model 必填' });
  const refs = Array.isArray(images) ? images.filter(Boolean) : [];
  if (typeof image === 'string' && image && !refs.includes(image)) refs.unshift(image);

  try {
    const r = await callImageUpstreamAsync({
      apiKey: settings.zhenzhenApiKey, finalApiModel, paramKind,
      prompt, n, aspect_ratio, image_size, refs, size, quality,
    });
    const text = await r.text();
    let data; try { data = JSON.parse(text); } catch {
      return res.status(500).json({ success: false, error: '上游响应非 JSON: ' + text.slice(0, 300) });
    }
    if (!r.ok) {
      return res.status(r.status).json({
        success: false,
        error: data?.error?.message || data?.message || `上游 HTTP ${r.status}`,
      });
    }
    const norm = await normalizeImageResponse(data);
    if (norm.kind === 'failed') {
      return res.status(500).json({ success: false, error: norm.error || '上游图像任务失败', raw: data });
    }
    if (norm.kind === 'sync') {
      return res.json({ success: true, data: { urls: norm.urls, raw: data, model: finalApiModel, prompt } });
    }
    if (norm.kind === 'async') {
      // 同步接口需要同步返回结果 → 内部轮询
      const url = await pollImageTask(norm.taskId, settings.zhenzhenApiKey);
      if (!url) return res.status(500).json({ success: false, error: '异步任务轮询超时/失败', taskId: norm.taskId });
      return res.json({ success: true, data: { urls: [url], raw: data, taskId: norm.taskId, model: finalApiModel, prompt } });
    }
    return res.status(500).json({ success: false, error: '上游未返回图片也未返 task_id: ' + JSON.stringify(data).slice(0, 300) });
  } catch (e) {
    console.error('proxy/image 错误:', e);
    res.status(500).json({ success: false, error: e.message || '请求失败' });
  }
});

// ========================================================================
// 图像异步任务接口(与主项目 gpt-image-2-web 一致)
// POST /api/proxy/image/submit -> { taskId }(同 submit 逻辑,但不同步轮询)
// GET  /api/proxy/image/status/:tid -> { status, progress, urls? }
// ========================================================================
router.post('/image/submit', async (req, res) => {
  const settings = loadRawSettings();
  try {
    const { model, apiModel, paramKind: paramKindIn, prompt, n,
            aspect_ratio, image_size, images, image, size, quality } = req.body || {};
    // v1.2.9.15: 一体化「专属优先 fallback 通用」校验
    if (!ensureKey(settings, res, apiModel || model || '', '图像')) return;
    if (!prompt) return res.status(400).json({ success: false, error: 'prompt 不得为空' });
    const m = String(apiModel || model || '');
    const ml = m.toLowerCase();
    const paramKind = paramKindIn || (ml.includes('grok') && ml.includes('image') ? 'grok-image' : (ml.includes('nano-banana') ? 'banana-ratio' : 'gpt-size'));
    const finalApiModel = apiModel || model;
    if (!finalApiModel) return res.status(400).json({ success: false, error: 'model 必填' });
    const refs = Array.isArray(images) ? images.filter(Boolean) : [];
    if (typeof image === 'string' && image && !refs.includes(image)) refs.unshift(image);

    // 完全对齐主项目 gpt-image-2-web:走 ?async=true,GPT2 强制 multipart edits + 白图占位
    const r = await callImageUpstreamAsync({
      apiKey: settings.zhenzhenApiKey, finalApiModel, paramKind,
      prompt, n, aspect_ratio, image_size, refs, size, quality,
    });
    const text = await r.text();
    let data; try { data = JSON.parse(text); } catch { data = { _raw: text }; }
    if (!r.ok) {
      return res.status(r.status).json({ success: false, error: data?.error?.message || data?.message || `上游 HTTP ${r.status}`, raw: data });
    }

    const norm = await normalizeImageResponse(data);
    if (norm.kind === 'failed') {
      return res.status(500).json({ success: false, error: norm.error || '上游图像任务失败', raw: data });
    }
    if (norm.kind === 'sync') {
      return res.json({ success: true, data: { sync: true, status: 'completed', progress: '100%', urls: norm.urls, raw: data } });
    }
    if (norm.kind === 'async') {
      rememberTaskKey(norm.taskId, settings.zhenzhenApiKey);
      return res.json({ success: true, data: { sync: false, taskId: norm.taskId, status: 'pending', progress: '0%', raw: data } });
    }
    return res.status(500).json({ success: false, error: '未获取到 task_id 且无同步结果: ' + JSON.stringify(data).slice(0, 300) });
  } catch (e) {
    console.error('proxy/image/submit 错误:', e);
    res.status(500).json({ success: false, error: e.message || '请求失败' });
  }
});

// 查询异步图像任务状态
router.get('/image/status/:tid', async (req, res) => {
  const settings = loadRawSettings();
  // 优先从 submit 阶段记录的 (taskId → key) 映射恢复，防止前端未传 model 导致 fallback 错 key。
  const remembered = recallTaskKey(req.params.tid);
  if (remembered) {
    if (settings) settings.zhenzhenApiKey = remembered;
    else return res.status(400).json({ success: false, error: '未找到 settings' });
  } else {
    // v1.2.9.15: 一体化「专属优先 fallback 通用」校验（查询阶段可选传 ?model=xxx）
    if (!ensureKey(settings, res, String(req.query.model || ''), '图像')) return;
  }
  const tid = req.params.tid;
  try {
    const url = `${config.ZHENZHEN_BASE_URL}/v1/images/tasks/${encodeURIComponent(tid)}`;
    const r = await fetch(url, { headers: { Authorization: `Bearer ${settings.zhenzhenApiKey}` } });
    const text = await r.text();
    let data; try { data = JSON.parse(text); } catch { data = { _raw: text }; }
    if (!r.ok) {
      return res.status(r.status).json({ success: false, error: data?.error?.message || `上游 HTTP ${r.status}`, raw: data });
    }
    if (imageApiFailed(data)) {
      return res.json({ success: false, data: { status: 'failed', progress: '0%', error: imageError(data) || '任务失败', raw: data } });
    }
    const statusRaw = imageStatus(data);
    const status = String(statusRaw || '').toLowerCase();
    const inner = data?.data && typeof data.data === 'object' ? data.data : {};
    const progress = inner.progress || data?.progress || '0%';
    const SUCCESS = ['success', 'completed', 'complete', 'done', 'finished'];
    const FAILURE = ['failure', 'failed', 'error', 'cancelled', 'canceled'];
    const urls = await saveImageItemsFromResult(data);
    if (SUCCESS.includes(status) || urls.length) {
      return res.json({ success: true, data: { status: 'completed', progress: '100%', urls, raw: data } });
    }
    if (FAILURE.includes(status)) {
      return res.json({ success: false, data: { status: 'failed', progress, error: imageError(data) || inner.fail_reason || '任务失败', raw: data } });
    }
    res.json({ success: true, data: { status: status || 'pending', progress, raw: data } });
  } catch (e) {
    console.error('proxy/image/status 错误:', e);
    res.status(500).json({ success: false, error: e.message || '查询失败' });
  }
});

// ========== 图像异步任务轮询(同步代理内部使用,路径对齐主项目 /v1/images/tasks/) ==========
// 轮询上限:1800 × 2s = 3600s = 60 分钟,与前端 ImageNode 标准路径保持一致,
// 避免 GPT2 复杂 prompt / 多参考图任务被 120s 提前中断。
async function pollImageTask(taskId, apiKey, maxRetries = 1800, interval = 2000) {
  const url = `${config.ZHENZHEN_BASE_URL}/v1/images/tasks/${encodeURIComponent(taskId)}`;
  for (let i = 0; i < maxRetries; i++) {
    await new Promise(r => setTimeout(r, interval));
    try {
      const r = await fetch(url, { headers: { Authorization: `Bearer ${apiKey}` } });
      const text = await r.text();
      let data; try { data = JSON.parse(text); } catch { continue; }
      if (!r.ok) continue;
      const st = String(imageStatus(data) || '').toLowerCase();
      const urls = await saveImageItemsFromResult(data);
      if (['success', 'completed', 'complete', 'done', 'finished'].includes(st) || urls.length) {
        return urls[0] || null;
      }
      if (['failure', 'failed', 'error', 'cancelled', 'canceled'].includes(st) || imageApiFailed(data)) {
        console.error('[poll] 任务失败:', imageError(data) || st);
        return null;
      }
    } catch (e) {
      console.warn('[poll] 轮询异常:', e.message);
    }
  }
  return null;
}

// ========================================================================
// FAL 渠道 —— 完全对齐 gpt-image-2-web SKILL.md §FAL模型渠道接入规范
// 不破坏原有 /image · /image/submit · /image/status/:tid 三个路由。
//
// 核心路由:
//   POST /api/proxy/image/fal/submit   -> { sync, urls?, requestId?, responseUrl?, endpoint? }
//   POST /api/proxy/image/fal/query    -> { status, images?, error? }   body: { responseUrl, endpoint, requestId }
//
// 主项目上游协议(index.html line 2890 runGPTFal / line 3587 runNanoFal):
//   URL: ${baseUrl}/fal/${endpoint}
//   Auth: Bearer ${apiKey}
//   GPT FAL  endpoint: 'openai/gpt-image-2' 或 'openai/gpt-image-2/edit'
//   NBPro FAL endpoint: 'fal-ai/nano-banana-pro/edit'
//   参考图上传: POST ${baseUrl}/v1/files  (复用现有 uploadRefToZhenzhen)
//   response_url 域名修复: queue.fal.run → ${baseUrl}/fal
//   轮询 HTTP 非200时 body 中 status=IN_QUEUE/IN_PROGRESS 仍视为进行中
// ========================================================================

const FAL_REGISTRY = {
  'gpt-image-2-fal': {
    endpoint: 'openai/gpt-image-2',
    editEndpoint: 'openai/gpt-image-2/edit',
    paramKind: 'gpt-fal',
    maxRefs: 5,
  },
  'nano-banana-pro-fal': {
    endpoint: 'fal-ai/nano-banana-pro/edit',
    editEndpoint: 'fal-ai/nano-banana-pro/edit',
    paramKind: 'nbpro-fal',
    maxRefs: 8,
  },
  // 主项目 runGeminiFal (line 3491) 与 runNanoFal 共用同一 fal-ai/nano-banana-pro/edit 端点 + 同 paramKind。
  // 只是 UI 控件 id 前缀不同 (g2f_* vs nf_*)。后端零增量分支，复用 nbpro-fal payload 组装。
  'nano-banana-2-fal': {
    endpoint: 'fal-ai/nano-banana-pro/edit',
    editEndpoint: 'fal-ai/nano-banana-pro/edit',
    paramKind: 'nbpro-fal',
    maxRefs: 8,
  },
};

// 按 16 倍数对齐(主项目 line 2904)
function snap16(v, fallback) {
  const n = parseInt(v, 10);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.max(256, Math.min(3840, Math.round(n / 16) * 16));
}

// 修复 response_url 域名(主项目 line 2954)
function fixFalResponseUrl(responseUrl, baseUrl, endpoint, requestId) {
  let url = String(responseUrl || '');
  if (url.includes('queue.fal.run')) {
    url = url.replace('https://queue.fal.run', `${baseUrl}/fal`);
  }
  if (!url) {
    const requestEndpoint = String(endpoint || '').startsWith('fal-ai/sora-2/')
      ? 'fal-ai/sora-2'
      : endpoint;
    url = `${baseUrl}/fal/${requestEndpoint}/requests/${requestId}`;
  }
  return url;
}

// POST /api/proxy/image/fal/submit
//   body 公用: { apiModel, prompt, images?, n?, format?, sync?, ... }
//   gpt-fal 专属: { mode?: 'edit'|'gen', size?: '1024x1024'|'square'|...|'custom', customW?, customH?, quality?: low|medium|high|auto }
//   nbpro-fal 专属: { aspect_ratio, resolution, safety_tolerance, seed?, system_prompt?, enable_web_search?, image_mode?: 'image_url'|'base64' }
router.post('/image/fal/submit', async (req, res) => {
  const settings = loadRawSettings();
  const {
    apiModel, prompt, images, n, format, sync,
    // gpt-fal
    mode, size, customW, customH, quality,
    // nbpro-fal
    aspect_ratio, resolution, safety_tolerance, seed,
    system_prompt, enable_web_search, image_mode,
  } = req.body || {};
  // v1.2.9.15: 一体化「专属优先 fallback 通用」校验
  if (!ensureKey(settings, res, apiModel || '', '图像 FAL')) return;
  const apiKey = settings.zhenzhenApiKey;
  const baseUrl = config.ZHENZHEN_BASE_URL;

  if (!apiModel) return res.status(400).json({ success: false, error: 'apiModel 必填' });
  if (!prompt) return res.status(400).json({ success: false, error: 'prompt 不得为空' });

  const reg = FAL_REGISTRY[apiModel];
  if (!reg) return res.status(400).json({ success: false, error: `未知的 FAL 模型: ${apiModel}` });

  const refs = Array.isArray(images) ? images.filter(Boolean) : [];
  const trimmedRefs = refs.slice(0, reg.maxRefs);
  const numImages = Math.max(1, Math.min(4, parseInt(n ?? 1, 10) || 1));
  const outputFormat = String(format || 'png').toLowerCase();

  // ========== 根据 paramKind 组装 payload ==========
  let payload;
  let endpoint;
  try {
    if (reg.paramKind === 'gpt-fal') {
      // 选 endpoint: edit 或 gen
      const useEdit = (mode === 'edit') || (mode !== 'gen' && trimmedRefs.length > 0);
      endpoint = useEdit ? (reg.editEndpoint || reg.endpoint) : reg.endpoint;
      // image_size
      let imageSize;
      const sz = String(size || 'auto');
      if (sz === 'custom') {
        imageSize = { width: snap16(customW, 1280), height: snap16(customH, 1280) };
      } else if (sz && sz !== 'auto') {
        imageSize = sz; // 预设字串 square_hd / portrait_16_9 等,或像素串
      }
      payload = {
        prompt,
        quality: String(quality || 'medium'),
        num_images: numImages,
        output_format: outputFormat,
      };
      if (imageSize) payload.image_size = imageSize;
      // image_urls 仅在 edit 下添加
      if (useEdit && trimmedRefs.length) {
        const urls = [];
        for (let i = 0; i < trimmedRefs.length; i++) {
          const u = await uploadRefToZhenzhen(trimmedRefs[i], apiKey);
          if (u) urls.push(u);
          else throw new Error(`FAL 参考图 #${i + 1} 上传失败`);
        }
        if (urls.length) payload.image_urls = urls;
      }
      if (sync === true || sync === 'true') payload.sync_mode = true;
    } else if (reg.paramKind === 'nbpro-fal') {
      // nano-banana-pro 只有 edit 端点
      endpoint = reg.endpoint;
      payload = {
        prompt,
        num_images: numImages,
        aspect_ratio: String(aspect_ratio || 'auto'),
        resolution: String(resolution || '2K'),
        output_format: outputFormat,
        safety_tolerance: String(safety_tolerance || '4'),
      };
      if (seed && Number(seed) > 0) payload.seed = Number(seed);
      if (system_prompt) payload.system_prompt = String(system_prompt);
      if (enable_web_search === true || enable_web_search === 'true') payload.enable_web_search = true;
      // 参考图(最多 8 张)
      if (trimmedRefs.length) {
        const imgs = [];
        const useBase64 = String(image_mode || 'image_url') === 'base64';
        for (let i = 0; i < trimmedRefs.length; i++) {
          const r = trimmedRefs[i];
          if (useBase64) {
            // 转 base64 dataURI
            const conv = await refToBananaImage(r);
            if (conv) imgs.push(conv);
          } else {
            const u = await uploadRefToZhenzhen(r, apiKey);
            if (u) imgs.push(u);
            else throw new Error(`FAL 参考图 #${i + 1} 上传失败`);
          }
        }
        if (imgs.length) payload.image_urls = imgs;
      }
    } else {
      return res.status(400).json({ success: false, error: `不支持的 FAL paramKind: ${reg.paramKind}` });
    }

    const falUrl = `${baseUrl}/fal/${endpoint}`;
    console.log('[fal/submit]', apiModel, '→', falUrl, '| payload keys:', Object.keys(payload), '| refs:', trimmedRefs.length);

    const resp = await fetch(falUrl, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const text = await resp.text();
    let data; try { data = JSON.parse(text); } catch { data = { _raw: text }; }
    if (!resp.ok) {
      return res.status(resp.status).json({
        success: false,
        error: data?.error || data?.detail || data?.message || `FAL HTTP ${resp.status}: ${text.slice(0, 300)}`,
      });
    }
    if (Array.isArray(data)) {
      return res.status(400).json({ success: false, error: `FAL 参数校验错误: ${JSON.stringify(data).slice(0, 300)}` });
    }
    if (data?.detail && !data?.images && !data?.request_id) {
      return res.status(400).json({ success: false, error: `FAL 错误: ${JSON.stringify(data.detail).slice(0, 300)}` });
    }

    // 同步返回
    if (Array.isArray(data?.images) && data.images.length) {
      const urls = [];
      for (const it of data.images) {
        if (it?.url) {
          const local = await saveRemoteImage(it.url);
          urls.push(local);
        }
      }
      return res.json({ success: true, data: { sync: true, urls, endpoint, raw: data } });
    }

    // 异步
    const requestId = data?.request_id;
    let responseUrl = data?.response_url || '';
    if (!requestId) {
      return res.status(500).json({ success: false, error: '未获取到 request_id: ' + JSON.stringify(data).slice(0, 300) });
    }
    responseUrl = fixFalResponseUrl(responseUrl, baseUrl, endpoint, requestId);
    return res.json({
      success: true,
      data: { sync: false, requestId, responseUrl, endpoint, raw: data },
    });
  } catch (e) {
    console.error('proxy/image/fal/submit 错误:', e);
    return res.status(500).json({ success: false, error: e.message || '请求失败' });
  }
});

// POST /api/proxy/image/fal/query
//   body: { responseUrl, endpoint, requestId }
//   返回: { status: 'pending'|'completed'|'failed', urls?, error? }
router.post('/image/fal/query', async (req, res) => {
  const settings = loadRawSettings();
  const { responseUrl: rawUrl, endpoint, requestId } = req.body || {};
  // v1.2.9.15: 一体化「专属优先 fallback 通用」校验
  if (!ensureKey(settings, res, endpoint || rawUrl || '', '图像 FAL')) return;
  const apiKey = settings.zhenzhenApiKey;
  const baseUrl = config.ZHENZHEN_BASE_URL;
  const responseUrl = fixFalResponseUrl(rawUrl, baseUrl, endpoint, requestId);
  if (!responseUrl) return res.status(400).json({ success: false, error: 'responseUrl 或 (endpoint+requestId) 必填' });

  try {
    const pr = await fetch(responseUrl, { headers: { Authorization: `Bearer ${apiKey}` } });
    const text = await pr.text();
    let data; try { data = JSON.parse(text); } catch { data = null; }
    // HTTP 非200: 主项目规范 - body 中 status=IN_QUEUE/IN_PROGRESS 视为继续等待,其他报错
    if (!pr.ok) {
      if (data && (data.status === 'IN_QUEUE' || data.status === 'IN_PROGRESS')) {
        return res.json({ success: true, data: { status: 'pending', raw: data } });
      }
      return res.status(pr.status).json({
        success: false,
        error: `FAL Poll HTTP ${pr.status}: ${text.slice(0, 300)}`,
        raw: data,
      });
    }
    if (!data) {
      return res.status(500).json({ success: false, error: 'FAL Poll 响应非 JSON: ' + text.slice(0, 200) });
    }
    // 完成
    if (Array.isArray(data.images) && data.images.length) {
      const urls = [];
      for (const it of data.images) {
        if (it?.url) {
          const local = await saveRemoteImage(it.url);
          urls.push(local);
        }
      }
      return res.json({ success: true, data: { status: 'completed', urls, raw: data } });
    }
    const st = String(data.status || '').toUpperCase();
    if (st === 'FAILED' || st === 'CANCELLED') {
      return res.json({
        success: false,
        data: { status: 'failed', error: data.error || data.detail || `FAL ${st}` },
      });
    }
    // IN_QUEUE / IN_PROGRESS / 空 => pending
    return res.json({ success: true, data: { status: 'pending', falStatus: st || 'IN_QUEUE', raw: data } });
  } catch (e) {
    console.error('proxy/image/fal/query 错误:', e);
    return res.status(500).json({ success: false, error: e.message || '查询失败' });
  }
});

// ============================================================================
// Midjourney 三路由：严格对齐 gpt-image-2-web server.py _handle_mj_imagine / _handle_mj_fetch_task / _handle_mj_upload
//   上游：{ZHENZHEN_BASE_URL}/{mj-turbo|mj-fast|mj-relax}/mj/submit/imagine
//          {ZHENZHEN_BASE_URL}/{...}/mj/task/{id}/fetch
//          {ZHENZHEN_BASE_URL}/{...}/mj/submit/upload-discord-images
//   服从贞贞工坊集中 Key（同上其他 zhenzhen 路由）。
// ============================================================================
const MJ_SPEED_MAP = { turbo: 'mj-turbo', fast: 'mj-fast', relax: 'mj-relax' };
function mjSpeedSeg(speed) {
  return MJ_SPEED_MAP[String(speed || '').toLowerCase()] || 'mj-fast';
}

// ---- POST /api/proxy/mj/imagine ----
// body: { prompt, ar?, no?, c?, s?, iw?, sw?, cw?, sv?, seed?, base64Array?, speed?, modes?, instanceId?, notifyHook?, remix? }
// 返回上游 imagine 原始响应 { code, description, result(taskId), properties }
router.post('/mj/imagine', async (req, res) => {
  const settings = loadRawSettings();
  // v1.2.9.15: 一体化「专属优先 fallback 通用」校验
  if (!ensureKey(settings, res, 'mj', 'MJ')) return;
  const body = req.body || {};
  const speedSeg = mjSpeedSeg(body.speed);
  const url = `${config.ZHENZHEN_BASE_URL}/${speedSeg}/mj/submit/imagine`;
  // 严格对齐主项目 runMJ payload（index.html L4547~L4587）
  const payload = {
    base64Array: Array.isArray(body.base64Array) ? body.base64Array : [],
    instanceId: body.instanceId || '',
    modes: Array.isArray(body.modes) ? body.modes : [],
    notifyHook: body.notifyHook || '',
    prompt: String(body.prompt || ''),
    remix: body.remix !== false,
    state: body.state || '',
    ar: body.ar || null,
    no: body.no || null,
    c: body.c || null,
    s: body.s || null,
    iw: body.iw || null,
    tile: false,
    r: null,
    video: false,
    sw: body.sw || null,
    cw: body.cw || null,
    sv: body.sv || null,
    seed: body.seed || null,
  };
  try {
    console.log(`[mj/imagine] -> ${url}\n  prompt: ${payload.prompt.slice(0, 200)}`);
    const r = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${settings.zhenzhenApiKey}`,
      },
      body: JSON.stringify(payload),
    });
    const text = await r.text();
    let data;
    try { data = JSON.parse(text); } catch { return res.status(500).json({ success: false, error: '上游响应非 JSON: ' + text.slice(0, 200) }); }
    if (!r.ok) return res.status(r.status).json({ success: false, error: data?.error || data?.description || `上游 HTTP ${r.status}` });
    return res.json({ success: true, data });
  } catch (e) {
    console.error('proxy/mj/imagine 错误:', e);
    return res.status(500).json({ success: false, error: e.message || '提交失败' });
  }
});

// ---- GET /api/proxy/mj/task/:id?speed=fast ----
// 轮询任务状态
router.get('/mj/task/:id', async (req, res) => {
  const settings = loadRawSettings();
  // v1.2.9.15: 一体化「专属优先 fallback 通用」校验
  if (!ensureKey(settings, res, 'mj', 'MJ')) return;
  const taskId = req.params.id;
  const speedSeg = mjSpeedSeg(req.query.speed);
  if (!taskId) return res.status(400).json({ success: false, error: 'taskId 必填' });
  const url = `${config.ZHENZHEN_BASE_URL}/${speedSeg}/mj/task/${encodeURIComponent(taskId)}/fetch`;
  try {
    const r = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${settings.zhenzhenApiKey}`,
      },
    });
    const raw = await r.text();
    let data;
    try { data = JSON.parse(raw); } catch { return res.status(500).json({ success: false, error: '上游响应非 JSON: ' + raw.slice(0, 200) }); }
    if (!r.ok) return res.status(r.status).json({ success: false, error: data?.error || data?.description || `上游 HTTP ${r.status}` });
    // image_urls 可能是 JSON 字符串也可能已是数组，透传，让前端统一处理
    return res.json({ success: true, data });
  } catch (e) {
    console.error('proxy/mj/task 错误:', e);
    return res.status(500).json({ success: false, error: e.message || '查询失败' });
  }
});

// ---- POST /api/proxy/mj/upload ----
// body: { base64Data: 'data:image/png;base64,xxxx', speed? }
// 上传参考图到 MJ Discord，返回 URL（主项目 uploadMJImage L4407 + server.py L2457）
router.post('/mj/upload', async (req, res) => {
  const settings = loadRawSettings();
  // v1.2.9.15: 一体化「专属优先 fallback 通用」校验
  if (!ensureKey(settings, res, 'mj', 'MJ')) return;
  const { base64Data, speed } = req.body || {};
  if (!base64Data) return res.status(400).json({ success: false, error: 'base64Data 不得为空' });
  const speedSeg = mjSpeedSeg(speed);
  const url = `${config.ZHENZHEN_BASE_URL}/${speedSeg}/mj/submit/upload-discord-images`;
  const payload = { base64Array: [base64Data], instanceId: '', notifyHook: '' };
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${settings.zhenzhenApiKey}`,
      },
      body: JSON.stringify(payload),
    });
    const text = await r.text();
    let data;
    try { data = JSON.parse(text); } catch { return res.status(500).json({ success: false, error: '上游响应非 JSON: ' + text.slice(0, 200) }); }
    if (!r.ok) return res.status(r.status).json({ success: false, error: data?.error || data?.description || `上游 HTTP ${r.status}` });
    if (data.status === 'FAILURE') return res.status(500).json({ success: false, error: data.fail_reason || data.failReason || 'MJ upload failed' });
    let imgUrl = '';
    if (Array.isArray(data.result)) imgUrl = data.result[0] || '';
    else if (typeof data.result === 'string') imgUrl = data.result;
    if (!imgUrl) return res.status(500).json({ success: false, error: '上游未返回 URL: ' + JSON.stringify(data).slice(0, 200) });
    return res.json({ success: true, data: { url: imgUrl, raw: data } });
  } catch (e) {
    console.error('proxy/mj/upload 错误:', e);
    return res.status(500).json({ success: false, error: e.message || '上传失败' });
  }
});

// ========== POST /api/proxy/llm — LLM Chat(独立 Key) ==========
function hasLlmVideoParts(messages) {
  if (!Array.isArray(messages)) return false;
  return messages.some((msg) => Array.isArray(msg?.content) && msg.content.some((part) => (
    part?.type === 'video_url' || part?.type === 'input_video' || !!part?.video_url || !!part?.input_video
  )));
}

// body: { model, messages, temperature?, max_tokens?, stream?, llmVideoMode? }
//   - messages[i].content 支持 string 或 多模态数组 [{type:'text',text} | {type:'image_url',image_url:{url}} | {type:'video_url',video_url:{url}}]
//   - stream=true → 透传上游 SSE(text/event-stream) 到前端；有视频时强制非流式，避免网关丢多模态附件
//   - 完全对齐 gpt-image-2-web _doSendChat (index.html L8128~L8305)
router.post('/llm', async (req, res) => {
  const settings = loadRawSettings();
  if (!settings?.llmApiKey) {
    return res.status(400).json({ success: false, error: '未配置 LLM 独立 API Key' });
  }
  const { model, messages, temperature, max_tokens, stream } = req.body || {};
  if (!model || !messages) {
    return res.status(400).json({ success: false, error: 'model 和 messages 必填' });
  }
  const inputHadVideos = hasLlmVideoParts(messages);

  // 预处理 messages 中的 image_url / video_url:
  //   - 图片: 本地 /files/* 转 base64 dataURL
  //   - 视频: 默认用项目内置 ffmpeg 抽关键帧转 image_url；或按用户选择发送原视频 Base64 / URL
  // 避免上游 LLM 服务拿着本地相对路径报 convert_request_failed。
  let normalizedMessages;
  try {
    normalizedMessages = await normalizeLlmMessageMedia(messages, req.body || {}, {
      baseUrl: `http://127.0.0.1:${config.PORT}`,
    });
  } catch (e) {
    return res.status(400).json({ success: false, error: e.message || '多模态素材预处理失败' });
  }

  const upstream = `${config.ZHENZHEN_BASE_URL}/v1/chat/completions`;
  const payload = {
    model,
    messages: normalizedMessages,
    temperature: temperature ?? 0.7,
    max_tokens: max_tokens ?? 4096,
    stream: !!stream && !inputHadVideos,
  };

  try {
    const r = await fetch(upstream, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${settings.llmApiKey}`,
      },
      body: JSON.stringify(payload),
    });

    // ===== 流式分支:SSE pass-through =====
    if (payload.stream) {
      if (!r.ok) {
        const errText = await r.text();
        return res.status(r.status).json({
          success: false,
          error: `上游 HTTP ${r.status}: ${errText.slice(0, 300)}`,
        });
      }
      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      // Node 18+ fetch response.body 为 ReadableStream
      try {
        const reader = r.body.getReader();
        const decoder = new TextDecoder();
        // 透传上游字节,前端按 SSE 解析
        // eslint-disable-next-line no-constant-condition
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(decoder.decode(value, { stream: true }));
        }
      } catch (streamErr) {
        console.error('proxy/llm SSE 转发异常:', streamErr);
      }
      return res.end();
    }

    // ===== 非流式分支(gpt-image-2-all 等) =====
    const text = await r.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      return res.status(500).json({ success: false, error: '上游响应非 JSON: ' + text.slice(0, 200) });
    }
    if (!r.ok) {
      return res.status(r.status).json({
        success: false,
        error: data?.error?.message || `上游 HTTP ${r.status}`,
      });
    }
    // 处理 content 可能是字符串或多模态数组(gpt-image-2-all 出图)
    const choice = data?.choices?.[0];
    let content = choice?.message?.content || '';
    const imageUrls = [];
    if (Array.isArray(content)) {
      let textParts = '';
      content.forEach((part) => {
        if (part?.type === 'text') textParts += part.text || '';
        else if (part?.type === 'image_url' && part.image_url?.url) imageUrls.push(part.image_url.url);
        else if (part?.type === 'image' && part.image_url?.url) imageUrls.push(part.image_url.url);
      });
      content = textParts;
    }
    if (Array.isArray(data?.data)) {
      data.data.forEach((d) => {
        if (d?.url) imageUrls.push(d.url);
        else if (d?.b64_json) imageUrls.push('data:image/png;base64,' + d.b64_json);
      });
    }
    res.json({
      success: true,
      data: { content, imageUrls, raw: data, model },
    });
  } catch (e) {
    console.error('proxy/llm 错误:', e);
    res.status(500).json({ success: false, error: e.message || '请求失败' });
  }
});

// ========================================================================
// 视频生成(异步) — 完全对齐 gpt-image-2-web
// 协议(贞贞工坊): POST /v2/videos/generations + GET /v2/videos/generations/:tid
//
// 通过 model 字段自动选择上游 payload 协议:
//   - 含 'veo'      → Veo3.1 协议:  { prompt, model, enhance_prompt, aspect_ratio, seed?, enable_upsample?, images?(base64,最多3) }
//                       (主项目 runVeo3, index.html line 3372)
//   - 含 'grok'     → Grok Video 协议: { prompt, model, ratio, duration(数字秒), resolution, seed?, images?(URL,最多7) }
//                       (主项目 runGrok3, index.html line 3863) — 参考图先 POST /v1/files 取 URL
//   - 其它(seedance 等)→ 沿用旧 Veo 字段(零破坏)
// ========================================================================

// 上传本地/远端参考素材到上游 /v1/files 取 URL
// 对齐 gpt-image-2-web 的 uploadFileToAPI: Seedance 的图像、视频、音频都不能直接传 /files/* 本地 URL。
async function uploadRefToZhenzhen(ref, apiKey) {
  if (typeof ref !== 'string' || !ref) return null;
  const trimmed = ref.trim();
  if (/^asset-[a-z0-9_-]+$/i.test(trimmed)) return trimmed;
  let buf, mime, ext;
  if (trimmed.startsWith('data:')) {
    const m = trimmed.match(/^data:([^;,]+);base64,(.+)$/);
    if (!m) return null;
    mime = m[1] || 'image/png';
    buf = Buffer.from(m[2], 'base64');
    ext = extFromContentType(mime) || (mime.split('/')[1] || 'png').replace('jpeg', 'jpg');
  } else if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('/files/') ||
    trimmed.startsWith('/api/resources/file/') ||
    trimmed.startsWith('/api/resources/set-file/')
  ) {
    const url = trimmed.startsWith('/') ? `http://127.0.0.1:${config.PORT}${trimmed}` : trimmed;
    const r = await fetch(url);
    if (!r.ok) return null;
    mime = r.headers.get('content-type') || 'image/png';
    buf = Buffer.from(await r.arrayBuffer());
    const tailExt = url.split(/[?#]/)[0].match(/\.([a-z0-9]{2,8})$/i)?.[1];
    ext = extFromContentType(mime) || tailExt || (mime.split('/')[1] || 'png').replace('jpeg', 'jpg');
  } else {
    return null;
  }
  const fd = new FormData();
  const blob = new Blob([buf], { type: mime });
  fd.append('file', blob, `ref_${Date.now()}.${ext}`);
  const upR = await fetch(`${config.ZHENZHEN_BASE_URL}/v1/files`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: fd,
  });
  if (!upR.ok) {
    console.warn('[video] /v1/files 上传失败 status=', upR.status);
    return null;
  }
  const j = await upR.json();
  return j?.url || null;
}

// ========================================================================
// Video FAL 渠道 — 完全对齐 gpt-image-2-web runVeo3Fal / runGrokFal
// 不破坏原有 /video/submit · /video/query 路由。
//
// POST /api/proxy/video/fal/submit  → { sync, videoUrl?, requestId?, responseUrl?, endpoint? }
// POST /api/proxy/video/fal/query   → { status, videoUrl?, error? }   body: { responseUrl, endpoint, requestId }
// ========================================================================

const VIDEO_FAL_REGISTRY = {
  'veo3.1-fal': {
    endpoint: 'fal-ai/veo3.1/fast/reference-to-video',
    paramKind: 'veo-fal',
    maxRefImages: 3,
  },
  'grok-video-fal': {
    endpoint: 'xai/grok-imagine-video/text-to-video',
    i2vEndpoint: 'xai/grok-imagine-video/image-to-video',
    referenceEndpoint: 'xai/grok-imagine-video/reference-to-video',
    paramKind: 'grok-fal',
    maxRefImages: 7,
    defaultImageMode: 'base64',
  },
  'grok-imagine-video-1.5': {
    endpoint: 'xai/grok-imagine-video/v1.5/image-to-video',
    paramKind: 'grok-fal',
    maxRefImages: 1,
    defaultImageMode: 'base64',
    requiresImage: true,
    disableAspectRatio: true,
  },
  'sora-2': {
    endpoint: 'fal-ai/sora-2/text-to-video',
    i2vEndpoint: 'fal-ai/sora-2/image-to-video',
    paramKind: 'sora-fal',
    maxRefImages: 1,
    defaultImageMode: 'base64',
  },
};

function getFalVideoUrl(data) {
  const video = data && data.video;
  if (video && typeof video === 'object' && video.url) return video.url;
  if (typeof video === 'string') return video;
  return data?.video_url || data?.url || data?.output?.video?.url || data?.data?.video?.url || '';
}

function splitSoraCharacterIds(raw) {
  return String(raw || '')
    .split(/[,，\n]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 2);
}

function splitGrokReferenceUrls(raw) {
  const values = Array.isArray(raw) ? raw : String(raw || '').split(/[,，\n]/);
  return values
    .map((s) => String(s || '').trim())
    .filter((s) => /^https?:\/\//i.test(s));
}

// 保存远程视频到本地
async function saveRemoteVideo(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`下载失败: ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    const ext = (url.match(/\.(mp4|webm|mov)/i)?.[1] || 'mp4').toLowerCase();
    const filename = `vid_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.${ext}`;
    const filePath = path.join(config.OUTPUT_DIR, filename);
    fs.writeFileSync(filePath, buf);
    return `/files/output/${filename}`;
  } catch (e) {
    console.error('⚠ 转存视频失败:', e.message);
    return url;
  }
}

// POST /api/proxy/video/fal/submit
router.post('/video/fal/submit', async (req, res) => {
  const settings = loadRawSettings();
  const {
    apiModel, prompt, images,
    // veo-fal
    aspect_ratio, duration, resolution, generate_audio, safety_tolerance, image_mode,
    // grok-fal
    gkDuration, gkRatio, gkMode, gkReferenceUrls,
    // sora-fal
    soraMode, soraRatio, soraDuration, soraResolution, soraDeleteVideo, soraBlockIp, soraCharacterIds,
  } = req.body || {};
  const rawApiModel = String(apiModel || '').trim();
  // 历史节点里可能保存过日期版 Sora2 选项；T8 现在只暴露稳定的 sora-2 FAL。
  const effectiveApiModel = /^sora-2(?:-\d{4}-\d{2}-\d{2})?$/.test(rawApiModel) ? 'sora-2' : rawApiModel;
  // v1.2.9.15: 一体化「专属优先 fallback 通用」校验
  if (!ensureKey(settings, res, effectiveApiModel || '', '视频 FAL')) return;
  const apiKey = settings.zhenzhenApiKey;
  const baseUrl = config.ZHENZHEN_BASE_URL;

  if (!rawApiModel) return res.status(400).json({ success: false, error: 'apiModel 必填' });
  if (!prompt) return res.status(400).json({ success: false, error: 'prompt 不得为空' });

  const reg = VIDEO_FAL_REGISTRY[effectiveApiModel];
  if (!reg) return res.status(400).json({ success: false, error: `未知的 Video FAL 模型: ${rawApiModel}` });

  const refs = Array.isArray(images) ? images.filter(Boolean) : [];
  const trimmedRefs = refs.slice(0, reg.maxRefImages);

  let payload;
  let endpoint;
  try {
    if (reg.paramKind === 'veo-fal') {
      // ===== Veo3.1 FAL (主项目 runVeo3Fal line 3694) =====
      endpoint = reg.endpoint;
      payload = {
        prompt,
        aspect_ratio: String(aspect_ratio || '16:9'),
        duration: String(duration || '8s'),
        resolution: String(resolution || '720p'),
        generate_audio: generate_audio === true,
        safety_tolerance: parseInt(safety_tolerance ?? 4, 10) || 4,
      };
      // 参考图(最多 3 张)
      if (trimmedRefs.length) {
        const imgArr = [];
        const useBase64 = String(image_mode || 'image_url') === 'base64';
        for (let i = 0; i < trimmedRefs.length; i++) {
          if (useBase64) {
            // base64 直传
            const conv = await refToBananaImage(trimmedRefs[i]);
            if (conv) imgArr.push(conv);
          } else {
            const u = await uploadRefToZhenzhen(trimmedRefs[i], apiKey);
            if (u) imgArr.push(u);
            else throw new Error(`FAL 参考图 #${i + 1} 上传失败`);
          }
        }
        if (imgArr.length) payload.image_urls = imgArr;
      }
    } else if (reg.paramKind === 'grok-fal') {
      // ===== Grok Video FAL (主项目 runGrokFal line 3787) =====
      const isV15 = effectiveApiModel === 'grok-imagine-video-1.5';
      const mode = isV15
        ? 'image_to_video'
        : String(gkMode || 'image_to_video') === 'reference_to_video' ? 'reference_to_video' : 'image_to_video';
      const extraReferenceUrls = splitGrokReferenceUrls(gkReferenceUrls);
      const hasImg = trimmedRefs.length > 0;
      const effectiveRatio = (mode === 'reference_to_video' || !hasImg) && String(gkRatio || '16:9') === 'auto'
        ? '16:9'
        : String(gkRatio || '16:9');
      payload = {
        prompt,
        duration: parseInt(gkDuration ?? 6, 10) || 6,
        resolution: String(resolution || '720p'),
      };
      if (!isV15) payload.aspect_ratio = effectiveRatio;
      const useBase64 = String(image_mode || reg.defaultImageMode || 'base64') === 'base64';
      if (isV15) {
        endpoint = reg.endpoint;
        if (!hasImg) throw new Error('Grok Video 1.5 requires one uploaded image');
        const imgData = useBase64
          ? await refToBananaImage(trimmedRefs[0])
          : await uploadRefToZhenzhen(trimmedRefs[0], apiKey);
        if (imgData) payload.image_url = imgData;
        else throw new Error('Grok Video 1.5 参考图处理失败');
      } else if (mode === 'reference_to_video') {
        endpoint = reg.referenceEndpoint || reg.i2vEndpoint || reg.endpoint;
        const referenceImageUrls = [];
        const uploadRefs = trimmedRefs.slice(0, 7);
        for (let i = 0; i < uploadRefs.length && referenceImageUrls.length < 7; i++) {
          const imgData = useBase64
            ? await refToBananaImage(uploadRefs[i])
            : await uploadRefToZhenzhen(uploadRefs[i], apiKey);
          if (imgData) referenceImageUrls.push(imgData);
          else throw new Error(`Grok FAL 参考图 #${i + 1} 处理失败`);
        }
        for (const url of extraReferenceUrls) {
          if (referenceImageUrls.length >= 7) break;
          referenceImageUrls.push(url);
        }
        if (!referenceImageUrls.length) throw new Error('Grok FAL 参考生视频需要至少 1 张参考图或 URL');
        payload.reference_image_urls = referenceImageUrls;
      } else {
        endpoint = hasImg ? (reg.i2vEndpoint || reg.endpoint) : reg.endpoint;
        // 图生视频模式: 单张 image_url；无图时保留文生视频 fallback。
        if (hasImg) {
          const imgData = useBase64
            ? await refToBananaImage(trimmedRefs[0])
            : await uploadRefToZhenzhen(trimmedRefs[0], apiKey);
          if (imgData) payload.image_url = imgData;
          else throw new Error('Grok FAL 参考图处理失败');
        }
      }
    } else if (reg.paramKind === 'sora-fal') {
      // ===== Sora2 FAL (主项目 runSora2Fal line 5341) =====
      const hasImg = trimmedRefs.length > 0;
      let mode = String(soraMode || 'auto');
      if (!['auto', 'text_to_video', 'image_to_video'].includes(mode)) mode = 'auto';
      if (mode === 'auto') mode = hasImg ? 'image_to_video' : 'text_to_video';
      if (mode === 'image_to_video' && !hasImg) throw new Error('FAL Sora2 image-to-video requires one uploaded image');

      const ratio = String(soraRatio || aspect_ratio || '16:9');
      const reso = String(soraResolution || resolution || '720p');
      endpoint = mode === 'image_to_video' ? (reg.i2vEndpoint || reg.endpoint) : reg.endpoint;
      payload = {
        prompt,
        resolution: mode === 'text_to_video' && reso === 'auto' ? '720p' : reso,
        aspect_ratio: mode === 'text_to_video' && ratio === 'auto' ? '16:9' : ratio,
        duration: parseInt(soraDuration ?? duration ?? 4, 10) || 4,
        delete_video: soraDeleteVideo !== false,
        model: effectiveApiModel,
        detect_and_block_ip: soraBlockIp === true,
      };
      const ids = splitSoraCharacterIds(soraCharacterIds);
      if (ids.length) payload.character_ids = ids;
      if (mode === 'image_to_video') {
        const useBase64 = String(image_mode || 'base64') === 'base64';
        const imgData = useBase64
          ? await refToBananaImage(trimmedRefs[0])
          : await uploadRefToZhenzhen(trimmedRefs[0], apiKey);
        if (imgData) payload.image_url = imgData;
        else throw new Error('Sora2 FAL 参考图处理失败');
      }
    } else {
      return res.status(400).json({ success: false, error: `不支持的 Video FAL paramKind: ${reg.paramKind}` });
    }

    const falUrl = `${baseUrl}/fal/${endpoint}`;
    console.log('[video/fal/submit]', effectiveApiModel, '→', falUrl, '| payload keys:', Object.keys(payload), '| refs:', trimmedRefs.length);

    const resp = await fetch(falUrl, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const text = await resp.text();
    let data; try { data = JSON.parse(text); } catch { data = { _raw: text }; }
    if (!resp.ok) {
      return res.status(resp.status).json({
        success: false,
        error: data?.error || data?.detail || data?.message || `FAL HTTP ${resp.status}: ${text.slice(0, 300)}`,
      });
    }
    if (Array.isArray(data)) {
      return res.status(400).json({ success: false, error: `FAL 参数校验错误: ${JSON.stringify(data).slice(0, 300)}` });
    }
    if (data?.detail && !data?.video && !data?.request_id) {
      return res.status(400).json({ success: false, error: `FAL 错误: ${JSON.stringify(data.detail).slice(0, 300)}` });
    }

    // 同步返回: result.video.url 或同类 video_url/url 字段
    const syncVideoUrl = getFalVideoUrl(data);
    if (syncVideoUrl) {
      const local = await saveRemoteVideo(syncVideoUrl);
      return res.json({ success: true, data: { sync: true, videoUrl: local, endpoint, raw: data } });
    }

    // 异步: request_id + response_url
    const requestId = data?.request_id;
    let responseUrl = data?.response_url || '';
    if (!requestId) {
      return res.status(500).json({ success: false, error: '未获取到 request_id: ' + JSON.stringify(data).slice(0, 300) });
    }
    responseUrl = fixFalResponseUrl(responseUrl, baseUrl, endpoint, requestId);
    return res.json({
      success: true,
      data: { sync: false, requestId, responseUrl, endpoint, raw: data },
    });
  } catch (e) {
    console.error('proxy/video/fal/submit 错误:', e);
    return res.status(500).json({ success: false, error: e.message || '请求失败' });
  }
});

// POST /api/proxy/video/fal/query
//   body: { responseUrl, endpoint, requestId }
//   完成标志: data.video.url (区别于图像的 data.images[])
router.post('/video/fal/query', async (req, res) => {
  const settings = loadRawSettings();
  const { responseUrl: rawUrl, endpoint, requestId } = req.body || {};
  // v1.2.9.15: 一体化「专属优先 fallback 通用」校验
  if (!ensureKey(settings, res, endpoint || rawUrl || '', '视频 FAL')) return;
  const apiKey = settings.zhenzhenApiKey;
  const baseUrl = config.ZHENZHEN_BASE_URL;
  const responseUrl = fixFalResponseUrl(rawUrl, baseUrl, endpoint, requestId);
  if (!responseUrl) return res.status(400).json({ success: false, error: 'responseUrl 或 (endpoint+requestId) 必填' });

  try {
    const pr = await fetch(responseUrl, { headers: { Authorization: `Bearer ${apiKey}` } });
    const text = await pr.text();
    let data; try { data = JSON.parse(text); } catch { data = null; }
    // HTTP 非200: 主项目规范 - body 中 status=IN_QUEUE/IN_PROGRESS 视为继续等待
    if (!pr.ok) {
      if (data && (data.status === 'IN_QUEUE' || data.status === 'IN_PROGRESS')) {
        return res.json({ success: true, data: { status: 'pending', raw: data } });
      }
      return res.status(pr.status).json({
        success: false,
        error: `FAL Poll HTTP ${pr.status}: ${text.slice(0, 300)}`,
        raw: data,
      });
    }
    if (!data) {
      return res.status(500).json({ success: false, error: 'FAL Poll 响应非 JSON: ' + text.slice(0, 200) });
    }
    // 完成: video.url 或同类 video_url/url 字段
    const finishedVideoUrl = getFalVideoUrl(data);
    if (finishedVideoUrl) {
      const local = await saveRemoteVideo(finishedVideoUrl);
      return res.json({ success: true, data: { status: 'completed', videoUrl: local, raw: data } });
    }
    const st = String(data.status || '').toUpperCase();
    if (st === 'FAILED' || st === 'CANCELLED') {
      return res.json({
        success: false,
        data: { status: 'failed', error: data.error || data.detail || `FAL ${st}` },
      });
    }
    // IN_QUEUE / IN_PROGRESS / 空 => pending
    return res.json({ success: true, data: { status: 'pending', falStatus: st || 'IN_QUEUE', raw: data } });
  } catch (e) {
    console.error('proxy/video/fal/query 错误:', e);
    return res.status(500).json({ success: false, error: e.message || '查询失败' });
  }
});

router.post('/video/submit', async (req, res) => {
  const settings = loadRawSettings();
  const {
    model, prompt,
    // Veo 参数
    aspect_ratio, enhance_prompt, enable_upsample,
    // Grok 参数
    ratio, duration, resolution,
    // 通用
    seed, images,
  } = req.body || {};
  // v1.2.9.15: 一体化「专属优先 fallback 通用」校验
  if (!ensureKey(settings, res, model || '', '视频')) return;
  if (!model || !prompt) {
    return res.status(400).json({ success: false, error: 'model 和 prompt 必填' });
  }
  const upstream = `${config.ZHENZHEN_BASE_URL}/v2/videos/generations`;
  const apiKey = settings.zhenzhenApiKey;
  const lowerModel = String(model).toLowerCase();
  const isGrok = lowerModel.includes('grok');
  const isVeo = lowerModel.includes('veo');
  let body;

  try {
    if (isGrok) {
      // ===== Grok Video 协议(主项目 runGrok3 line 3863) =====
      body = {
        prompt,
        model,
        ratio: ratio || '16:9',
        duration: parseInt(duration ?? 15, 10),
        resolution: resolution || '720P',
      };
      if (seed && seed > 0) body.seed = seed;
      if (Array.isArray(images) && images.length) {
        const refs = images.slice(0, 7); // Grok 最多 7 张
        const urls = [];
        for (let i = 0; i < refs.length; i++) {
          const u = await uploadRefToZhenzhen(refs[i], apiKey);
          if (u) urls.push(u);
          else throw new Error(`参考图 #${i + 1} 上传失败`);
        }
        if (urls.length) body.images = urls;
      }
      console.log('[upstream] Grok Video → /v2/videos/generations model:', model, 'ratio:', body.ratio, 'duration:', body.duration, 'resolution:', body.resolution, 'refs:', body.images?.length || 0);
    } else {
      // ===== Veo3.1 协议(主项目 runVeo3 line 3372)=====
      // 旧 seedance / 默认行为也走这里(零破坏)
      body = { prompt, model, enhance_prompt: enhance_prompt !== false };
      if (aspect_ratio) body.aspect_ratio = aspect_ratio;
      if (seed && seed > 0) body.seed = seed;
      if (enable_upsample) body.enable_upsample = true;
      if (Array.isArray(images) && images.length) body.images = images.slice(0, 3); // base64 dataURL
      console.log('[upstream] Veo/Default → /v2/videos/generations model:', model, 'aspect_ratio:', body.aspect_ratio, 'refs:', body.images?.length || 0, isVeo ? '(veo)' : '(legacy)');
    }

    const r = await fetch(upstream, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });
    const text = await r.text();
    let data;
    try { data = JSON.parse(text); } catch {
      return res.status(500).json({ success: false, error: '上游响应非 JSON: ' + text.slice(0, 200) });
    }
    if (!r.ok) {
      return res.status(r.status).json({ success: false, error: data?.error?.message || data?.message || `上游 HTTP ${r.status}` });
    }
    const taskId = data?.task_id || data?.id;
    if (!taskId) return res.status(500).json({ success: false, error: '未获取到 task_id: ' + text.slice(0, 200) });
    rememberTaskKey(taskId, apiKey);
    res.json({ success: true, data: { taskId, raw: data } });
  } catch (e) {
    console.error('proxy/video/submit 错误:', e);
    res.status(500).json({ success: false, error: e.message || '请求失败' });
  }
});

router.get('/video/query', async (req, res) => {
  const settings = loadRawSettings();
  const taskId = String(req.query.taskId || '').trim();
  // 优先从 submit 阶段记录的 (taskId → key) 映射恢复，防止前端未传 model 导致 fallback 错 key。
  const remembered = recallTaskKey(taskId);
  if (remembered) {
    if (settings) settings.zhenzhenApiKey = remembered;
    else return res.status(400).json({ success: false, error: '未找到 settings' });
  } else {
    // v1.2.9.15: 一体化「专属优先 fallback 通用」校验
    if (!ensureKey(settings, res, String(req.query.model || ''), '视频')) return;
  }
  if (!taskId) return res.status(400).json({ success: false, error: 'taskId 必填' });
  const upstream = `${config.ZHENZHEN_BASE_URL}/v2/videos/generations/${encodeURIComponent(taskId)}`;
  try {
    const r = await fetch(upstream, {
      headers: { Authorization: `Bearer ${settings.zhenzhenApiKey}` },
    });
    const text = await r.text();
    let data;
    try { data = JSON.parse(text); } catch {
      return res.status(500).json({ success: false, error: '上游响应非 JSON: ' + text.slice(0, 200) });
    }
    if (!r.ok) {
      return res.status(r.status).json({ success: false, error: data?.error?.message || `上游 HTTP ${r.status}` });
    }
    const st = String(data?.status || '').toUpperCase();
    let videoUrl = null;
    if (st === 'SUCCESS') {
      const remote = data?.data?.output;
      if (remote) {
        // 转存视频到本地
        try {
          const vr = await fetch(remote);
          if (vr.ok) {
            const buf = Buffer.from(await vr.arrayBuffer());
            const ext = (remote.match(/\.(mp4|webm|mov)/i)?.[1] || 'mp4').toLowerCase();
            const filename = `vid_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.${ext}`;
            fs.writeFileSync(path.join(config.OUTPUT_DIR, filename), buf);
            videoUrl = `/files/output/${filename}`;
          } else {
            videoUrl = remote;
          }
        } catch {
          videoUrl = remote;
        }
      }
    }
    res.json({
      success: true,
      data: {
        status: st || 'PENDING',
        progress: data?.progress || '',
        videoUrl,
        failReason: data?.fail_reason || null,
        raw: data,
      },
    });
  } catch (e) {
    console.error('proxy/video/query 错误:', e);
    res.status(500).json({ success: false, error: e.message || '请求失败' });
  }
});

// ========================================================================
// Seedance 2.0(异步)— 完全对齐 gpt-image-2-web runSeedance / pollSeedance
//   submit: POST ${ZHENZHEN_BASE_URL}/seedance/v3/contents/generations/tasks
//   query : GET  ${ZHENZHEN_BASE_URL}/seedance/v3/contents/generations/tasks/{tid}
// payload: { model, content[], duration, ratio, resolution, generate_audio,
//            return_last_frame, watermark, tools?[web_search], seed? }
// content 数组成员:
//   { type:'text', text }
//   { type:'image_url', image_url:{url}, role:'first_frame'|'last_frame'|'reference_image' }
//   { type:'video_url', video_url:{url}, role:'reference_video' }   // 需先 /v1/files 上传换 URL
//   { type:'audio_url', audio_url:{url}, role:'reference_audio' }   // 需先 /v1/files 上传换 URL
// ========================================================================
router.post('/seedance/submit', async (req, res) => {
  const settings = loadRawSettings();
  // v1.2.9.15: 一体化「专属优先 fallback 通用」校验
  if (!ensureKey(settings, res, 'seedance', 'Seedance')) return;
  const apiKey = settings.zhenzhenApiKey;
  const baseUrl = config.ZHENZHEN_BASE_URL;
  const {
    model, prompt,
    duration, ratio, resolution,
    generate_audio, return_last_frame, watermark, web_search,
    seed,
    firstFrame, lastFrame,
    refImages,
    videos, audios,
  } = req.body || {};

  if (!model) return res.status(400).json({ success: false, error: 'model 必填' });
  if (!prompt) return res.status(400).json({ success: false, error: 'prompt 不得为空' });

  try {
    const content = [{ type: 'text', text: String(prompt) }];

    const hasF = !!firstFrame;
    const hasL = !!lastFrame;

    // first_frame:
    //   - 单独 first_frame(无 last_frame): 不带 role
    //   - 与 last_frame 同时存在: role='first_frame'
    if (hasF) {
      const u = await uploadRefToZhenzhen(firstFrame, apiKey);
      if (!u) throw new Error('first_frame 上传失败');
      const e = { type: 'image_url', image_url: { url: u } };
      if (hasL) e.role = 'first_frame';
      content.push(e);
    }

    // last_frame: 必须与 first_frame 同时
    if (hasL && hasF) {
      const u = await uploadRefToZhenzhen(lastFrame, apiKey);
      if (!u) throw new Error('last_frame 上传失败');
      content.push({ type: 'image_url', image_url: { url: u }, role: 'last_frame' });
    }

    // reference_image
    if (Array.isArray(refImages)) {
      for (let i = 0; i < refImages.length; i++) {
        const u = await uploadRefToZhenzhen(refImages[i], apiKey);
        if (u) content.push({ type: 'image_url', image_url: { url: u }, role: 'reference_image' });
      }
    }

    // reference_video / reference_audio:
    // gpt-image-2-web 的 runSeedance 会把本地视频/音频先上传到 /v1/files，再把返回 URL 放入 content。
    // T8 画布上游素材通常是 /files/input 或 /files/output，本地地址不能直接提交给 Seedance。
    if (Array.isArray(videos)) {
      for (let i = 0; i < videos.length; i++) {
        const v = videos[i];
        if (typeof v === 'string' && v) {
          const u = await uploadRefToZhenzhen(v, apiKey);
          if (!u) throw new Error(`reference_video ${i + 1} 上传失败`);
          content.push({ type: 'video_url', video_url: { url: u }, role: 'reference_video' });
        }
      }
    }
    if (Array.isArray(audios)) {
      for (let i = 0; i < audios.length; i++) {
        const a = audios[i];
        if (typeof a === 'string' && a) {
          const u = await uploadRefToZhenzhen(a, apiKey);
          if (!u) throw new Error(`reference_audio ${i + 1} 上传失败`);
          content.push({ type: 'audio_url', audio_url: { url: u }, role: 'reference_audio' });
        }
      }
    }

    const payload = {
      model,
      content,
      duration: parseInt(duration ?? 5, 10),
      ratio: ratio || '16:9',
      resolution: resolution || '720p',
      generate_audio: generate_audio !== false,
      return_last_frame: return_last_frame === true,
      watermark: watermark === true,
    };
    if (web_search === true) payload.tools = [{ type: 'web_search' }];
    if (typeof seed === 'number' && seed !== -1) payload.seed = seed;

    console.log('[upstream] Seedance2.0 → /seedance/v3/contents/generations/tasks model:', model,
      'duration:', payload.duration, 'ratio:', payload.ratio, 'resolution:', payload.resolution,
      'content_items:', content.length);

    const r = await fetch(`${baseUrl}/seedance/v3/contents/generations/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(payload),
    });
    const text = await r.text();
    let data;
    try { data = JSON.parse(text); } catch {
      return res.status(500).json({ success: false, error: '上游响应非 JSON: ' + text.slice(0, 200) });
    }
    if (!r.ok) {
      return res.status(r.status).json({ success: false, error: data?.error?.message || data?.message || `上游 HTTP ${r.status}` });
    }
    const taskId = data?.id || data?.task_id;
    if (!taskId) return res.status(500).json({ success: false, error: '未获取到 task_id: ' + text.slice(0, 200) });
    res.json({ success: true, data: { taskId, raw: data } });
  } catch (e) {
    console.error('proxy/seedance/submit 错误:', e);
    res.status(500).json({ success: false, error: e.message || '请求失败' });
  }
});

router.get('/seedance/query', async (req, res) => {
  const settings = loadRawSettings();
  // v1.2.9.15: 一体化「专属优先 fallback 通用」校验
  if (!ensureKey(settings, res, 'seedance', 'Seedance')) return;
  const taskId = String(req.query.taskId || '').trim();
  if (!taskId) return res.status(400).json({ success: false, error: 'taskId 必填' });

  const apiKey = settings.zhenzhenApiKey;
  const baseUrl = config.ZHENZHEN_BASE_URL;
  const upstream = `${baseUrl}/seedance/v3/contents/generations/tasks/${encodeURIComponent(taskId)}`;

  try {
    const r = await fetch(upstream, { headers: { Authorization: `Bearer ${apiKey}` } });
    const text = await r.text();
    let data;
    try { data = JSON.parse(text); } catch {
      return res.status(500).json({ success: false, error: '上游响应非 JSON: ' + text.slice(0, 200) });
    }
    if (!r.ok) {
      return res.status(r.status).json({ success: false, error: data?.error?.message || `上游 HTTP ${r.status}` });
    }
    // 状态归一(对齐主项目)
    let st = String(data?.status || '').toLowerCase();
    if (st === 'success') st = 'succeeded';
    if (st === 'fail' || st === 'failure') st = 'failed';

    let videoUrl = null;
    if (st === 'succeeded') {
      // 多重路径解析 video_url(对齐 pollSeedance line 3287-3296)
      let vUrl = null;
      const rc = data?.content;
      if (rc && typeof rc === 'object' && !Array.isArray(rc)) {
        vUrl = rc.video_url || rc.videoUrl;
      }
      if (!vUrl && data?.data && typeof data.data === 'object') {
        const dc = data.data.content;
        if (dc && typeof dc === 'object') vUrl = dc.video_url || dc.videoUrl;
        if (!vUrl) vUrl = data.data.video_url || data.data.videoUrl;
      }
      if (!vUrl && Array.isArray(data?.results)) {
        for (const it of data.results) {
          if (it && (it.outputType === 'mp4' || it.outputType === 'video' || (it.url && /\.mp4(\?|$)/i.test(it.url)))) {
            vUrl = it.url; break;
          }
          if (it && it.url && !vUrl) vUrl = it.url;
        }
      }
      if (!vUrl && Array.isArray(data?.content)) {
        for (const it of data.content) {
          if (it?.type === 'video_url') {
            const vu = it.video_url;
            vUrl = typeof vu === 'string' ? vu : (vu && vu.url);
            if (vUrl) break;
          }
        }
      }
      if (!vUrl) vUrl = data?.video_url || data?.videoUrl;

      if (vUrl) {
        // 转存到本地
        videoUrl = await saveRemoteVideo(vUrl);
      }
    }

    return res.json({
      success: true,
      data: {
        status: st || 'pending',
        progress: data?.progress || '',
        videoUrl,
        failReason: data?.fail_reason || data?.failReason || null,
        raw: data,
      },
    });
  } catch (e) {
    console.error('proxy/seedance/query 错误:', e);
    res.status(500).json({ success: false, error: e.message || '查询失败' });
  }
});

// ========================================================================
// 音频生成(Suno - 异步)
// 协议(贞贞工坊):POST /suno/generate + GET /suno/feed/:clipIds + POST /suno/submit/music
// 模式:generate / cover / extend
// 严格对齐主项目 gpt-image-2-web 的 SUNO_MV_MAP (7 个版本)
// ========================================================================
const SUNO_MV_MAP = {
  'v3.0': 'chirp-v3.0',
  'v3.5': 'chirp-v3.5',
  'v4': 'chirp-v4',
  'v4.5': 'chirp-auk',
  'v4.5+': 'chirp-bluejay',
  'v5': 'chirp-crow',
  'v5.5': 'chirp-fenix',
};

// 兼容带 'suno-' 前缀的旧调用方 (如 'suno-v5.5')
function resolveSunoMv(version) {
  const v = String(version || 'v5.5').replace(/^suno-/i, '');
  return SUNO_MV_MAP[v] || 'chirp-fenix';
}

router.post('/audio/submit', async (req, res) => {
  const settings = loadRawSettings();
  // v1.2.9.15: 一体化「专属优先 fallback 通用」校验 —— 先 applyClassifiedKey('suno') 再校验 effective key
  if (!ensureKey(settings, res, 'suno', 'Suno')) return;
  const { mode, prompt, title, tags, version, seed, continue_clip_id, continue_at, cover_clip_id } = req.body || {};
  const m = mode || 'generate';
  if (!prompt && m !== 'extend') {
    return res.status(400).json({ success: false, error: 'prompt 必填' });
  }
  const mv = resolveSunoMv(version);
  const auth = { Authorization: `Bearer ${settings.zhenzhenApiKey}`, 'Content-Type': 'application/json' };
  try {
    if (m === 'generate') {
      const body = { prompt: prompt || '', tags: tags || '', mv, title: title || '' };
      if (seed && seed > 0) body.seed = seed;
      const r = await fetch(`${config.ZHENZHEN_BASE_URL}/suno/generate`, { method: 'POST', headers: auth, body: JSON.stringify(body) });
      const text = await r.text();
      let data; try { data = JSON.parse(text); } catch { return res.status(500).json({ success: false, error: '上游响应非 JSON: ' + text.slice(0, 200) }); }
      if (!r.ok) return res.status(r.status).json({ success: false, error: data?.error?.message || `上游 HTTP ${r.status}` });
      const taskId = data?.id;
      const clipIds = (data?.clips || []).map((c) => c.id).filter(Boolean);
      if (!taskId || clipIds.length < 1) return res.status(500).json({ success: false, error: '未获取到 task/clip: ' + text.slice(0, 200) });
      return res.json({ success: true, data: { taskId, clipIds, raw: data } });
    }
    if (m === 'extend') {
      if (!continue_clip_id) return res.status(400).json({ success: false, error: 'extend 模式需 continue_clip_id' });
      const body = { prompt: prompt || '', tags: tags || '', mv, title: title || '', task: 'upload_extend', continue_clip_id, continue_at: continue_at ?? 28 };
      if (seed && seed > 0) body.seed = seed;
      const r = await fetch(`${config.ZHENZHEN_BASE_URL}/suno/generate`, { method: 'POST', headers: auth, body: JSON.stringify(body) });
      const text = await r.text();
      let data; try { data = JSON.parse(text); } catch { return res.status(500).json({ success: false, error: '上游响应非 JSON: ' + text.slice(0, 200) }); }
      if (!r.ok) return res.status(r.status).json({ success: false, error: data?.error?.message || `上游 HTTP ${r.status}` });
      const taskId = data?.id;
      const clipIds = (data?.clips || []).map((c) => c.id).filter(Boolean);
      if (!taskId) return res.status(500).json({ success: false, error: '未获取 task' });
      return res.json({ success: true, data: { taskId, clipIds, raw: data } });
    }
    if (m === 'cover') {
      if (!cover_clip_id) return res.status(400).json({ success: false, error: 'cover 模式需 cover_clip_id' });
      const body = {
        prompt: prompt || '', tags: tags || '', mv, title: title || '', task: 'cover',
        cover_clip_id, generation_type: 'TEXT', make_instrumental: false, negative_tags: '',
        continue_clip_id: null, continue_at: null, continued_aligned_prompt: null,
        infill_start_s: null, infill_end_s: null,
      };
      if (seed && seed > 0) body.seed = seed;
      const r = await fetch(`${config.ZHENZHEN_BASE_URL}/suno/submit/music`, { method: 'POST', headers: auth, body: JSON.stringify(body) });
      const text = await r.text();
      let data; try { data = JSON.parse(text); } catch { return res.status(500).json({ success: false, error: '上游响应非 JSON: ' + text.slice(0, 200) }); }
      if (!r.ok) return res.status(r.status).json({ success: false, error: data?.error?.message || `上游 HTTP ${r.status}` });
      const taskId = (typeof data?.data === 'string' ? data.data : data?.id) || '';
      const clipIds = Array.isArray(data?.data) ? data.data.map((c) => c.id || c.clip_id).filter(Boolean) : (data?.clips || []).map((c) => c.id);
      if (!taskId) return res.status(500).json({ success: false, error: '未获取 task: ' + text.slice(0, 200) });
      return res.json({ success: true, data: { taskId, clipIds, raw: data } });
    }
    return res.status(400).json({ success: false, error: `未知模式: ${m}` });
  } catch (e) {
    console.error('proxy/audio/submit 错误:', e);
    res.status(500).json({ success: false, error: e.message || '请求失败' });
  }
});

router.get('/audio/query', async (req, res) => {
  const settings = loadRawSettings();
  // v1.2.9.15: 一体化「专属优先 fallback 通用」校验
  if (!ensureKey(settings, res, 'suno', 'Suno')) return;
  const ids = String(req.query.clipIds || req.query.taskId || '').trim();
  if (!ids) return res.status(400).json({ success: false, error: 'clipIds 或 taskId 必填' });
  // 是否将完成的音频转存到本地 output 目录(默认 true)
  const saveLocal = String(req.query.saveLocal ?? 'true').toLowerCase() !== 'false';
  try {
    const r = await fetch(`${config.ZHENZHEN_BASE_URL}/suno/feed/${encodeURIComponent(ids)}`, {
      headers: { Authorization: `Bearer ${settings.zhenzhenApiKey}` },
    });
    const text = await r.text();
    let data; try { data = JSON.parse(text); } catch { return res.status(500).json({ success: false, error: '上游响应非 JSON: ' + text.slice(0, 200) }); }
    if (!r.ok) return res.status(r.status).json({ success: false, error: data?.error?.message || `上游 HTTP ${r.status}` });
    const clips = Array.isArray(data) ? data : (data?.clips || []);
    const tracks = [];
    for (const c of clips) {
      if (c?.status === 'complete' && c?.audio_url) {
        const remoteUrl = c.audio_url;
        const localUrl = saveLocal ? await saveRemoteAudio(remoteUrl) : remoteUrl;
        tracks.push({
          id: c.id || c.clip_id,
          clipId: c.clip_id || c.id,
          audioUrl: localUrl,
          remoteUrl,
          imageUrl: c.image_large_url || c.image_url || '',
          title: c.title || '',
          tags: c.tags || '',
          duration: c.metadata?.duration || 0,
        });
      }
    }
    const allDone = clips.length > 0 && tracks.length === clips.length;
    res.json({
      success: true,
      data: {
        status: allDone ? 'SUCCESS' : 'PENDING',
        tracks,
        total: clips.length,
        completed: tracks.length,
        raw: data,
      },
    });
  } catch (e) {
    console.error('proxy/audio/query 错误:', e);
    res.status(500).json({ success: false, error: e.message || '请求失败' });
  }
});

// ========================================================================
// 音频上传 (Suno cover/extend 使用)
// 完全对齐主项目 gpt-image-2-web 的 _sunoUploadAudio 5 步流程:
// 1) POST /suno/uploads/audio { extension }  -> { id, url, fields? }
// 2) S3 上传: 有 fields 走 POST FormData / 无 fields 走 PUT 预签 URL
// 3) POST /suno/uploads/audio/{id}/upload-finish { upload_type, upload_filename }
// 4) GET /suno/uploads/audio/{id} 轮询 30 × 2s 直到 status='complete'
// 5) POST /suno/uploads/audio/{id}/initialize-clip {} -> { clip_id }
// ========================================================================
router.post('/audio/upload', audioUpload.single('file'), async (req, res) => {
  const settings = loadRawSettings();
  // v1.2.9.15: 修复 BUG —— 之前完全缺失 applyClassifiedKey('suno')，
  // 导致 Suno cover/extend 上传步骤即使配置了 sunoApiKey 也始终用通用 zhenzhenApiKey，
  // 与 audio/submit · audio/query 的 key 不一致。改用 ensureKey 统一「专属优先 fallback 通用」。
  if (!ensureKey(settings, res, 'suno', 'Suno')) return;
  if (!req.file) return res.status(400).json({ success: false, error: '未接收到音频文件 (field=file)' });
  const apiKey = settings.zhenzhenApiKey;
  const baseUrl = config.ZHENZHEN_BASE_URL;
  const audioBuf = req.file.buffer;
  const filename = req.file.originalname || 'audio.mp3';
  const ext = (filename.split('.').pop() || 'mp3').toLowerCase();
  const mimeMap = { mp3: 'audio/mpeg', wav: 'audio/wav', m4a: 'audio/mp4', ogg: 'audio/ogg', flac: 'audio/flac', aac: 'audio/aac', wma: 'audio/x-ms-wma' };
  const ct = mimeMap[ext] || req.file.mimetype || 'audio/mpeg';
  try {
    // 1) init
    const r1 = await fetch(`${baseUrl}/suno/uploads/audio`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ extension: ext }),
    });
    if (!r1.ok) return res.status(r1.status).json({ success: false, error: `Upload init failed: ${r1.status} ${await r1.text()}` });
    const r1Json = await r1.json();
    const upData = (r1Json.code && r1Json.data) ? r1Json.data : r1Json;
    const uploadId = upData.id;
    const uploadUrl = upData.url;
    const fields = upData.fields;
    if (!uploadId || !uploadUrl) return res.status(500).json({ success: false, error: 'Upload init 返回无效: missing id/url' });
    // 2) S3 upload
    let r2;
    if (fields && Object.keys(fields).length > 0) {
      const fd = new FormData();
      Object.keys(fields).forEach((k) => fd.append(k, fields[k]));
      fd.append('file', new Blob([audioBuf], { type: ct }), filename);
      r2 = await fetch(uploadUrl, { method: 'POST', body: fd });
    } else {
      r2 = await fetch(uploadUrl, { method: 'PUT', body: audioBuf, headers: { 'Content-Type': ct } });
    }
    if (r2.status !== 204 && r2.status !== 200 && !r2.ok) {
      return res.status(500).json({ success: false, error: `S3 upload failed: ${r2.status}` });
    }
    // 3) finish
    const r3 = await fetch(`${baseUrl}/suno/uploads/audio/${uploadId}/upload-finish`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ upload_type: 'file_upload', upload_filename: filename }),
    });
    if (!r3.ok) return res.status(500).json({ success: false, error: `Upload finish failed: ${r3.status} ${await r3.text()}` });
    // 4) poll status
    let clipId = '';
    for (let i = 0; i < 30; i++) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      const sr = await fetch(`${baseUrl}/suno/uploads/audio/${uploadId}`, { headers: { Authorization: `Bearer ${apiKey}` } });
      if (!sr.ok) continue;
      const srJson = await sr.json();
      const sd = (srJson.code && srJson.data) ? srJson.data : srJson;
      const st = sd.status || sd.state || '';
      if (st === 'complete') {
        // 5) initialize-clip
        const r4 = await fetch(`${baseUrl}/suno/uploads/audio/${uploadId}/initialize-clip`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });
        if (!r4.ok) return res.status(500).json({ success: false, error: `Initialize clip failed: ${r4.status} ${await r4.text()}` });
        const r4Json = await r4.json();
        const initData = (r4Json.code && r4Json.data) ? r4Json.data : r4Json;
        clipId = initData.clip_id || initData.id || '';
        break;
      } else if (st === 'failed' || st === 'error') {
        const errMsg = sd.error_message || sd.error || sd.detail || sd.message || st;
        return res.status(500).json({ success: false, error: `音频处理失败: ${errMsg}` });
      }
    }
    if (!clipId) return res.status(504).json({ success: false, error: 'Upload timeout - no clip_id (60s)' });
    return res.json({ success: true, data: { clipId, uploadId, filename, size: req.file.size, mime: ct } });
  } catch (e) {
    console.error('proxy/audio/upload 错误:', e);
    res.status(500).json({ success: false, error: e.message || '请求失败' });
  }
});

// ========================================================================
// RunningHub 工作流(异步)
// 协议:POST /task/openapi/ai-app/run + POST /task/openapi/outputs
// API Key 取自 settings.rhApiKey（与 settings.js / 前端 ApiSettings 字段保持一致；
// 历史代码误写为 runninghubApiKey 导致永远读不到，已修正）
// v1.2.9.16: 取消 rhWalletApiKey 单独字段 —— 普通 RH 节点 与 RH 钱包应用节点
//            统一使用 settings.rhApiKey，简化用户配置心智。
// ========================================================================
// 统一选 key 工具：所有 RH 调用只用 settings.rhApiKey。
function pickRhApiKey(settings) {
  return settings?.rhApiKey || settings?.runninghubApiKey || '';
}
function missingRhKeyError() {
  return '未配置 RunningHub API Key（请在设置中填写 RunningHub API Key）';
}

router.post('/runninghub/submit', async (req, res) => {
  const settings = loadRawSettings();
  const { webappId, nodeInfoList, instanceType } = req.body || {};
  const apiKey = pickRhApiKey(settings);
  if (!apiKey) return res.status(400).json({ success: false, error: missingRhKeyError() });
  if (!webappId) return res.status(400).json({ success: false, error: 'webappId 必填' });
  try {
    const body = { apiKey, webappId, nodeInfoList: nodeInfoList || [] };
    if (instanceType) body.instanceType = instanceType;
    const r = await fetch(`${config.RH_BASE_URL}/task/openapi/ai-app/run`, {
      method: 'POST',
      headers: { Host: 'www.runninghub.cn', 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(body),
    });
    const data = await r.json();
    if (data.code === 0) {
      const taskId = data?.data?.taskId;
      return res.json({ success: true, data: { taskId, raw: data } });
    }
    return res.status(400).json({ success: false, error: data.msg || `RH 提交失败 code=${data.code}` });
  } catch (e) {
    console.error('proxy/rh/submit 错误:', e);
    res.status(500).json({ success: false, error: e.message || '请求失败' });
  }
});

router.get('/runninghub/query', async (req, res) => {
  const settings = loadRawSettings();
  const apiKey = pickRhApiKey(settings);
  if (!apiKey) return res.status(400).json({ success: false, error: missingRhKeyError() });
  const taskId = String(req.query.taskId || '').trim();
  if (!taskId) return res.status(400).json({ success: false, error: 'taskId 必填' });
  try {
    const r = await fetch(`${config.RH_BASE_URL}/task/openapi/outputs`, {
      method: 'POST',
      headers: { Host: 'www.runninghub.cn', 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey, taskId }),
    });
    const data = await r.json();
    // code 0=成功 / 804=运行中 / 813=排队 / 805=失败
    let status = 'PENDING';
    let urls = [];
    if (data.code === 0) {
      status = 'SUCCESS';
      // RH outputs 返回结构兼容：
      //   ① data: [{fileUrl, fileType}, ...]                  // 常见 (AI 应用)
      //   ② data: { outputs: [...] }                            // 包一层的变体
      //   ③ data: { fileUrl, fileType }                         // 单产物对象
      //   ④ data: { results: [...] } / { files: [...] }         // 边缘变体
      let arr = [];
      const dd = data.data;
      if (Array.isArray(dd)) arr = dd;
      else if (dd && typeof dd === 'object') {
        if (Array.isArray(dd.outputs)) arr = dd.outputs;
        else if (Array.isArray(dd.results)) arr = dd.results;
        else if (Array.isArray(dd.files)) arr = dd.files;
        else if (dd.fileUrl || dd.url) arr = [dd];
      }
      console.log('[RH/query]', taskId, '产物数:', arr.length, '原始 code:', data.code);
      // 转存所有产物到本地
      for (const it of arr) {
        const remote = it?.fileUrl || it?.url;
        if (!remote) continue;
        try {
          const fr = await fetch(remote);
          if (fr.ok) {
            let buf = Buffer.from(await fr.arrayBuffer());
            let ext = inferRemoteOutputExt(remote, fr.headers.get('content-type'));
            const duck = await tryDecodeDuckPayload(buf);
            if (duck?.decoded && duck.buffer) {
              buf = duck.buffer;
              ext = safeOutputExt(duck.ext, ext);
              console.log(
                '[RH/query][duck] decoded',
                `bits=${duck.lsbBits}`,
                `${duck.originalExt} -> ${ext}`,
                `kind=${duck.kind}`,
                `bytes=${buf.length}`,
              );
            } else if (duck?.passwordProtected) {
              console.log('[RH/query][duck] password protected payload detected, keep original duck image');
            }
            const filename = `rh_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.${ext}`;
            fs.writeFileSync(path.join(config.OUTPUT_DIR, filename), buf);
            urls.push(`/files/output/${filename}`);
          } else {
            urls.push(remote);
          }
        } catch {
          urls.push(remote);
        }
      }
    } else if (data.code === 804) status = 'RUNNING';
    else if (data.code === 813) status = 'QUEUED';
    else if (data.code === 805) status = 'FAILED';
    else status = 'UNKNOWN';
    // failReason 序列化为字符串：ComfyUI 报错可能是 object（traceback/exception_message/...）
    // 前端直接用于 setError 会造成 React JSX 渲染 object 崩溃。
    let failReasonRaw = data?.data?.failedReason ?? data?.data?.failReason ?? null;
    let failReasonStr = null;
    if (failReasonRaw != null) {
      if (typeof failReasonRaw === 'string') {
        failReasonStr = failReasonRaw;
      } else if (typeof failReasonRaw === 'object') {
        failReasonStr = failReasonRaw.exception_message || failReasonRaw.message || JSON.stringify(failReasonRaw);
      } else {
        failReasonStr = String(failReasonRaw);
      }
    }
    res.json({
      success: true,
      data: {
        status,
        urls,
        failReason: failReasonStr,
        code: data.code,
        raw: data,
      },
    });
  } catch (e) {
    console.error('proxy/rh/query 错误:', e);
    res.status(500).json({ success: false, error: e.message || '请求失败' });
  }
});

// ----------------------------------------------------------------
// POST /runninghub/upload-asset
// 通用素材→RH 上传转换：
//   入参 JSON: { url: '/files/output/xxx.png' | 'https://....' }
//   出参: { success, data: { fileName, fileType } }
// 用途: RhConfigNode 中 valueType=image|video|audio 的条目，
//       提交工作流前先把 url 转成 RH 内部 fileName，再写入 nodeInfoList.fieldValue。
// 协议: POST {RH}/task/openapi/upload  (multipart: apiKey, fileType=input, file)
// ----------------------------------------------------------------
router.post('/runninghub/upload-asset', express.json({ limit: '20mb' }), async (req, res) => {
  const settings = loadRawSettings();
  const apiKey = pickRhApiKey(settings);
  if (!apiKey) return res.status(400).json({ success: false, error: missingRhKeyError() });
  const url = String(req.body?.url || '').trim();
  if (!url) return res.status(400).json({ success: false, error: 'url 必填' });
  try {
    // 1) 拿到 buffer + mime + filename
    let buf;
    let mime = 'application/octet-stream';
    let baseName = 'asset';
    if (url.startsWith('/files/output/') || url.startsWith('/output/')) {
      // 本地静态资源 - 输出目录
      const rel = url.replace(/^\/files\/output\//, '').replace(/^\/output\//, '');
      const full = path.join(config.OUTPUT_DIR, rel);
      if (!fs.existsSync(full)) return res.status(404).json({ success: false, error: '本地文件不存在: ' + url });
      buf = fs.readFileSync(full);
      baseName = path.basename(full);
    } else if (url.startsWith('/files/input/') || url.startsWith('/input/')) {
      // 本地静态资源 - 上传目录（视频/音频/参考图上传节点的产物）
      const rel = url.replace(/^\/files\/input\//, '').replace(/^\/input\//, '');
      const full = path.join(config.INPUT_DIR, rel);
      if (!fs.existsSync(full)) return res.status(404).json({ success: false, error: '本地文件不存在: ' + url });
      buf = fs.readFileSync(full);
      baseName = path.basename(full);
    } else if (/^https?:\/\//i.test(url)) {
      const fr = await fetch(url);
      if (!fr.ok) return res.status(400).json({ success: false, error: `下载素材失败 HTTP ${fr.status}` });
      buf = Buffer.from(await fr.arrayBuffer());
      mime = fr.headers.get('content-type') || mime;
      const tail = url.split(/[?#]/)[0];
      baseName = tail.split('/').pop() || baseName;
    } else {
      return res.status(400).json({ success: false, error: '不支持的 url: ' + url });
    }
    // 2) 根据扩展名校正 mime
    const extMatch = baseName.match(/\.([a-zA-Z0-9]+)$/);
    const ext = extMatch ? extMatch[1].toLowerCase() : '';
    const mimeMap = {
      png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', bmp: 'image/bmp',
      mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime', m4v: 'video/x-m4v', mkv: 'video/x-matroska',
      mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', m4a: 'audio/mp4', flac: 'audio/flac',
    };
    if (mimeMap[ext]) mime = mimeMap[ext];
    if (!ext) baseName += '.bin';
    // 3) FormData 上传到 RH
    const fd = new FormData();
    fd.append('apiKey', apiKey);
    fd.append('fileType', 'input');
    const blob = new Blob([buf], { type: mime });
    fd.append('file', blob, baseName);
    const r = await fetch(`${config.RH_BASE_URL}/task/openapi/upload`, {
      method: 'POST',
      headers: { Host: 'www.runninghub.cn' },
      body: fd,
    });
    const data = await r.json();
    console.log('[RH/upload-asset]', baseName, mime, buf.length, '→', data?.code, data?.data?.fileName);
    if (data.code === 0 && data?.data?.fileName) {
      return res.json({ success: true, data: { fileName: data.data.fileName, fileType: data.data.fileType || mime } });
    }
    return res.status(400).json({ success: false, error: data.msg || `RH 上传失败 code=${data.code}` });
  } catch (e) {
    console.error('proxy/rh/upload-asset 错误:', e);
    res.status(500).json({ success: false, error: e.message || '请求失败' });
  }
});

// 获取 AI 应用信息(nodeInfoList 等)
router.get('/runninghub/app-info', async (req, res) => {
  const settings = loadRawSettings();
  const apiKey = pickRhApiKey(settings);
  if (!apiKey) return res.status(400).json({ success: false, error: missingRhKeyError() });
  const webappId = String(req.query.webappId || '').trim();
  if (!webappId) return res.status(400).json({ success: false, error: 'webappId 必填' });
  try {
    const url = `${config.RH_BASE_URL}/api/webapp/apiCallDemo?apiKey=${encodeURIComponent(apiKey)}&webappId=${encodeURIComponent(webappId)}`;
    const r = await fetch(url, { method: 'GET', headers: { Host: 'www.runninghub.cn' } });
    const data = await r.json();
    if (data.code !== 0) return res.status(400).json({ success: false, error: data.msg || `RH 查询失败 code=${data.code}` });
    res.json({ success: true, data: data.data || {} });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message || '请求失败' });
  }
});

module.exports = router;
