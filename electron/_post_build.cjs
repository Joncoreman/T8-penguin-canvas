// ============================================================================
// _post_build.js — electron-builder 完成后的产物核验脚本
//
// 职责:
//   1. 检查 dist_electron/win-unpacked/resources/backend-enc/*.t8c 是否存在
//   2. 检查 frontend/index.html 是否到位
//   3. 强制移除任何意外混入的明文 backend/src/*.js (双保险)
//   4. 输出最终产物清单
// ============================================================================
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const UNPACKED = path.join(ROOT, 'dist_electron', 'win-unpacked');
const RES = path.join(UNPACKED, 'resources');
let missingCount = 0;

function ok(p) {
  console.log('  ✅', path.relative(UNPACKED, p));
}
function bad(p) {
  console.log('  ❌ MISSING', path.relative(UNPACKED, p));
}

function checkFile(p) {
  if (fs.existsSync(p)) ok(p);
  else {
    missingCount += 1;
    bad(p);
  }
}

function checkFrontendAsset(prefix, ext) {
  const assetsDir = path.join(RES, 'frontend', 'assets');
  const label = path.join(assetsDir, `${prefix}*${ext}`);
  if (!fs.existsSync(assetsDir)) {
    missingCount += 1;
    bad(label);
    return;
  }
  const found = fs.readdirSync(assetsDir).find((name) => name.startsWith(prefix) && name.endsWith(ext));
  if (found) ok(path.join(assetsDir, found));
  else {
    missingCount += 1;
    bad(label);
  }
}

function listDir(p, indent = '    ') {
  if (!fs.existsSync(p)) return;
  for (const name of fs.readdirSync(p)) {
    const full = path.join(p, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) {
      console.log(indent + '📁', name);
      listDir(full, indent + '    ');
    } else {
      console.log(indent + '📄', name, `(${st.size}B)`);
    }
  }
}

function nukePlainBackend() {
  // electron-builder 不应该把明文 backend/src 打进 asar/resources;若存在则强制删
  const candidates = [
    path.join(RES, 'app', 'backend', 'src'),
    path.join(RES, 'backend', 'src'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) {
      console.log('  🧹 nuke plaintext:', path.relative(UNPACKED, c));
      fs.rmSync(c, { recursive: true, force: true });
    }
  }
}

function rel(p) {
  return path.relative(UNPACKED, p);
}

function failSecurity(message, p) {
  console.error('  ❌ SECURITY', message, p ? rel(p) : '');
  process.exit(1);
}

function walkFiles(root, out = []) {
  if (!fs.existsSync(root)) return out;
  const st = fs.statSync(root);
  if (!st.isDirectory()) return out;
  for (const name of fs.readdirSync(root)) {
    const full = path.join(root, name);
    const item = fs.statSync(full);
    if (item.isDirectory()) walkFiles(full, out);
    else out.push(full);
  }
  return out;
}

function isSmallTextFile(p) {
  const ext = path.extname(p).toLowerCase();
  if (!['.json', '.js', '.cjs', '.mjs', '.html', '.txt', '.env', '.yml', '.yaml', '.toml'].includes(ext)) {
    return false;
  }
  try {
    return fs.statSync(p).size <= 2 * 1024 * 1024;
  } catch (_) {
    return false;
  }
}

function checkAiWatermarkRuntime() {
  const runtimeRoot = path.join(RES, 'tools', 'remove-ai-watermarks');
  const required = process.env.T8_REQUIRE_AI_WATERMARK_RUNTIME === '1';
  const candidates = [
    path.join(runtimeRoot, 'remove-ai-watermarks.exe'),
    path.join(runtimeRoot, 'Scripts', 'remove-ai-watermarks.exe'),
    path.join(runtimeRoot, 'python.exe'),
    path.join(runtimeRoot, 'python', 'python.exe'),
    path.join(runtimeRoot, '.venv', 'Scripts', 'python.exe'),
  ];
  const found = candidates.find((p) => fs.existsSync(p));
  if (found) {
    ok(found);
    const manifest = path.join(runtimeRoot, 'runtime-manifest.json');
    if (fs.existsSync(manifest)) ok(manifest);
    else console.log('  ⚠️  optional runtime-manifest.json not found');
    return;
  }
  const message = 'remove-ai-watermarks sidecar runtime not bundled; packaged app will require PATH/env installed CLI';
  if (required) failSecurity(message, runtimeRoot);
  console.log('  ⚠️ ', message);
  console.log('     Set T8_REQUIRE_AI_WATERMARK_RUNTIME=1 for user-release builds that must be offline/self-contained.');
}

function checkFfmpegRuntime() {
  const runtimeRoot = path.join(RES, 'tools', 'ffmpeg');
  const binary = process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';
  const ffmpeg = path.join(runtimeRoot, binary);
  if (!fs.existsSync(ffmpeg)) {
    missingCount += 1;
    bad(ffmpeg);
    return;
  }
  ok(ffmpeg);
}

function checkNoRhToolboxMaker() {
  const forbiddenDirs = [
    path.join(RES, 'tools', 'rh-toolbox-maker'),
    path.join(RES, 'rh-toolbox-maker'),
    path.join(RES, 'app', 'rh-toolbox-maker'),
    path.join(RES, 'app.asar.unpacked', 'rh-toolbox-maker'),
  ];
  for (const p of forbiddenDirs) {
    if (fs.existsSync(p)) {
      failSecurity('RH toolbox maker must not be shipped to end users:', p);
    }
  }

  const forbiddenText = [
    /RHToolboxMakerNode/,
    /RH工具箱制作器/,
    /rh-toolbox-maker/,
  ];
  for (const p of walkFiles(path.join(RES, 'frontend')).filter(isSmallTextFile)) {
    const text = fs.readFileSync(p, 'utf-8');
    if (forbiddenText.some((re) => re.test(text))) {
      failSecurity('RH toolbox maker frontend code leaked into packaged assets:', p);
    }
  }
  console.log('  ✅ RH toolbox maker is not present in packaged resources');
}

function main() {
  console.log('==========================================');
  console.log('[post-build] 验证打包产物');
  console.log('==========================================');

  if (!fs.existsSync(UNPACKED)) {
    console.error('  ❌ dist_electron/win-unpacked 不存在,先跑 npm run dist:dir');
    process.exit(1);
  }

  console.log('[1] 加密后端字节码:');
  checkFile(path.join(RES, 'backend-enc', 'server.t8c'));
  checkFile(path.join(RES, 'backend-enc', 'config.t8c'));
  checkFile(path.join(RES, 'backend-enc', 'routes', 'canvas.t8c'));
  checkFile(path.join(RES, 'backend-enc', 'routes', 'settings.t8c'));
  checkFile(path.join(RES, 'backend-enc', 'routes', 'proxy.t8c'));
  checkFile(path.join(RES, 'backend-enc', 'routes', 'externalProviders.t8c'));
  checkFile(path.join(RES, 'backend-enc', 'routes', 'files.t8c'));
  checkFile(path.join(RES, 'backend-enc', 'routes', 'imageOps.t8c'));
  checkFile(path.join(RES, 'backend-enc', 'routes', 'resources.t8c'));
  checkFile(path.join(RES, 'backend-enc', 'routes', 'themes.t8c'));
  checkFile(path.join(RES, 'backend-enc', 'routes', 'eagle.t8c'));
  checkFile(path.join(RES, 'backend-enc', 'routes', 'aiWatermark.t8c'));
  checkFile(path.join(RES, 'backend-enc', 'routes', 'cloudUploads.t8c'));
  checkFile(path.join(RES, 'backend-enc', 'cloudUploads', 'settings.t8c'));
  checkFile(path.join(RES, 'backend-enc', 'cloudUploads', 'uploader.t8c'));
  checkFile(path.join(RES, 'backend-enc', 'providers', 'registry.t8c'));
  checkFile(path.join(RES, 'backend-enc', 'providers', 'mediaResolver.t8c'));
  checkFile(path.join(RES, 'backend-enc', 'providers', 'adapters.t8c'));
  checkFile(path.join(RES, 'backend-enc', 'providers', 'openaiCompatible.t8c'));
  checkFile(path.join(RES, 'backend-enc', 'providers', 'llmMedia.t8c'));
  checkFile(path.join(RES, 'backend-enc', 'providers', 'modelscope.t8c'));
  checkFile(path.join(RES, 'backend-enc', 'providers', 'volcengine.t8c'));
  checkFile(path.join(RES, 'backend-enc', 'providers', 'comfyui.t8c'));
  checkFile(path.join(RES, 'backend-enc', 'providers', 'jimengCli.t8c'));
  checkFile(path.join(RES, 'backend-enc', 'tools', 'aiWatermark', 'runner.t8c'));
  checkFile(path.join(RES, 'backend-enc', 'tools', 'aiWatermark', 'media.t8c'));
  checkFile(path.join(RES, 'backend-enc', 'utils', 'duckPayload.t8c'));

  console.log('\n[2] 前端 dist:');
  checkFile(path.join(RES, 'frontend', 'index.html'));
  checkFile(path.join(RES, 'frontend', 'assets'));
  checkFrontendAsset('classic-one-summer-day-', '.mp3');
  checkFrontendAsset('pixel-theme-of-sss-', '.mp3');
  checkFrontendAsset('op-battle-scars-', '.mp3');
  checkFrontendAsset('rh-tide-', '.mp3');
  checkFrontendAsset('rh-hidden-saya-', '.mp3');
  checkFrontendAsset('naruto-shinsei-gyakuten-', '.mp3');
  checkFrontendAsset('eva-decisive-battle-', '.mp3');
  checkFrontendAsset('yyh-unbalanced-kiss-piano-', '.mp3');
  checkFrontendAsset('yyh-hidden-tonight-', '.mp3');
  checkFrontendAsset('slamdunk-kimi-ga-suki-', '.mp3');
  checkFrontendAsset('soccer-tsubasa-burning-hero-', '.mid');

  console.log('\n[3] 清除可能混入的明文后端源码:');
  nukePlainBackend();

  console.log('\n[4] 去AI水印 sidecar runtime:');
  checkAiWatermarkRuntime();

  console.log('\n[5] ffmpeg sidecar runtime:');
  checkFfmpegRuntime();

  console.log('\n[6] RH工具箱制作器分发检查:');
  checkNoRhToolboxMaker();

  console.log('\n[7] resources/ 完整结构:');
  listDir(RES);

  if (missingCount > 0) {
    console.error(`\n[post-build] FAILED: ${missingCount} required files are missing`);
    process.exit(1);
  }

  console.log('\n[post-build] DONE ✅');
}

if (require.main === module) main();
