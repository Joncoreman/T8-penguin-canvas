import { memo, useMemo, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { Handle, Position, useReactFlow, type Node, type Edge, type NodeProps } from '@xyflow/react';
import {
  AlertCircle,
  Edit3,
  FileImage,
  FileVideo,
  Music,
  RotateCcw,
  Upload as UploadIcon,
  X,
} from 'lucide-react';
import { useUpdateNodeData } from './useUpdateNodeData';
import { useThemeStore } from '../../stores/theme';
import { useHiddenFeatureStore, isRhDuckUploadEnabled } from '../../stores/hiddenFeatures';
import { PORT_COLOR } from '../../config/portTypes';
import { useRunTrigger } from '../../hooks/useRunTrigger';
import { useDragMaterialStore, type MaterialPayload } from '../../stores/dragMaterial';
import ImageEditModal, { type ImageEditProduceMeta } from './ImageEditModal';
import ResizableCorners from './ResizableCorners';
import CollectionSplitButton from '../CollectionSplitButton';
import ImageHoverPreview from '../ImageHoverPreview';
import { decodeDuckFiles, type DuckDecodeFileItem } from '../../services/api';
import { resolveThemeTemplate } from '../../theme/defaultTemplates';
import {
  createOutputDataFromItems,
  createUploadDataFromItem,
  createUploadDataFromItems,
  formatMediaSize,
  getMediaItemsFromData,
  sameMediaUrls,
  type MediaItem,
  type MediaKind,
} from '../../utils/mediaCollection';
// v1.2.10.5: 节点落点防重叠
import { placeSingleNode, placeBatchNodes, defaultSizeOf, type Rect as PlacementRect } from '../../utils/nodePlacement';

/**
 * UploadNode - 通用上传素材节点
 *
 * 设计(v2 重构: 占除了"先选类型"步骤):
 *   1. 节点创建后默认就是"点击/拖拽上传"状态, accept = image/video/audio 三合一
 *   2. 选中/拖入文件 → 按 MIME 自动识别 kind (图像/视频/音频)
 *   3. 上传完成:保存 url 到对应字段(imageUrl / videoUrl / audioUrl)
 *      同时按类型选择正确的端口颜色
 *   4. Handle 颜色随 uploadType 变化(image=黄/video=粉/audio=紫);
 *      未上传时 Handle 为中性 any 色
 *   5. 已上传后右上角可重置/换文件
 *
 * 与下游联动:
 *   - 上游 nothing(无 target Handle)
 *   - 输出 → 通过 data.imageUrl/videoUrl/audioUrl 暴露给下游
 */
type UploadKind = MediaKind;

const KIND_META: Record<
  UploadKind,
  {
    label: string;
    accept: string;
    icon: typeof FileImage;
    color: string;
    dataField: 'imageUrl' | 'videoUrl' | 'audioUrl';
    port: 'image' | 'video' | 'audio';
  }
> = {
  image: {
    label: '图像',
    accept: 'image/*',
    icon: FileImage,
    color: PORT_COLOR.image,
    dataField: 'imageUrl',
    port: 'image',
  },
  video: {
    label: '视频',
    accept: 'video/*',
    icon: FileVideo,
    color: PORT_COLOR.video,
    dataField: 'videoUrl',
    port: 'video',
  },
  audio: {
    label: '音频',
    accept: 'audio/*',
    icon: Music,
    color: PORT_COLOR.audio,
    dataField: 'audioUrl',
    port: 'audio',
  },
};

/** 通过文件 MIME 推断上传类型(支持拖拽时自动选定类型) */
function inferKindFromFile(file: File): UploadKind | null {
  const m = file.type;
  if (!m) return null;
  if (m.startsWith('image/')) return 'image';
  if (m.startsWith('video/')) return 'video';
  if (m.startsWith('audio/')) return 'audio';
  return null;
}

const UploadNode = ({ id, data, selected }: NodeProps) => {
  const update = useUpdateNodeData(id);
  const { theme, style, templateId, customTemplates } = useThemeStore();
  const isDark = theme === 'dark';
  const isPixel = style === 'pixel';
  const activeTemplate = useMemo(
    () => resolveThemeTemplate(templateId, customTemplates),
    [templateId, customTemplates],
  );
  const isRhDomVisual =
    typeof document !== 'undefined' && document.documentElement.dataset.themeVisual === 'rh';
  const isRhVisual = activeTemplate.visuals?.style === 'rh' || isRhDomVisual;
  const isYyhDomVisual =
    typeof document !== 'undefined' && document.documentElement.dataset.themeVisual === 'yyh';
  const isYyhVisual = activeTemplate.visuals?.style === 'yyh' || isYyhDomVisual;
  const rhDuckUploadIds = useHiddenFeatureStore((s) => s.rhDuckUploadIds);
  const clearRhDuckUpload = useHiddenFeatureStore((s) => s.clearRhDuckUpload);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const rf = useReactFlow();

  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  // 图像编辑弹窗 src URL（与 OutputNode 双击逻辑保持一致）
  const [editingUrl, setEditingUrl] = useState<string | null>(null);

  const d = data as any;
  const uploadType: UploadKind | null = d?.uploadType ?? null;
  const meta = uploadType ? KIND_META[uploadType] : null;
  const mediaItems = uploadType ? getMediaItemsFromData(d, uploadType) : [];
  const url: string | undefined = mediaItems[0]?.url;
  const rhDuckMode = Boolean(
    isRhVisual &&
      uploadType === 'image' &&
      mediaItems.length > 0 &&
      isRhDuckUploadEnabled(rhDuckUploadIds, id),
  );
  const yyhPortraitUploadMode = Boolean(isYyhVisual && d?.yyhPortraitHidden);

  // 节点本地尺寸 state: 默认 (260, 高度由内容撑开 — 上传后图/视频会撑高 root)
  // 拖角后由 ResizableCorners onResize 同步具体 px (保证 measured 准确 + keepAspectRatio 生效 + handleBounds 准确)
  const [size, setSize] = useState<{ w: number; h?: number }>({ w: 260 });

  // === 运行总线: 点击 RUN 后根据已上传素材生成下游 OutputNode ===
  // 设计要点:
  //   1. 只有 url 已就绪才会创建, 未上传会报错
  //   2. 防重复: 检查是否已存在 source=id, target.type='output' 且 data.directXxxUrl=当前 url 的下游
  //      若已存在则仅提示不重复创建
  //   3. 创建后节点 id 以 'output-auto-up-' 开头, 避开 'output-auto-' 网格重排接管
  const handleRun = async () => {
    setError(null);
    if (!uploadType || !meta || mediaItems.length === 0) {
      const msg = '请先上传素材';
      setError(msg);
      throw new Error(msg);
    }
    const edges = rf.getEdges();
    const nodes = rf.getNodes();

    const toDecodedMediaItem = (source: MediaItem, decoded?: DuckDecodeFileItem): MediaItem | null => {
      if (!decoded?.decoded || !decoded.url) return null;
      if (decoded.kind !== 'image' && decoded.kind !== 'video' && decoded.kind !== 'audio') return null;
      return {
        kind: decoded.kind,
        url: decoded.url,
        name: decoded.filename || source.name,
        size: decoded.size,
        mime: decoded.mime || source.mime,
      };
    };

    let outputGroups: Array<{ kind: MediaKind; items: MediaItem[] }> = [{ kind: uploadType, items: mediaItems }];
    let outputFromRhDuckDecode = false;
    if (rhDuckMode && uploadType === 'image') {
      try {
        const decoded = await decodeDuckFiles(mediaItems.map((item) => item.url));
        if (decoded.decodedCount > 0) {
          const decodedBySource = new Map(decoded.items.map((item) => [item.sourceUrl, item]));
          const grouped = new Map<MediaKind, MediaItem[]>();
          const push = (item: MediaItem) => {
            const list = grouped.get(item.kind) || [];
            list.push(item);
            grouped.set(item.kind, list);
          };
          mediaItems.forEach((item) => {
            const decodedItem = toDecodedMediaItem(item, decodedBySource.get(item.url));
            if (decodedItem) push(decodedItem);
          });
          const decodedGroups = Array.from(grouped.entries()).map(([kind, items]) => ({ kind, items }));
          if (decodedGroups.length > 0) {
            outputGroups = decodedGroups;
            outputFromRhDuckDecode = true;
          }
        }
      } catch (e) {
        console.warn('[UploadNode] RH duck decode failed, fallback to normal upload output', e);
      }
    }

    const groupsToCreate = outputGroups.filter(({ kind, items }) => {
      if (items.length === 0) return false;
      return !edges.some((e) => {
        if (e.source !== id) return false;
        const t = nodes.find((n) => n.id === e.target);
        if (!t || t.type !== 'output') return false;
        const td = (t.data as any) || {};
        return sameMediaUrls(getMediaItemsFromData(td, kind), items);
      });
    });
    if (groupsToCreate.length === 0) return;

    const me = rf.getNode(id);
    const myW = (me as any)?.measured?.width || (me as any)?.width || 320;
    const baseX = (me?.position?.x ?? 0) + myW + 80;
    const baseY = me?.position?.y ?? 0;
    const ts = Date.now();
    const _sz = defaultSizeOf('output');
    const _singlePos = groupsToCreate.length === 1
      ? placeSingleNode(baseX, baseY, 'output', nodes, { source: `placement:upload-auto:${id}` })
      : null;
    const _desired: PlacementRect[] = groupsToCreate.map((_, i) => ({
      x: _singlePos?.x ?? baseX,
      y: _singlePos?.y ?? baseY + i * Math.max(280, _sz.h + 40),
      w: _sz.w,
      h: _sz.h,
    }));
    const _off = groupsToCreate.length === 1
      ? { dx: 0, dy: 0 }
      : placeBatchNodes(_desired, nodes, { source: `placement:upload-auto:${id}` });
    const newNodes: Node[] = groupsToCreate.map(({ kind, items }, i) => {
      const newId = `output-auto-up-${id}-${ts}-${kind}-${i}-${Math.random().toString(36).slice(2, 6)}`;
      return {
        id: newId,
        type: 'output',
        position: {
          x: _desired[i].x + _off.dx,
          y: _desired[i].y + _off.dy,
        },
        data: {
          ...createOutputDataFromItems(kind, items),
          ...(outputFromRhDuckDecode ? { rhDuckDecoded: true, rhDuckSourceNodeId: id } : {}),
        },
        selected: false,
      } as Node;
    });
    const newEdges: Edge[] = newNodes.map((node) => ({
      id: `e-auto-up-${node.id}`,
      source: id,
      target: node.id,
      type: 'deletable',
      ...(outputFromRhDuckDecode
        ? { className: 'rh-duck-edge', data: { rhDuckEdge: true } }
        : {}),
    } as Edge));
    rf.addNodes(newNodes);
    rf.setEdges((eds) => [...eds, ...newEdges]);
  };

  // 接入运行总线, 供 NodeActionBar / 批量运行 调起
  useRunTrigger(id, handleRun);

  // === 跨节点拖拽: source (从已上传缩略图 Ctrl+拖出) ===
  const startDrag = useDragMaterialStore((s) => s.start);
  const beginMaterialDrag = (e: React.MouseEvent, payload: MaterialPayload) => {
    if (e.button !== 0) return;
    if (!(e.ctrlKey || e.metaKey)) return;
    e.preventDefault();
    e.stopPropagation();
    startDrag(payload, e.clientX, e.clientY);
  };

  /** 重置:清空所有字段,回到默认拖拽上传状态 */
  const handleReset = () => {
    clearRhDuckUpload(id);
    update({
      uploadType: null,
      imageUrl: undefined,
      imageUrls: undefined,
      videoUrl: undefined,
      videoUrls: undefined,
      audioUrl: undefined,
      audioUrls: undefined,
      fileName: '',
      fileNames: [],
      fileSize: 0,
      fileSizes: [],
      mime: '',
      mimes: [],
    });
    setError(null);
  };

  const uploadSingleFile = async (file: File, kind: UploadKind): Promise<MediaItem> => {
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch('/api/files/upload', { method: 'POST', body: fd });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || `上传失败 HTTP ${res.status}`);
    }
    const json = await res.json();
    if (!json.success || !json.data?.url) {
      throw new Error(json.error || '上传失败:未返回 URL');
    }
    return {
      kind,
      url: json.data.url,
      name: file.name,
      size: file.size,
      mime: file.type,
    };
  };

  /** 真正执行上传(在已确定 kind 后); 同类型多文件会追加到当前合集 */
  const uploadFiles = async (files: File[], kind: UploadKind, skipped = 0) => {
    if (files.length === 0) return;
    setError(null);
    setUploading(true);
    try {
      const uploaded: MediaItem[] = [];
      for (const file of files) {
        uploaded.push(await uploadSingleFile(file, kind));
      }
      const base = uploadType === kind ? mediaItems : [];
      update(createUploadDataFromItems(kind, [...base, ...uploaded]));
      if (skipped > 0) {
        setError(`已上传 ${uploaded.length} 个${KIND_META[kind].label}，跳过 ${skipped} 个非同类型文件`);
      }
    } catch (e: any) {
      setError(e?.message || '上传失败');
    } finally {
      setUploading(false);
    }
  };

  const prepareFiles = (rawFiles: File[]) => {
    const files = rawFiles.filter(Boolean);
    if (files.length === 0) return;
    const inferred = uploadType ?? files.map(inferKindFromFile).find(Boolean) ?? null;
    if (!inferred) {
      setError('无法识别文件类型,请选择图像/视频/音频');
      return;
    }
    const accepted = files.filter((file) => inferKindFromFile(file) === inferred);
    const skipped = files.length - accepted.length;
    if (accepted.length === 0) {
      const km = KIND_META[inferred];
      setError(`文件类型不匹配:期望 ${km.label}`);
      return;
    }
    void uploadFiles(accepted, inferred, skipped);
  };

  /** 文件选择:自动按 MIME 推断 kind 后上传 */
  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = ''; // 允许重复选同一文件
    prepareFiles(files);
  };

  /** 拖拽上传:若 kind 未选则按文件 MIME 自动推断 */
  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    prepareFiles(Array.from(e.dataTransfer?.files || []));
  };

  const triggerPick = () => fileInputRef.current?.click();

  // === 双击 / 上方「Edit」 → 启动图像编辑弹窗（仅 image 类型生效） ===
  // 逻辑对齐 OutputNode：编辑产物以独立 OutputNode 外挂到右侧，
  // 不修改当前上传节点本身的 imageUrl。
  const canEditImage = !!url && uploadType === 'image';
  const openEdit = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (canEditImage && url) setEditingUrl(url);
  };
  const handleProduce = (urls: string[], _meta: ImageEditProduceMeta) => {
    if (!urls || urls.length === 0) return;
    const me = rf.getNode(id);
    const myW = (me as any)?.measured?.width || (me as any)?.width || 260;
    const myH = (me as any)?.measured?.height || (me as any)?.height || 360;
    const baseX = (me?.position?.x ?? 0) + myW + 80;
    const baseY = me?.position?.y ?? 0;
    const COLS = 3;
    const COL_W = 350;
    const ROW_H = Math.max(360, myH);
    const ts = Date.now();
    // v1.2.10.5: 整组防重叠 —— 先算 3 列宫格, 再求公共偏移
    const _sz = defaultSizeOf('output');
    const _desired: PlacementRect[] = urls.map((_, i) => ({
      x: baseX + (i % COLS) * COL_W,
      y: baseY + Math.floor(i / COLS) * ROW_H,
      w: _sz.w, h: _sz.h,
    }));
    const _off = placeBatchNodes(_desired, rf.getNodes(), { source: `placement:upload-produce:${id}` });
    const newNodes: Node[] = urls.map((u, i) => {
      const newId = `output-auto-edit-${id}-${ts}-${i}-${Math.random()
        .toString(36)
        .slice(2, 6)}`;
      return {
        id: newId,
        type: 'output',
        position: {
          x: baseX + (i % COLS) * COL_W + _off.dx,
          y: baseY + Math.floor(i / COLS) * ROW_H + _off.dy,
        },
        data: {
          directImageUrl: u,
          imageUrl: u,
        },
      } as Node;
    });
    rf.addNodes(newNodes);
  };

  const splitUploadCollection = () => {
    if (!uploadType || mediaItems.length <= 1) return;
    const me = rf.getNode(id);
    const myW = (me as any)?.measured?.width || (me as any)?.width || 260;
    const myH = (me as any)?.measured?.height || (me as any)?.height || 240;
    const baseX = (me?.position?.x ?? 0) + myW + 80;
    const baseY = me?.position?.y ?? 0;
    const ts = Date.now();
    const COLS = 3;
    const COL_W = 300;
    const ROW_H = Math.max(240, myH);
    const _sz = defaultSizeOf('upload');
    const _desired: PlacementRect[] = mediaItems.map((_, i) => ({
      x: baseX + (i % COLS) * COL_W,
      y: baseY + Math.floor(i / COLS) * ROW_H,
      w: _sz.w,
      h: _sz.h,
    }));
    const _off = placeBatchNodes(_desired, rf.getNodes(), { source: `placement:split-upload:${id}` });
    const newNodes: Node[] = mediaItems.map((item, i) => ({
      id: `upload-split-${id}-${ts}-${i}-${Math.random().toString(36).slice(2, 6)}`,
      type: 'upload',
      position: {
        x: baseX + (i % COLS) * COL_W + _off.dx,
        y: baseY + Math.floor(i / COLS) * ROW_H + _off.dy,
      },
      data: createUploadDataFromItem(item),
      selected: false,
    } as Node));
    rf.addNodes(newNodes);
  };

  // ==================== 渲染 ====================
  const handleColor = meta?.color || PORT_COLOR.any;
  const effectiveHandleColor = rhDuckMode ? '#ff345f' : yyhPortraitUploadMode ? '#ff4fd8' : handleColor;
  const headerLabel = meta ? `上传${meta.label}` : '上传素材';
  const totalSize = mediaItems.reduce((sum, item) => sum + (item.size || 0), 0);

  return (
    <div
      data-rh-duck-mode={rhDuckMode ? 'true' : undefined}
      data-yyh-portrait-hidden-upload={yyhPortraitUploadMode ? 'true' : undefined}
      className="relative rounded-xl border-2 transition-colors flex flex-col"
      style={{
        background: isDark ? 'rgba(20,20,22,.92)' : 'rgba(255,255,255,.96)',
        backdropFilter: 'blur(8px)',
        borderColor: selected || rhDuckMode ? effectiveHandleColor : isDark ? 'rgba(255,255,255,.15)' : 'rgba(0,0,0,.1)',
        width: size.w,
        height: size.h, // undefined → auto, 上传后被图/视频自然撑高; 拖角后具体 px
        minWidth: 220,
        // 不设 overflow 避免裁掉 ResizableCorners 的 4 角 handle (中心点在节点边缘上)
      }}
    >
      {/* 四角同比例缩放 (仅选中时出现) — 主题色跟随上传类型的端口色 */}
      <ResizableCorners
        selected={selected}
        minWidth={220}
        minHeight={180}
        accent={effectiveHandleColor}
        onResize={(_e, p) => setSize({ w: p.width, h: p.height })}
      />
      {/* 选中时浮动「Edit」按钮 — 仅图像类型可用，与双击预览图等价 */}
      {selected && canEditImage && (
        <button
          type="button"
          className="nodrag nopan"
          onClick={openEdit}
          onMouseDown={(e) => e.stopPropagation()}
          title="编辑图像（裁剪 / 宫格切分），等同双击预览图"
          style={{
            position: 'absolute',
            top: -34,
            left: 0,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '4px 10px',
            height: 26,
            background: isDark ? 'rgba(28,28,32,0.92)' : 'rgba(255,255,255,0.95)',
            color: effectiveHandleColor,
            border: `1px solid ${effectiveHandleColor}66`,
            borderRadius: isPixel ? 0 : 6,
            boxShadow: isPixel
              ? `2px 2px 0 ${effectiveHandleColor}`
              : isDark
                ? '0 6px 24px rgba(0,0,0,0.4)'
                : '0 6px 24px rgba(0,0,0,0.12)',
            cursor: 'pointer',
            fontSize: 12,
            fontWeight: 600,
            zIndex: 30,
          }}
        >
          <Edit3 size={12} />
          <span>Edit</span>
        </button>
      )}
      {/* 仅有 source handle(上传节点不接收输入) */}
      <Handle
        type="source"
        position={Position.Right}
        className="!border-0"
        style={{ background: effectiveHandleColor, width: 10, height: 10 }}
        title={meta ? `输出 ${meta.label}` : '请先选择类型'}
      />

      {/* 头部 */}
      <div
        className={`flex items-center gap-2 px-3 py-2 border-b ${
          isDark ? 'border-white/10' : 'border-black/10'
        }`}
      >
        <div
          className="w-6 h-6 rounded flex items-center justify-center"
          style={{
            background: effectiveHandleColor + '33',
            color: effectiveHandleColor,
            boxShadow: `inset 0 0 0 1px ${effectiveHandleColor}66`,
          }}
        >
          {meta ? <meta.icon size={13} /> : <UploadIcon size={13} />}
        </div>
        <div className={`flex-1 text-sm font-semibold ${isDark ? 'text-white' : 'text-zinc-900'}`}>
          {headerLabel}
        </div>
        {meta && (
          <button
            onClick={handleReset}
            title="重置类型"
            className={`p-1 rounded ${
              isDark ? 'hover:bg-white/10 text-white/60' : 'hover:bg-black/10 text-zinc-600'
            }`}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <RotateCcw size={11} />
          </button>
        )}
      </div>

      {/* body 高度逻辑: root 默认 height=auto 时 body 也 auto 跟随内容 (图/视频) 自然高;
          root 拖角后有具体 px 时, body flex-1 撑满剩余 + min-h-0 允许内容 overflow */}
      <div className={`p-2.5 space-y-2 ${size.h ? 'flex-1 min-h-0 overflow-auto' : ''}`} onMouseDown={(e) => e.stopPropagation()}>
        {/* 隐藏的文件输入: accept 三合一, 上传后自动按 MIME 识别 kind */}
        <input
          ref={fileInputRef}
          type="file"
          accept={meta ? meta.accept : 'image/*,video/*,audio/*'}
          multiple
          className="hidden"
          onChange={handleFileChange}
        />

        {/* 未上传状态: 一个大点击/拖拽区域, 自动识别类型 */}
        {mediaItems.length === 0 && (
          <div
            onClick={triggerPick}
            onDragOver={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDrop}
            className={`cursor-pointer rounded border-2 border-dashed flex flex-col items-center justify-center text-[11px] transition-colors py-6 px-3 ${
              dragActive
                ? 'bg-white/10'
                : isDark
                  ? 'border-white/15 hover:border-white/30 text-white/60'
                  : 'border-black/15 hover:border-black/30 text-zinc-500'
            }`}
            style={dragActive ? { borderColor: effectiveHandleColor } : undefined}
          >
            <UploadIcon size={22} className="mb-1.5" style={{ color: effectiveHandleColor }} />
            <span className="font-medium">
              {uploading ? '上传中...' : dragActive ? '松开以上传' : '点击或拖拽文件'}
            </span>
            <span
              className={`text-[10px] mt-0.5 ${
                isDark ? 'text-white/30' : 'text-zinc-400'
              }`}
            >
              自动识别 图像 / 视频 / 音频 · 支持同类型批量
            </span>
          </div>
        )}

        {/* 已上传:展示预览 + 文件信息 */}
        {mediaItems.length > 0 && uploadType && meta && (
          <div className="group/upload-section space-y-1.5">
            <div className={`flex items-center gap-1.5 text-[10px] ${isDark ? 'text-white/50' : 'text-zinc-500'}`}>
              <meta.icon size={11} />
              <span className="flex-1">{meta.label} ({mediaItems.length})</span>
              <CollectionSplitButton
                count={mediaItems.length}
                kindLabel={meta.label}
                onSplit={splitUploadCollection}
                className="opacity-100 transition sm:opacity-0 sm:group-hover/upload-section:opacity-100 sm:focus-within:opacity-100"
              />
            </div>

            {uploadType === 'image' && (
              <div className={mediaItems.length >= 2 ? 'grid grid-cols-2 gap-1.5' : 'space-y-1'}>
                {mediaItems.map((item, i) => (
                  <div key={`${item.url}-${i}`} className="group/upload-image space-y-0.5">
                    <div className="relative">
                      <img
                        src={item.url}
                        alt={item.name || `图像 ${i + 1}`}
                        className="w-full h-auto rounded block cursor-zoom-in"
                        style={{ background: '#0008', objectFit: 'contain', maxHeight: mediaItems.length >= 2 ? 120 : 480 }}
                        data-drag-source
                        data-drag-kind="image"
                        data-drag-url={item.url}
                        data-drag-preview={item.url}
                        data-drag-node-id={id}
                        data-resource-title={item.name}
                        onMouseDown={(e) =>
                          beginMaterialDrag(e, { kind: 'image', url: item.url, sourceNodeId: id, previewUrl: item.url })
                        }
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          setEditingUrl(item.url);
                        }}
                        title="双击编辑（裁剪 / 宫格切分） · Ctrl+拖拽可送到其他节点"
                      />
                      <ImageHoverPreview
                        src={item.url}
                        alt={item.name || `图像 ${i + 1}`}
                        buttonClassName="absolute right-1.5 top-1.5 z-10 h-7 w-7 p-0 opacity-0 shadow-md transition group-hover/upload-image:opacity-100 focus:opacity-100"
                      />
                    </div>
                    <div className={`flex items-center gap-1 text-[10px] ${isDark ? 'text-white/45' : 'text-zinc-500'}`}>
                      <span className="truncate flex-1" title={item.name}>{item.name || `图像 ${i + 1}`}</span>
                      {item.size ? <span className="opacity-70">{formatMediaSize(item.size)}</span> : null}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {uploadType === 'video' && (
              <div className="space-y-1.5">
                {mediaItems.map((item, i) => (
                  <div key={`${item.url}-${i}`} className="space-y-0.5">
                    <video
                      src={item.url}
                      controls
                      className="w-full h-auto rounded block"
                      style={{ background: '#000', objectFit: 'contain', maxHeight: mediaItems.length >= 2 ? 180 : 480 }}
                      data-drag-source
                      data-drag-kind="video"
                      data-drag-url={item.url}
                      data-drag-preview={item.url}
                      data-drag-node-id={id}
                      data-resource-title={item.name}
                      onMouseDown={(e) =>
                        beginMaterialDrag(e, { kind: 'video', url: item.url, sourceNodeId: id, previewUrl: item.url })
                      }
                    />
                    <div className={`flex items-center gap-1 text-[10px] ${isDark ? 'text-white/45' : 'text-zinc-500'}`}>
                      <span className="truncate flex-1" title={item.name}>{item.name || `视频 ${i + 1}`}</span>
                      {item.size ? <span className="opacity-70">{formatMediaSize(item.size)}</span> : null}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {uploadType === 'audio' && (
              <div className="space-y-1.5">
                {mediaItems.map((item, i) => (
                  <div key={`${item.url}-${i}`} className="space-y-0.5">
                    <audio
                      src={item.url}
                      controls
                      className="w-full"
                      data-drag-source
                      data-drag-kind="audio"
                      data-drag-url={item.url}
                      data-drag-node-id={id}
                      data-resource-title={item.name}
                      onMouseDown={(e) =>
                        beginMaterialDrag(e, { kind: 'audio', url: item.url, sourceNodeId: id })
                      }
                    />
                    <div className={`flex items-center gap-1 text-[10px] ${isDark ? 'text-white/45' : 'text-zinc-500'}`}>
                      <span className="truncate flex-1" title={item.name}>{item.name || `音频 ${i + 1}`}</span>
                      {item.size ? <span className="opacity-70">{formatMediaSize(item.size)}</span> : null}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div
              className={`flex items-center gap-1 text-[10px] ${
                isDark ? 'text-white/50' : 'text-zinc-500'
              }`}
            >
              <span className="truncate flex-1">
                {mediaItems.length} 项{totalSize > 0 ? ` · ${formatMediaSize(totalSize)}` : ''}
              </span>
              <button
                onClick={triggerPick}
                title="继续添加同类型文件"
                className={`nodrag nopan p-0.5 rounded ${
                  isDark ? 'hover:bg-white/10' : 'hover:bg-black/10'
                }`}
                onMouseDown={(e) => e.stopPropagation()}
              >
                <UploadIcon size={11} />
              </button>
              <button
                onClick={handleReset}
                title="清空文件"
                className={`nodrag nopan p-0.5 rounded ${
                  isDark ? 'hover:bg-red-500/20 text-red-400' : 'hover:bg-red-100 text-red-600'
                }`}
                onMouseDown={(e) => e.stopPropagation()}
              >
                <X size={11} />
              </button>
            </div>
          </div>
        )}

        {/* 错误提示 */}
        {error && (
          <div className="flex items-start gap-1 text-[10px] text-red-300 bg-red-500/10 border border-red-500/20 rounded px-2 py-1">
            <AlertCircle size={11} className="mt-0.5 flex-shrink-0" />
            <span className="break-all">{error}</span>
          </div>
        )}

        {/* 输出说明 */}
        {meta && (
          <div
            className={`text-[10px] text-right ${
              isDark ? 'text-white/30' : 'text-zinc-400'
            }`}
          >
            → 输出 {meta.label} (端口色 <span style={{ color: effectiveHandleColor }}>●</span>)
          </div>
        )}
      </div>
      {/* 图像编辑弹窗：产物以独立 OutputNode 外挂到右侧 */}
      {editingUrl && (
        <ImageEditModal
          srcUrl={editingUrl}
          onClose={() => setEditingUrl(null)}
          onProduce={handleProduce}
        />
      )}
    </div>
  );
};

export default memo(UploadNode);
