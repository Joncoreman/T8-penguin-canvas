// 三套 API Key 设置路由
const express = require('express');
const fs = require('fs');
const path = require('path');
const config = require('../config');

const router = express.Router();

// 默认 settings 结构(三套通用 Key + 7 类分类 Key)
const DEFAULT_SETTINGS = {
  // 三套通用 Key
  zhenzhenApiKey: '',
  zhenzhenBaseUrl: config.ZHENZHEN_BASE_URL, // 固定 https://ai.t8star.org
  rhApiKey: '',
  rhBaseUrl: config.RH_BASE_URL,
  // v1.2.9.16: 取消 rhWalletApiKey —— RH 钱包应用节点与普通 RunningHub 节点统一使用 rhApiKey
  llmApiKey: '',
  llmBaseUrl: config.ZHENZHEN_BASE_URL, // 同贞贞工坊上游
  // 分类 Key（留空时 fallback 到 zhenzhenApiKey）
  gptImageApiKey: '',
  nanoBananaApiKey: '',
  mjApiKey: '',
  veoApiKey: '',
  grokApiKey: '',
  seedanceApiKey: '',
  sunoApiKey: '',
  // v1.2.10.2: 全局生成素材自动保存到本地的路径(可用户自定义)
  fileSavePath: config.DEFAULT_LOCAL_SAVE_DIR,
  // 其他偏好
  preferences: {
    theme: 'dark',
    language: 'zh-CN',
  },
};

// 分类 key 字段列表（供 GET 脱敏与 POST 合并使用）
const CLASSIFIED_KEY_FIELDS = [
  'gptImageApiKey', 'nanoBananaApiKey', 'mjApiKey', 'veoApiKey',
  'grokApiKey', 'seedanceApiKey', 'sunoApiKey',
];

function maskKey(k) {
  return k ? '****' + String(k).slice(-4) : '';
}

function loadSettings() {
  if (!fs.existsSync(config.SETTINGS_FILE)) return { ...DEFAULT_SETTINGS };
  try {
    const data = JSON.parse(fs.readFileSync(config.SETTINGS_FILE, 'utf-8'));
    // 强制 base URL 与配置一致(防篡改)
    return {
      ...DEFAULT_SETTINGS,
      ...data,
      zhenzhenBaseUrl: config.ZHENZHEN_BASE_URL,
      llmBaseUrl: config.ZHENZHEN_BASE_URL,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function saveSettings(settings) {
  fs.writeFileSync(config.SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf-8');
}

// v1.2.10.2: 启动时确保「文件自动保存路径」存在(不存在则 mkdir -p)
function ensureFileSavePath() {
  try {
    const s = loadSettings();
    const p = (s.fileSavePath || config.DEFAULT_LOCAL_SAVE_DIR || '').trim();
    if (!p) return;
    if (!fs.existsSync(p)) {
      fs.mkdirSync(p, { recursive: true });
      console.log(`[settings] 创建文件自动保存路径: ${p}`);
    }
  } catch (e) {
    console.warn('[settings] 创建 fileSavePath 失败(忽略):', e?.message || e);
  }
}
ensureFileSavePath();

// GET /api/settings — 获取全部设置(脱敏 Key 仅返回最后4位)
router.get('/', (_req, res) => {
  const settings = loadSettings();
  const masked = {
    ...settings,
    zhenzhenApiKey: maskKey(settings.zhenzhenApiKey),
    rhApiKey: maskKey(settings.rhApiKey),
    llmApiKey: maskKey(settings.llmApiKey),
  };
  for (const f of CLASSIFIED_KEY_FIELDS) {
    masked[f] = maskKey(settings[f]);
  }
  res.json({ success: true, data: masked });
});

// GET /api/settings/raw — 内部接口,获取明文(供 Phase 4 代理调用使用)
router.get('/raw', (_req, res) => {
  res.json({ success: true, data: loadSettings() });
});

// POST /api/settings — 更新设置
router.post('/', (req, res) => {
  const current = loadSettings();
  const incoming = req.body || {};
  const merged = {
    ...current,
    ...incoming,
    // base URL 强制为配置值,不允许覆盖
    zhenzhenBaseUrl: config.ZHENZHEN_BASE_URL,
    llmBaseUrl: config.ZHENZHEN_BASE_URL,
  };
  saveSettings(merged);
  // v1.2.10.2: 保存后重新确保「文件自动保存路径」存在
  if (typeof incoming.fileSavePath === 'string' && incoming.fileSavePath.trim()) {
    try {
      const p = incoming.fileSavePath.trim();
      if (!fs.existsSync(p)) {
        fs.mkdirSync(p, { recursive: true });
        console.log(`[settings] 创建文件自动保存路径: ${p}`);
      }
    } catch (e) {
      console.warn('[settings] mkdir fileSavePath 失败:', e?.message || e);
    }
  }
  res.json({ success: true });
});

// =====================
// RH 工具节点 - 分类 API（v1.2.10+，与 RH 应用创意包数据完全分开）
// =====================

function loadJson(file, fallback) {
  try {
    if (!fs.existsSync(file)) return fallback;
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch {
    return fallback;
  }
}
function saveJson(file, data) {
  try {
    const dir = require('path').dirname(file);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch {
    return false;
  }
}
function genId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

// 获取分类列表
router.get('/rh-tool-categories', (_req, res) => {
  const list = loadJson(config.RH_TOOL_CATEGORIES_FILE, []);
  list.sort((a, b) => (a.order || 0) - (b.order || 0));
  res.json({ success: true, data: list });
});

// 新增分类
router.post('/rh-tool-categories', (req, res) => {
  const { name } = req.body || {};
  if (!name || !String(name).trim()) {
    return res.json({ success: false, error: '分类名不能为空' });
  }
  const list = loadJson(config.RH_TOOL_CATEGORIES_FILE, []);
  if (list.find((c) => c.name === String(name).trim())) {
    return res.json({ success: false, error: '分类名已存在' });
  }
  const newCat = {
    id: genId('rhcat'),
    name: String(name).trim(),
    order: list.length,
    createdAt: Date.now(),
  };
  list.push(newCat);
  saveJson(config.RH_TOOL_CATEGORIES_FILE, list);
  res.json({ success: true, data: newCat });
});

// 重命名分类
router.put('/rh-tool-categories/:id', (req, res) => {
  const { id } = req.params;
  const { name } = req.body || {};
  if (!name || !String(name).trim()) {
    return res.json({ success: false, error: '分类名不能为空' });
  }
  const list = loadJson(config.RH_TOOL_CATEGORIES_FILE, []);
  const target = list.find((c) => c.id === id);
  if (!target) return res.json({ success: false, error: '分类不存在' });
  if (list.find((c) => c.id !== id && c.name === String(name).trim())) {
    return res.json({ success: false, error: '分类名已存在' });
  }
  target.name = String(name).trim();
  saveJson(config.RH_TOOL_CATEGORIES_FILE, list);
  res.json({ success: true, data: target });
});

// 删除分类（其下应用 categoryId 重置为空）
router.delete('/rh-tool-categories/:id', (req, res) => {
  const { id } = req.params;
  let list = loadJson(config.RH_TOOL_CATEGORIES_FILE, []);
  const len = list.length;
  list = list.filter((c) => c.id !== id);
  if (list.length === len) {
    return res.json({ success: false, error: '分类不存在' });
  }
  saveJson(config.RH_TOOL_CATEGORIES_FILE, list);
  const apps = loadJson(config.RH_TOOL_APPS_FILE, []);
  let changed = false;
  apps.forEach((a) => {
    if (a.categoryId === id) {
      a.categoryId = '';
      changed = true;
    }
  });
  if (changed) saveJson(config.RH_TOOL_APPS_FILE, apps);
  res.json({ success: true });
});

// 分类排序
router.post('/rh-tool-categories/reorder', (req, res) => {
  const { ids } = req.body || {};
  if (!Array.isArray(ids)) return res.json({ success: false, error: '参数错误' });
  const list = loadJson(config.RH_TOOL_CATEGORIES_FILE, []);
  const map = new Map(list.map((c) => [c.id, c]));
  const reordered = [];
  ids.forEach((id, idx) => {
    const c = map.get(id);
    if (c) {
      c.order = idx;
      reordered.push(c);
      map.delete(id);
    }
  });
  for (const c of map.values()) {
    c.order = reordered.length;
    reordered.push(c);
  }
  saveJson(config.RH_TOOL_CATEGORIES_FILE, reordered);
  res.json({ success: true, data: reordered });
});

// =====================
// RH 工具节点 - 应用 API
// =====================

// 获取应用列表
router.get('/rh-tool-apps', (_req, res) => {
  const list = loadJson(config.RH_TOOL_APPS_FILE, []);
  list.sort((a, b) => (a.order || 0) - (b.order || 0));
  res.json({ success: true, data: list });
});

// 新增应用
router.post('/rh-tool-apps', (req, res) => {
  const { webappId, title, description, categoryId, coverUrl } = req.body || {};
  if (!webappId || !title) {
    return res.json({ success: false, error: '缺少必要参数 (webappId / title)' });
  }
  const list = loadJson(config.RH_TOOL_APPS_FILE, []);
  const newApp = {
    id: genId('rhtool'),
    webappId: String(webappId).trim(),
    title: String(title).trim(),
    description: description ? String(description) : '',
    categoryId: categoryId || '',
    coverUrl: coverUrl || '',
    order: list.length,
    addedAt: Date.now(),
  };
  list.push(newApp);
  saveJson(config.RH_TOOL_APPS_FILE, list);
  res.json({ success: true, data: newApp });
});

// 更新应用
router.put('/rh-tool-apps/:id', (req, res) => {
  const { id } = req.params;
  const list = loadJson(config.RH_TOOL_APPS_FILE, []);
  const app = list.find((a) => a.id === id);
  if (!app) return res.json({ success: false, error: '应用不存在' });
  const { webappId, title, description, categoryId, coverUrl } = req.body || {};
  if (typeof webappId === 'string' && webappId.trim()) app.webappId = webappId.trim();
  if (typeof title === 'string' && title.trim()) app.title = title.trim();
  if (typeof description === 'string') app.description = description;
  if (typeof categoryId === 'string') app.categoryId = categoryId;
  if (typeof coverUrl === 'string') app.coverUrl = coverUrl;
  saveJson(config.RH_TOOL_APPS_FILE, list);
  res.json({ success: true, data: app });
});

// 删除应用
router.delete('/rh-tool-apps/:id', (req, res) => {
  const { id } = req.params;
  let list = loadJson(config.RH_TOOL_APPS_FILE, []);
  const len = list.length;
  list = list.filter((a) => a.id !== id);
  if (list.length === len) return res.json({ success: false, error: '应用不存在' });
  saveJson(config.RH_TOOL_APPS_FILE, list);
  res.json({ success: true });
});

// 应用排序
router.post('/rh-tool-apps/reorder', (req, res) => {
  const { ids } = req.body || {};
  if (!Array.isArray(ids)) return res.json({ success: false, error: '参数错误' });
  const list = loadJson(config.RH_TOOL_APPS_FILE, []);
  const map = new Map(list.map((a) => [a.id, a]));
  const reordered = [];
  ids.forEach((id, idx) => {
    const a = map.get(id);
    if (a) {
      a.order = idx;
      reordered.push(a);
      map.delete(id);
    }
  });
  for (const a of map.values()) {
    a.order = reordered.length;
    reordered.push(a);
  }
  saveJson(config.RH_TOOL_APPS_FILE, reordered);
  res.json({ success: true, data: reordered });
});

module.exports = router;
