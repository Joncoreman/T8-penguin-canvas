export type ComfyFieldSource =
  | 'prompt'
  | 'negative'
  | 'image1'
  | 'image2'
  | 'image3'
  | 'video1'
  | 'audio1'
  | 'width'
  | 'height'
  | 'batch_size'
  | 'seed'
  | 'steps'
  | 'cfg'
  | 'sampler_name'
  | 'scheduler'
  | 'denoise'
  | 'model_name'
  | 'ckpt_name'
  | 'clip_name'
  | 'vae_name'
  | 'lora_name'
  | 'strength_model'
  | 'strength_clip'
  | 'fixed';

export interface ComfyFieldMapping {
  nodeId: string;
  fieldName: string;
  source?: string;
  value?: any;
}

export interface ComfyDetectedField extends ComfyFieldMapping {
  classType: string;
  nodeTitle: string;
  label: string;
}

export interface ComfyWorkflowAnalysis {
  fields: ComfyDetectedField[];
  imageInputCount: number;
  videoInputCount: number;
  audioInputCount: number;
  outputCount: number;
  warnings: string[];
}

export interface CanonicalizeComfyFieldsOptions {
  addMissingPromptField?: boolean;
}

export type ComfyFieldExcludeRule = string;

export const COMFY_FIELD_SOURCE_OPTIONS: Array<{ value: ComfyFieldSource; label: string; hint?: string }> = [
  { value: 'prompt', label: '正向 Prompt' },
  { value: 'negative', label: '负向 Prompt' },
  { value: 'image1', label: '上游图片 1' },
  { value: 'image2', label: '上游图片 2' },
  { value: 'image3', label: '上游图片 3' },
  { value: 'video1', label: '上游视频 1' },
  { value: 'audio1', label: '上游音频 1' },
  { value: 'width', label: '宽度' },
  { value: 'height', label: '高度' },
  { value: 'batch_size', label: '批量数' },
  { value: 'seed', label: 'Seed' },
  { value: 'steps', label: 'Steps' },
  { value: 'cfg', label: 'CFG' },
  { value: 'sampler_name', label: 'Sampler' },
  { value: 'scheduler', label: 'Scheduler' },
  { value: 'denoise', label: 'Denoise' },
  { value: 'model_name', label: '模型名' },
  { value: 'ckpt_name', label: 'Checkpoint' },
  { value: 'clip_name', label: 'CLIP' },
  { value: 'vae_name', label: 'VAE' },
  { value: 'lora_name', label: 'LoRA' },
  { value: 'strength_model', label: 'LoRA 模型强度' },
  { value: 'strength_clip', label: 'LoRA CLIP 强度' },
  { value: 'fixed', label: '固定值' },
];

function entriesOfWorkflow(workflow: unknown): Array<[string, any]> {
  if (!workflow || typeof workflow !== 'object' || Array.isArray(workflow)) return [];
  return Object.entries(workflow as Record<string, any>).filter(([, node]) => (
    node && typeof node === 'object' && !Array.isArray(node) && node.inputs && typeof node.inputs === 'object'
  ));
}

function nodeTitle(nodeId: string, node: any): string {
  return String(node?._meta?.title || node?.title || node?.class_type || `#${nodeId}`).trim();
}

function classTypeOf(node: any): string {
  return String(node?.class_type || '').trim();
}

function pushField(
  out: ComfyDetectedField[],
  seen: Set<string>,
  nodeId: string,
  node: any,
  fieldName: string,
  source: ComfyFieldSource,
) {
  const key = `${nodeId}::${fieldName}`;
  if (seen.has(key)) return;
  seen.add(key);
  const classType = classTypeOf(node);
  const title = nodeTitle(nodeId, node);
  out.push({
    nodeId,
    fieldName,
    source,
    classType,
    nodeTitle: title,
    label: `${title} #${nodeId} · ${fieldName}`,
  });
}

function isNegativePromptNode(node: any, promptTextAlreadySeen: boolean): boolean {
  const text = `${node?._meta?.title || ''} ${node?.title || ''} ${node?.class_type || ''}`.toLowerCase();
  if (/negative|neg|反向|负向|不要|排除/.test(text)) return true;
  return promptTextAlreadySeen;
}

function linkedNodeId(value: unknown): string {
  if (!Array.isArray(value)) return '';
  const first = value[0];
  if (typeof first === 'string' || typeof first === 'number') return String(first).trim();
  return '';
}

function buildClipTextRoleMap(entries: Array<[string, any]>): Map<string, 'prompt' | 'negative'> {
  const roles = new Map<string, 'prompt' | 'negative'>();
  for (const [, node] of entries) {
    const inputs = node?.inputs || {};
    const positive = linkedNodeId(inputs.positive);
    const negative = linkedNodeId(inputs.negative);
    if (positive) roles.set(positive, 'prompt');
    if (negative) roles.set(negative, 'negative');
  }
  return roles;
}

function hasField(inputs: Record<string, any>, fieldName: string): boolean {
  return Object.prototype.hasOwnProperty.call(inputs, fieldName);
}

export function analyzeComfyWorkflow(workflow: unknown): ComfyWorkflowAnalysis {
  const fields: ComfyDetectedField[] = [];
  const seen = new Set<string>();
  let promptTextSeen = false;
  let imageInputCount = 0;
  let videoInputCount = 0;
  let audioInputCount = 0;
  let outputCount = 0;
  const warnings: string[] = [];
  const entries = entriesOfWorkflow(workflow);
  const clipTextRoles = buildClipTextRoleMap(entries);

  if (!entries.length) {
    warnings.push('未识别到 API Workflow 节点；请确认导入的是 ComfyUI API 格式，而不是普通前端 workflow。');
    return { fields, imageInputCount, videoInputCount, audioInputCount, outputCount, warnings };
  }

  for (const [nodeId, node] of entries) {
    const classType = classTypeOf(node);
    const lowClass = classType.toLowerCase();
    const inputs = node.inputs || {};
    const inputKeys = Object.keys(inputs);

    if (lowClass.includes('cliptextencode') && hasField(inputs, 'text')) {
      const role = clipTextRoles.get(nodeId);
      const source: ComfyFieldSource = role || (isNegativePromptNode(node, promptTextSeen) ? 'negative' : 'prompt');
      pushField(fields, seen, nodeId, node, 'text', source);
      if (source === 'prompt') promptTextSeen = true;
    }

    if ((lowClass.includes('loadimage') || lowClass.includes('imageinput')) && hasField(inputs, 'image')) {
      imageInputCount += 1;
      pushField(fields, seen, nodeId, node, 'image', (`image${Math.min(imageInputCount, 3)}` as ComfyFieldSource));
    }

    if ((lowClass.includes('loadvideo') || lowClass.includes('videoinput') || lowClass.includes('vhs')) && hasField(inputs, 'video')) {
      videoInputCount += 1;
      pushField(fields, seen, nodeId, node, 'video', 'video1');
    }

    if ((lowClass.includes('loadaudio') || lowClass.includes('audioinput')) && hasField(inputs, 'audio')) {
      audioInputCount += 1;
      pushField(fields, seen, nodeId, node, 'audio', 'audio1');
    }

    if (lowClass.includes('emptylatent') || lowClass.includes('latentimage')) {
      if (hasField(inputs, 'width')) pushField(fields, seen, nodeId, node, 'width', 'width');
      if (hasField(inputs, 'height')) pushField(fields, seen, nodeId, node, 'height', 'height');
      if (hasField(inputs, 'batch_size')) pushField(fields, seen, nodeId, node, 'batch_size', 'batch_size');
    }

    if (lowClass.includes('ksampler') || lowClass.includes('sampler')) {
      for (const key of ['seed', 'noise_seed']) {
        if (hasField(inputs, key)) pushField(fields, seen, nodeId, node, key, 'seed');
      }
      for (const key of ['steps', 'cfg', 'sampler_name', 'scheduler', 'denoise'] as const) {
        if (hasField(inputs, key)) pushField(fields, seen, nodeId, node, key, key);
      }
    }

    for (const key of ['model_name', 'ckpt_name', 'clip_name', 'vae_name', 'lora_name', 'strength_model', 'strength_clip'] as const) {
      if (hasField(inputs, key)) pushField(fields, seen, nodeId, node, key, key);
    }

    if (lowClass.includes('saveimage') || lowClass.includes('previewimage') || lowClass.includes('savevideo') || lowClass.includes('saveaudio')) outputCount += 1;

    if (!lowClass && inputKeys.length > 0) {
      warnings.push(`#${nodeId} 缺少 class_type，可能不是标准 API Workflow 节点。`);
    }
  }

  if (!fields.some((field) => field.source === 'prompt')) {
    warnings.push('未自动找到正向 Prompt 字段；可以在映射表中手动添加或切到高级 fields JSON。');
  }
  if (imageInputCount > 0 && !fields.some((field) => /^image\d+$/.test(String(field.source || '')))) {
    warnings.push('检测到图像输入节点，但没有生成图片映射。');
  }

  return { fields, imageInputCount, videoInputCount, audioInputCount, outputCount, warnings };
}

export function compactComfyFields(fields: Array<ComfyFieldMapping | ComfyDetectedField> | undefined): ComfyFieldMapping[] {
  const out: ComfyFieldMapping[] = [];
  const seen = new Set<string>();
  for (const field of Array.isArray(fields) ? fields : []) {
    const nodeId = String(field?.nodeId || '').trim();
    const fieldName = String(field?.fieldName || '').trim();
    if (!nodeId || !fieldName) continue;
    const key = `${nodeId}::${fieldName}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const hasValue = Object.prototype.hasOwnProperty.call(field, 'value');
    const rawSource = String(field.source || '').trim();
    const source = rawSource || (hasValue ? 'fixed' : fieldName);
    const next: ComfyFieldMapping = { nodeId, fieldName, source };
    if (source === 'fixed' && hasValue) next.value = field.value;
    out.push(next);
  }
  return out;
}

function isClipTextField(node: any, fieldName: string): boolean {
  return classTypeOf(node).toLowerCase().includes('cliptextencode') && fieldName === 'text';
}

function isPromptLikeSource(source: string, fieldName: string): boolean {
  return ['prompt', 'positive', 'negative', 'text'].includes(source) || source === fieldName;
}

function fieldKey(field: ComfyFieldMapping): string {
  return `${field.nodeId}::${field.fieldName}`;
}

export function parseComfyFieldExcludeRules(value: unknown): ComfyFieldExcludeRule[] {
  const rawItems = Array.isArray(value)
    ? value
    : String(value || '').split(/[\n,;，；]+/);
  const out: string[] = [];
  for (const raw of rawItems) {
    const item = String(raw || '').trim();
    if (!item || out.includes(item)) continue;
    out.push(item.slice(0, 120));
  }
  return out.slice(0, 200);
}

function normalizeRuleText(value: unknown): string {
  return String(value || '').trim().toLowerCase();
}

function fuzzyContains(value: string, needle: string): boolean {
  return !!needle && !!value && value.includes(needle);
}

export function shouldExcludeComfyField(
  workflow: unknown,
  field: ComfyFieldMapping | ComfyDetectedField,
  rules: unknown,
): boolean {
  const excludeRules = parseComfyFieldExcludeRules(rules);
  if (!excludeRules.length || !field) return false;
  const entries = entriesOfWorkflow(workflow);
  const nodes = new Map(entries);
  const nodeId = String(field.nodeId || '').trim();
  const fieldName = String(field.fieldName || '').trim();
  const source = String(field.source || fieldName || '').trim();
  const node = nodes.get(nodeId);
  const classType = String((field as ComfyDetectedField).classType || classTypeOf(node) || '').trim();
  const title = String((field as ComfyDetectedField).nodeTitle || (node ? nodeTitle(nodeId, node) : '')).trim();
  const label = String((field as ComfyDetectedField).label || `${title} #${nodeId} · ${fieldName}`).trim();
  const exactTokens = new Set([
    normalizeRuleText(source),
    normalizeRuleText(fieldName),
    normalizeRuleText(nodeId),
    normalizeRuleText(`#${nodeId}`),
    normalizeRuleText(`${nodeId}.${fieldName}`),
    normalizeRuleText(`#${nodeId}.${fieldName}`),
    normalizeRuleText(`${classType}.${fieldName}`),
    normalizeRuleText(`${classType}.${source}`),
    normalizeRuleText(title),
    normalizeRuleText(classType),
  ].filter(Boolean));
  const searchable = normalizeRuleText([
    nodeId,
    `#${nodeId}`,
    fieldName,
    source,
    classType,
    title,
    label,
    `${nodeId}.${fieldName}`,
    `#${nodeId}.${fieldName}`,
    `${classType}.${fieldName}`,
    `${classType}.${source}`,
  ].filter(Boolean).join(' '));

  for (const rawRule of excludeRules) {
    const rule = normalizeRuleText(rawRule);
    if (!rule) continue;
    const prefixed = rule.match(/^(source|field|class|node|title)\s*:\s*(.+)$/);
    if (prefixed) {
      const [, kind, value] = prefixed;
      const target = normalizeRuleText(value);
      if (!target) continue;
      if (kind === 'source' && normalizeRuleText(source) === target) return true;
      if (kind === 'field' && normalizeRuleText(fieldName) === target) return true;
      if (kind === 'class' && fuzzyContains(normalizeRuleText(classType), target)) return true;
      if (kind === 'node' && (normalizeRuleText(nodeId) === target || normalizeRuleText(`#${nodeId}`) === target)) return true;
      if (kind === 'title' && fuzzyContains(normalizeRuleText(title), target)) return true;
      continue;
    }
    if (exactTokens.has(rule) || fuzzyContains(searchable, rule)) return true;
  }
  return false;
}

export function filterComfyFieldsByExcludeRules<T extends ComfyFieldMapping | ComfyDetectedField>(
  workflow: unknown,
  fields: T[] | undefined,
  rules: unknown,
): T[] {
  const excludeRules = parseComfyFieldExcludeRules(rules);
  const sourceFields = Array.isArray(fields) ? fields : [];
  if (!excludeRules.length) return sourceFields.slice();
  return sourceFields.filter((field) => !shouldExcludeComfyField(workflow, field, excludeRules));
}

export function canonicalizeComfyFieldsByWorkflow(
  workflow: unknown,
  fields: Array<ComfyFieldMapping | ComfyDetectedField> | undefined,
  options: CanonicalizeComfyFieldsOptions = {},
): ComfyFieldMapping[] {
  const entries = entriesOfWorkflow(workflow);
  const nodes = new Map(entries);
  const clipTextRoles = buildClipTextRoleMap(entries);
  const out: ComfyFieldMapping[] = [];
  const seen = new Set<string>();
  let hasPromptField = false;
  const compactedFields = compactComfyFields(fields);
  const sourceFields = compactedFields.length
    ? compactedFields
    : compactComfyFields(analyzeComfyWorkflow(workflow).fields);
  let correctedPromptToNegative = false;

  for (const field of sourceFields) {
    const next: ComfyFieldMapping = { ...field };
    const node = nodes.get(next.nodeId);
    const source = String(next.source || next.fieldName || '').trim();
    const role = clipTextRoles.get(next.nodeId);
    if (node && role && isClipTextField(node, next.fieldName) && isPromptLikeSource(source, next.fieldName)) {
      next.source = role === 'prompt' ? 'prompt' : 'negative';
      if (role === 'negative' && ['prompt', 'positive', 'text'].includes(source)) {
        correctedPromptToNegative = true;
      }
    }
    const key = fieldKey(next);
    if (seen.has(key)) continue;
    seen.add(key);
    if (next.source === 'prompt' || next.source === 'positive') hasPromptField = true;
    out.push(next);
  }

  const shouldAddMissingPrompt = options.addMissingPromptField === true
    || (options.addMissingPromptField !== false && (!compactedFields.length || correctedPromptToNegative));
  if (shouldAddMissingPrompt && entries.length && !hasPromptField) {
    const detectedPrompt = analyzeComfyWorkflow(workflow).fields.find((field) => (
      (field.source === 'prompt' || field.source === 'positive') && !seen.has(fieldKey(field))
    ));
    if (detectedPrompt) {
      out.push(compactComfyFields([detectedPrompt])[0]);
    }
  }

  return out;
}
