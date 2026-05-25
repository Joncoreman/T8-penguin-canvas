// ============================================================================
// _post_build.js — electron-builder 完成后的产物核验脚本
//
// 职责:
//   1. 检查 dist_electron/win-unpacked/resources/backend-enc/*.t8c 是否存在
//   2. 检查 frontend/index.html 是否到位
//   3. 强制移除任何意外混入的明文 backend/src/*.js (双保险)
//   4. 检查充值私有配置/密钥没有混入用户分发包
//   5. 输出最终产物清单
// ============================================================================
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const UNPACKED = path.join(ROOT, 'dist_electron', 'win-unpacked');
const RES = path.join(UNPACKED, 'resources');

function ok(p) {
  console.log('  ✅', path.relative(UNPACKED, p));
}
function bad(p) {
  console.log('  ❌ MISSING', path.relative(UNPACKED, p));
}

function checkFile(p) {
  if (fs.existsSync(p)) ok(p);
  else bad(p);
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

function checkNoRechargeSecrets() {
  const rechargeSource = path.join(ROOT, 'backend', 'src', 'routes', 'recharge.js');
  if (fs.existsSync(rechargeSource)) {
    const src = fs.readFileSync(rechargeSource, 'utf-8');
    if (/RECHARGE_DEFAULT_ENC\s*=\s*['"`]ZZENC1/.test(src)) {
      failSecurity('source contains legacy RECHARGE_DEFAULT_ENC encrypted payload:', rechargeSource);
    }
    if (!/RECHARGE_DEFAULT_ENC\s*=\s*['"`]\s*['"`]/.test(src)) {
      failSecurity('source RECHARGE_DEFAULT_ENC must stay an empty string before packaging:', rechargeSource);
    }
  }

  const forbiddenFiles = [
    path.join(RES, 'data', 'recharge.private.json'),
    path.join(RES, 'recharge.private.json'),
    path.join(RES, 'app', 'data', 'recharge.private.json'),
    path.join(RES, 'app.asar.unpacked', 'data', 'recharge.private.json'),
  ];
  for (const p of forbiddenFiles) {
    if (fs.existsSync(p)) {
      failSecurity('private recharge config must never be shipped:', p);
    }
  }

  const patterns = [
    {
      name: 'non-empty AGENT_HMAC_KEY JSON value',
      re: /"AGENT_HMAC_KEY"\s*:\s*"[A-Za-z0-9+/_=-]{16,}"/,
    },
    {
      name: 'non-empty DULUPAY_KEY JSON value',
      re: /"DULUPAY_KEY"\s*:\s*"[A-Za-z0-9+/_=-]{16,}"/,
    },
    {
      name: 'RECHARGE_AGENT_HMAC_KEY assignment',
      re: /RECHARGE_AGENT_HMAC_KEY\s*=\s*['"]?[A-Za-z0-9+/_=-]{16,}/,
    },
    {
      name: 'legacy encrypted recharge default',
      re: /RECHARGE_DEFAULT_ENC\s*=\s*['"`]ZZENC1\\?n[A-Za-z0-9+/=]{20,}/,
    },
  ];

  for (const p of walkFiles(RES).filter(isSmallTextFile)) {
    const text = fs.readFileSync(p, 'utf-8');
    for (const pat of patterns) {
      if (pat.re.test(text)) {
        failSecurity(`possible recharge secret in packaged text file (${pat.name}):`, p);
      }
    }
  }

  console.log('  ✅ recharge private config / HMAC not present in packaged resources');
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
  checkFile(path.join(RES, 'backend-enc', 'routes', 'files.t8c'));
  checkFile(path.join(RES, 'backend-enc', 'routes', 'imageOps.t8c'));
  checkFile(path.join(RES, 'backend-enc', 'routes', 'recharge.t8c'));

  console.log('\n[2] 前端 dist:');
  checkFile(path.join(RES, 'frontend', 'index.html'));
  checkFile(path.join(RES, 'frontend', 'assets'));

  console.log('\n[3] 清除可能混入的明文后端源码:');
  nukePlainBackend();

  console.log('\n[4] 充值密钥分发安全检查:');
  checkNoRechargeSecrets();

  console.log('\n[5] resources/ 完整结构:');
  listDir(RES);

  console.log('\n[post-build] DONE ✅');
}

if (require.main === module) main();
