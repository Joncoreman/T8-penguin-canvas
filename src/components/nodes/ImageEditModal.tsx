import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Crop as CropIcon,
  Grid3x3,
  RotateCcw,
  X,
  Plus,
  Minus,
  Eraser,
  Undo2,
  Redo2,
  Check,
  Loader2,
  Brush,
  Paintbrush,
  Square as SquareIcon,
  Circle as CircleIcon,
  ListOrdered,
  Layers as LayersIcon,
  Lock as LockIcon,
  Unlock as UnlockIcon,
  Eye as EyeIcon,
  EyeOff as EyeOffIcon,
  ArrowUp,
  ArrowDown,
  ChevronsUp,
  ChevronsDown,
  Copy as CopyIcon,
  Trash2,
  FlipHorizontal2,
  FlipVertical2,
  Image as ImageIconLucide,
  RotateCw,
} from 'lucide-react';
import { useThemeStore } from '../../stores/theme';
import { opCrop, opGridCrop, uploadDataUrl, uploadFileBlob } from '../../services/imageOps';

/**
 * ImageEditModal
 *  OutputNode 中图片双击后弹出, 支持:
 *    - 裁剪 (crop): 拖动 crop-box + 4 角缩放
 *    - 宫格切分 (grid):
 *        预设: rows/cols 等分 + gap (像素间隔)
 *        自定义: 拖入横线/纵线, 拖动调整, 撤销/清空
 *
 *  产物不修改原素材, 全部以独立 OutputNode 形式落到右侧 (由 onProduce 回调处理)。
 *  双主题适配: 科技风 (深底+青色 accent) / 像素风 (白底+黑边+8-bit)
 */

export type ImageEditProduceMeta =
  | { type: 'crop'; rect: { x: number; y: number; w: number; h: number } }
  | {
      type: 'grid-split';
      layout: { rows: number; cols: number; gap: number };
      rects: Array<{ x: number; y: number; w: number; h: number; row: number; col: number }>;
    }
  | { type: 'mask'; strokeCount: number }
  | { type: 'brush'; strokeCount: number }
  | { type: 'compose'; layerCount: number; canvasW: number; canvasH: number };

interface Props {
  srcUrl: string;
  onClose: () => void;
  /** 产物 urls 注入到外部 (在 OutputNode 中创建 N 个新 OutputNode) */
  onProduce: (urls: string[], meta: ImageEditProduceMeta) => void;
}

type EditMode = 'crop' | 'mask' | 'brush' | 'grid' | 'compose';
type GridSubMode = 'preset' | 'custom';
type BrushTool = 'free' | 'rect' | 'ellipse' | 'label';

// ---- compose v2 图层类型 ----
interface ImageLayer {
  id: string;
  kind: 'image';
  name: string;
  src: string;
  /** 画布 px 坐标 (不用 fraction) */
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number; // 度
  flipX: boolean;
  flipY: boolean;
  opacity: number; // 0..1
  visible: boolean;
  locked: boolean;
}
type Layer = ImageLayer;

interface Pt {
  x: number; // 0..1 fraction of natural size
  y: number;
}
interface FRect {
  x: number;
  y: number;
  w: number;
  h: number;
}
/** 矢量化一笔画/一个图形 (fraction 坐标, 跨渲染不失真) */
type DrawStroke =
  | { kind: 'mask-stroke'; size: number; points: Pt[] }
  | { kind: 'mask-erase'; size: number; points: Pt[] }
  | { kind: 'brush-free'; color: string; size: number; points: Pt[] }
  | { kind: 'brush-rect'; color: string; size: number; rect: FRect }
  | { kind: 'brush-ellipse'; color: string; size: number; rect: FRect }
  | { kind: 'brush-label'; color: string; size: number; pos: Pt; text: string };

interface Line {
  type: 'h' | 'v';
  pos: number; // 0..1 fraction of natural size
}
interface CropBox {
  x: number; // 0..1
  y: number;
  w: number;
  h: number;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const EDIT_STAGE_PADDING = 32;
const EDIT_STAGE_MIN_PREVIEW = 180;

// 计算切割矩形 (natural 像素), 兼容 等分 / 自定义 两个模式
function computeRects(
  W: number,
  H: number,
  rows: number,
  cols: number,
  gap: number,
  customLines: Line[] | null,
): Array<{ x: number; y: number; w: number; h: number; row: number; col: number }> {
  const halfGap = gap / 2;
  if (customLines && customLines.length > 0) {
    const rawH = [...new Set(customLines.filter((l) => l.type === 'h').map((l) => l.pos * H))].sort(
      (a, b) => a - b,
    );
    const rawV = [...new Set(customLines.filter((l) => l.type === 'v').map((l) => l.pos * W))].sort(
      (a, b) => a - b,
    );
    const hCuts = [0, ...rawH, H];
    const vCuts = [0, ...rawV, W];
    const rects: Array<{ x: number; y: number; w: number; h: number; row: number; col: number }> = [];
    for (let row = 0; row < hCuts.length - 1; row++) {
      for (let col = 0; col < vCuts.length - 1; col++) {
        const y1 = Math.round(row === 0 ? hCuts[row] : hCuts[row] + halfGap);
        const y2 = Math.round(
          row === hCuts.length - 2 ? hCuts[row + 1] : hCuts[row + 1] - halfGap,
        );
        const x1 = Math.round(col === 0 ? vCuts[col] : vCuts[col] + halfGap);
        const x2 = Math.round(
          col === vCuts.length - 2 ? vCuts[col + 1] : vCuts[col + 1] - halfGap,
        );
        if (x2 > x1 && y2 > y1) {
          rects.push({ row, col, x: x1, y: y1, w: x2 - x1, h: y2 - y1 });
        }
      }
    }
    return rects;
  }
  // 等分
  const rects: Array<{ x: number; y: number; w: number; h: number; row: number; col: number }> = [];
  for (let row = 0; row < rows; row++) {
    const topLine = (row * H) / rows;
    const bottomLine = ((row + 1) * H) / rows;
    const y1 = Math.round(row === 0 ? 0 : topLine + halfGap);
    const y2 = Math.round(row === rows - 1 ? H : bottomLine - halfGap);
    for (let col = 0; col < cols; col++) {
      const leftLine = (col * W) / cols;
      const rightLine = ((col + 1) * W) / cols;
      const x1 = Math.round(col === 0 ? 0 : leftLine + halfGap);
      const x2 = Math.round(col === cols - 1 ? W : rightLine - halfGap);
      if (x2 > x1 && y2 > y1) rects.push({ row, col, x: x1, y: y1, w: x2 - x1, h: y2 - y1 });
    }
  }
  return rects;
}

const ImageEditModal = ({ srcUrl, onClose, onProduce }: Props) => {
  const { theme, style } = useThemeStore();
  const isDark = theme === 'dark';
  const isPixel = style === 'pixel';

  const [mode, setMode] = useState<EditMode>('crop');
  const [gridMode, setGridMode] = useState<GridSubMode>('preset');
  const [crop, setCrop] = useState<CropBox>({ x: 0.1, y: 0.1, w: 0.8, h: 0.8 });
  const [rows, setRows] = useState(3);
  const [cols, setCols] = useState(3);
  const [gap, setGap] = useState(0);
  const [orient, setOrient] = useState<'h' | 'v'>('h');
  const [customLines, setCustomLines] = useState<Line[]>([]);
  const [history, setHistory] = useState<Line[][]>([]);
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  // ---- mask / brush ----
  const [maskStrokes, setMaskStrokes] = useState<DrawStroke[]>([]);
  const [maskHistory, setMaskHistory] = useState<DrawStroke[][]>([]);
  const [maskRedo, setMaskRedo] = useState<DrawStroke[][]>([]);
  const [brushStrokes, setBrushStrokes] = useState<DrawStroke[]>([]);
  const [brushHistory, setBrushHistory] = useState<DrawStroke[][]>([]);
  const [brushRedo, setBrushRedo] = useState<DrawStroke[][]>([]);
  const [maskBrushSize, setMaskBrushSize] = useState(42); // 0..1 不使用 —— 存 px @ natural
  const [maskErasing, setMaskErasing] = useState(false);
  const [brushTool, setBrushTool] = useState<BrushTool>('free');
  const [brushColor, setBrushColor] = useState('#ff2d55');
  const [brushSize, setBrushSize] = useState(14);
  const [labelCounter, setLabelCounter] = useState(1);
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);

  // ---- compose v2 ----
  const [composeLayers, setComposeLayers] = useState<Layer[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [canvasW, setCanvasW] = useState(1024);
  const [canvasH, setCanvasH] = useState(1024);
  const [composeInited, setComposeInited] = useState(false);
  const [composeHistory, setComposeHistory] = useState<
    Array<{ layers: Layer[]; selectedIds: string[]; canvasW: number; canvasH: number }>
  >([]);
  const [composeFuture, setComposeFuture] = useState<
    Array<{ layers: Layer[]; selectedIds: string[]; canvasW: number; canvasH: number }>
  >([]);
  const [composeStageBox, setComposeStageBox] = useState({ w: 800, h: 500 });
  const composeStageRef = useRef<HTMLDivElement | null>(null);
  const composeFileInputRef = useRef<HTMLInputElement | null>(null);
  const composeFitRef = useRef<{ scale: number; offsetX: number; offsetY: number }>({
    scale: 1,
    offsetX: 0,
    offsetY: 0,
  });
  const composeDragRef = useRef<{
    pointerId: number;
    startCx: number;
    startCy: number;
    op: 'move' | 'scale' | 'rotate';
    handle?: 'tl' | 'tr' | 'bl' | 'br';
    startLayers: Map<string, ImageLayer>;
    activeId: string;
    centerX?: number;
    centerY?: number;
    startAngle?: number;
    shift?: boolean;
    alt?: boolean;
  } | null>(null);

  const stageRef = useRef<HTMLDivElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [imageStageBox, setImageStageBox] = useState({ w: 0, h: 0 });
  const drawCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawDragRef = useRef<{
    pointerId: number;
    startPt: Pt;
    pending: DrawStroke | null;
  } | null>(null);

  const setGridGap = useCallback((value: number) => {
    setGap(clamp(Math.round(Number.isFinite(value) ? value : 0), 0, 240));
  }, []);

  // ---- 撤销/恢复辅助 (mask/brush 各自一栈) ----
  const pushHistory = useCallback(
    (m: EditMode) => {
      if (m === 'mask') {
        setMaskHistory((h) => [...h, maskStrokes].slice(-50));
        setMaskRedo([]);
      } else if (m === 'brush') {
        setBrushHistory((h) => [...h, brushStrokes].slice(-50));
        setBrushRedo([]);
      }
    },
    [maskStrokes, brushStrokes],
  );
  const undo = useCallback(() => {
    if (mode === 'mask') {
      setMaskHistory((h) => {
        if (!h.length) return h;
        const prev = h[h.length - 1];
        setMaskRedo((r) => [...r, maskStrokes]);
        setMaskStrokes(prev);
        return h.slice(0, -1);
      });
    } else if (mode === 'brush') {
      setBrushHistory((h) => {
        if (!h.length) return h;
        const prev = h[h.length - 1];
        setBrushRedo((r) => [...r, brushStrokes]);
        setBrushStrokes(prev);
        return h.slice(0, -1);
      });
    }
  }, [mode, maskStrokes, brushStrokes]);
  const redo = useCallback(() => {
    if (mode === 'mask') {
      setMaskRedo((r) => {
        if (!r.length) return r;
        const next = r[r.length - 1];
        setMaskHistory((h) => [...h, maskStrokes].slice(-50));
        setMaskStrokes(next);
        return r.slice(0, -1);
      });
    } else if (mode === 'brush') {
      setBrushRedo((r) => {
        if (!r.length) return r;
        const next = r[r.length - 1];
        setBrushHistory((h) => [...h, brushStrokes].slice(-50));
        setBrushStrokes(next);
        return r.slice(0, -1);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, maskStrokes, brushStrokes]);

  const clearCurrent = () => {
    if (mode === 'mask') {
      pushHistory('mask');
      setMaskStrokes([]);
    } else if (mode === 'brush') {
      pushHistory('brush');
      setBrushStrokes([]);
      setLabelCounter(1);
    }
  };

  // ESC 关闭 + Ctrl+Z/Y 撤销恢复 + 1/2/3/4 切换 mode + [/] 调笔刷
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      // 避免 input/textarea 输入时拦截
      const tag = (e.target as HTMLElement | null)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea') return;
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        undo();
        return;
      }
      if (
        ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'z') ||
        ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y')
      ) {
        e.preventDefault();
        redo();
        return;
      }
      if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        if (e.key === '1') setMode('crop');
        else if (e.key === '2') setMode('mask');
        else if (e.key === '3') setMode('brush');
        else if (e.key === '4') setMode('grid');
        else if (e.key === '5') setMode('compose');
        else if (e.key === '[') {
          if (mode === 'mask') setMaskBrushSize((s) => Math.max(2, s - 4));
          else if (mode === 'brush') setBrushSize((s) => Math.max(2, s - 2));
        } else if (e.key === ']') {
          if (mode === 'mask') setMaskBrushSize((s) => Math.min(300, s + 4));
          else if (mode === 'brush') setBrushSize((s) => Math.min(160, s + 2));
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onClose, undo, redo, mode]);

  // 主题样式 token
  const accent = isPixel ? '#C73B6B' : '#22d3ee';
  const modalBg = isPixel ? '#FFFBF0' : isDark ? 'rgb(20,20,22)' : '#fff';
  const modalBorder = isPixel
    ? '2px solid #1A1410'
    : isDark
    ? '1px solid rgba(255,255,255,.15)'
    : '1px solid rgba(0,0,0,.12)';
  const modalRadius = isPixel ? 0 : 14;
  const modalShadow = isPixel ? '6px 6px 0 #1A1410' : '0 20px 50px rgba(0,0,0,.35)';
  const textColor = isPixel ? '#1A1410' : isDark ? '#fff' : '#111';
  const subText = isPixel ? '#5A4A3F' : isDark ? 'rgba(255,255,255,.5)' : 'rgba(0,0,0,.5)';
  const inputBg = isPixel ? '#fff' : isDark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.04)';
  const handleRadius = isPixel ? 0 : 999;

  // ---- crop-box 拖拽 ----
  const dragRef = useRef<{
    mode: 'move' | 'tl' | 'tr' | 'bl' | 'br';
    startX: number;
    startY: number;
    startCrop: CropBox;
    rect: DOMRect;
  } | null>(null);

  const startCropDrag = (e: React.PointerEvent, m: 'move' | 'tl' | 'tr' | 'bl' | 'br') => {
    if (!imgRef.current) return;
    const rect = imgRef.current.getBoundingClientRect();
    dragRef.current = {
      mode: m,
      startX: e.clientX,
      startY: e.clientY,
      startCrop: { ...crop },
      rect,
    };
    (e.target as Element).setPointerCapture?.(e.pointerId);
    e.preventDefault();
    e.stopPropagation();
  };
  const moveCropDrag = (e: React.PointerEvent) => {
    const ctx = dragRef.current;
    if (!ctx) return;
    const dx = (e.clientX - ctx.startX) / ctx.rect.width;
    const dy = (e.clientY - ctx.startY) / ctx.rect.height;
    setCrop((c) => {
      let { x, y, w, h } = ctx.startCrop;
      if (ctx.mode === 'move') {
        x = clamp(x + dx, 0, 1 - w);
        y = clamp(y + dy, 0, 1 - h);
      } else if (ctx.mode === 'br') {
        w = clamp(ctx.startCrop.w + dx, 0.02, 1 - x);
        h = clamp(ctx.startCrop.h + dy, 0.02, 1 - y);
      } else if (ctx.mode === 'tr') {
        w = clamp(ctx.startCrop.w + dx, 0.02, 1 - x);
        const ny = clamp(ctx.startCrop.y + dy, 0, ctx.startCrop.y + ctx.startCrop.h - 0.02);
        h = ctx.startCrop.h - (ny - ctx.startCrop.y);
        y = ny;
      } else if (ctx.mode === 'bl') {
        const nx = clamp(ctx.startCrop.x + dx, 0, ctx.startCrop.x + ctx.startCrop.w - 0.02);
        w = ctx.startCrop.w - (nx - ctx.startCrop.x);
        x = nx;
        h = clamp(ctx.startCrop.h + dy, 0.02, 1 - y);
      } else if (ctx.mode === 'tl') {
        const nx = clamp(ctx.startCrop.x + dx, 0, ctx.startCrop.x + ctx.startCrop.w - 0.02);
        const ny = clamp(ctx.startCrop.y + dy, 0, ctx.startCrop.y + ctx.startCrop.h - 0.02);
        w = ctx.startCrop.w - (nx - ctx.startCrop.x);
        h = ctx.startCrop.h - (ny - ctx.startCrop.y);
        x = nx;
        y = ny;
      }
      return { x, y, w, h };
    });
  };
  const endCropDrag = () => {
    dragRef.current = null;
  };

  // ---- 自定义切线 ----
  const lineDragRef = useRef<{ index: number; pointerId: number } | null>(null);

  const lineHit = (fx: number, fy: number, W: number, H: number): number => {
    if (!customLines.length) return -1;
    // 阈值: max(8, min(W,H)/80) (像素), 转 fraction
    const thresholdPxV = Math.max(8, Math.min(W, H) / 80);
    let best = -1;
    let bestDist = Infinity;
    customLines.forEach((line, idx) => {
      const dist =
        line.type === 'h'
          ? Math.abs(fy - line.pos) * H
          : Math.abs(fx - line.pos) * W;
      if (dist < thresholdPxV && dist < bestDist) {
        best = idx;
        bestDist = dist;
      }
    });
    return best;
  };

  const onStagePointerDown = (e: React.PointerEvent) => {
    if (mode !== 'grid' || gridMode !== 'custom' || !imgRef.current) return;
    const rect = imgRef.current.getBoundingClientRect();
    const fx = clamp((e.clientX - rect.left) / rect.width, 0.001, 0.999);
    const fy = clamp((e.clientY - rect.top) / rect.height, 0.001, 0.999);
    if (!naturalSize) return;
    // 命中已有线 → 进入 drag
    const hit = lineHit(fx, fy, naturalSize.w, naturalSize.h);
    setHistory((h) => [...h, customLines.map((l) => ({ ...l }))]);
    if (hit >= 0) {
      lineDragRef.current = { index: hit, pointerId: e.pointerId };
      (e.target as Element).setPointerCapture?.(e.pointerId);
    } else {
      const newLine: Line = { type: orient, pos: orient === 'h' ? fy : fx };
      setCustomLines((arr) => {
        const next = [...arr, newLine];
        lineDragRef.current = { index: next.length - 1, pointerId: e.pointerId };
        return next;
      });
      (e.target as Element).setPointerCapture?.(e.pointerId);
    }
    e.preventDefault();
  };
  const onStagePointerMove = (e: React.PointerEvent) => {
    if (!imgRef.current) return;
    const ctx = lineDragRef.current;
    if (!ctx) return;
    const rect = imgRef.current.getBoundingClientRect();
    const fx = clamp((e.clientX - rect.left) / rect.width, 0.001, 0.999);
    const fy = clamp((e.clientY - rect.top) / rect.height, 0.001, 0.999);
    setCustomLines((arr) =>
      arr.map((l, i) =>
        i === ctx.index ? { ...l, pos: l.type === 'h' ? fy : fx } : l,
      ),
    );
  };
  const onStagePointerUp = (e: React.PointerEvent) => {
    if (lineDragRef.current) {
      try {
        (e.target as Element).releasePointerCapture?.(lineDragRef.current.pointerId);
      } catch {}
      lineDragRef.current = null;
    }
  };

  const undoLine = () => {
    setHistory((h) => {
      if (!h.length) return h;
      const last = h[h.length - 1];
      setCustomLines(last);
      return h.slice(0, -1);
    });
  };
  const clearLines = () => {
    setHistory((h) => [...h, customLines.map((l) => ({ ...l }))]);
    setCustomLines([]);
  };

  const enterCustom = () => {
    setGridMode('custom');
    setHistory([]);
    setCustomLines([]);
  };
  const exitCustom = () => {
    setGridMode('preset');
    setCustomLines([]);
    setHistory([]);
  };

  // ---- 应用 ----
  async function applyCrop() {
    if (!naturalSize) return;
    setBusy(true);
    setErrMsg(null);
    try {
      const px = {
        x: Math.round(crop.x * naturalSize.w),
        y: Math.round(crop.y * naturalSize.h),
        w: Math.max(1, Math.round(crop.w * naturalSize.w)),
        h: Math.max(1, Math.round(crop.h * naturalSize.h)),
      };
      const { imageUrl } = await opCrop(srcUrl, px.x, px.y, px.w, px.h);
      onProduce([imageUrl], { type: 'crop', rect: px });
      onClose();
    } catch (e: any) {
      setErrMsg(e?.message || '裁剪失败');
    } finally {
      setBusy(false);
    }
  }
  async function applyGrid() {
    if (!naturalSize) return;
    setBusy(true);
    setErrMsg(null);
    try {
      const useCustom = gridMode === 'custom' && customLines.length > 0;
      const rects = computeRects(
        naturalSize.w,
        naturalSize.h,
        rows,
        cols,
        gap,
        useCustom ? customLines : null,
      );
      if (rects.length === 0) {
        setErrMsg('无有效切割矩形');
        setBusy(false);
        return;
      }
      const { urls, layout } = await opGridCrop(
        srcUrl,
        useCustom ? Math.max(1, ...rects.map((r) => r.row + 1)) : rows,
        useCustom ? Math.max(1, ...rects.map((r) => r.col + 1)) : cols,
        gap,
        rects,
      );
      onProduce(urls, { type: 'grid-split', layout, rects });
      onClose();
    } catch (e: any) {
      setErrMsg(e?.message || '宫格切分失败');
    } finally {
      setBusy(false);
    }
  }

  // ==================== compose v2: 图层组合 ====================
  const pushComposeHistory = useCallback(() => {
    setComposeHistory((h) =>
      [...h, { layers: composeLayers, selectedIds, canvasW, canvasH }].slice(-50),
    );
    setComposeFuture([]);
  }, [composeLayers, selectedIds, canvasW, canvasH]);

  const composeUndo = useCallback(() => {
    setComposeHistory((h) => {
      if (!h.length) return h;
      const prev = h[h.length - 1];
      setComposeFuture((f) =>
        [...f, { layers: composeLayers, selectedIds, canvasW, canvasH }].slice(-50),
      );
      setComposeLayers(prev.layers);
      setSelectedIds(prev.selectedIds);
      setCanvasW(prev.canvasW);
      setCanvasH(prev.canvasH);
      return h.slice(0, -1);
    });
  }, [composeLayers, selectedIds, canvasW, canvasH]);

  const composeRedo = useCallback(() => {
    setComposeFuture((f) => {
      if (!f.length) return f;
      const next = f[f.length - 1];
      setComposeHistory((h) =>
        [...h, { layers: composeLayers, selectedIds, canvasW, canvasH }].slice(-50),
      );
      setComposeLayers(next.layers);
      setSelectedIds(next.selectedIds);
      setCanvasW(next.canvasW);
      setCanvasH(next.canvasH);
      return f.slice(0, -1);
    });
  }, [composeLayers, selectedIds, canvasW, canvasH]);

  const genLayerId = () => `L${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

  const addImageLayerFromUrl = useCallback(
    async (url: string, name?: string) => {
      try {
        const im = await loadImage(url);
        const W = im.naturalWidth;
        const H = im.naturalHeight;
        // 默认放在画布中央，最大不超过画布 70%
        const fit = Math.min(1, (canvasW * 0.7) / W, (canvasH * 0.7) / H);
        const w = Math.round(W * fit);
        const h = Math.round(H * fit);
        const layer: ImageLayer = {
          id: genLayerId(),
          kind: 'image',
          name: name || `图层 ${composeLayers.length + 1}`,
          src: url,
          x: Math.round((canvasW - w) / 2),
          y: Math.round((canvasH - h) / 2),
          w,
          h,
          rotation: 0,
          flipX: false,
          flipY: false,
          opacity: 1,
          visible: true,
          locked: false,
        };
        pushComposeHistory();
        setComposeLayers((arr) => [...arr, layer]);
        setSelectedIds([layer.id]);
      } catch (e: any) {
        setErrMsg(e?.message || '加载图像失败');
      }
    },
    [canvasW, canvasH, composeLayers.length, pushComposeHistory],
  );

  const addImageLayerFromFile = useCallback(
    async (file: File | Blob, filename?: string) => {
      try {
        const url = await uploadFileBlob(file, filename);
        await addImageLayerFromUrl(url, filename);
      } catch (e: any) {
        setErrMsg(e?.message || '上传失败');
      }
    },
    [addImageLayerFromUrl],
  );

  const moveLayer = (id: string, delta: number) => {
    pushComposeHistory();
    setComposeLayers((arr) => {
      const idx = arr.findIndex((l) => l.id === id);
      if (idx < 0) return arr;
      const next = [...arr];
      const target = next.splice(idx, 1)[0];
      const ni = Math.max(0, Math.min(next.length, idx + delta));
      next.splice(ni, 0, target);
      return next;
    });
  };
  const moveLayerToTop = (id: string) => {
    pushComposeHistory();
    setComposeLayers((arr) => {
      const idx = arr.findIndex((l) => l.id === id);
      if (idx < 0) return arr;
      const next = [...arr];
      const target = next.splice(idx, 1)[0];
      next.push(target);
      return next;
    });
  };
  const moveLayerToBottom = (id: string) => {
    pushComposeHistory();
    setComposeLayers((arr) => {
      const idx = arr.findIndex((l) => l.id === id);
      if (idx < 0) return arr;
      const next = [...arr];
      const target = next.splice(idx, 1)[0];
      next.unshift(target);
      return next;
    });
  };
  const removeLayerById = (id: string) => {
    pushComposeHistory();
    setComposeLayers((arr) => arr.filter((l) => l.id !== id));
    setSelectedIds((s) => s.filter((x) => x !== id));
  };
  const duplicateLayer = (id: string) => {
    pushComposeHistory();
    setComposeLayers((arr) => {
      const idx = arr.findIndex((l) => l.id === id);
      if (idx < 0) return arr;
      const src = arr[idx];
      const copy: ImageLayer = {
        ...src,
        id: genLayerId(),
        name: src.name + ' 副本',
        x: src.x + 16,
        y: src.y + 16,
      };
      const next = [...arr];
      next.splice(idx + 1, 0, copy);
      setSelectedIds([copy.id]);
      return next;
    });
  };
  const updateLayer = (id: string, patch: Partial<ImageLayer>) => {
    setComposeLayers((arr) =>
      arr.map((l) => (l.id === id ? ({ ...l, ...patch } as ImageLayer) : l)),
    );
  };

  // 应用 compose: 离屏 canvas 渲染 → toDataURL → uploadDataUrl → onProduce
  async function applyCompose() {
    if (composeLayers.length === 0) {
      setErrMsg('请先添加图层');
      return;
    }
    setBusy(true);
    setErrMsg(null);
    try {
      const cv = document.createElement('canvas');
      cv.width = canvasW;
      cv.height = canvasH;
      const ctx = cv.getContext('2d');
      if (!ctx) throw new Error('canvas 不可用');
      // 透明底 (不填任何颜色)
      ctx.clearRect(0, 0, canvasW, canvasH);
      // 累加画每个可见图层
      for (const layer of composeLayers) {
        if (!layer.visible) continue;
        const im = await loadImage(layer.src);
        ctx.save();
        ctx.globalAlpha = layer.opacity;
        const cx = layer.x + layer.w / 2;
        const cy = layer.y + layer.h / 2;
        ctx.translate(cx, cy);
        if (layer.rotation) ctx.rotate((layer.rotation * Math.PI) / 180);
        ctx.scale(layer.flipX ? -1 : 1, layer.flipY ? -1 : 1);
        ctx.drawImage(im, -layer.w / 2, -layer.h / 2, layer.w, layer.h);
        ctx.restore();
      }
      const dataUrl = cv.toDataURL('image/png');
      const url = await uploadDataUrl(dataUrl, 'compose');
      onProduce([url], {
        type: 'compose',
        layerCount: composeLayers.length,
        canvasW,
        canvasH,
      });
      onClose();
    } catch (e: any) {
      setErrMsg(e?.message || '应用图层组合失败');
    } finally {
      setBusy(false);
    }
  }

  // ---- compose 底图初始化: 双击进来的 srcUrl 作为图层 #0 (并以其原图尺寸作为画布默认) ----
  useEffect(() => {
    if (mode !== 'compose') return;
    if (composeInited) return;
    let cancelled = false;
    (async () => {
      try {
        const im = await loadImage(srcUrl);
        if (cancelled) return;
        const W = im.naturalWidth || 1024;
        const H = im.naturalHeight || 1024;
        const cw = Math.max(64, Math.min(4096, W));
        const ch = Math.max(64, Math.min(4096, H));
        const layer: ImageLayer = {
          id: genLayerId(),
          kind: 'image',
          name: '底图',
          src: srcUrl,
          x: 0,
          y: 0,
          w: cw,
          h: ch,
          rotation: 0,
          flipX: false,
          flipY: false,
          opacity: 1,
          visible: true,
          locked: false,
        };
        setCanvasW(cw);
        setCanvasH(ch);
        setComposeLayers([layer]);
        setSelectedIds([layer.id]);
        setComposeInited(true);
      } catch (e: any) {
        setErrMsg(e?.message || '底图加载失败');
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, srcUrl]);

  // ---- compose 鼠标交互 (move / scale 4 角 / rotate 把手) ----
  const stagePointToCanvas = (clientX: number, clientY: number): { x: number; y: number } | null => {
    const stage = composeStageRef.current;
    if (!stage) return null;
    const r = stage.getBoundingClientRect();
    const fit = composeFitRef.current;
    const sx = clientX - r.left - fit.offsetX;
    const sy = clientY - r.top - fit.offsetY;
    return { x: sx / fit.scale, y: sy / fit.scale };
  };

  const onComposeLayerPointerDown = (
    e: React.PointerEvent,
    layerId: string,
    op: 'move' | 'scale' | 'rotate',
    handle?: 'tl' | 'tr' | 'bl' | 'br',
  ) => {
    e.stopPropagation();
    e.preventDefault();
    const layer = composeLayers.find((l) => l.id === layerId) as ImageLayer | undefined;
    if (!layer || layer.locked) return;
    const pt = stagePointToCanvas(e.clientX, e.clientY);
    if (!pt) return;
    pushComposeHistory();
    // 选中处理: shift 追加 / 全选切换; 否则单选
    let newSelected: string[];
    if (e.shiftKey) {
      newSelected = selectedIds.includes(layerId)
        ? selectedIds.filter((x) => x !== layerId)
        : [...selectedIds, layerId];
    } else {
      newSelected = selectedIds.includes(layerId) && selectedIds.length > 1
        ? selectedIds
        : [layerId];
    }
    setSelectedIds(newSelected);
    const startMap = new Map<string, ImageLayer>();
    for (const id of newSelected) {
      const lz = composeLayers.find((l) => l.id === id) as ImageLayer | undefined;
      if (lz) startMap.set(id, { ...lz });
    }
    composeDragRef.current = {
      pointerId: e.pointerId,
      startCx: pt.x,
      startCy: pt.y,
      op,
      handle,
      startLayers: startMap,
      activeId: layerId,
      centerX: layer.x + layer.w / 2,
      centerY: layer.y + layer.h / 2,
      startAngle:
        op === 'rotate'
          ? Math.atan2(pt.y - (layer.y + layer.h / 2), pt.x - (layer.x + layer.w / 2)) *
            (180 / Math.PI)
          : 0,
      shift: e.shiftKey,
      alt: e.altKey,
    };
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };

  const onComposeStageMove = (e: React.PointerEvent) => {
    const ctx = composeDragRef.current;
    if (!ctx) return;
    const pt = stagePointToCanvas(e.clientX, e.clientY);
    if (!pt) return;
    const dx = pt.x - ctx.startCx;
    const dy = pt.y - ctx.startCy;
    if (ctx.op === 'move') {
      setComposeLayers((arr) =>
        arr.map((l) => {
          const start = ctx.startLayers.get(l.id);
          if (!start) return l;
          return { ...l, x: start.x + dx, y: start.y + dy };
        }),
      );
    } else if (ctx.op === 'scale' && ctx.handle) {
      const start = ctx.startLayers.get(ctx.activeId);
      if (!start) return;
      // 4 角缩放：默认同比 (Shift 则自由); Alt 中心缩放
      const aspect = start.w / start.h;
      let nx = start.x;
      let ny = start.y;
      let nw = start.w;
      let nh = start.h;
      const handle = ctx.handle;
      const sameRatio = !e.shiftKey;
      if (handle === 'br') {
        nw = Math.max(8, start.w + dx);
        nh = Math.max(8, sameRatio ? nw / aspect : start.h + dy);
      } else if (handle === 'tr') {
        nw = Math.max(8, start.w + dx);
        const dh = sameRatio ? nw / aspect - start.h : -dy;
        nh = Math.max(8, start.h + dh);
        ny = start.y - (nh - start.h);
      } else if (handle === 'bl') {
        nw = Math.max(8, start.w - dx);
        nx = start.x + (start.w - nw);
        nh = Math.max(8, sameRatio ? nw / aspect : start.h + dy);
      } else if (handle === 'tl') {
        nw = Math.max(8, start.w - dx);
        nx = start.x + (start.w - nw);
        const dh = sameRatio ? nw / aspect - start.h : -dy;
        nh = Math.max(8, start.h + dh);
        ny = start.y - (nh - start.h);
      }
      if (e.altKey) {
        // Alt 中心缩放
        nx = start.x + start.w / 2 - nw / 2;
        ny = start.y + start.h / 2 - nh / 2;
      }
      updateLayer(ctx.activeId, { x: nx, y: ny, w: nw, h: nh });
    } else if (ctx.op === 'rotate') {
      const start = ctx.startLayers.get(ctx.activeId);
      if (!start || ctx.centerX == null || ctx.centerY == null) return;
      const ang =
        Math.atan2(pt.y - ctx.centerY, pt.x - ctx.centerX) * (180 / Math.PI);
      let next = start.rotation + (ang - (ctx.startAngle || 0));
      if (e.shiftKey) {
        next = Math.round(next / 15) * 15; // Shift 吸附 15°
      }
      updateLayer(ctx.activeId, { rotation: next });
    }
  };

  const onComposeStageUp = (e: React.PointerEvent) => {
    if (composeDragRef.current) {
      try {
        (e.target as Element).releasePointerCapture?.(composeDragRef.current.pointerId);
      } catch {}
      composeDragRef.current = null;
    }
  };

  // ---- compose 键盘快捷键 (Ctrl+Z/Y/A/D, Del, 方向键) ----
  useEffect(() => {
    if (mode !== 'compose') return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea') return;
      const ctrl = e.ctrlKey || e.metaKey;
      if (ctrl && !e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        composeUndo();
      } else if (
        (ctrl && e.shiftKey && e.key.toLowerCase() === 'z') ||
        (ctrl && e.key.toLowerCase() === 'y')
      ) {
        e.preventDefault();
        composeRedo();
      } else if (ctrl && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        setSelectedIds(composeLayers.map((l) => l.id));
      } else if (ctrl && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        if (selectedIds.length === 1) duplicateLayer(selectedIds[0]);
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedIds.length === 0) return;
        e.preventDefault();
        pushComposeHistory();
        setComposeLayers((arr) => arr.filter((l) => !selectedIds.includes(l.id)));
        setSelectedIds([]);
      } else if (
        e.key === 'ArrowLeft' ||
        e.key === 'ArrowRight' ||
        e.key === 'ArrowUp' ||
        e.key === 'ArrowDown'
      ) {
        if (selectedIds.length === 0) return;
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        const dx =
          e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
        const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
        setComposeLayers((arr) =>
          arr.map((l) =>
            selectedIds.includes(l.id) ? { ...l, x: l.x + dx, y: l.y + dy } : l,
          ),
        );
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, composeLayers, selectedIds, composeUndo, composeRedo]);

  // ---- compose 拖入文件 / Ctrl+V 粘贴文件 ----
  useEffect(() => {
    if (mode !== 'compose') return;
    const stage = composeStageRef.current;
    if (!stage) return;
    const onDragOver = (e: DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
    };
    const onDrop = async (e: DragEvent) => {
      e.preventDefault();
      const files = e.dataTransfer?.files;
      if (!files || files.length === 0) return;
      for (const f of Array.from(files)) {
        if (f.type.startsWith('image/')) {
          await addImageLayerFromFile(f, f.name);
        }
      }
    };
    const onPaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const it of Array.from(items)) {
        if (it.type.startsWith('image/')) {
          const blob = it.getAsFile();
          if (blob) await addImageLayerFromFile(blob, `paste-${Date.now()}.png`);
        }
      }
    };
    stage.addEventListener('dragover', onDragOver);
    stage.addEventListener('drop', onDrop);
    window.addEventListener('paste', onPaste);
    return () => {
      stage.removeEventListener('dragover', onDragOver);
      stage.removeEventListener('drop', onDrop);
      window.removeEventListener('paste', onPaste);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, addImageLayerFromFile]);

  // ---- compose stage 尺寸观察 + fit 计算 ----
  useEffect(() => {
    if (mode !== 'compose') return;
    const el = composeStageRef.current;
    if (!el) return;
    const update = () => {
      const r = el.getBoundingClientRect();
      setComposeStageBox({ w: r.width, h: r.height });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [mode]);
  const composeFit = useMemo(() => {
    const sw = Math.max(1, composeStageBox.w);
    const sh = Math.max(1, composeStageBox.h);
    const scale = Math.min(sw / canvasW, sh / canvasH) * 0.92;
    const offsetX = (sw - canvasW * scale) / 2;
    const offsetY = (sh - canvasH * scale) / 2;
    return { scale, offsetX, offsetY };
  }, [composeStageBox, canvasW, canvasH]);
  useEffect(() => {
    composeFitRef.current = composeFit;
  }, [composeFit]);

  // 非 compose 模式需要按真实舞台可视尺寸缩放图片，避免宽图/高图在裁剪弹窗里被上下遮住。
  useEffect(() => {
    if (mode === 'compose') return;
    const el = stageRef.current;
    if (!el) return;
    const update = () => {
      const r = el.getBoundingClientRect();
      setImageStageBox({ w: r.width, h: r.height });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener('resize', update);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', update);
    };
  }, [mode]);

  const imagePreviewLimit = useMemo(() => {
    const fallbackW =
      typeof window === 'undefined' ? 1200 : Math.max(360, Math.floor(window.innerWidth * 0.94) - 80);
    const fallbackH =
      typeof window === 'undefined' ? 640 : Math.max(280, Math.floor(window.innerHeight * 0.94) - 220);
    const stageW = imageStageBox.w > 0 ? imageStageBox.w : fallbackW;
    const stageH = imageStageBox.h > 0 ? imageStageBox.h : fallbackH;
    return {
      maxW: Math.max(EDIT_STAGE_MIN_PREVIEW, Math.floor(stageW - EDIT_STAGE_PADDING * 2 - 8)),
      maxH: Math.max(EDIT_STAGE_MIN_PREVIEW, Math.floor(stageH - EDIT_STAGE_PADDING * 2 - 8)),
    };
  }, [imageStageBox]);

  // ---- mask / brush 画布渲染 (如不同状态中跳转, 根据矢量重画) ----
  const drawStrokeOnCtx = (
    ctx: CanvasRenderingContext2D,
    s: DrawStroke,
    W: number,
    H: number,
  ) => {
    if (s.kind === 'mask-stroke' || s.kind === 'mask-erase') {
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = s.size;
      ctx.strokeStyle = '#fff';
      ctx.fillStyle = '#fff';
      ctx.globalCompositeOperation = s.kind === 'mask-erase' ? 'destination-out' : 'source-over';
      if (s.points.length === 1) {
        const p = s.points[0];
        ctx.beginPath();
        ctx.arc(p.x * W, p.y * H, s.size / 2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.beginPath();
        s.points.forEach((p, i) => {
          const x = p.x * W;
          const y = p.y * H;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.stroke();
      }
      ctx.restore();
      return;
    }
    if (s.kind === 'brush-free') {
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = s.size;
      ctx.strokeStyle = s.color;
      ctx.fillStyle = s.color;
      if (s.points.length === 1) {
        const p = s.points[0];
        ctx.beginPath();
        ctx.arc(p.x * W, p.y * H, s.size / 2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.beginPath();
        s.points.forEach((p, i) => {
          const x = p.x * W;
          const y = p.y * H;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.stroke();
      }
      ctx.restore();
      return;
    }
    if (s.kind === 'brush-rect') {
      ctx.save();
      ctx.lineWidth = s.size;
      ctx.strokeStyle = s.color;
      ctx.strokeRect(s.rect.x * W, s.rect.y * H, s.rect.w * W, s.rect.h * H);
      ctx.restore();
      return;
    }
    if (s.kind === 'brush-ellipse') {
      ctx.save();
      ctx.lineWidth = s.size;
      ctx.strokeStyle = s.color;
      ctx.beginPath();
      const cx = (s.rect.x + s.rect.w / 2) * W;
      const cy = (s.rect.y + s.rect.h / 2) * H;
      const rx = Math.abs(s.rect.w / 2) * W;
      const ry = Math.abs(s.rect.h / 2) * H;
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      return;
    }
    if (s.kind === 'brush-label') {
      ctx.save();
      const fontPx = Math.max(14, s.size * 1.6);
      const x = s.pos.x * W;
      const y = s.pos.y * H;
      const r = fontPx * 0.85;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = s.color;
      ctx.fill();
      ctx.lineWidth = Math.max(2, s.size / 4);
      ctx.strokeStyle = '#fff';
      ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.font = `bold ${Math.round(fontPx)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(s.text, x, y + 1);
      ctx.restore();
      return;
    }
  };

  useEffect(() => {
    const cv = drawCanvasRef.current;
    if (!cv || !naturalSize) return;
    if (cv.width !== naturalSize.w) cv.width = naturalSize.w;
    if (cv.height !== naturalSize.h) cv.height = naturalSize.h;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, cv.width, cv.height);
    if (mode === 'mask') {
      // 诊底透明 overlay; mask 的“黑底白笔”仅在调 applyMask 时走离屏
      for (const s of maskStrokes) drawStrokeOnCtx(ctx, s, cv.width, cv.height);
    } else if (mode === 'brush') {
      for (const s of brushStrokes) drawStrokeOnCtx(ctx, s, cv.width, cv.height);
    }
  }, [mode, maskStrokes, brushStrokes, naturalSize]);

  const getFracPt = (e: { clientX: number; clientY: number }): Pt | null => {
    const img = imgRef.current;
    if (!img) return null;
    const r = img.getBoundingClientRect();
    return {
      x: clamp((e.clientX - r.left) / r.width, 0, 1),
      y: clamp((e.clientY - r.top) / r.height, 0, 1),
    };
  };

  // ---- mask/brush pointer 事件 ----
  const onDrawPointerDown = (e: React.PointerEvent) => {
    if (mode !== 'mask' && mode !== 'brush') return;
    if (!naturalSize) return;
    const pt = getFracPt(e);
    if (!pt) return;
    e.stopPropagation();
    e.preventDefault();
    pushHistory(mode);
    if (mode === 'mask') {
      const stroke: DrawStroke = {
        kind: maskErasing ? 'mask-erase' : 'mask-stroke',
        size: maskBrushSize,
        points: [pt],
      };
      setMaskStrokes((arr) => [...arr, stroke]);
      drawDragRef.current = { pointerId: e.pointerId, startPt: pt, pending: stroke };
    } else {
      // brush
      if (brushTool === 'free') {
        const stroke: DrawStroke = { kind: 'brush-free', color: brushColor, size: brushSize, points: [pt] };
        setBrushStrokes((arr) => [...arr, stroke]);
        drawDragRef.current = { pointerId: e.pointerId, startPt: pt, pending: stroke };
      } else if (brushTool === 'rect') {
        const stroke: DrawStroke = {
          kind: 'brush-rect',
          color: brushColor,
          size: brushSize,
          rect: { x: pt.x, y: pt.y, w: 0, h: 0 },
        };
        setBrushStrokes((arr) => [...arr, stroke]);
        drawDragRef.current = { pointerId: e.pointerId, startPt: pt, pending: stroke };
      } else if (brushTool === 'ellipse') {
        const stroke: DrawStroke = {
          kind: 'brush-ellipse',
          color: brushColor,
          size: brushSize,
          rect: { x: pt.x, y: pt.y, w: 0, h: 0 },
        };
        setBrushStrokes((arr) => [...arr, stroke]);
        drawDragRef.current = { pointerId: e.pointerId, startPt: pt, pending: stroke };
      } else if (brushTool === 'label') {
        const stroke: DrawStroke = {
          kind: 'brush-label',
          color: brushColor,
          size: brushSize,
          pos: pt,
          text: String(labelCounter),
        };
        setBrushStrokes((arr) => [...arr, stroke]);
        setLabelCounter((n) => n + 1);
        drawDragRef.current = null;
      }
    }
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };
  const onDrawPointerMove = (e: React.PointerEvent) => {
    // 跟随鼠标 cursor 展示笔刷圈
    if (mode === 'mask' || mode === 'brush') {
      const img = imgRef.current;
      if (img) {
        const r = img.getBoundingClientRect();
        setCursor({ x: e.clientX - r.left, y: e.clientY - r.top });
      }
    }
    const ctx = drawDragRef.current;
    if (!ctx) return;
    const pt = getFracPt(e);
    if (!pt) return;
    if (mode === 'mask') {
      setMaskStrokes((arr) => {
        const last = arr[arr.length - 1];
        if (!last || (last.kind !== 'mask-stroke' && last.kind !== 'mask-erase')) return arr;
        const next = [...arr];
        next[next.length - 1] = { ...last, points: [...last.points, pt] };
        return next;
      });
    } else if (mode === 'brush') {
      if (brushTool === 'free') {
        setBrushStrokes((arr) => {
          const last = arr[arr.length - 1];
          if (!last || last.kind !== 'brush-free') return arr;
          const next = [...arr];
          next[next.length - 1] = { ...last, points: [...last.points, pt] };
          return next;
        });
      } else if (brushTool === 'rect' || brushTool === 'ellipse') {
        setBrushStrokes((arr) => {
          const last = arr[arr.length - 1];
          if (
            !last ||
            (last.kind !== 'brush-rect' && last.kind !== 'brush-ellipse')
          )
            return arr;
          const next = [...arr];
          next[next.length - 1] = {
            ...last,
            rect: {
              x: Math.min(ctx.startPt.x, pt.x),
              y: Math.min(ctx.startPt.y, pt.y),
              w: Math.abs(pt.x - ctx.startPt.x),
              h: Math.abs(pt.y - ctx.startPt.y),
            },
          };
          return next;
        });
      }
    }
  };
  const onDrawPointerUp = (e: React.PointerEvent) => {
    if (drawDragRef.current) {
      try {
        (e.target as Element).releasePointerCapture?.(drawDragRef.current.pointerId);
      } catch {}
      drawDragRef.current = null;
    }
  };
  const onDrawPointerLeave = () => setCursor(null);

  // ---- 应用 mask: 黑底白笔 → 上传 → produce 2 张 (原图 + mask) ----
  async function applyMask() {
    if (!naturalSize || maskStrokes.length === 0) return;
    setBusy(true);
    setErrMsg(null);
    try {
      // 离屏 canvas A: mask (黑底白笔)
      const cv = document.createElement('canvas');
      cv.width = naturalSize.w;
      cv.height = naturalSize.h;
      const ctx = cv.getContext('2d');
      if (!ctx) throw new Error('canvas 不可用');
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, cv.width, cv.height);
      for (const s of maskStrokes) drawStrokeOnCtx(ctx, s, cv.width, cv.height);
      const maskDataUrl = cv.toDataURL('image/png');

      // 原图转存（同步上传一份与 mask 同源）
      const originUrl = await fetchAndUpload(srcUrl, 'mask-src');
      const maskUrl = await uploadDataUrl(maskDataUrl, 'mask');
      onProduce([originUrl, maskUrl], { type: 'mask', strokeCount: maskStrokes.length });
      onClose();
    } catch (e: any) {
      setErrMsg(e?.message || '应用遮罩失败');
    } finally {
      setBusy(false);
    }
  }

  // ---- 应用 brush: 原图 + 涵盖所有画笔 → 上传 → produce 1 张 ----
  async function applyBrush() {
    if (!naturalSize || brushStrokes.length === 0) return;
    setBusy(true);
    setErrMsg(null);
    try {
      const img = await loadImage(srcUrl);
      const cv = document.createElement('canvas');
      cv.width = naturalSize.w;
      cv.height = naturalSize.h;
      const ctx = cv.getContext('2d');
      if (!ctx) throw new Error('canvas 不可用');
      ctx.drawImage(img, 0, 0, cv.width, cv.height);
      for (const s of brushStrokes) drawStrokeOnCtx(ctx, s, cv.width, cv.height);
      const dataUrl = cv.toDataURL('image/png');
      const url = await uploadDataUrl(dataUrl, 'brush');
      onProduce([url], { type: 'brush', strokeCount: brushStrokes.length });
      onClose();
    } catch (e: any) {
      setErrMsg(e?.message || '应用画板失败');
    } finally {
      setBusy(false);
    }
  }

  // 将任意 url 原图转存为本地 dataUrl 后上传，保障同源 + 外链不被黑名单
  async function fetchAndUpload(srcUrl: string, prefix: string): Promise<string> {
    const img = await loadImage(srcUrl);
    const cv = document.createElement('canvas');
    cv.width = img.naturalWidth;
    cv.height = img.naturalHeight;
    const ctx = cv.getContext('2d');
    if (!ctx) throw new Error('canvas 不可用');
    ctx.drawImage(img, 0, 0);
    const dataUrl = cv.toDataURL('image/png');
    return uploadDataUrl(dataUrl, prefix);
  }
  function loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = (err) => reject(new Error('图片加载失败 (可能因 CORS)'));
      img.src = src;
    });
  }

  // ---- 等分预览叠层 (svg) ----
  const previewLines = useMemo(() => {
    if (mode !== 'grid') return null;
    const useCustom = gridMode === 'custom';
    const items: Array<{ type: 'h' | 'v'; pos: number; cut?: boolean }> = [];
    if (useCustom) {
      customLines.forEach((l) => items.push({ type: l.type, pos: l.pos }));
    } else {
      for (let i = 1; i < rows; i++) items.push({ type: 'h', pos: i / rows });
      for (let i = 1; i < cols; i++) items.push({ type: 'v', pos: i / cols });
    }
    return items;
  }, [mode, gridMode, customLines, rows, cols]);

  const cropPxLabel = naturalSize
    ? `${Math.round(crop.w * naturalSize.w)}×${Math.round(crop.h * naturalSize.h)}`
    : '—';

  const btnBase: React.CSSProperties = {
    height: 32,
    padding: '0 10px',
    borderRadius: isPixel ? 0 : 8,
    border: isPixel ? '2px solid #1A1410' : `1px solid ${isDark ? 'rgba(255,255,255,.18)' : 'rgba(0,0,0,.18)'}`,
    background: inputBg,
    color: textColor,
    fontSize: 12,
    fontWeight: 600,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    cursor: 'pointer',
    boxShadow: isPixel ? '2px 2px 0 #1A1410' : 'none',
  };
  const btnPrimary: React.CSSProperties = {
    ...btnBase,
    background: accent,
    color: isPixel ? '#1A1410' : '#001b1f',
    border: isPixel ? '2px solid #1A1410' : 'none',
  };
  const tabBtn = (active: boolean): React.CSSProperties => ({
    ...btnBase,
    background: active ? accent + (isPixel ? '' : '33') : inputBg,
    color: active ? (isPixel ? '#1A1410' : accent) : textColor,
    border: isPixel
      ? `2px solid ${active ? '#1A1410' : '#1A1410'}`
      : `1px solid ${active ? accent : isDark ? 'rgba(255,255,255,.18)' : 'rgba(0,0,0,.18)'}`,
    fontWeight: active ? 700 : 500,
  });

  const inputStyle: React.CSSProperties = {
    width: 56,
    height: 28,
    padding: '0 6px',
    background: inputBg,
    color: textColor,
    border: isPixel ? '2px solid #1A1410' : `1px solid ${isDark ? 'rgba(255,255,255,.18)' : 'rgba(0,0,0,.18)'}`,
    borderRadius: isPixel ? 0 : 6,
    fontSize: 12,
    textAlign: 'center',
  };

  const ui = (
    <div
      className="img-edit-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div
        className="img-edit-modal"
        style={{
          background: modalBg,
          border: modalBorder,
          borderRadius: modalRadius,
          boxShadow: modalShadow,
          color: textColor,
        }}
      >
        {/* Header (横向): 标题 + tabs + 关闭 */}
        <div
          className="img-edit-header"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            padding: '14px 20px',
            borderBottom: isPixel
              ? '2px solid #1A1410'
              : `1px solid ${isDark ? 'rgba(255,255,255,.1)' : 'rgba(0,0,0,.1)'}`,
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: '0 0 auto' }}>
            <div style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.2 }}>编辑图片</div>
            <div style={{ fontSize: 11, color: subText, lineHeight: 1.2 }}>
              {mode === 'crop'
                ? '拖动框体选择区域，4 角可缩放'
                : mode === 'mask'
                ? '用笔刷涂出需重绘区域，白色 = 遮罩区'
                : mode === 'brush'
                ? '选择工具 + 颜色，在图上记号、标注、画草图'
                : mode === 'compose'
                ? '拖入图片或粘贴 → 多图层组合 (拖动/4 角缩放/旋转/Shift 自由比例/Alt 中心)'
                : gridMode === 'preset'
                ? '调整横/纵线数量与 gap 进行等分切分'
                : '点击画布添加切线，拖动进行调整'}
            </div>
          </div>
          <div style={{ flex: 1 }} />
          <div style={{ display: 'flex', gap: 6 }}>
            <button style={tabBtn(mode === 'crop')} onClick={() => setMode('crop')} title="裁剪 (1)">
              <CropIcon size={14} /> 裁剪
            </button>
            <button style={tabBtn(mode === 'mask')} onClick={() => setMode('mask')} title="遮罩 (2)">
              <Brush size={14} /> 遮罩
            </button>
            <button style={tabBtn(mode === 'brush')} onClick={() => setMode('brush')} title="画板 (3)">
              <Paintbrush size={14} /> 画板
            </button>
            <button style={tabBtn(mode === 'grid')} onClick={() => setMode('grid')} title="宫格切分 (4)">
              <Grid3x3 size={14} /> 宫格切分
            </button>
            <button style={tabBtn(mode === 'compose')} onClick={() => setMode('compose')} title="图层组合 (5)">
              <LayersIcon size={14} /> 组合
            </button>
          </div>
          <button style={btnBase} onClick={onClose} title="关闭 (ESC)">
            <X size={14} />
          </button>
        </div>

        {/* Toolbar */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: 10,
            padding: '10px 20px',
            background: isPixel ? '#FFF7DD' : isDark ? 'rgba(255,255,255,.03)' : 'rgba(0,0,0,.03)',
            borderBottom: isPixel
              ? '2px solid #1A1410'
              : `1px solid ${isDark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.08)'}`,
            fontSize: 12,
          }}
        >
          {mode === 'crop' && (
            <>
              <span style={{ color: subText }}>框尺寸</span>
              <strong>{cropPxLabel}</strong>
              <button
                style={btnBase}
                onClick={() => setCrop({ x: 0.1, y: 0.1, w: 0.8, h: 0.8 })}
              >
                <RotateCcw size={13} /> 重置
              </button>
              <div style={{ flex: 1 }} />
              {naturalSize && (
                <span style={{ color: subText }}>
                  原图 {naturalSize.w}×{naturalSize.h}
                </span>
              )}
            </>
          )}
          {mode === 'grid' && gridMode === 'preset' && (
            <>
              <span style={{ color: subText }}>行</span>
              <input
                type="number"
                min={1}
                max={20}
                value={rows}
                onChange={(e) => setRows(Math.max(1, Math.min(20, Number(e.target.value) || 1)))}
                style={inputStyle}
              />
              <span style={{ color: subText }}>列</span>
              <input
                type="number"
                min={1}
                max={20}
                value={cols}
                onChange={(e) => setCols(Math.max(1, Math.min(20, Number(e.target.value) || 1)))}
                style={inputStyle}
              />
              <span style={{ color: subText }}>gap</span>
              <input
                type="number"
                min={0}
                max={240}
                value={gap}
                onChange={(e) => setGridGap(Number(e.target.value))}
                style={inputStyle}
              />
              <span style={{ color: subText }}>px</span>
              <input
                type="range"
                min={0}
                max={240}
                step={1}
                value={gap}
                onChange={(e) => setGridGap(Number(e.target.value))}
                title="拖动调整 gap 去缝间距"
                style={{
                  width: 180,
                  accentColor: isPixel ? '#C43E7B' : '#db2777',
                }}
              />
              <div
                style={{
                  width: 1,
                  height: 18,
                  background: isPixel ? '#1A1410' : 'rgba(127,127,127,.3)',
                  margin: '0 4px',
                }}
              />
              <button style={btnBase} onClick={() => { setRows(2); setCols(2); }}>2×2</button>
              <button style={btnBase} onClick={() => { setRows(3); setCols(3); }}>3×3</button>
              <button style={btnBase} onClick={() => { setRows(2); setCols(3); }}>2×3</button>
              <button style={btnBase} onClick={() => { setRows(4); setCols(4); }}>4×4</button>
              <div style={{ flex: 1 }} />
              <button style={btnBase} onClick={enterCustom}>
                <Plus size={13} /> 自定义切线
              </button>
            </>
          )}
          {mode === 'grid' && gridMode === 'custom' && (
            <>
              <span style={{ color: subText }}>方向</span>
              <button style={tabBtn(orient === 'h')} onClick={() => setOrient('h')} title="放置横线">
                ─ 横
              </button>
              <button style={tabBtn(orient === 'v')} onClick={() => setOrient('v')} title="放置纵线">
                │ 纵
              </button>
              <span style={{ color: subText, marginLeft: 8 }}>gap</span>
              <input
                type="number"
                min={0}
                max={240}
                value={gap}
                onChange={(e) => setGridGap(Number(e.target.value))}
                style={inputStyle}
              />
              <span style={{ color: subText }}>px</span>
              <input
                type="range"
                min={0}
                max={240}
                step={1}
                value={gap}
                onChange={(e) => setGridGap(Number(e.target.value))}
                title="拖动调整 gap 去缝间距"
                style={{
                  width: 160,
                  accentColor: isPixel ? '#C43E7B' : '#db2777',
                }}
              />
              <span style={{ color: subText, marginLeft: 8 }}>共 {customLines.length} 条</span>
              <div style={{ flex: 1 }} />
              <button style={btnBase} onClick={undoLine} disabled={!history.length}>
                <Undo2 size={13} /> 撤销
              </button>
              <button style={btnBase} onClick={clearLines}>
                <Eraser size={13} /> 清空
              </button>
              <button style={btnBase} onClick={exitCustom}>
                <Minus size={13} /> 退出自定义
              </button>
            </>
          )}
          {mode === 'mask' && (
            <>
              <span style={{ color: subText }}>笔刷</span>
              <input
                type="range"
                min={2}
                max={300}
                value={maskBrushSize}
                onChange={(e) => setMaskBrushSize(Number(e.target.value))}
                style={{ width: 140 }}
              />
              <span style={{ minWidth: 28, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>
                {maskBrushSize}
              </span>
              <button
                style={tabBtn(maskErasing)}
                onClick={() => setMaskErasing((v) => !v)}
                title="橡皮切换 (仅擦除遮罩)"
              >
                <Eraser size={13} /> {maskErasing ? '橡皮中' : '橡皮'}
              </button>
              <button style={btnBase} onClick={undo} disabled={!maskHistory.length} title="撤销 (Ctrl+Z)">
                <Undo2 size={13} />
              </button>
              <button style={btnBase} onClick={redo} disabled={!maskRedo.length} title="恢复 (Ctrl+Y)">
                <Redo2 size={13} />
              </button>
              <button style={btnBase} onClick={clearCurrent} title="清空遮罩">
                <Eraser size={13} /> 清空
              </button>
              <div style={{ flex: 1 }} />
              <span style={{ color: subText }}>产物：原图 + 黑底白笔 mask</span>
            </>
          )}
          {mode === 'brush' && (
            <>
              <button
                style={tabBtn(brushTool === 'free')}
                onClick={() => setBrushTool('free')}
                title="自由笔刷"
              >
                <Paintbrush size={13} />
              </button>
              <button
                style={tabBtn(brushTool === 'rect')}
                onClick={() => setBrushTool('rect')}
                title="矩形"
              >
                <SquareIcon size={13} />
              </button>
              <button
                style={tabBtn(brushTool === 'ellipse')}
                onClick={() => setBrushTool('ellipse')}
                title="椭圆"
              >
                <CircleIcon size={13} />
              </button>
              <button
                style={tabBtn(brushTool === 'label')}
                onClick={() => setBrushTool('label')}
                title="数字标签 (点一下 +1)"
              >
                <ListOrdered size={13} />
              </button>
              <span style={{ color: subText, marginLeft: 4 }}>颜色</span>
              <input
                type="color"
                value={brushColor}
                onChange={(e) => setBrushColor(e.target.value)}
                style={{
                  width: 28,
                  height: 28,
                  padding: 0,
                  border: isPixel ? '2px solid #1A1410' : `1px solid ${isDark ? 'rgba(255,255,255,.18)' : 'rgba(0,0,0,.18)'}`,
                  borderRadius: isPixel ? 0 : 6,
                  background: 'transparent',
                  cursor: 'pointer',
                }}
              />
              <span style={{ color: subText }}>笔刷</span>
              <input
                type="range"
                min={2}
                max={160}
                value={brushSize}
                onChange={(e) => setBrushSize(Number(e.target.value))}
                style={{ width: 110 }}
              />
              <span style={{ minWidth: 24, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>
                {brushSize}
              </span>
              <button style={btnBase} onClick={undo} disabled={!brushHistory.length} title="撤销 (Ctrl+Z)">
                <Undo2 size={13} />
              </button>
              <button style={btnBase} onClick={redo} disabled={!brushRedo.length} title="恢复 (Ctrl+Y)">
                <Redo2 size={13} />
              </button>
              <button style={btnBase} onClick={clearCurrent} title="清空画板">
                <Eraser size={13} /> 清空
              </button>
              <div style={{ flex: 1 }} />
              <span style={{ color: subText }}>产物：原图 ⊕ 画板合成图</span>
            </>
          )}
          {mode === 'compose' && (
            <>
              <button
                style={btnBase}
                onClick={() => composeFileInputRef.current?.click()}
                title="添加图片图层"
              >
                <Plus size={13} /> 添加图片
              </button>
              <input
                ref={composeFileInputRef}
                type="file"
                accept="image/*"
                multiple
                style={{ display: 'none' }}
                onChange={async (e) => {
                  const files = e.target.files;
                  if (!files) return;
                  for (const f of Array.from(files)) {
                    await addImageLayerFromFile(f, f.name);
                  }
                  e.target.value = '';
                }}
              />
              <span style={{ color: subText, marginLeft: 4 }}>画布</span>
              <input
                type="number"
                min={64}
                max={4096}
                value={canvasW}
                onChange={(e) => {
                  const v = Math.max(64, Math.min(4096, Number(e.target.value) || 1024));
                  setCanvasW(v);
                }}
                style={{ ...inputStyle, width: 70 }}
              />
              <span style={{ color: subText }}>×</span>
              <input
                type="number"
                min={64}
                max={4096}
                value={canvasH}
                onChange={(e) => {
                  const v = Math.max(64, Math.min(4096, Number(e.target.value) || 1024));
                  setCanvasH(v);
                }}
                style={{ ...inputStyle, width: 70 }}
              />
              {([
                [1024, 1024, '1:1'],
                [768, 1024, '3:4'],
                [1024, 768, '4:3'],
                [1080, 1920, '9:16'],
                [1920, 1080, '16:9'],
              ] as Array<[number, number, string]>).map(([w, h, label]) => (
                <button
                  key={label}
                  style={btnBase}
                  onClick={() => {
                    pushComposeHistory();
                    setCanvasW(w);
                    setCanvasH(h);
                  }}
                  title={`${w}×${h}`}
                >
                  {label}
                </button>
              ))}
              <div
                style={{
                  width: 1,
                  height: 18,
                  background: isPixel ? '#1A1410' : 'rgba(127,127,127,.3)',
                  margin: '0 4px',
                }}
              />
              <button
                style={btnBase}
                onClick={composeUndo}
                disabled={!composeHistory.length}
                title="撤销 (Ctrl+Z)"
              >
                <Undo2 size={13} />
              </button>
              <button
                style={btnBase}
                onClick={composeRedo}
                disabled={!composeFuture.length}
                title="恢复 (Ctrl+Y)"
              >
                <Redo2 size={13} />
              </button>
              <div style={{ flex: 1 }} />
              <span style={{ color: subText }}>
                {composeLayers.length} 图层 · {selectedIds.length} 选中
              </span>
            </>
          )}
        </div>

        {/* Stage */}
        {mode === 'compose' ? (
          <div
            className="img-edit-stage"
            data-mode="compose"
            style={{
              flex: 1,
              display: 'flex',
              minHeight: 420,
              background: isPixel ? '#FFF1B8' : isDark ? '#020617' : '#f8fafc',
            }}
          >
            {/* 左 sidebar 图层列表 */}
            <div
              style={{
                width: 200,
                borderRight: isPixel
                  ? '2px solid #1A1410'
                  : `1px solid ${isDark ? 'rgba(255,255,255,.1)' : 'rgba(0,0,0,.1)'}`,
                padding: 8,
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
                background: isPixel ? '#FFFBF0' : isDark ? 'rgba(255,255,255,.02)' : 'rgba(0,0,0,.02)',
              }}
            >
              <div style={{ fontSize: 11, color: subText, padding: '4px 6px', fontWeight: 700 }}>
                <LayersIcon size={12} style={{ verticalAlign: -2, marginRight: 4 }} />
                图层 (顶 → 底)
              </div>
              {[...composeLayers].reverse().map((layer) => {
                const selected = selectedIds.includes(layer.id);
                return (
                  <div
                    key={layer.id}
                    onPointerDown={(e) => {
                      if (e.shiftKey) {
                        setSelectedIds((s) =>
                          s.includes(layer.id) ? s.filter((x) => x !== layer.id) : [...s, layer.id],
                        );
                      } else {
                        setSelectedIds([layer.id]);
                      }
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '4px 6px',
                      background: selected
                        ? isPixel
                          ? '#FFE066'
                          : accent + '33'
                        : 'transparent',
                      border: isPixel ? '2px solid' : '1px solid',
                      borderColor: selected
                        ? isPixel
                          ? '#1A1410'
                          : accent
                        : 'transparent',
                      borderRadius: isPixel ? 0 : 6,
                      cursor: 'pointer',
                      fontSize: 12,
                    }}
                  >
                    <button
                      style={{ ...btnBase, padding: 2, minWidth: 'auto' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        updateLayer(layer.id, { visible: !layer.visible });
                      }}
                      title={layer.visible ? '隐藏' : '显示'}
                    >
                      {layer.visible ? <EyeIcon size={12} /> : <EyeOffIcon size={12} />}
                    </button>
                    <button
                      style={{ ...btnBase, padding: 2, minWidth: 'auto' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        updateLayer(layer.id, { locked: !layer.locked });
                      }}
                      title={layer.locked ? '解锁' : '锁定'}
                    >
                      {layer.locked ? <LockIcon size={12} /> : <UnlockIcon size={12} />}
                    </button>
                    <span
                      style={{
                        flex: 1,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                      title={layer.name}
                    >
                      {layer.name}
                    </span>
                    <button
                      style={{ ...btnBase, padding: 2, minWidth: 'auto' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        removeLayerById(layer.id);
                      }}
                      title="删除"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                );
              })}
              {composeLayers.length === 0 && (
                <div style={{ fontSize: 11, color: subText, padding: 8, textAlign: 'center' }}>
                  无图层
                </div>
              )}
            </div>
            {/* 中画布 */}
            <div
              ref={composeStageRef}
              style={{
                flex: 1,
                position: 'relative',
                overflow: 'hidden',
                cursor: 'default',
              }}
              onPointerMove={onComposeStageMove}
              onPointerUp={onComposeStageUp}
              onPointerDown={(e) => {
                if (e.target === e.currentTarget) setSelectedIds([]);
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  left: composeFit.offsetX,
                  top: composeFit.offsetY,
                  width: canvasW * composeFit.scale,
                  height: canvasH * composeFit.scale,
                  background:
                    'repeating-conic-gradient(' +
                    (isPixel ? '#fff' : isDark ? '#1f2937' : '#fff') +
                    ' 0% 25%, ' +
                    (isPixel ? '#FFE066' : isDark ? '#374151' : '#e5e7eb') +
                    ' 0% 50%) 50% / 24px 24px',
                  border: isPixel ? '2px solid #1A1410' : `1px solid ${accent}`,
                  boxShadow: isPixel ? '4px 4px 0 #1A1410' : `0 0 0 1px ${accent}33`,
                }}
                onPointerDown={(e) => {
                  if (e.target === e.currentTarget) setSelectedIds([]);
                }}
              >
                {composeLayers.map((layer) => {
                  const selected = selectedIds.includes(layer.id);
                  const W = layer.w * composeFit.scale;
                  const H = layer.h * composeFit.scale;
                  const X = layer.x * composeFit.scale;
                  const Y = layer.y * composeFit.scale;
                  return (
                    <div
                      key={layer.id}
                      style={{
                        position: 'absolute',
                        left: X,
                        top: Y,
                        width: W,
                        height: H,
                        transform: `rotate(${layer.rotation}deg) scale(${layer.flipX ? -1 : 1}, ${layer.flipY ? -1 : 1})`,
                        transformOrigin: 'center center',
                        opacity: layer.visible ? layer.opacity : 0.2,
                        outline: selected ? `2px solid ${accent}` : 'none',
                        outlineOffset: 0,
                        cursor: layer.locked ? 'not-allowed' : 'move',
                        pointerEvents: 'auto',
                      }}
                      onPointerDown={(e) => onComposeLayerPointerDown(e, layer.id, 'move')}
                    >
                      {/* eslint-disable-next-line jsx-a11y/alt-text */}
                      <img
                        src={layer.src}
                        crossOrigin="anonymous"
                        draggable={false}
                        style={{
                          display: 'block',
                          width: '100%',
                          height: '100%',
                          imageRendering: isPixel ? 'pixelated' : 'auto',
                          userSelect: 'none',
                          pointerEvents: 'none',
                        }}
                      />
                      {selected && !layer.locked && (
                        <>
                          {(['tl', 'tr', 'bl', 'br'] as const).map((h) => {
                            const pos: React.CSSProperties = {
                              position: 'absolute',
                              width: 12,
                              height: 12,
                              background: '#fff',
                              border: `2px solid ${accent}`,
                              borderRadius: handleRadius,
                              cursor: h === 'tl' || h === 'br' ? 'nwse-resize' : 'nesw-resize',
                            };
                            if (h === 'tl') {
                              pos.left = -7;
                              pos.top = -7;
                            } else if (h === 'tr') {
                              pos.right = -7;
                              pos.top = -7;
                            } else if (h === 'bl') {
                              pos.left = -7;
                              pos.bottom = -7;
                            } else {
                              pos.right = -7;
                              pos.bottom = -7;
                            }
                            return (
                              <div
                                key={h}
                                style={pos}
                                onPointerDown={(e) =>
                                  onComposeLayerPointerDown(e, layer.id, 'scale', h)
                                }
                              />
                            );
                          })}
                          {/* 旋转把手 */}
                          <div
                            onPointerDown={(e) =>
                              onComposeLayerPointerDown(e, layer.id, 'rotate')
                            }
                            style={{
                              position: 'absolute',
                              left: '50%',
                              top: -28,
                              width: 14,
                              height: 14,
                              background: accent,
                              border: '2px solid #fff',
                              borderRadius: '50%',
                              transform: 'translateX(-50%)',
                              cursor: 'crosshair',
                              boxShadow: '0 0 0 1px rgba(0,0,0,.4)',
                            }}
                          />
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            {/* 右 sidebar 选中属性 */}
            <div
              style={{
                width: 220,
                borderLeft: isPixel
                  ? '2px solid #1A1410'
                  : `1px solid ${isDark ? 'rgba(255,255,255,.1)' : 'rgba(0,0,0,.1)'}`,
                padding: 12,
                overflowY: 'auto',
                background: isPixel ? '#FFFBF0' : isDark ? 'rgba(255,255,255,.02)' : 'rgba(0,0,0,.02)',
                fontSize: 12,
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              {selectedIds.length === 0 && (
                <div style={{ color: subText, textAlign: 'center', marginTop: 12 }}>未选中图层</div>
              )}
              {selectedIds.length > 1 && (
                <div style={{ color: subText, textAlign: 'center', marginTop: 12 }}>
                  已选中 {selectedIds.length} 个图层
                </div>
              )}
              {selectedIds.length === 1 &&
                (() => {
                  const layer = composeLayers.find((l) => l.id === selectedIds[0]);
                  if (!layer) return null;
                  const numField = (
                    label: string,
                    val: number,
                    onChange: (v: number) => void,
                  ) => (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 28, color: subText }}>{label}</span>
                      <input
                        type="number"
                        value={Math.round(val * 100) / 100}
                        onChange={(e) => onChange(Number(e.target.value) || 0)}
                        style={{ ...inputStyle, flex: 1, textAlign: 'left' }}
                      />
                    </div>
                  );
                  return (
                    <>
                      <div style={{ fontWeight: 700, color: textColor, wordBreak: 'break-all' }}>
                        {layer.name}
                      </div>
                      {numField('X', layer.x, (v) => updateLayer(layer.id, { x: v }))}
                      {numField('Y', layer.y, (v) => updateLayer(layer.id, { y: v }))}
                      {numField('W', layer.w, (v) => updateLayer(layer.id, { w: Math.max(8, v) }))}
                      {numField('H', layer.h, (v) => updateLayer(layer.id, { h: Math.max(8, v) }))}
                      {numField('旋', layer.rotation, (v) => updateLayer(layer.id, { rotation: v }))}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ width: 28, color: subText }}>不透</span>
                        <input
                          type="range"
                          min={0}
                          max={100}
                          value={Math.round(layer.opacity * 100)}
                          onChange={(e) =>
                            updateLayer(layer.id, { opacity: Number(e.target.value) / 100 })
                          }
                          style={{ flex: 1 }}
                        />
                        <span style={{ width: 28, textAlign: 'right' }}>
                          {Math.round(layer.opacity * 100)}
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        <button
                          style={tabBtn(layer.flipX)}
                          onClick={() => updateLayer(layer.id, { flipX: !layer.flipX })}
                          title="水平翻转"
                        >
                          <FlipHorizontal2 size={13} />
                        </button>
                        <button
                          style={tabBtn(layer.flipY)}
                          onClick={() => updateLayer(layer.id, { flipY: !layer.flipY })}
                          title="垂直翻转"
                        >
                          <FlipVertical2 size={13} />
                        </button>
                        <button
                          style={tabBtn(layer.locked)}
                          onClick={() => updateLayer(layer.id, { locked: !layer.locked })}
                          title="锁定"
                        >
                          {layer.locked ? <LockIcon size={13} /> : <UnlockIcon size={13} />}
                        </button>
                        <button
                          style={tabBtn(!layer.visible)}
                          onClick={() => updateLayer(layer.id, { visible: !layer.visible })}
                          title="可见性"
                        >
                          {layer.visible ? <EyeIcon size={13} /> : <EyeOffIcon size={13} />}
                        </button>
                      </div>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        <button
                          style={btnBase}
                          onClick={() => moveLayerToTop(layer.id)}
                          title="置顶"
                        >
                          <ChevronsUp size={13} />
                        </button>
                        <button
                          style={btnBase}
                          onClick={() => moveLayer(layer.id, 1)}
                          title="上移"
                        >
                          <ArrowUp size={13} />
                        </button>
                        <button
                          style={btnBase}
                          onClick={() => moveLayer(layer.id, -1)}
                          title="下移"
                        >
                          <ArrowDown size={13} />
                        </button>
                        <button
                          style={btnBase}
                          onClick={() => moveLayerToBottom(layer.id)}
                          title="置底"
                        >
                          <ChevronsDown size={13} />
                        </button>
                      </div>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        <button
                          style={btnBase}
                          onClick={() => duplicateLayer(layer.id)}
                          title="复制 (Ctrl+D)"
                        >
                          <CopyIcon size={13} /> 复制
                        </button>
                        <button
                          style={btnBase}
                          onClick={() => removeLayerById(layer.id)}
                          title="删除 (Del)"
                        >
                          <Trash2 size={13} /> 删除
                        </button>
                      </div>
                    </>
                  );
                })()}
            </div>
          </div>
        ) : (
        <div
          ref={stageRef}
          className="img-edit-stage"
          data-mode={mode}
          style={{
            flex: 1,
            overflow: 'auto',
            padding: EDIT_STAGE_PADDING,
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'flex-start',
            background: isPixel ? '#FFF1B8' : isDark ? '#020617' : '#f8fafc',
            minHeight: 360,
            cursor:
              mode === 'mask' || mode === 'brush'
                ? 'crosshair'
                : mode === 'grid' && gridMode === 'custom'
                ? orient === 'h'
                  ? 'row-resize'
                  : 'col-resize'
                : 'default',
          }}
          onPointerMove={(e) => {
            moveCropDrag(e);
            onStagePointerMove(e);
            onDrawPointerMove(e);
          }}
          onPointerUp={(e) => {
            endCropDrag();
            onStagePointerUp(e);
            onDrawPointerUp(e);
          }}
          onPointerLeave={onDrawPointerLeave}
        >
          <div
            style={{
              position: 'relative',
              display: 'inline-block',
              flex: '0 0 auto',
              margin: 'auto',
              lineHeight: 0,
              userSelect: 'none',
            }}
            onPointerDown={(e) => {
              if (mode === 'mask' || mode === 'brush') {
                onDrawPointerDown(e);
              } else {
                onStagePointerDown(e);
              }
            }}
          >
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            <img
              ref={imgRef}
              src={srcUrl}
              draggable={false}
              crossOrigin="anonymous"
              onLoad={(e) => {
                const t = e.currentTarget;
                setNaturalSize({ w: t.naturalWidth, h: t.naturalHeight });
              }}
              style={{
                display: 'block',
                maxWidth: imagePreviewLimit.maxW,
                maxHeight: imagePreviewLimit.maxH,
                width: 'auto',
                height: 'auto',
                objectFit: 'contain',
                background: isPixel ? '#fff' : '#000',
                borderRadius: isPixel ? 0 : 8,
                imageRendering: isPixel ? 'pixelated' : 'auto',
                filter: mode === 'mask' ? 'brightness(.55)' : 'none',
                transition: 'filter 160ms ease',
              }}
            />
            {/* mask/brush 画布 overlay (始终渲染，在 crop/grid 模式下依然可见，但 pointer-events:none) */}
            <canvas
              ref={drawCanvasRef}
              className="img-edit-draw"
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                pointerEvents: mode === 'mask' || mode === 'brush' ? 'auto' : 'none',
                opacity: mode === 'mask' ? 0.85 : 1,
                mixBlendMode: 'normal',
                imageRendering: isPixel ? 'pixelated' : 'auto',
                borderRadius: isPixel ? 0 : 8,
              }}
            />
            {/* 跟随鼠标的笔刷圈 */}
            {(mode === 'mask' || mode === 'brush') && cursor && (
              <div
                className="img-edit-cursor"
                style={{
                  position: 'absolute',
                  left: cursor.x,
                  top: cursor.y,
                  width: (mode === 'mask' ? maskBrushSize : brushSize) *
                    ((imgRef.current?.clientWidth || 1) / (naturalSize?.w || 1)),
                  height: (mode === 'mask' ? maskBrushSize : brushSize) *
                    ((imgRef.current?.clientHeight || 1) / (naturalSize?.h || 1)),
                  transform: 'translate(-50%, -50%)',
                  borderRadius: '50%',
                  border: `1.5px solid ${mode === 'mask' ? '#fff' : brushColor}`,
                  boxShadow: '0 0 0 1px rgba(0,0,0,.5)',
                  pointerEvents: 'none',
                }}
              />
            )}
            {/* crop-box (仅 crop 模式) */}
            {mode === 'crop' && naturalSize && (
              <div
                className="crop-box"
                onPointerDown={(e) => startCropDrag(e, 'move')}
                style={{
                  position: 'absolute',
                  left: `${crop.x * 100}%`,
                  top: `${crop.y * 100}%`,
                  width: `${crop.w * 100}%`,
                  height: `${crop.h * 100}%`,
                  border: `2px solid ${isPixel ? '#1A1410' : '#fff'}`,
                  boxShadow: `0 0 0 9999px rgba(${isPixel ? '26,20,16' : '15,23,42'},.55)`,
                  borderRadius: isPixel ? 0 : 6,
                  cursor: 'move',
                }}
              >
                {(['tl', 'tr', 'bl', 'br'] as const).map((k) => {
                  const pos: React.CSSProperties = {
                    position: 'absolute',
                    width: 14,
                    height: 14,
                    background: isPixel ? '#FFE066' : '#fff',
                    border: '2px solid #111',
                    borderRadius: handleRadius,
                    cursor: k === 'tl' || k === 'br' ? 'nwse-resize' : 'nesw-resize',
                  };
                  if (k === 'tl') {
                    pos.left = -8;
                    pos.top = -8;
                  } else if (k === 'tr') {
                    pos.right = -8;
                    pos.top = -8;
                  } else if (k === 'bl') {
                    pos.left = -8;
                    pos.bottom = -8;
                  } else {
                    pos.right = -8;
                    pos.bottom = -8;
                  }
                  return (
                    <div
                      key={k}
                      className="crop-handle"
                      onPointerDown={(e) => startCropDrag(e, k)}
                      style={pos}
                    />
                  );
                })}
              </div>
            )}

            {/* grid overlay svg */}
            {mode === 'grid' && previewLines && (
              <svg
                style={{
                  position: 'absolute',
                  inset: 0,
                  width: '100%',
                  height: '100%',
                  pointerEvents: 'none',
                }}
              >
                {previewLines.map((l, i) => {
                  const stroke = accent;
                  if (l.type === 'h') {
                    const yPct = `${l.pos * 100}%`;
                    return (
                      <g key={i}>
                        <line
                          x1="0"
                          x2="100%"
                          y1={yPct}
                          y2={yPct}
                          stroke={stroke}
                          strokeWidth={isPixel ? 2 : 1.6}
                          shapeRendering={isPixel ? 'crispEdges' : 'auto'}
                        />
                        {gap > 0 && (
                          <>
                            <line
                              x1="0"
                              x2="100%"
                              y1={`calc(${yPct} - ${gap / 2}px)`}
                              y2={`calc(${yPct} - ${gap / 2}px)`}
                              stroke={stroke}
                              strokeDasharray="6 4"
                              strokeWidth="1"
                            />
                            <line
                              x1="0"
                              x2="100%"
                              y1={`calc(${yPct} + ${gap / 2}px)`}
                              y2={`calc(${yPct} + ${gap / 2}px)`}
                              stroke={stroke}
                              strokeDasharray="6 4"
                              strokeWidth="1"
                            />
                          </>
                        )}
                      </g>
                    );
                  }
                  const xPct = `${l.pos * 100}%`;
                  return (
                    <g key={i}>
                      <line
                        x1={xPct}
                        x2={xPct}
                        y1="0"
                        y2="100%"
                        stroke={stroke}
                        strokeWidth={isPixel ? 2 : 1.6}
                        shapeRendering={isPixel ? 'crispEdges' : 'auto'}
                      />
                      {gap > 0 && (
                        <>
                          <line
                            x1={`calc(${xPct} - ${gap / 2}px)`}
                            x2={`calc(${xPct} - ${gap / 2}px)`}
                            y1="0"
                            y2="100%"
                            stroke={stroke}
                            strokeDasharray="6 4"
                            strokeWidth="1"
                          />
                          <line
                            x1={`calc(${xPct} + ${gap / 2}px)`}
                            x2={`calc(${xPct} + ${gap / 2}px)`}
                            y1="0"
                            y2="100%"
                            stroke={stroke}
                            strokeDasharray="6 4"
                            strokeWidth="1"
                          />
                        </>
                      )}
                    </g>
                  );
                })}
              </svg>
            )}
          </div>
        </div>
        )}

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '14px 20px',
            borderTop: isPixel
              ? '2px solid #1A1410'
              : `1px solid ${isDark ? 'rgba(255,255,255,.1)' : 'rgba(0,0,0,.1)'}`,
          }}
        >
          {errMsg && (
            <div style={{ color: '#EF4444', fontSize: 12, fontWeight: 600 }}>{errMsg}</div>
          )}
          <div style={{ flex: 1 }} />
          <button style={btnBase} onClick={onClose} disabled={busy}>
            取消
          </button>
          {mode === 'crop' ? (
            <button style={btnPrimary} onClick={applyCrop} disabled={busy || !naturalSize}>
              {busy ? (
                <>
                  <Loader2 size={14} className="animate-spin" /> 处理中…
                </>
              ) : (
                <>
                  <Check size={14} /> 应用裁剪
                </>
              )}
            </button>
          ) : mode === 'mask' ? (
            <button
              style={btnPrimary}
              onClick={applyMask}
              disabled={busy || !naturalSize || maskStrokes.length === 0}
              title={maskStrokes.length === 0 ? '请先绘制遮罩区域' : ''}
            >
              {busy ? (
                <>
                  <Loader2 size={14} className="animate-spin" /> 处理中…
                </>
              ) : (
                <>
                  <Check size={14} /> 应用遮罩
                </>
              )}
            </button>
          ) : mode === 'brush' ? (
            <button
              style={btnPrimary}
              onClick={applyBrush}
              disabled={busy || !naturalSize || brushStrokes.length === 0}
              title={brushStrokes.length === 0 ? '请先作画' : ''}
            >
              {busy ? (
                <>
                  <Loader2 size={14} className="animate-spin" /> 处理中…
                </>
              ) : (
                <>
                  <Check size={14} /> 应用画板
                </>
              )}
            </button>
          ) : mode === 'compose' ? (
            <button
              style={btnPrimary}
              onClick={applyCompose}
              disabled={busy || composeLayers.length === 0}
              title={composeLayers.length === 0 ? '请先添加图层' : ''}
            >
              {busy ? (
                <>
                  <Loader2 size={14} className="animate-spin" /> 处理中…
                </>
              ) : (
                <>
                  <Check size={14} /> 应用组合
                </>
              )}
            </button>
          ) : (
            <button style={btnPrimary} onClick={applyGrid} disabled={busy || !naturalSize}>
              {busy ? (
                <>
                  <Loader2 size={14} className="animate-spin" /> 处理中…
                </>
              ) : (
                <>
                  <Check size={14} /> 应用宫格切分
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );

  // 使用 Portal 逃逸 ReactFlow 节点的 transform 父级,
  // 否则 position:fixed 会被变换为相对 transform 父定位, 对备布局逼仄。
  return typeof document !== 'undefined' ? createPortal(ui, document.body) : ui;
};

export default ImageEditModal;
