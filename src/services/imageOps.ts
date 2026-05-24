/**
 * 图像变换 service - /api/image/*
 */
async function postOp<T = any>(path: string, body: any): Promise<T> {
  const r = await fetch(`/api/image/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await r.json();
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
) =>
  postOp<{ urls: string[]; rows: number; cols: number; gap: number; layout: { rows: number; cols: number; gap: number } }>(
    'grid-crop',
    { imageUrl, rows, cols, gap, rectsPx },
  );

export const opCombine = (imageUrls: string[], direction: 'horizontal' | 'vertical') =>
  postOp<{ imageUrl: string }>('combine', { imageUrls, direction });

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
