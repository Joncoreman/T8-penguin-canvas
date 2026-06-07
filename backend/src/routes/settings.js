// 三套 API Key 设置路由
const express = require('express');
const fs = require('fs');
const path = require('path');
const config = require('../config');
const {
  maskAdvancedProviders,
  normalizeAdvancedProviders,
  summarizeAdvancedProviders,
} = require('../providers/registry');
const {
  maskCloudUploadTargets,
  normalizeCloudUploadTargets,
  summarizeCloudUploadTargets,
} = require('../cloudUploads/settings');

const router = express.Router();

// 默认 settings 结构(三套通用 Key + 8 类分类 Key)
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
  soraApiKey: '',
  grokApiKey: '',
  seedanceApiKey: '',
  sunoApiKey: '',
  // v1.2.10.2: 全局生成素材自动保存到本地的路径(可用户自定义)
  fileSavePath: config.DEFAULT_LOCAL_SAVE_DIR,
  // v1.3.1: 画布自动保存导出路径(实际写入 <path>/T8-penguin-canvas/canvases)
  canvasAutoSavePath: config.DEFAULT_CANVAS_AUTO_SAVE_DIR,
  // v1.3.4: 资源库路径(资源文件 + resource_library.json 元数据)
  resourceLibraryPath: config.DEFAULT_RESOURCE_LIBRARY_DIR,
  // v1.3.6: 自定义主题模板路径
  themeTemplatePath: config.DEFAULT_THEME_TEMPLATE_DIR,
  // 本地 Eagle API 地址，只用于“发送到 Eagle”功能。路由层仍会强制限制为本机地址。
  eagleApiBase: config.DEFAULT_EAGLE_API_BASE,
  // v1.8.0: 扩展 API 平台（高级可选）。默认只提供禁用的配置卡片，不影响主流程。
  advancedProviders: normalizeAdvancedProviders(),
  // v1.9.x: 云端上传目标（可选）。默认禁用，不影响资源库/自动保存主流程。
  cloudUploadTargets: normalizeCloudUploadTargets(),
  // 其他偏好
  preferences: {
    theme: 'dark',
    language: 'zh-CN',
  },
};

const CURRENT_DEFAULT_PATHS = {
  fileSavePath: config.DEFAULT_LOCAL_SAVE_DIR,
  canvasAutoSavePath: config.DEFAULT_CANVAS_AUTO_SAVE_DIR,
  resourceLibraryPath: config.DEFAULT_RESOURCE_LIBRARY_DIR,
  themeTemplatePath: config.DEFAULT_THEME_TEMPLATE_DIR,
};

const LEGACY_DEFAULT_PATHS = {
  fileSavePath: config.LEGACY_WINDOWS_DEFAULT_ROOT,
  canvasAutoSavePath: config.LEGACY_WINDOWS_DEFAULT_ROOT,
  resourceLibraryPath: `${config.LEGACY_WINDOWS_DEFAULT_ROOT}\\resources`,
  themeTemplatePath: `${config.LEGACY_WINDOWS_DEFAULT_ROOT}\\theme-templates`,
};

// 分类 key 字段列表（供 GET 脱敏与 POST 合并使用）
const CLASSIFIED_KEY_FIELDS = [
  'gptImageApiKey', 'nanoBananaApiKey', 'mjApiKey', 'veoApiKey', 'soraApiKey',
  'grokApiKey', 'seedanceApiKey', 'sunoApiKey',
];

function normalizePathForCompare(value) {
  return String(value || '')
    .trim()
    .replace(/[\\/]+$/, '')
    .replace(/\\/g, '/')
    .toLowerCase();
}

function migrateLegacyDefaultPaths(settings) {
  if (process.platform === 'win32') {
    return { settings, changed: false };
  }
  let changed = false;
  const next = { ...settings };
  for (const field of Object.keys(CURRENT_DEFAULT_PATHS)) {
    const current = String(next[field] || '').trim();
    if (!current) continue;
    if (normalizePathForCompare(current) === normalizePathForCompare(LEGACY_DEFAULT_PATHS[field])) {
      next[field] = CURRENT_DEFAULT_PATHS[field];
      changed = true;
    }
  }
  return { settings: next, changed };
}

function maskKey(k) {
  return k ? '****' + String(k).slice(-4) : '';
}

function loadSettings({ persistMigrations = true } = {}) {
  if (!fs.existsSync(config.SETTINGS_FILE)) return { ...DEFAULT_SETTINGS };
  try {
    const data = JSON.parse(fs.readFileSync(config.SETTINGS_FILE, 'utf-8'));
    // 强制 base URL 与配置一致(防篡改)
    const merged = {
      ...DEFAULT_SETTINGS,
      ...data,
      zhenzhenBaseUrl: config.ZHENZHEN_BASE_URL,
      llmBaseUrl: config.ZHENZHEN_BASE_URL,
    };
    merged.advancedProviders = normalizeAdvancedProviders(data.advancedProviders);
    merged.cloudUploadTargets = normalizeCloudUploadTargets(data.cloudUploadTargets);
    const migrated = migrateLegacyDefaultPaths(merged);
    if (persistMigrations && migrated.changed) {
      saveSettings(migrated.settings);
    }
    return migrated.settings;
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function saveSettings(settings) {
  fs.writeFileSync(config.SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf-8');
}

// v1.2.10.2/v1.3.1: 启动时确保本地保存路径存在(不存在则 mkdir -p)
function ensureLocalSavePaths() {
  try {
    const s = loadSettings();
    const paths = [
      { label: '文件自动保存路径', value: s.fileSavePath || config.DEFAULT_LOCAL_SAVE_DIR || '' },
      { label: '画布自动保存路径', value: s.canvasAutoSavePath || config.DEFAULT_CANVAS_AUTO_SAVE_DIR || '' },
      { label: '资源库路径', value: s.resourceLibraryPath || config.DEFAULT_RESOURCE_LIBRARY_DIR || '' },
      { label: '主题模板路径', value: s.themeTemplatePath || config.DEFAULT_THEME_TEMPLATE_DIR || '' },
    ];
    for (const item of paths) {
      const p = String(item.value || '').trim();
      if (!p) continue;
      if (!fs.existsSync(p)) {
        fs.mkdirSync(p, { recursive: true });
        console.log(`[settings] 创建${item.label}: ${p}`);
      }
    }
  } catch (e) {
    console.warn('[settings] 创建本地保存路径失败(忽略):', e?.message || e);
  }
}
ensureLocalSavePaths();

// GET /api/settings — 获取全部设置(脱敏 Key 仅返回最后4位)
router.get('/', (_req, res) => {
  const settings = loadSettings();
  const masked = {
    ...settings,
    zhenzhenApiKey: maskKey(settings.zhenzhenApiKey),
    rhApiKey: maskKey(settings.rhApiKey),
    llmApiKey: maskKey(settings.llmApiKey),
    advancedProviders: maskAdvancedProviders(settings.advancedProviders),
    advancedProviderSummary: summarizeAdvancedProviders(settings.advancedProviders),
    cloudUploadTargets: maskCloudUploadTargets(settings.cloudUploadTargets),
    cloudUploadSummary: summarizeCloudUploadTargets(settings.cloudUploadTargets),
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
  const hasAdvancedProviders = Object.prototype.hasOwnProperty.call(incoming, 'advancedProviders');
  const hasCloudUploadTargets = Object.prototype.hasOwnProperty.call(incoming, 'cloudUploadTargets');
  const merged = {
    ...current,
    ...incoming,
    // base URL 强制为配置值,不允许覆盖
    zhenzhenBaseUrl: config.ZHENZHEN_BASE_URL,
    llmBaseUrl: config.ZHENZHEN_BASE_URL,
  };
  merged.advancedProviders = hasAdvancedProviders
    ? normalizeAdvancedProviders(incoming.advancedProviders, current.advancedProviders)
    : normalizeAdvancedProviders(current.advancedProviders);
  merged.cloudUploadTargets = hasCloudUploadTargets
    ? normalizeCloudUploadTargets(incoming.cloudUploadTargets, current.cloudUploadTargets)
    : normalizeCloudUploadTargets(current.cloudUploadTargets);
  saveSettings(merged);
  // v1.2.10.2/v1.3.1/v1.3.4: 保存后重新确保本地保存路径存在
  for (const field of ['fileSavePath', 'canvasAutoSavePath', 'resourceLibraryPath', 'themeTemplatePath']) {
    if (typeof incoming[field] !== 'string' || !incoming[field].trim()) continue;
    try {
      const p = incoming[field].trim();
      if (!fs.existsSync(p)) {
        fs.mkdirSync(p, { recursive: true });
        console.log(`[settings] 创建${field}: ${p}`);
      }
    } catch (e) {
      console.warn(`[settings] mkdir ${field} 失败:`, e?.message || e);
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
function cleanId(value, prefix) {
  const raw = String(value || '').trim().replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 96);
  return raw || genId(prefix);
}
function normalizeRhToolsBackup(raw) {
  const payload = raw && typeof raw === 'object' ? raw : {};
  const rawCategories = Array.isArray(payload.categories) ? payload.categories : [];
  const rawTools = Array.isArray(payload.tools) ? payload.tools : [];

  const usedCatIds = new Set();
  const categories = rawCategories
    .map((c, idx) => {
      const name = String(c?.name || '').trim();
      if (!name) return null;
      let id = cleanId(c?.id, 'rhcat');
      while (usedCatIds.has(id)) id = genId('rhcat');
      usedCatIds.add(id);
      return {
        id,
        name: name.slice(0, 80),
        order: Number.isFinite(Number(c?.order)) ? Number(c.order) : idx,
        createdAt: Number(c?.createdAt) || Date.now(),
      };
    })
    .filter(Boolean);

  const categoryIds = new Set(categories.map((c) => c.id));
  const usedToolIds = new Set();
  const tools = rawTools
    .map((t, idx) => {
      const webappId = String(t?.webappId || '').trim();
      const title = String(t?.title || '').trim();
      if (!webappId || !title) return null;
      let id = cleanId(t?.id, 'rhtool');
      while (usedToolIds.has(id)) id = genId('rhtool');
      usedToolIds.add(id);
      const categoryId = String(t?.categoryId || '').trim();
      return {
        id,
        webappId: webappId.slice(0, 120),
        title: title.slice(0, 120),
        description: typeof t?.description === 'string' ? t.description.slice(0, 2000) : '',
        categoryId: categoryIds.has(categoryId) ? categoryId : '',
        coverUrl: typeof t?.coverUrl === 'string' ? t.coverUrl.slice(0, 2000) : '',
        order: Number.isFinite(Number(t?.order)) ? Number(t.order) : idx,
        addedAt: Number(t?.addedAt) || Date.now(),
      };
    })
    .filter(Boolean);

  categories.sort((a, b) => (a.order || 0) - (b.order || 0));
  tools.sort((a, b) => (a.order || 0) - (b.order || 0));
  categories.forEach((c, idx) => { c.order = idx; });
  tools.forEach((t, idx) => { t.order = idx; });
  return { categories, tools };
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

// RH 超市导出: 分类 + 应用一次性备份，便于版本迁移。
router.get('/rh-tools/export', (_req, res) => {
  const categories = loadJson(config.RH_TOOL_CATEGORIES_FILE, [])
    .sort((a, b) => (a.order || 0) - (b.order || 0));
  const tools = loadJson(config.RH_TOOL_APPS_FILE, [])
    .sort((a, b) => (a.order || 0) - (b.order || 0));
  res.json({
    success: true,
    data: {
      schema: 't8-rh-tools',
      version: 1,
      exportedAt: new Date().toISOString(),
      categories,
      tools,
    },
  });
});

// RH 超市导入: 默认覆盖当前 RH 超市数据，保留备份内 id 以兼容画布节点选中的应用。
router.post('/rh-tools/import', (req, res) => {
  try {
    const mode = req.body?.mode === 'merge' ? 'merge' : 'replace';
    const normalized = normalizeRhToolsBackup(req.body || {});

    let categories = normalized.categories;
    let tools = normalized.tools;

    if (mode === 'merge') {
      const existingCategories = loadJson(config.RH_TOOL_CATEGORIES_FILE, []);
      const existingTools = loadJson(config.RH_TOOL_APPS_FILE, []);
      const catByName = new Map(existingCategories.map((c) => [String(c.name || '').trim(), c]));
      const mergedCategories = [...existingCategories];
      const catIdMap = new Map();
      for (const c of normalized.categories) {
        const existing = catByName.get(c.name);
        if (existing) {
          catIdMap.set(c.id, existing.id);
          continue;
        }
        c.order = mergedCategories.length;
        mergedCategories.push(c);
        catIdMap.set(c.id, c.id);
      }

      const toolByWebapp = new Map(existingTools.map((t) => [String(t.webappId || '').trim(), t]));
      const mergedTools = [...existingTools];
      for (const t of normalized.tools) {
        const mappedCategory = catIdMap.get(t.categoryId) || t.categoryId || '';
        const existing = toolByWebapp.get(t.webappId);
        if (existing) {
          Object.assign(existing, { ...t, id: existing.id, categoryId: mappedCategory });
        } else {
          t.categoryId = mappedCategory;
          t.order = mergedTools.length;
          mergedTools.push(t);
        }
      }
      categories = mergedCategories.map((c, idx) => ({ ...c, order: idx }));
      tools = mergedTools.map((t, idx) => ({ ...t, order: idx }));
    }

    saveJson(config.RH_TOOL_CATEGORIES_FILE, categories);
    saveJson(config.RH_TOOL_APPS_FILE, tools);
    res.json({
      success: true,
      data: {
        categories,
        tools,
        categoryCount: categories.length,
        toolCount: tools.length,
      },
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e?.message || String(e) });
  }
});

module.exports = router;
module.exports.loadSettings = loadSettings;
module.exports.saveSettings = saveSettings;
