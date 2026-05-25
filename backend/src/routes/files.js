/**
 * 文件上传/下载路由
 * 用于:用户从本地上传参考图,后续传给图像生成接口
 */
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const config = require('../config');

const router = express.Router();

// 配置 multer
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, config.INPUT_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '.png';
    const name = `up_${Date.now()}_${Math.random().toString(36).slice(2, 6)}${ext}`;
    cb(null, name);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: config.MAX_FILE_SIZE },
});

// POST /api/files/upload — 上传文件
router.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, error: '未收到文件' });
  }
  res.json({
    success: true,
    data: {
      filename: req.file.filename,
      url: `/files/input/${req.file.filename}`,
      size: req.file.size,
      mime: req.file.mimetype,
    },
  });
});

// GET /api/files/list — 列出 output 目录
router.get('/list', (_req, res) => {
  try {
    const files = fs.readdirSync(config.OUTPUT_DIR)
      .filter((f) => /\.(png|jpe?g|webp|gif|mp4|webm|mp3|wav)$/i.test(f))
      .map((f) => {
        const stat = fs.statSync(path.join(config.OUTPUT_DIR, f));
        return {
          filename: f,
          url: `/files/output/${f}`,
          size: stat.size,
          mtime: stat.mtimeMs,
        };
      })
      .sort((a, b) => b.mtime - a.mtime);
    res.json({ success: true, data: files });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// POST /api/files/upload-base64 — 从 base64 dataURL 保存 PNG/JPG 到 OUTPUT_DIR
// 供手绘画板 / 抽帧等前端产生的图像使用
router.post('/upload-base64', express.json({ limit: '20mb' }), (req, res) => {
  try {
    const { dataUrl, prefix } = req.body || {};
    if (!dataUrl || typeof dataUrl !== 'string') {
      return res.status(400).json({ success: false, error: '缺少 dataUrl' });
    }
    const m = /^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/i.exec(dataUrl);
    if (!m) {
      return res.status(400).json({ success: false, error: 'dataUrl 格式不支持' });
    }
    const ext = m[1].toLowerCase() === 'jpg' ? 'jpeg' : m[1].toLowerCase();
    const buf = Buffer.from(m[2], 'base64');
    const tag = (prefix || 'draw').replace(/[^a-z0-9-]/gi, '').slice(0, 16) || 'draw';
    const filename = `${tag}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.${ext === 'jpeg' ? 'png' : ext}`;
    const fp = path.join(config.OUTPUT_DIR, filename);
    fs.writeFileSync(fp, buf);
    res.json({
      success: true,
      data: {
        filename,
        url: `/files/output/${filename}`,
        size: buf.length,
      },
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// v1.2.10.2: 全局生成素材自动保存到本地路径
// POST /api/files/save-to-disk
//   body: { url: string, filename?: string, kind?: 'image'|'video'|'audio' }
//   url 支持:
//     - /files/output/xxx       → 从 OUTPUT_DIR 复制
//     - /files/input/xxx        → 从 INPUT_DIR 复制
//     - http(s)://...           → fetch 拉取后写入
//   读取当前 settings.fileSavePath, 不存在则 mkdir -p。
//   冲突防护: 同名文件已存在 → 跳过并返回 exist:true(不覆盖)。
router.post('/save-to-disk', express.json({ limit: '2mb' }), async (req, res) => {
  try {
    const { url, filename } = req.body || {};
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ success: false, error: '缺少 url' });
    }
    // 读取 settings
    let savePath = config.DEFAULT_LOCAL_SAVE_DIR;
    try {
      if (fs.existsSync(config.SETTINGS_FILE)) {
        const s = JSON.parse(fs.readFileSync(config.SETTINGS_FILE, 'utf-8'));
        if (typeof s?.fileSavePath === 'string' && s.fileSavePath.trim()) {
          savePath = s.fileSavePath.trim();
        }
      }
    } catch { /* ignore */ }
    if (!savePath) {
      return res.status(400).json({ success: false, error: '未配置 fileSavePath' });
    }
    if (!fs.existsSync(savePath)) {
      fs.mkdirSync(savePath, { recursive: true });
    }

    // 推断目标文件名
    const inferName = () => {
      if (filename && typeof filename === 'string') return filename.replace(/[\\\/:*?"<>|]/g, '_');
      try {
        const u = url.startsWith('http') ? new URL(url) : new URL(url, 'http://x');
        const base = path.basename(u.pathname || '') || `out_${Date.now()}`;
        return base.replace(/[\\\/:*?"<>|]/g, '_');
      } catch {
        return `out_${Date.now()}`;
      }
    };
    const target = path.join(savePath, inferName());

    // 已存在不覆盖 (防重复保存/面板多实例并发)
    if (fs.existsSync(target)) {
      return res.json({ success: true, data: { path: target, exist: true } });
    }

    // 本地 /files/output/* 或 /files/input/* → 直接 copyFile
    const localCopy = (srcAbs) => {
      if (!fs.existsSync(srcAbs)) {
        return res.status(404).json({ success: false, error: `源文件不存在: ${srcAbs}` });
      }
      fs.copyFileSync(srcAbs, target);
      return res.json({ success: true, data: { path: target, exist: false, source: 'copy' } });
    };
    if (url.startsWith('/files/output/')) {
      const rel = decodeURIComponent(url.replace('/files/output/', ''));
      return localCopy(path.join(config.OUTPUT_DIR, rel));
    }
    if (url.startsWith('/files/input/')) {
      const rel = decodeURIComponent(url.replace('/files/input/', ''));
      return localCopy(path.join(config.INPUT_DIR, rel));
    }

    // 远端 http(s) → fetch 拉取
    if (/^https?:\/\//i.test(url)) {
      try {
        const resp = await fetch(url);
        if (!resp.ok) {
          return res.status(502).json({ success: false, error: `拉取远端资源失败: HTTP ${resp.status}` });
        }
        const ab = await resp.arrayBuffer();
        fs.writeFileSync(target, Buffer.from(ab));
        return res.json({ success: true, data: { path: target, exist: false, source: 'fetch' } });
      } catch (e) {
        return res.status(502).json({ success: false, error: '拉取远端资源出错: ' + (e?.message || e) });
      }
    }

    return res.status(400).json({ success: false, error: '不支持的 url 协议' });
  } catch (e) {
    return res.status(500).json({ success: false, error: e?.message || String(e) });
  }
});

module.exports = router;
