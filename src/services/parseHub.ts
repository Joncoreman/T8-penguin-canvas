export type AggregateParserMode = 'parse' | 'download';
export type AggregateParserMediaKind = 'image' | 'video' | 'audio' | 'file' | 'text';

export interface AggregateParserMedia {
  kind: AggregateParserMediaKind;
  url: string;
  label?: string;
  ext?: string;
  thumbUrl?: string;
  localPath?: string;
  width?: number;
  height?: number;
  duration?: number;
  source?: 'remote' | 'download';
}

export interface AggregateParserResult {
  ok: boolean;
  platform?: string;
  platformName?: string;
  type?: string;
  title?: string;
  content?: string;
  contentPreview?: string;
  sourceUrl?: string;
  mode?: AggregateParserMode;
  media: AggregateParserMedia[];
  outputText: string;
  parsehubVersion?: string;
  pythonVersion?: string;
  downloadedDir?: string;
  complianceWarning?: string;
  supportedPlatforms?: string[];
  raw?: unknown;
}

export interface AggregateParserStatus {
  ok: boolean;
  available: boolean;
  error?: string;
  parsehubVersion?: string;
  pythonVersion?: string;
  platforms: Array<{ id?: string; name?: string; supported_types?: string[] } | string>;
  supportedPlatforms: string[];
}

export interface AggregateParserResolvePayload {
  input: string;
  mode?: AggregateParserMode;
  proxy?: string;
  cookie?: string;
  acceptedCompliance: boolean;
}

export class AggregateParserApiError extends Error {
  code?: string;
  hint?: string;
  nextAction?: string;
  status?: number;

  constructor(message: string, options: { code?: string; hint?: string; nextAction?: string; status?: number } = {}) {
    super(message);
    this.name = 'AggregateParserApiError';
    this.code = options.code;
    this.hint = options.hint;
    this.nextAction = options.nextAction;
    this.status = options.status;
  }
}

const BASE = '/api/parsehub';

async function readJson<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.success === false) {
    throw new AggregateParserApiError(data?.error || data?.message || `HTTP ${res.status}`, {
      code: data?.code,
      hint: data?.hint,
      nextAction: data?.nextAction,
      status: res.status,
    });
  }
  return data;
}

export async function getAggregateParserStatus(): Promise<AggregateParserStatus> {
  const data = await readJson<{ success: boolean; data: AggregateParserStatus }>(
    await fetch(`${BASE}/status`),
  );
  return data.data;
}

export async function resolveAggregateMedia(payload: AggregateParserResolvePayload): Promise<AggregateParserResult> {
  const data = await readJson<{ success: boolean; data: AggregateParserResult }>(
    await fetch(`${BASE}/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
  );
  return data.data;
}
