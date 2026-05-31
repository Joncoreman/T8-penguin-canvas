/**
 * T8-penguin-canvas 后端 API 封装
 * 所有请求走 Vite proxy → http://127.0.0.1:18766
 */
import type { ApiSettings, CanvasData, CanvasListItem } from '../types/canvas';
import type { ThemeTemplate } from '../theme/types';
import type { MediaKind } from '../utils/mediaCollection';

const BASE = '/api';

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!res.ok) {
    let errMsg = `HTTP ${res.status}`;
    try {
      const data = await res.json();
      errMsg = data.error || data.message || errMsg;
    } catch {
      /* ignore */
    }
    throw new Error(errMsg);
  }
  return res.json();
}

// ========== 状态 ==========
export async function checkBackendStatus(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE}/status`);
    return res.ok;
  } catch {
    return false;
  }
}

// ========== 画布列表 ==========
export async function listCanvases(): Promise<CanvasListItem[]> {
  const res = await request<{ success: boolean; data: CanvasListItem[] }>(`${BASE}/canvas`);
  return res.data || [];
}

export async function createCanvas(name?: string): Promise<CanvasListItem> {
  const res = await request<{ success: boolean; data: CanvasListItem }>(`${BASE}/canvas`, {
    method: 'POST',
    body: JSON.stringify({ name: name || '未命名画布' }),
  });
  return res.data;
}

export async function getCanvasData(id: string): Promise<CanvasData> {
  const res = await request<{ success: boolean; data: CanvasData }>(`${BASE}/canvas/${id}`);
  return res.data;
}

export async function saveCanvasData(id: string, data: CanvasData, options?: { allowEmpty?: boolean }): Promise<void> {
  const query = options?.allowEmpty ? '?allowEmpty=1' : '';
  await request(`${BASE}/canvas/${id}${query}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function autoSaveCanvasData(
  id: string,
  data: CanvasData,
): Promise<{ path?: string; nodeCount?: number; edgeCount?: number }> {
  const res = await request<{
    success: boolean;
    data: { path?: string; nodeCount?: number; edgeCount?: number };
  }>(`${BASE}/canvas/${id}/auto-save`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return res.data || {};
}

export async function deleteCanvas(id: string): Promise<void> {
  await request(`${BASE}/canvas/${id}`, { method: 'DELETE' });
}

export async function renameCanvas(id: string, name: string): Promise<CanvasListItem> {
  const res = await request<{ success: boolean; data: CanvasListItem }>(
    `${BASE}/canvas/${id}/name`,
    {
      method: 'PATCH',
      body: JSON.stringify({ name }),
    }
  );
  return res.data;
}

// ========== 设置(三套通用 Key + 分类 Key) ==========
export async function getSettings(): Promise<ApiSettings> {
  const res = await request<{ success: boolean; data: ApiSettings }>(`${BASE}/settings`);
  return res.data;
}

// 获取明文 Key（仅用于设置弹窗内眼睛预览，不脱敏）
export async function getRawSettings(): Promise<ApiSettings> {
  const res = await request<{ success: boolean; data: ApiSettings }>(`${BASE}/settings/raw`);
  return res.data;
}

export async function updateSettings(patch: Partial<ApiSettings>): Promise<void> {
  await request(`${BASE}/settings`, {
    method: 'POST',
    body: JSON.stringify(patch),
  });
}

// ========== 文件自动保存到本地路径 (v1.2.10.2) ==========
// 静默失败(后端不可用/路径不存在/写入床夫败等) —— 仅返回布尔, 不抛
// 以免阐业务外主生成链路(OutputNode 只负责 "心愿尝试保存")。
export async function saveAssetToDisk(
  url: string,
  filename?: string,
): Promise<{ ok: boolean; path?: string; exist?: boolean; error?: string }> {
  try {
    if (!url) return { ok: false, error: 'empty url' };
    const res = await fetch(`${BASE}/files/save-to-disk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, filename }),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.success) {
      return { ok: false, error: json?.error || `HTTP ${res.status}` };
    }
    return { ok: true, path: json?.data?.path, exist: !!json?.data?.exist };
  } catch (e: any) {
    return { ok: false, error: e?.message || String(e) };
  }
}

export interface DuckDecodeFileItem {
  sourceUrl: string;
  decoded: boolean;
  url?: string;
  filename?: string;
  size?: number;
  kind?: MediaKind;
  mime?: string;
  originalExt?: string;
  ext?: string;
  isDuck?: boolean;
  passwordProtected?: boolean;
  reason?: string;
}

export async function decodeDuckFiles(
  urls: string[],
): Promise<{ items: DuckDecodeFileItem[]; decodedCount: number }> {
  const res = await request<{
    success: boolean;
    data: { items: DuckDecodeFileItem[]; decodedCount: number };
  }>(`${BASE}/files/duck-decode`, {
    method: 'POST',
    body: JSON.stringify({ urls }),
  });
  return res.data || { items: [], decodedCount: 0 };
}

// ========== RH 工具节点 (v1.2.10+) ==========
//   与顶层控件区分：仅供 RHToolsNode 使用，与 RH 应用创意包数据完全分开。
//   后端走 T8 自己的 18766 服务。

export interface RHToolCategory {
  id: string;
  name: string;
  order: number;
  createdAt: number;
}

export interface RHTool {
  id: string;
  webappId: string;
  title: string;
  description: string;
  categoryId: string;
  coverUrl: string;
  order: number;
  addedAt: number;
}

export interface RHToolsBackup {
  schema?: 't8-rh-tools' | string;
  version?: number;
  exportedAt?: string;
  categories: RHToolCategory[];
  tools: RHTool[];
}

export interface AddRHToolPayload {
  webappId: string;
  title: string;
  description?: string;
  categoryId?: string;
  coverUrl?: string;
}

export type OkData<T> = { success: true; data: T };
export type ErrData = { success: false; error: string };
export type Result<T> = OkData<T> | ErrData;

async function safeRequest<T>(url: string, init?: RequestInit): Promise<Result<T>> {
  try {
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      ...init,
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return { success: false, error: json.error || `HTTP ${res.status}` };
    if (json && typeof json === 'object' && 'success' in json) return json as Result<T>;
    return { success: true, data: json as T };
  } catch (e: any) {
    return { success: false, error: e?.message || '网络错误' };
  }
}

// ----- 分类 -----
export function getRHToolCategories() {
  return safeRequest<RHToolCategory[]>(`${BASE}/settings/rh-tool-categories`);
}
export function addRHToolCategory(name: string) {
  return safeRequest<RHToolCategory>(`${BASE}/settings/rh-tool-categories`, {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
}
export function renameRHToolCategory(id: string, name: string) {
  return safeRequest<RHToolCategory>(`${BASE}/settings/rh-tool-categories/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify({ name }),
  });
}
export function deleteRHToolCategory(id: string) {
  return safeRequest<void>(`${BASE}/settings/rh-tool-categories/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}
export function reorderRHToolCategories(ids: string[]) {
  return safeRequest<RHToolCategory[]>(`${BASE}/settings/rh-tool-categories/reorder`, {
    method: 'POST',
    body: JSON.stringify({ ids }),
  });
}

// ----- 应用 -----
export function getRHTools() {
  return safeRequest<RHTool[]>(`${BASE}/settings/rh-tool-apps`);
}
export function addRHTool(payload: AddRHToolPayload) {
  return safeRequest<RHTool>(`${BASE}/settings/rh-tool-apps`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
export function updateRHTool(id: string, payload: Partial<AddRHToolPayload>) {
  return safeRequest<RHTool>(`${BASE}/settings/rh-tool-apps/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}
export function deleteRHTool(id: string) {
  return safeRequest<void>(`${BASE}/settings/rh-tool-apps/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}
export function reorderRHTools(ids: string[]) {
  return safeRequest<RHTool[]>(`${BASE}/settings/rh-tool-apps/reorder`, {
    method: 'POST',
    body: JSON.stringify({ ids }),
  });
}
export function getRHToolsBackup() {
  return safeRequest<RHToolsBackup>(`${BASE}/settings/rh-tools/export`);
}
export function importRHToolsBackup(payload: RHToolsBackup, mode: 'replace' | 'merge' = 'replace') {
  return safeRequest<{ categories: RHToolCategory[]; tools: RHTool[]; categoryCount: number; toolCount: number }>(
    `${BASE}/settings/rh-tools/import`,
    {
      method: 'POST',
      body: JSON.stringify({ ...payload, mode }),
    }
  );
}

// ========== 资源库 (v1.3.4) ==========
export type ResourceKind = 'image' | 'video' | 'audio' | 'set' | 'pose';
export type ResourceMediaKind = 'image' | 'video' | 'audio';
export type ResourceMaterialSetKind = 'text' | 'image' | 'video' | 'audio';

export interface ResourceCategory {
  id: string;
  kind: ResourceKind;
  name: string;
  order: number;
  system?: boolean;
  createdAt: number;
}

export interface ResourceItem {
  id: string;
  kind: ResourceKind;
  categoryId: string;
  title: string;
  originalName?: string;
  fileUrl: string;
  thumbUrl?: string;
  mime?: string;
  size: number;
  sha256?: string;
  tags: string[];
  favorite: boolean;
  sourceUrl?: string;
  sourceNodeId?: string;
  sourceCanvasId?: string;
  materialSetKind?: ResourceMaterialSetKind;
  materialSetItems?: Array<{
    id: string;
    kind: ResourceMaterialSetKind;
    url?: string;
    text?: string;
    name?: string;
    size?: number;
    mime?: string;
  }>;
  createdAt: number;
  updatedAt: number;
  lastUsedAt?: number;
}

export interface AddResourceSetPayload {
  materialSetKind: ResourceMaterialSetKind;
  materialSetItems: Array<{
    id?: string;
    kind: ResourceMaterialSetKind;
    url?: string;
    text?: string;
    name?: string;
    size?: number;
    mime?: string;
  }>;
  categoryId?: string;
  title?: string;
  tags?: string[];
  sourceNodeId?: string;
  sourceCanvasId?: string;
  favorite?: boolean;
}

export interface AddResourcePayload {
  url: string;
  kind: ResourceMediaKind;
  categoryId?: string;
  title?: string;
  tags?: string[];
  sourceNodeId?: string;
  sourceCanvasId?: string;
  favorite?: boolean;
}

export interface AddResourcePosePayload {
  poseBackup: Record<string, any>;
  categoryId?: string;
  title?: string;
  tags?: string[];
  sourceNodeId?: string;
  sourceCanvasId?: string;
  favorite?: boolean;
}

export function getResourceCategories(kind?: ResourceKind) {
  const q = kind ? `?kind=${encodeURIComponent(kind)}` : '';
  return safeRequest<ResourceCategory[]>(`${BASE}/resources/categories${q}`);
}

export function addResourceCategory(kind: ResourceKind, name: string) {
  return safeRequest<ResourceCategory>(`${BASE}/resources/categories`, {
    method: 'POST',
    body: JSON.stringify({ kind, name }),
  });
}

export function renameResourceCategory(id: string, name: string) {
  return safeRequest<ResourceCategory>(`${BASE}/resources/categories/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify({ name }),
  });
}

export function deleteResourceCategory(id: string) {
  return safeRequest<{ movedTo: string }>(`${BASE}/resources/categories/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export function getResourceItems(params: {
  kind?: ResourceKind;
  categoryId?: string;
  q?: string;
  favorite?: boolean;
} = {}) {
  const sp = new URLSearchParams();
  if (params.kind) sp.set('kind', params.kind);
  if (params.categoryId) sp.set('categoryId', params.categoryId);
  if (params.q) sp.set('q', params.q);
  if (params.favorite) sp.set('favorite', '1');
  const qs = sp.toString();
  return safeRequest<ResourceItem[]>(`${BASE}/resources/items${qs ? `?${qs}` : ''}`);
}

export function addResourceItem(payload: AddResourcePayload) {
  return safeRequest<ResourceItem & { duplicate?: boolean }>(`${BASE}/resources/items/add`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function addResourceSet(payload: AddResourceSetPayload) {
  return safeRequest<ResourceItem & { duplicate?: boolean }>(`${BASE}/resources/sets/add`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function addResourcePose(payload: AddResourcePosePayload) {
  return safeRequest<ResourceItem & { duplicate?: boolean }>(`${BASE}/resources/poses/add`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateResourceItem(id: string, patch: Partial<Pick<ResourceItem, 'title' | 'categoryId' | 'tags' | 'favorite'>> & { touch?: boolean }) {
  return safeRequest<ResourceItem>(`${BASE}/resources/items/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(patch),
  });
}

export function deleteResourceItem(id: string) {
  return safeRequest<void>(`${BASE}/resources/items/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

// ========== Eagle 本地库 ==========
export interface EagleImportMaterial {
  id?: string;
  kind: ResourceMaterialSetKind;
  url?: string;
  text?: string;
  name?: string;
  tags?: string[];
}

export interface EagleImportResult {
  base: string;
  imported: Array<{ kind: string; name: string; result?: any }>;
  skipped: Array<{ kind: string; name: string; reason: string }>;
  failures: Array<{ kind: string; name: string; error: string }>;
}

export function sendToEagle(payload: {
  materials: EagleImportMaterial[];
  tags?: string[];
  folderId?: string;
  eagleApiBase?: string;
}) {
  return safeRequest<EagleImportResult>(`${BASE}/eagle/import`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

// ========== 主题模板 (v1.3.6) ==========

export interface ThemeTemplatesResponse {
  path: string;
  templates: ThemeTemplate[];
}

export function getThemeTemplates() {
  return safeRequest<ThemeTemplatesResponse>(`${BASE}/themes/templates`);
}

export function importThemeTemplate(template: ThemeTemplate) {
  return safeRequest<ThemeTemplate>(`${BASE}/themes/templates/import`, {
    method: 'POST',
    body: JSON.stringify({ template }),
  });
}

export function saveThemeTemplate(template: ThemeTemplate) {
  return safeRequest<ThemeTemplate>(`${BASE}/themes/templates/${encodeURIComponent(template.id)}`, {
    method: 'PUT',
    body: JSON.stringify(template),
  });
}

export function exportThemeTemplate(id: string) {
  return safeRequest<ThemeTemplate>(`${BASE}/themes/templates/${encodeURIComponent(id)}/export`);
}

export function deleteThemeTemplate(id: string) {
  return safeRequest<void>(`${BASE}/themes/templates/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

// ========== 算力充值 ==========

export interface RechargeConfig {
  website_url: string;
  agent_base_url: string;
  configured: boolean;
  device_id: string;
}

export interface RechargeBinding {
  bound: boolean;
  website_user_id?: number;
  bind_time?: string;
}

export interface RechargePlan {
  id: string;
  power: number;
  price: number;
  quota: number;
  name: string;
  test?: boolean;
}

export type RechargeOrderStatus = 'pending' | 'transferring' | 'success' | 'transfer_failed';

export interface RechargeOrder {
  order_id: string;
  website_user_id: number;
  plan_id: string;
  plan_name: string;
  power: number;
  amount: number;
  quota: number;
  pay_type: 'alipay' | 'wxpay';
  status: RechargeOrderStatus;
  pay_url?: string;
  trade_no?: string;
  create_time?: string;
  pay_time?: string;
  transfer_message?: string;
}

export interface RechargeOrderCreateResponse {
  success: boolean;
  order_id: string;
  pay_url: string;
  amount: number;
  power: number;
  quota: number;
  plan_name: string;
  pay_type: 'alipay' | 'wxpay';
}

export interface RechargeOrderCheckResponse {
  success: boolean;
  status: RechargeOrderStatus;
  order_id: string;
  plan_name: string;
  amount: number;
  quota: number;
  power?: number;
  pay_url?: string;
  pay_time?: string;
  transfer_message?: string;
}

export function getRechargeConfig() {
  return request<RechargeConfig>(`${BASE}/recharge/config`);
}

export function getRechargeBinding() {
  return request<RechargeBinding>(`${BASE}/recharge/binding`);
}

export function bindRechargeUser(websiteUserId: number) {
  return request<{ success: boolean; website_user_id: number }>(`${BASE}/recharge/binding`, {
    method: 'POST',
    body: JSON.stringify({ website_user_id: websiteUserId }),
  });
}

export function unbindRechargeUser() {
  return request<{ success: boolean }>(`${BASE}/recharge/binding`, { method: 'DELETE' });
}

export function getRechargePlans() {
  return request<RechargePlan[]>(`${BASE}/recharge/plans`);
}

export function createRechargeOrder(planId: string, payType: 'alipay' | 'wxpay') {
  return request<RechargeOrderCreateResponse>(`${BASE}/recharge/order/create`, {
    method: 'POST',
    body: JSON.stringify({ plan_id: planId, pay_type: payType }),
  });
}

export function checkRechargeOrder(orderId: string) {
  return request<RechargeOrderCheckResponse>(`${BASE}/recharge/order/${encodeURIComponent(orderId)}/check`);
}

export function retryRechargeOrder(orderId: string) {
  return request<RechargeOrderCheckResponse>(`${BASE}/recharge/order/${encodeURIComponent(orderId)}/retry`, {
    method: 'POST',
  });
}

export function getRechargeOrders(limit = 20) {
  return request<RechargeOrder[]>(`${BASE}/recharge/orders?limit=${encodeURIComponent(String(limit))}`);
}
