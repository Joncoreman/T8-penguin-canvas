/**
 * 图像变换 service - /api/image/*
 */
import type { GridComposeRequest } from '../utils/gridEditor';

async function postOp<T = any>(path: string, body: any): Promise<T> {
  const r = await fetch(`/api/image/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await r.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    const isHtml = /^\s*</.test(text || '');
    throw new Error(isHtml ? '图像处理接口未就绪，请重启后端服务后重试' : `接口返回异常: ${text.slice(0, 120)}`);
  }
  if (!r.ok || !data.success) throw new Error(data?.error || `HTTP ${r.status}`);
  return data.data;
}

export const opResize = (imageUrl: string, width?: number, height?: number, fit?: string) =>
  postOp<{ imageUrl: string }>('resize', { imageUrl, width, height, fit });

export const opUpscale = (imageUrl: string, scale: number) =>
  postOp<{ imageUrl: string; scale: number }>('upscale', { imageUrl, scale });

/**
 * 单矩形裁剪
 * @param imageUrl 原图 URL
 * @param x natural 像素 起点 X
 * @param y natural 像素 起点 Y
 * @param w natural 像素 宽
 * @param h natural 像素 高
 */
export const opCrop = (
  imageUrl: string,
  x: number,
  y: number,
  w: number,
  h: number,
) => postOp<{ imageUrl: string }>('crop', { imageUrl, x, y, w, h });

/**
 * 宫格切分
 * - 等分模式: 传 rows/cols/gap
 * - 自定义模式: 传 rectsPx (外部已计算好的 natural 像素矩形)
 */
export const opGridCrop = (
  imageUrl: string,
  rows: number,
  cols: number,
  gap?: number,
  rectsPx?: Array<{ x: number; y: number; w: number; h: number; row?: number; col?: number }>,
  options?: {
    orderMode?: 'row' | 'column' | 'snake' | 'reverse';
    exportIndexes?: number[] | string;
  },
) =>
  postOp<{
    urls: string[];
    rows: number;
    cols: number;
    gap: number;
    orderMode?: string;
    exportIndexes?: number[];
    totalTiles?: number;
    layout: { rows: number; cols: number; gap: number; orderMode?: string };
  }>(
    'grid-crop',
    { imageUrl, rows, cols, gap, rectsPx, ...(options || {}) },
  );

export const opGridCompose = (request: GridComposeRequest) =>
  postOp<{
    imageUrl: string;
    rows: number;
    cols: number;
    width: number;
    height: number;
    gap: number;
  }>('grid-compose', request);

export const opCombine = (imageUrls: string[], direction: 'horizontal' | 'vertical') =>
  postOp<{ imageUrl: string }>('combine', { imageUrls, direction });

export const opCompare = (
  imageAUrl: string,
  imageBUrl: string,
  mode: 'slider' | 'side-by-side' | 'overlay' | 'blink' | 'heatmap' | 'focus',
  options?: {
    align?: 'contain' | 'cover' | 'fill';
    split?: number;
    opacity?: number;
    threshold?: number;
  },
) =>
  postOp<{
    imageUrl: string;
    metrics: {
      width: number;
      height: number;
      imageA: { width: number; height: number };
      imageB: { width: number; height: number };
      meanDiff: number;
      maxDiff: number;
      changedRatio: number;
      threshold: number;
    };
  }>('compare', { imageAUrl, imageBUrl, mode, ...(options || {}) });

export const opRemoveBg = (imageUrl: string) =>
  postOp<{ imageUrl: string; warning?: string }>('remove-bg', { imageUrl });

/**
 * 将 dataURL (base64) 上传到后端 → 返回本地 url (/files/output/xxx)
 * 用于：图像编辑器 mask / brush 模式产物落地
 */
export async function uploadDataUrl(dataUrl: string, prefix: string = 'edit'): Promise<string> {
  const r = await fetch('/api/files/upload-base64', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dataUrl, prefix }),
  });
  const json = await r.json();
  if (!r.ok || !json.success) throw new Error(json?.error || `HTTP ${r.status}`);
  return json.data.url as string;
}

/**
 * 将 File / Blob 上传 (multipart) → 返回本地 url
 * 用于：图像编辑器 compose 模式 拖入文件 / Ctrl+V 粘贴文件 作为新图层
 */
export async function uploadFileBlob(file: File | Blob, filename?: string): Promise<string> {
  const fd = new FormData();
  const fname = filename || (file instanceof File ? file.name : `compose-${Date.now()}.png`);
  fd.append('file', file, fname);
  const r = await fetch('/api/files/upload', { method: 'POST', body: fd });
  const json = await r.json();
  if (!r.ok || !json.success) throw new Error(json?.error || `HTTP ${r.status}`);
  return json.data.url as string;
}
