// 画布数据 CRUD 路由(Phase 0 占位,Phase 1 完整实现)
const express = require('express');
const fs = require('fs');
const path = require('path');
const config = require('../config');

const router = express.Router();

// 工具函数
function readJsonFile(file) {
  const raw = fs.readFileSync(file, 'utf-8').replace(/^\uFEFF/, '').replace(/\0/g, '');
  return JSON.parse(raw);
}

function canvasCreatedAtFromId(id, fallback) {
  const match = String(id || '').match(/^canvas-(\d+)-/);
  if (!match) return fallback;
  const parsed = Number(match[1]);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function recoverCanvasListFromFiles() {
  if (!fs.existsSync(config.DATA_DIR)) return [];
  const items = [];
  for (const entry of fs.readdirSync(config.DATA_DIR, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    if (!/^canvas_canvas-[\w-]+\.json$/.test(entry.name)) continue;
    const id = entry.name.replace(/^canvas_/, '').replace(/\.json$/, '');
    const file = path.join(config.DATA_DIR, entry.name);
    try {
      const data = readJsonFile(file);
      if (!Array.isArray(data?.nodes) || !Array.isArray(data?.edges)) continue;
      const stat = fs.statSync(file);
      const updatedAt = Math.max(1, Math.round(stat.mtimeMs));
      items.push({
        id,
        name: id,
        nodeCount: data.nodes.length,
        createdAt: canvasCreatedAtFromId(id, updatedAt),
        updatedAt,
      });
    } catch {
      // Ignore corrupt canvas payloads; the list should still recover valid canvases.
    }
  }
  return items.sort((a, b) => a.createdAt - b.createdAt);
}

function loadCanvasList() {
  if (!fs.existsSync(config.CANVAS_FILE)) return recoverCanvasListFromFiles();
  try {
    const list = readJsonFile(config.CANVAS_FILE);
    return Array.isArray(list) ? list : recoverCanvasListFromFiles();
  } catch (e) {
    console.warn(`⚠ 画布列表读取失败，尝试从单画布文件恢复: ${e?.message || e}`);
    return recoverCanvasListFromFiles();
  }
}

function saveCanvasList(list) {
  atomicWriteJson(config.CANVAS_FILE, list);
}

function getCanvasFile(id) {
  return path.join(config.DATA_DIR, `canvas_${id}.json`);
}

function safeFilename(input) {
  return String(input || 'canvas')
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 80) || 'canvas';
}

function loadSettings() {
  try {
    if (!fs.existsSync(config.SETTINGS_FILE)) return {};
    return JSON.parse(fs.readFileSync(config.SETTINGS_FILE, 'utf-8'));
  } catch {
    return {};
  }
}

function getCanvasAutoSaveDir() {
  const settings = loadSettings();
  const base = String(settings.canvasAutoSavePath || config.DEFAULT_CANVAS_AUTO_SAVE_DIR || '').trim();
  if (!base) return '';
  return path.join(base, 'T8-penguin-canvas', 'canvases');
}

function atomicWriteJson(file, data) {
  const dir = path.dirname(file);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf-8');
  fs.renameSync(tmp, file);
}

function parseNodeSerialId(value) {
  const raw = String(value ?? '').trim().replace(/^#/, '').trim();
  if (!/^\d+$/.test(raw)) return 0;
  const parsed = Number(raw);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 0;
}

function deriveNextNodeSerialId(nodes, incomingNext) {
  const requested = parseNodeSerialId(incomingNext);
  let maxSerial = 0;
  for (const node of Array.isArray(nodes) ? nodes : []) {
    maxSerial = Math.max(maxSerial, parseNodeSerialId(node?.data?.nodeSerialId));
  }
  return Math.max(1, requested || 1, maxSerial + 1);
}

// GET /api/canvas — 获取画布列表
router.get('/', (_req, res) => {
  const list = loadCanvasList();
  res.json({ success: true, data: list });
});

// POST /api/canvas — 创建画布
router.post('/', (req, res) => {
  const list = loadCanvasList();
  const id = `canvas-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const now = Date.now();
  const canvas = {
    id,
    name: req.body?.name || '未命名画布',
    nodeCount: 0,
    createdAt: now,
    updatedAt: now,
  };
  list.push(canvas);
  saveCanvasList(list);
  // 初始化空画布数据
  atomicWriteJson(getCanvasFile(id), { nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 }, nextNodeSerialId: 1 });
  res.json({ success: true, data: canvas });
});

// GET /api/canvas/:id — 获取单个画布数据
router.get('/:id', (req, res) => {
  const file = getCanvasFile(req.params.id);
  if (!fs.existsSync(file)) {
    return res.status(404).json({ success: false, error: '画布不存在' });
  }
  try {
    const data = readJsonFile(file);
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, error: '读取失败: ' + e.message });
  }
});

// PUT /api/canvas/:id — 更新画布数据(防空数据覆盖)
router.put('/:id', (req, res) => {
  const file = getCanvasFile(req.params.id);
  const incoming = req.body;
  const allowEmptyOverwrite = req.query?.allowEmpty === '1' || incoming?.allowEmpty === true;
  // 防空数据覆盖保护
  if (
    !incoming ||
    !Array.isArray(incoming.nodes) ||
    (!allowEmptyOverwrite && incoming.nodes.length === 0 && fs.existsSync(file))
  ) {
    const existing = fs.existsSync(file) ? readJsonFile(file) : null;
    if (existing && Array.isArray(existing.nodes) && existing.nodes.length > 0) {
      console.warn(`⚠ 拒绝空数据覆盖画布 ${req.params.id}(原 ${existing.nodes.length} 节点)`);
      return res.status(400).json({ success: false, error: '拒绝空数据覆盖' });
    }
  }
  const persisted = {
    nodes: Array.isArray(incoming?.nodes) ? incoming.nodes : [],
    edges: Array.isArray(incoming?.edges) ? incoming.edges : [],
    viewport: incoming?.viewport || { x: 0, y: 0, zoom: 1 },
    nextNodeSerialId: deriveNextNodeSerialId(incoming?.nodes, incoming?.nextNodeSerialId),
  };
  atomicWriteJson(file, persisted);
  // 更新列表元数据
  const list = loadCanvasList();
  const item = list.find((x) => x.id === req.params.id);
  if (item) {
    item.nodeCount = persisted.nodes.length;
    item.updatedAt = Date.now();
    saveCanvasList(list);
  }
  res.json({ success: true });
});

// POST /api/canvas/:id/auto-save — 将当前画布镜像保存到用户配置的本地目录
// 用于跨版本迁移: 用户可在「API 设置 → 画布自动保存路径」配置基础路径。
// 实际保存位置: <path>/T8-penguin-canvas/canvases/<画布名>-<id>.json
router.post('/:id/auto-save', (req, res) => {
  try {
    const incoming = req.body;
    if (!incoming || !Array.isArray(incoming.nodes) || !Array.isArray(incoming.edges)) {
      return res.status(400).json({ success: false, error: '画布数据格式错误' });
    }
    const saveDir = getCanvasAutoSaveDir();
    if (!saveDir) {
      return res.status(400).json({ success: false, error: '未配置 canvasAutoSavePath' });
    }

    const list = loadCanvasList();
    const item = list.find((x) => x.id === req.params.id);
    const name = item?.name || req.params.id;
    const shortId = String(req.params.id).replace(/^canvas-/, '').slice(0, 24);
    const filename = `${safeFilename(name)}-${safeFilename(shortId)}.json`;
    const target = path.join(saveDir, filename);
    const now = Date.now();
    const payload = {
      schema: 't8-penguin-canvas-autosave',
      version: 1,
      autoSavedAt: new Date(now).toISOString(),
      canvas: {
        id: req.params.id,
        name,
        nodeCount: incoming.nodes.length,
        edgeCount: incoming.edges.length,
        createdAt: item?.createdAt || null,
        updatedAt: item?.updatedAt || now,
      },
      nodes: incoming.nodes,
      edges: incoming.edges,
      viewport: incoming.viewport || { x: 0, y: 0, zoom: 1 },
      nextNodeSerialId: deriveNextNodeSerialId(incoming.nodes, incoming.nextNodeSerialId),
    };

    atomicWriteJson(target, payload);
    res.json({ success: true, data: { path: target, nodeCount: incoming.nodes.length, edgeCount: incoming.edges.length } });
  } catch (e) {
    res.status(500).json({ success: false, error: e?.message || String(e) });
  }
});

// DELETE /api/canvas/:id
router.delete('/:id', (req, res) => {
  const list = loadCanvasList();
  const filtered = list.filter((x) => x.id !== req.params.id);
  saveCanvasList(filtered);
  const file = getCanvasFile(req.params.id);
  if (fs.existsSync(file)) fs.unlinkSync(file);
  res.json({ success: true });
});

// PATCH /api/canvas/:id/name — 重命名
router.patch('/:id/name', (req, res) => {
  const list = loadCanvasList();
  const item = list.find((x) => x.id === req.params.id);
  if (!item) return res.status(404).json({ success: false, error: '画布不存在' });
  item.name = req.body?.name || item.name;
  item.updatedAt = Date.now();
  saveCanvasList(list);
  res.json({ success: true, data: item });
});

module.exports = router;
