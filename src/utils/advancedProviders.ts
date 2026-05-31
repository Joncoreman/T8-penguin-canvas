import type { AdvancedProviderConfig, AdvancedProviderSummary } from '../types/canvas';

const MASKED_RE = /^\*{2,}/;

export function parseAdvancedProviderModelText(value: string): string[] {
  const out: string[] = [];
  for (const raw of String(value || '').split(/[\n,]/)) {
    const item = raw.trim();
    if (!item || out.includes(item)) continue;
    out.push(item);
  }
  return out;
}

export function stringifyAdvancedProviderModels(values?: string[]): string {
  return (Array.isArray(values) ? values : [])
    .map((item) => String(item || '').trim())
    .filter(Boolean)
    .join('\n');
}

export function hasAdvancedProviderSecret(value?: string): boolean {
  const text = String(value || '').trim();
  return !!text && (MASKED_RE.test(text) || text.length > 0);
}

export function advancedProviderSummary(providers?: AdvancedProviderConfig[]): AdvancedProviderSummary {
  const list = Array.isArray(providers) ? providers : [];
  return list.reduce<AdvancedProviderSummary>((summary, provider) => {
    if (provider?.enabled) summary.enabledCount += 1;
    if (hasAdvancedProviderSecret(provider?.apiKey)) summary.configuredKeyCount += 1;
    if (hasAdvancedProviderSecret(provider?.volcengineConfig?.accessKeyId)) summary.configuredKeyCount += 1;
    if (hasAdvancedProviderSecret(provider?.volcengineConfig?.secretAccessKey)) summary.configuredKeyCount += 1;
    if (provider?.protocol === 'comfyui' && (provider.baseUrl || provider.comfyuiConfig?.instances?.length)) {
      summary.comfyuiConfigured = true;
    }
    if (provider?.protocol === 'jimeng-cli' && provider.jimengConfig?.executablePath) {
      summary.jimengConfigured = true;
    }
    return summary;
  }, {
    enabledCount: 0,
    configuredKeyCount: 0,
    comfyuiConfigured: false,
    jimengConfigured: false,
  });
}
