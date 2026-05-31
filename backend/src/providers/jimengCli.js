const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

function cleanExecutablePath(provider) {
  return String(provider?.jimengConfig?.executablePath || '').trim();
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
  testProvider,
};
