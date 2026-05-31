const openaiCompatible = require('./openaiCompatible');
const modelscope = require('./modelscope');
const volcengine = require('./volcengine');
const comfyui = require('./comfyui');
const jimengCli = require('./jimengCli');

const ADAPTERS = {
  'openai-compatible': openaiCompatible,
  modelscope,
  volcengine,
  comfyui,
  'jimeng-cli': jimengCli,
};

function getAdapterForProtocol(protocol) {
  return ADAPTERS[String(protocol || '').trim()] || null;
}

async function testProviderConnection(provider, options = {}) {
  const adapter = getAdapterForProtocol(provider?.protocol);
  if (!adapter) {
    return {
      ok: false,
      code: 'unsupported_protocol',
      providerId: provider?.id || '',
      protocol: provider?.protocol || '',
      error: '不支持的扩展平台协议。',
    };
  }
  return adapter.testProvider(provider, options);
}

module.exports = {
  getAdapterForProtocol,
  testProviderConnection,
};
