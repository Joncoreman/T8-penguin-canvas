import { memo, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { Handle, Position, useReactFlow, type Node, type Edge, type NodeProps } from '@xyflow/react';
import {
  AlertCircle,
  FileImage,
  FileVideo,
  Music,
  RotateCcw,
  Upload as UploadIcon,
  X,
} from 'lucide-react';
import { useUpdateNodeData } from './useUpdateNodeData';
import { useThemeStore } from '../../stores/theme';
import { PORT_COLOR } from '../../config/portTypes';
import { useRunTrigger } from '../../hooks/useRunTrigger';
import { useDragMaterialStore, type MaterialPayload } from '../../stores/dragMaterial';

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
type UploadKind = 'image' | 'video' | 'audio';

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
  const { theme, style } = useThemeStore();
  const isDark = theme === 'dark';
  const isPixel = style === 'pixel';
  const fileInputRef = useRef<HTMLInputElement>(null);
  const rf = useReactFlow();

  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const d = data as any;
  const uploadType: UploadKind | null = d?.uploadType ?? null;
  const fileName: string = d?.fileName || '';
  const fileSize: number = d?.fileSize || 0;
  const meta = uploadType ? KIND_META[uploadType] : null;
  const url: string | undefined = meta ? d?.[meta.dataField] : undefined;

  // === 运行总线: 点击 RUN 后根据已上传素材生成下游 OutputNode ===
  // 设计要点:
  //   1. 只有 url 已就绪才会创建, 未上传会报错
  //   2. 防重复: 检查是否已存在 source=id, target.type='output' 且 data.directXxxUrl=当前 url 的下游
  //      若已存在则仅提示不重复创建
  //   3. 创建后节点 id 以 'output-auto-up-' 开头, 避开 'output-auto-' 网格重排接管
  const handleRun = async () => {
    setError(null);
    if (!uploadType || !meta || !url) {
      const msg = '请先上传素材';
      setError(msg);
      throw new Error(msg);
    }
    // 防重复检测
    const edges = rf.getEdges();
    const nodes = rf.getNodes();
    const dupExisted = edges.some((e) => {
      if (e.source !== id) return false;
      const t = nodes.find((n) => n.id === e.target);
      if (!t || t.type !== 'output') return false;
      const td = (t.data as any) || {};
      return td.directImageUrl === url || td.directVideoUrl === url || td.directAudioUrl === url;
    });
    if (dupExisted) {
      // 已有指向同一 url 的下游 OutputNode, 不重复创建
      return;
    }
    const me = rf.getNode(id);
    const myW = (me as any)?.measured?.width || (me as any)?.width || 320;
    const baseX = (me?.position?.x ?? 0) + myW + 80;
    const baseY = me?.position?.y ?? 0;
    const ts = Date.now();
    const newId = `output-auto-up-${id}-${ts}-${Math.random().toString(36).slice(2, 6)}`;
    // 按 uploadType 写入不同的 direct* 字段, 让 OutputNode 能独立展示
    const dataPatch: Record<string, any> = {};
    if (uploadType === 'image') {
      dataPatch.directImageUrl = url;
      dataPatch.imageUrl = url;
    } else if (uploadType === 'video') {
      dataPatch.directVideoUrl = url;
      dataPatch.videoUrl = url;
    } else if (uploadType === 'audio') {
      dataPatch.directAudioUrl = url;
      dataPatch.audioUrl = url;
    }
    const newNode: Node = {
      id: newId,
      type: 'output',
      position: { x: baseX, y: baseY },
      data: dataPatch,
      selected: false,
    } as Node;
    const newEdge: Edge = {
      id: `e-auto-up-${newId}`,
      source: id,
      target: newId,
      type: 'deletable',
    } as Edge;
    rf.addNodes(newNode);
    rf.setEdges((eds) => [...eds, newEdge]);
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
    update({
      uploadType: null,
      imageUrl: undefined,
      videoUrl: undefined,
      audioUrl: undefined,
      fileName: '',
      fileSize: 0,
      mime: '',
    });
    setError(null);
  };

  /** 真正执行上传(在已确定 kind 后) */
  const uploadFile = async (file: File, kind: UploadKind) => {
    setError(null);
    setUploading(true);
    try {
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
      const km = KIND_META[kind];
      update({
        uploadType: kind,
        [km.dataField]: json.data.url,
        fileName: file.name,
        fileSize: file.size,
        mime: file.type,
      });
    } catch (e: any) {
      setError(e?.message || '上传失败');
    } finally {
      setUploading(false);
    }
  };

  /** 文件选择:自动按 MIME 推断 kind 后上传 */
  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // 允许重复选同一文件
    if (!file) return;
    const inferred = uploadType ?? inferKindFromFile(file);
    if (!inferred) {
      setError('无法识别文件类型,请选择图像/视频/音频');
      return;
    }
    // 若已选定类型且不匹配, 提示错误
    if (uploadType && uploadType !== inferred) {
      const km = KIND_META[uploadType];
      setError(`文件类型不匹配:期望 ${km.label},得到 ${file.type || '未知'}`);
      return;
    }
    void uploadFile(file, inferred);
  };

  /** 拖拽上传:若 kind 未选则按文件 MIME 自动推断 */
  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const file = e.dataTransfer?.files?.[0];
    if (!file) return;
    const inferred = uploadType ?? inferKindFromFile(file);
    if (!inferred) {
      setError('无法识别文件类型,请选择图像/视频/音频');
      return;
    }
    void uploadFile(file, inferred);
  };

  const triggerPick = () => fileInputRef.current?.click();

  // ==================== 渲染 ====================
  const handleColor = meta?.color || PORT_COLOR.any;
  const headerLabel = meta ? `上传${meta.label}` : '上传素材';

  return (
    <div
      className="relative rounded-xl border-2 transition-colors w-[260px]"
      style={{
        background: isDark ? 'rgba(20,20,22,.92)' : 'rgba(255,255,255,.96)',
        backdropFilter: 'blur(8px)',
        borderColor: selected ? handleColor : isDark ? 'rgba(255,255,255,.15)' : 'rgba(0,0,0,.1)',
      }}
    >
      {/* 仅有 source handle(上传节点不接收输入) */}
      <Handle
        type="source"
        position={Position.Right}
        className="!border-0"
        style={{ background: handleColor, width: 10, height: 10 }}
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
            background: handleColor + '33',
            color: handleColor,
            boxShadow: `inset 0 0 0 1px ${handleColor}66`,
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

      {/* body */}
      <div className="p-2.5 space-y-2" onMouseDown={(e) => e.stopPropagation()}>
        {/* 隐藏的文件输入: accept 三合一, 上传后自动按 MIME 识别 kind */}
        <input
          ref={fileInputRef}
          type="file"
          accept={meta ? meta.accept : 'image/*,video/*,audio/*'}
          className="hidden"
          onChange={handleFileChange}
        />

        {/* 未上传状态: 一个大点击/拖拽区域, 自动识别类型 */}
        {!url && (
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
            style={dragActive ? { borderColor: handleColor } : undefined}
          >
            <UploadIcon size={22} className="mb-1.5" style={{ color: handleColor }} />
            <span className="font-medium">
              {uploading ? '上传中...' : dragActive ? '松开以上传' : '点击或拖拽文件'}
            </span>
            <span
              className={`text-[10px] mt-0.5 ${
                isDark ? 'text-white/30' : 'text-zinc-400'
              }`}
            >
              自动识别 图像 / 视频 / 音频
            </span>
          </div>
        )}

        {/* 已上传:展示预览 + 文件信息 */}
        {url && uploadType && meta && (
          <div className="space-y-1.5">
            {uploadType === 'image' && (
              <img
                src={url}
                alt={fileName}
                className="w-full h-auto rounded block"
                style={{ background: '#0008', objectFit: 'contain', maxHeight: 480 }}
                onMouseDown={(e) =>
                  beginMaterialDrag(e, { kind: 'image', url, sourceNodeId: id, previewUrl: url })
                }
                title="Ctrl+拖拽可送到其他节点"
              />
            )}
            {uploadType === 'video' && (
              <video
                src={url}
                controls
                className="w-full h-auto rounded block"
                style={{ background: '#000', objectFit: 'contain', maxHeight: 480 }}
                onMouseDown={(e) =>
                  beginMaterialDrag(e, { kind: 'video', url, sourceNodeId: id, previewUrl: url })
                }
              />
            )}
            {uploadType === 'audio' && (
              <audio
                src={url}
                controls
                className="w-full"
                onMouseDown={(e) =>
                  beginMaterialDrag(e, { kind: 'audio', url, sourceNodeId: id })
                }
              />
            )}
            <div
              className={`flex items-center gap-1 text-[10px] ${
                isDark ? 'text-white/50' : 'text-zinc-500'
              }`}
            >
              <span className="truncate flex-1" title={fileName}>
                {fileName || '未命名'}
              </span>
              {fileSize > 0 && (
                <span className="opacity-70">
                  {(fileSize / 1024).toFixed(1)} KB
                </span>
              )}
              <button
                onClick={triggerPick}
                title="替换文件"
                className={`p-0.5 rounded ${
                  isDark ? 'hover:bg-white/10' : 'hover:bg-black/10'
                }`}
              >
                <UploadIcon size={11} />
              </button>
              <button
                onClick={handleReset}
                title="清空文件"
                className={`p-0.5 rounded ${
                  isDark ? 'hover:bg-red-500/20 text-red-400' : 'hover:bg-red-100 text-red-600'
                }`}
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
            → 输出 {meta.label} (端口色 <span style={{ color: handleColor }}>●</span>)
          </div>
        )}
      </div>
    </div>
  );
};

export default memo(UploadNode);
