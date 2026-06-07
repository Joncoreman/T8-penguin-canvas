// ============================================================================
// _post_build.js — electron-builder 完成后的产物核验脚本
//
// 职责:
//   1. 检查 dist_electron/win-unpacked/resources/backend-enc/*.t8c 是否存在
//   2. 检查 frontend/index.html 是否到位
//   3. 强制移除任何意外混入的明文 backend/src/*.js (双保险)
//   4. 运行本地私有扩展的可选分发检查
//   5. 输出最终产物清单
// ============================================================================
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PACKAGE_JSON = require(path.join(ROOT, 'package.json'));
const APP_VERSION = PACKAGE_JSON.version;
const PRODUCT_NAME = PACKAGE_JSON.build && PACKAGE_JSON.build.productName
  ? PACKAGE_JSON.build.productName
  : 'T8-PenguinCanvas';
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

function runLocalPostBuildChecks() {
  const disabled = process.env.T8_ENABLE_LOCAL_PRIVATE === '0'
    || process.env.T8_DISABLE_LOCAL_EXTENSIONS === '1';
  const hookPath = path.join(ROOT, 'local-private', 'extensions', 'build', 'post-build.cjs');
  if (disabled) {
    console.log('  ⚠️  local private build hook disabled by environment');
    return;
  }
  if (!fs.existsSync(hookPath)) {
    console.log('  ✅ no local private build hook configured');
    return;
  }
  const hook = require(hookPath);
  const run = typeof hook === 'function' ? hook : hook && hook.runLocalPostBuildChecks;
  if (typeof run !== 'function') {
    failSecurity('local private build hook does not export a runnable check:', hookPath);
  }
  run({
    ROOT,
    PACKAGE_JSON,
    APP_VERSION,
    PRODUCT_NAME,
    UNPACKED,
    RES,
    ok,
    bad,
    checkFile,
    checkFrontendAsset,
    listDir,
    rel,
    failSecurity,
    walkFiles,
    isSmallTextFile,
  });
}

function checkAiWatermarkRuntime() {
  const runtimeRoot = path.join(RES, 'tools', 'remove-ai-watermarks');
  const archiveRoot = path.join(RES, 'tools', 'runtime-archives');
  const archive = path.join(archiveRoot, 'remove-ai-watermarks-runtime.zip');
  const archiveManifest = path.join(archiveRoot, 'runtime-archives-manifest.json');
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
  if (fs.existsSync(archive)) {
    ok(archive);
    if (fs.existsSync(archiveManifest)) ok(archiveManifest);
    else {
      missingCount += 1;
      bad(archiveManifest);
    }
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

function checkParseHubRuntime() {
  const bridge = path.join(RES, 'tools', 'parsehub-bridge', 'parsehub_bridge.py');
  const libsRoot = path.join(RES, 'tools', 'parsehub-pythonlibs');
  const parsehubPkg = path.join(libsRoot, 'parsehub');
  const archiveRoot = path.join(RES, 'tools', 'runtime-archives');
  const archive = path.join(archiveRoot, 'parsehub-pythonlibs.zip');
  const archiveManifest = path.join(archiveRoot, 'runtime-archives-manifest.json');
  const strict = process.env.T8_REQUIRE_PARSEHUB_RUNTIME === '1';

  checkFile(bridge);
  if (fs.existsSync(parsehubPkg)) {
    ok(parsehubPkg);
    return;
  }
  if (fs.existsSync(archive)) {
    ok(archive);
    if (fs.existsSync(archiveManifest)) ok(archiveManifest);
    else {
      missingCount += 1;
      bad(archiveManifest);
    }
    return;
  }

  const message = 'ParseHub python dependencies not bundled; aggregate parser will require T8_PARSEHUB_LIB_PATHS or system/site installed parsehub';
  if (strict) failSecurity(message, libsRoot);
  console.log('  ⚠️ ', message);
  console.log('     Refresh with: tools\\remove-ai-watermarks-runtime\\python\\python.exe -m pip install --upgrade --target tools\\parsehub-pythonlibs .\\ParseHub, then npm run prepack:runtimes');
}

function checkUpdateArtifacts() {
  const distDir = path.join(ROOT, 'dist_electron');
  const installerName = `${PRODUCT_NAME}-Setup-${APP_VERSION}.exe`;
  const installer = path.join(distDir, installerName);
  const blockmap = path.join(distDir, `${installerName}.blockmap`);
  const latest = path.join(distDir, 'latest.yml');
  const strict = process.env.T8_REQUIRE_UPDATE_ARTIFACTS === '1';
  const hasInstaller = fs.existsSync(installer);
  const hasBlockmap = fs.existsSync(blockmap);

  if (!strict && !hasInstaller && !hasBlockmap) {
    console.log('  ⚠️  NSIS update artifacts not present; skipping installer/latest.yml checks for dir build');
    return;
  }

  checkFile(installer);
  checkFile(blockmap);
  checkFile(latest);

  if (fs.existsSync(latest)) {
    const text = fs.readFileSync(latest, 'utf-8');
    if (!new RegExp(`version:\\s*${APP_VERSION.replace(/\./g, '\\.')}`).test(text)) {
      missingCount += 1;
      console.error(`  ❌ latest.yml version mismatch, expected ${APP_VERSION}`);
    } else {
      ok(latest);
    }
    if (!text.includes(installerName)) {
      missingCount += 1;
      console.error(`  ❌ latest.yml does not reference ${installerName}`);
    }
  }
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
  checkFile(path.join(RES, 'backend-enc', 'routes', 'parseHub.t8c'));
  checkFile(path.join(RES, 'backend-enc', 'routes', 'achievements.t8c'));
  checkFile(path.join(RES, 'backend-enc', 'routes', 'topaz.t8c'));
  checkFile(path.join(RES, 'backend-enc', 'achievements', 'store.t8c'));
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
  checkFile(path.join(RES, 'backend-enc', 'tools', 'topaz', 'runner.t8c'));
  checkFile(path.join(RES, 'backend-enc', 'utils', 'duckPayload.t8c'));
  checkFile(path.join(RES, 'backend-enc', 'utils', 'parseHubBridge.t8c'));
  checkFile(path.join(RES, 'backend-enc', 'utils', 'runtimeArchive.t8c'));

  console.log('\n[2] 前端 dist:');
  checkFile(path.join(RES, 'frontend', 'index.html'));
  checkFile(path.join(RES, 'frontend', 'assets'));
  checkFile(path.join(RES, 'shared', 'achievementManifest.json'));
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
  checkFrontendAsset('dragonball-makafushigi-adventure-', '.mp3');
  checkFrontendAsset('dragonball-shenron-cha-la-head-cha-la-', '.mp3');

  console.log('\n[3] 清除可能混入的明文后端源码:');
  nukePlainBackend();

  console.log('\n[4] 本地私有扩展分发检查:');
  runLocalPostBuildChecks();

  console.log('\n[5] 去AI水印 sidecar runtime:');
  checkAiWatermarkRuntime();

  console.log('\n[6] ffmpeg sidecar runtime:');
  checkFfmpegRuntime();

  console.log('\n[7] ParseHub bridge/runtime:');
  checkParseHubRuntime();

  console.log('\n[8] RH工具箱制作器分发检查:');
  checkNoRhToolboxMaker();

  console.log('\n[9] GitHub 自动更新资产:');
  checkUpdateArtifacts();

  console.log('\n[10] resources/ 完整结构:');
  listDir(RES);

  if (missingCount > 0) {
    console.error(`\n[post-build] FAILED: ${missingCount} required files are missing`);
    process.exit(1);
  }

  console.log('\n[post-build] DONE ✅');
}

if (require.main === module) main();
