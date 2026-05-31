const openaiCompatible = require('./openaiCompatible');

async function testProvider(provider, options = {}) {
  const result = await openaiCompatible.testProvider(provider, options);
  return {
    ...result,
    providerId: provider.id,
    protocol: 'volcengine',
  };
}

module.exports = {
  testProvider,
};
