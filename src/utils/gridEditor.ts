export type GridEditorFit = 'adaptive' | 'cover' | 'contain' | 'fill';
export type GridEditorOrigin = 'upstream' | 'local';

export interface GridEditorConfig {
  rows: number;
  cols: number;
  width: number;
  height: number;
  gap: number;
  background: string;
  fit: GridEditorFit;
  showIndexes: boolean;
}

export interface GridEditorItem {
  id: string;
  url: string;
  title?: string;
  origin?: GridEditorOrigin;
}

export interface GridComposeCell {
  imageUrl: string;
  fit?: GridEditorFit;
}

export interface GridComposeRequest extends GridEditorConfig {
  cells: Array<GridComposeCell | null>;
}

export const GRID_EDITOR_PRESETS = [
  { label: '2×2', rows: 2, cols: 2 },
  { label: '3×3', rows: 3, cols: 3 },
  { label: '3×4', rows: 4, cols: 3 },
  { label: '4×3', rows: 3, cols: 4 },
  { label: '1×4', rows: 4, cols: 1 },
  { label: '4×1', rows: 1, cols: 4 },
] as const;

export const GRID_EDITOR_RATIO_PRESETS = [
  { label: '1:1', width: 1200, height: 1200 },
  { label: '4:3', width: 1600, height: 1200 },
  { label: '16:9', width: 1920, height: 1080 },
  { label: '9:16', width: 1080, height: 1920 },
] as const;

export const GRID_EDITOR_CUSTOM_RATIO_VALUE = 'custom';

const clampInt = (value: unknown, min: number, max: number, fallback: number) => {
  const n = Number.parseInt(String(value), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
};

const normalizeFit = (value: unknown): GridEditorFit => {
  if (value === 'adaptive' || value === 'cover' || value === 'contain' || value === 'fill') return value;
  return 'adaptive';
};

const normalizeColor = (value: unknown, fallback = '#111827') => {
  const raw = String(value || '').trim();
  if (/^#[0-9a-f]{3}$/i.test(raw) || /^#[0-9a-f]{6}$/i.test(raw)) return raw.toLowerCase();
  return fallback;
};

export function normalizeGridEditorConfig(value: Partial<GridEditorConfig> | Record<string, unknown> = {}): GridEditorConfig {
  return {
    rows: clampInt(value.rows, 1, 12, 3),
    cols: clampInt(value.cols, 1, 12, 3),
    width: clampInt(value.width, 64, 4096, 1200),
    height: clampInt(value.height, 64, 4096, 1200),
    gap: clampInt(value.gap, 0, 160, 0),
    background: normalizeColor(value.background),
    fit: normalizeFit(value.fit),
    showIndexes: Boolean(value.showIndexes),
  };
}

export function gridEditorRatioSelectValue(width: unknown, height: unknown, mode?: unknown): string {
  if (mode === GRID_EDITOR_CUSTOM_RATIO_VALUE) return GRID_EDITOR_CUSTOM_RATIO_VALUE;
  const w = Number.parseInt(String(width), 10);
  const h = Number.parseInt(String(height), 10);
  const preset = GRID_EDITOR_RATIO_PRESETS.find((item) => item.width === w && item.height === h);
  return preset ? `${preset.width}:${preset.height}` : GRID_EDITOR_CUSTOM_RATIO_VALUE;
}

export function buildGridEditorItems(
  upstreamItems: GridEditorItem[] = [],
  localItems: GridEditorItem[] = [],
  order: string[] = [],
): GridEditorItem[] {
  const byId = new Map<string, GridEditorItem>();
  const add = (item: GridEditorItem, fallbackOrigin: GridEditorOrigin) => {
    if (!item || typeof item.id !== 'string' || typeof item.url !== 'string' || !item.id || !item.url) return;
    if (byId.has(item.id)) return;
    byId.set(item.id, { ...item, origin: item.origin || fallbackOrigin });
  };
  upstreamItems.forEach((item) => add(item, 'upstream'));
  localItems.forEach((item) => add(item, 'local'));

  const used = new Set<string>();
  const sorted: GridEditorItem[] = [];
  for (const id of order) {
    const item = byId.get(id);
    if (!item || used.has(id)) continue;
    sorted.push(item);
    used.add(id);
  }
  for (const [id, item] of byId) {
    if (used.has(id)) continue;
    sorted.push(item);
  }
  return sorted;
}

export function createGridEditorSlots(items: GridEditorItem[], config: Pick<GridEditorConfig, 'rows' | 'cols'>): Array<GridEditorItem | null> {
  const rows = clampInt(config.rows, 1, 12, 3);
  const cols = clampInt(config.cols, 1, 12, 3);
  const total = rows * cols;
  return Array.from({ length: total }, (_, index) => items[index] || null);
}

export function moveGridEditorItem(order: string[], activeId: string, overId: string): string[] {
  if (!activeId || !overId || activeId === overId) return order.slice();
  const oldIndex = order.indexOf(activeId);
  const newIndex = order.indexOf(overId);
  if (oldIndex < 0 || newIndex < 0) return order.slice();
  const next = order.slice();
  const [item] = next.splice(oldIndex, 1);
  next.splice(newIndex, 0, item);
  return next;
}

export function buildGridComposeRequest(items: GridEditorItem[], config: GridEditorConfig): GridComposeRequest {
  const normalized = normalizeGridEditorConfig(config);
  const slots = createGridEditorSlots(items, normalized);
  return {
    ...normalized,
    cells: slots.map((slot) => (slot ? { imageUrl: slot.url, fit: normalized.fit } : null)),
  };
}

export function splitGridEditorItems(items: GridEditorItem[]): string[] {
  return items.map((item) => item.url).filter((url): url is string => typeof url === 'string' && url.length > 0);
}

export function rowsNeededForItems(count: number, cols: number): number {
  const safeCols = clampInt(cols, 1, 12, 3);
  const safeCount = Math.max(0, Math.trunc(Number(count) || 0));
  return Math.max(1, Math.min(12, Math.ceil(safeCount / safeCols)));
}
