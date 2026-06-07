const fs = require('fs');
const path = require('path');

const SOURCE_INDEX = path.resolve(__dirname, '..', '..', '..', 'local-private', 'extensions', 'backend', 'index.cjs');
const ENCRYPTED_INDEX = path.resolve(__dirname, '..', 'local-private', 'extensions', 'backend', 'index.t8c');

function isEnabled() {
  return process.env.T8_ENABLE_LOCAL_PRIVATE !== '0'
    && process.env.T8_DISABLE_LOCAL_EXTENSIONS !== '1';
}

function loadLocalExtensionIndex() {
  if (!isEnabled()) return null;
  for (const candidate of [ENCRYPTED_INDEX, SOURCE_INDEX]) {
    if (!fs.existsSync(candidate)) continue;
    try {
      return require(candidate);
    } catch (error) {
      console.warn('[local-extensions] load failed:', candidate, error?.message || error);
      return null;
    }
  }
  return null;
}

function registerLocalExtensions(app, context = {}) {
  const local = loadLocalExtensionIndex();
  if (!local) return;
  if (typeof local.registerLocalExtensions === 'function') {
    local.registerLocalExtensions(app, context);
  }
}

module.exports = {
  registerLocalExtensions,
};
