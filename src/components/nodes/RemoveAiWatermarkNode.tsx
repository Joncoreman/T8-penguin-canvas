import { memo, useEffect, useMemo, useState } from 'react';
import { Handle, Position, useEdges, useNodes } from '@xyflow/react';
import {
  AlertTriangle,
  Eraser,
  FileText,
  Info,
  Loader2,
  Plus,
  ShieldOff,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { getAiWatermarkStatus, processAiWatermark, type AiWatermarkMode, type AiWatermarkOptions, type AiWatermarkRegion, type AiWatermarkStatus } from '../../services/aiWatermark';
import { getMediaItemsFromData, type MediaItem, type MediaKind } from '../../utils/mediaCollection';
import { useRunTrigger } from '../../hooks/useRunTrigger';
import { useUpdateNodeData } from './useUpdateNodeData';
import { useHasAutoOutput } from './useHasAutoOutput';
import SmartImage from '../SmartImage';

const MODE_OPTIONS: Array<{ value: AiWatermarkMode; label: string; hint: string }> = [
  { value: 'smart', label: '智能清理', hint: '可见水印 auto + 元数据清理' },
  { value: 'visible', label: '可见水印', hint: 'Gemini / Doubao / Jimeng 等已知标记' },
  { value: 'erase', label: '框选擦除', hint: '手动区域 inpaint' },
  { value: 'invisible', label: '隐形水印', hint: '需要上游 GPU 可选依赖' },
  { value: 'metadata-check', label: '元数据检查', hint: '仅输出报告' },
  { value: 'metadata-remove', label: '元数据清理', hint: '图片 / 视频 / 音频容器' },
  { value: 'identify', label: '来源鉴别', hint: '输出 JSON 报告' },
];

const DEFAULT_OPTIONS: AiWatermarkOptions = {
  mark: 'auto',
  detect: true,
  inpaint: true,
  inpaintMethod: 'ns',
  inpaintStrength: 0.85,
  stripMetadata: true,
  runInvisible: false,
  regions: [],
  backend: 'cv2',
  eraseMethod: 'telea',
  dilate: 3,
  pipeline: 'default',
  device: 'auto',
  steps: 50,
  humanize: 0,
  unsharp: 0,
  maxResolution: 0,
  minResolution: 1024,
  controlnetScale: 1,
  auto: false,
  adaptivePolish: false,
  restoreFaces: false,
  restoreFacesWeight: 0.5,
  protectText: false,
  protectFaces: false,
  keepStandardMetadata: true,
  noVisible: false,
};

function normalizeMode(value: any): AiWatermarkMode {
  return MODE_OPTIONS.some((item) => item.value === value) ? value : 'smart';
}

function normalizePipeline(value: any): 'default' | 'controlnet' {
  return value === 'controlnet' || value === 'ctrlregen' ? 'controlnet' : 'default';
}

function formatMediaSummary(items: MediaItem[]) {
  const counts = items.reduce<Record<MediaKind, number>>(
    (acc, item) => {
      acc[item.kind] += 1;
      return acc;
    },
    { image: 0, video: 0, audio: 0 },
  );
  return `图像 ${counts.image} · 视频 ${counts.video} · 音频 ${counts.audio}`;
}

function isImageOnlyMode(mode: AiWatermarkMode) {
  return !['metadata-check', 'metadata-remove'].includes(mode);
}

function reportToText(report: any) {
  if (!report) return '';
  if (typeof report.text === 'string') return report.text;
  try {
    return JSON.stringify(report, null, 2);
  } catch {
    return String(report);
  }
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="text-[10px] font-semibold" style={{ color: 'var(--t8-text-muted)' }}>{children}</label>;
}

function SmallHint({ children }: { children: React.ReactNode }) {
  return <div className="text-[10px] leading-snug" style={{ color: 'var(--t8-text-dim)' }}>{children}</div>;
}

function NumberInput({
  value,
  min,
  max,
  step,
  onChange,
}: {
  value: number | '';
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number | '') => void;
}) {
  return (
    <input
      className="t8-input nodrag nowheel w-full px-2 py-1 text-xs"
      type="number"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(event) => {
        const raw = event.target.value;
        onChange(raw === '' ? '' : Number(raw));
      }}
    />
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
  disabled = false,
  title,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <label
      className={`flex items-center gap-2 text-[11px] ${disabled ? 'cursor-not-allowed opacity-55' : 'cursor-pointer'}`}
      style={{ color: 'var(--t8-text-main)' }}
      title={title}
    >
      <input
        className="nodrag"
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      {label}
    </label>
  );
}

function RemoveAiWatermarkNode({ id, data, selected }: { id: string; data: any; selected?: boolean }) {
  const update = useUpdateNodeData(id);
  const edges = useEdges();
  const nodes = useNodes();
  const hasAutoOutput = useHasAutoOutput(id);
  const [status, setStatus] = useState<AiWatermarkStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [localError, setLocalError] = useState('');
  const [previewSize, setPreviewSize] = useState<{ w: number; h: number } | null>(null);

  const d = data || {};
  const mode = normalizeMode(d.aiWatermarkMode);
  const processAll = d.aiWatermarkProcessAll === true;
  const options: AiWatermarkOptions = { ...DEFAULT_OPTIONS, ...(d.aiWatermarkOptions || {}) };
  const statusText = d.status || 'idle';
  const outputUrls: string[] = Array.isArray(d.imageUrls)
    ? d.imageUrls
    : d.imageUrl
      ? [d.imageUrl]
      : [];
  const outputText = typeof d.outputText === 'string' ? d.outputText : '';

  const upstreamItems = useMemo(() => {
    const upstreamIds = edges.filter((edge) => edge.target === id).map((edge) => edge.source);
    const seen = new Set<string>();
    const out: MediaItem[] = [];
    for (const sourceId of upstreamIds) {
      const node = nodes.find((item) => item.id === sourceId);
      const nodeData = node?.data || {};
      for (const kind of ['image', 'video', 'audio'] as MediaKind[]) {
        for (const item of getMediaItemsFromData(nodeData, kind)) {
          if (!item.url || seen.has(item.url)) continue;
          seen.add(item.url);
          out.push(item);
        }
      }
    }
    return out;
  }, [edges, nodes, id, data]);

  const firstPreviewImage = upstreamItems.find((item) => item.kind === 'image')?.url;

  useEffect(() => {
    let cancelled = false;
    setStatusLoading(true);
    getAiWatermarkStatus()
      .then((next) => {
        if (!cancelled) setStatus(next);
      })
      .catch((error) => {
        if (!cancelled) setStatus({
          installed: false,
          markKeys: ['gemini', 'doubao', 'jimeng'],
          optionalFeatures: { invisible: false, lama: false, detect: false, trustmark: false, restore: false, auto: false, controlnet: false, adaptivePolish: false },
          setupHints: [error?.message || '状态检查失败'],
        });
      })
      .finally(() => {
        if (!cancelled) setStatusLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const patchOptions = (patch: Partial<AiWatermarkOptions>) => {
    update({ aiWatermarkOptions: { ...options, ...patch } });
  };

  const setRegions = (regions: AiWatermarkRegion[]) => patchOptions({ regions });

  const addRegion = () => {
    const w = previewSize?.w || 1024;
    const h = previewSize?.h || 1024;
    const rw = Math.min(320, Math.max(64, Math.round(w * 0.24)));
    const rh = Math.min(140, Math.max(48, Math.round(h * 0.1)));
    const next = [
      ...(Array.isArray(options.regions) ? options.regions : []),
      { x: Math.max(0, w - rw - 24), y: Math.max(0, h - rh - 24), w: rw, h: rh },
    ];
    setRegions(next);
  };

  const updateRegion = (index: number, patch: Partial<AiWatermarkRegion>) => {
    const current = Array.isArray(options.regions) ? options.regions : [];
    setRegions(current.map((region, i) => (i === index ? { ...region, ...patch } : region)));
  };

  const removeRegion = (index: number) => {
    const current = Array.isArray(options.regions) ? options.regions : [];
    setRegions(current.filter((_, i) => i !== index));
  };

  const handleRun = async () => {
    setLocalError('');
    const candidates = isImageOnlyMode(mode)
      ? upstreamItems.filter((item) => item.kind === 'image')
      : upstreamItems;
    if (candidates.length === 0) {
      const msg = isImageOnlyMode(mode) ? '请连接上游图像素材' : '请连接上游图像 / 视频 / 音频素材';
      setLocalError(msg);
      update({ status: 'error', error: msg });
      return;
    }
    if (!status?.installed) {
      const msg = `未检测到 remove-ai-watermarks。${(status?.setupHints || []).slice(0, 2).join('；')}`;
      setLocalError(msg);
      update({ status: 'error', error: msg });
      return;
    }
    const selectedItems = processAll ? candidates : candidates.slice(0, 1);
    update({ status: 'running', error: '', outputText: '' });
    try {
      const effectiveOptions: AiWatermarkOptions = {
        ...options,
        restoreFaces: options.restoreFaces === true && status?.optionalFeatures?.restore === true,
      };
      const results = [];
      const imageUrls: string[] = [];
      const videoUrls: string[] = [];
      const audioUrls: string[] = [];
      const texts: string[] = [];
      for (const item of selectedItems) {
        const result = await processAiWatermark({
          source: item.url,
          kind: item.kind,
          mode,
          options: effectiveOptions,
        });
        results.push(result);
        if (result.outputUrl) {
          if (result.outputKind === 'image') imageUrls.push(result.outputUrl);
          else if (result.outputKind === 'video') videoUrls.push(result.outputUrl);
          else if (result.outputKind === 'audio') audioUrls.push(result.outputUrl);
        }
        if (result.outputText || result.report) texts.push(result.outputText || reportToText(result.report));
      }
      const patch: Record<string, any> = {
        status: 'success',
        error: '',
        aiWatermarkResults: results,
        metadata: { aiWatermarkResults: results },
      };
      if (imageUrls.length > 0) {
        patch.imageUrl = imageUrls[0];
        patch.imageUrls = imageUrls;
        patch.urls = imageUrls;
      }
      if (videoUrls.length > 0) {
        patch.videoUrl = videoUrls[0];
        patch.videoUrls = videoUrls;
      }
      if (audioUrls.length > 0) {
        patch.audioUrl = audioUrls[0];
        patch.audioUrls = audioUrls;
      }
      if (texts.length > 0) {
        patch.outputText = texts.join('\n\n---\n\n');
        patch.text = patch.outputText;
        patch.prompt = patch.outputText;
      }
      update(patch);
    } catch (error: any) {
      const msg = error?.message || '去 AI 水印处理失败';
      setLocalError(msg);
      update({ status: 'error', error: msg });
    }
  };

  useRunTrigger(id, handleRun);

  const modeMeta = MODE_OPTIONS.find((item) => item.value === mode) || MODE_OPTIONS[0];
  const marks = ['auto', ...((status?.markKeys || ['gemini', 'doubao', 'jimeng']).filter((item) => item !== 'auto'))];
  const canUseInvisible = status?.optionalFeatures?.invisible;
  const canUseLama = status?.optionalFeatures?.lama;
  const canUseAutoTune = status?.optionalFeatures?.auto !== false;
  const canUseControlnet = status?.optionalFeatures?.controlnet !== false;
  const canUseRestore = status?.optionalFeatures?.restore === true;
  const pipeline = normalizePipeline(options.pipeline);
  const error = localError || d.error || '';

  return (
    <div
      className={`t8-node overflow-hidden ${selected ? 'ring-2' : ''}`}
      style={{
        width: 380,
        borderColor: selected ? 'var(--t8-accent)' : 'var(--t8-border-strong)',
        boxShadow: selected ? '0 0 0 2px color-mix(in srgb, var(--t8-accent) 32%, transparent)' : undefined,
      }}
    >
      <Handle type="target" position={Position.Left} style={{ background: 'var(--t8-accent)', border: '1px solid var(--t8-bg-node)' }} />
      <Handle type="source" position={Position.Right} style={{ background: 'var(--t8-accent)', border: '1px solid var(--t8-bg-node)' }} />

      <div className="t8-node-header flex items-center gap-2 px-3 py-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-md" style={{ background: 'var(--t8-accent)', color: 'var(--t8-accent-text)' }}>
          <ShieldOff size={17} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-bold">去AI水印</div>
          <div className="truncate text-[10px]" style={{ color: 'var(--t8-text-muted)' }}>
            {modeMeta.label} · {modeMeta.hint}
          </div>
        </div>
        <div className="text-[10px] font-bold" style={{ color: status?.installed ? 'var(--t8-accent)' : 'var(--t8-text-dim)' }}>
          {statusLoading ? '检测中' : status?.installed ? (status.runtimeArchivePending ? '内置运行时' : `v${status.version || '?'}`) : '未安装'}
        </div>
      </div>

      <div className="nodrag nowheel space-y-2 p-3">
        <div className="t8-card flex items-start gap-2 px-2 py-2">
          <Info size={14} style={{ color: 'var(--t8-accent)' }} />
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-semibold">{formatMediaSummary(upstreamItems)}</div>
            <SmallHint>用于本人或已授权素材处理；不建议用于规避版权、署名或平台合规标记。</SmallHint>
          </div>
        </div>

        {!status?.installed && (
          <div className="rounded-md border px-2 py-2 text-[10px]" style={{ borderColor: 'var(--t8-border)', color: 'var(--t8-text-muted)' }}>
            {(status?.setupHints || ['pipx install remove-ai-watermarks']).slice(0, 3).map((hint) => (
              <div key={hint}>{hint}</div>
            ))}
          </div>
        )}

        {status?.runtimeArchivePending && (
          <div className="rounded-md border px-2 py-2 text-[10px]" style={{ borderColor: 'var(--t8-border)', color: 'var(--t8-text-muted)' }}>
            已随安装包携带内置运行时归档；首次执行会准备到本机缓存，后续直接复用。
          </div>
        )}

        <div className="grid grid-cols-[1fr_auto] gap-2">
          <div>
            <FieldLabel>模式</FieldLabel>
            <select
              className="t8-select w-full px-2 py-1.5 text-xs"
              value={mode}
              onChange={(event) => update({ aiWatermarkMode: event.target.value })}
            >
              {MODE_OPTIONS.map((item) => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </select>
          </div>
          <label className="mt-5 flex items-center gap-1.5 text-[11px]" style={{ color: 'var(--t8-text-main)' }}>
            <input
              type="checkbox"
              checked={processAll}
              onChange={(event) => update({ aiWatermarkProcessAll: event.target.checked })}
            />
            全部
          </label>
        </div>

        {(mode === 'smart' || mode === 'visible') && (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <FieldLabel>水印类型</FieldLabel>
              <select className="t8-select w-full px-2 py-1 text-xs" value={options.mark || 'auto'} onChange={(e) => patchOptions({ mark: e.target.value })}>
                {marks.map((mark) => <option key={mark} value={mark}>{mark}</option>)}
              </select>
            </div>
            <div>
              <FieldLabel>修补方式</FieldLabel>
              <select className="t8-select w-full px-2 py-1 text-xs" value={options.inpaintMethod || 'ns'} onChange={(e) => patchOptions({ inpaintMethod: e.target.value as any })}>
                <option value="ns">ns</option>
                <option value="telea">telea</option>
                <option value="gaussian">gaussian</option>
              </select>
            </div>
            <ToggleRow label="先识别再处理" checked={options.detect !== false} onChange={(value) => patchOptions({ detect: value })} />
            <ToggleRow label="修补残影" checked={options.inpaint !== false} onChange={(value) => patchOptions({ inpaint: value })} />
            <ToggleRow label="清理元数据" checked={options.stripMetadata !== false} onChange={(value) => patchOptions({ stripMetadata: value })} />
            {mode === 'smart' && <ToggleRow label="追加隐形处理" checked={!!options.runInvisible} onChange={(value) => patchOptions({ runInvisible: value })} />}
          </div>
        )}

        {mode === 'erase' && (
          <div className="space-y-2">
            {firstPreviewImage && (
              <div className="relative rounded-md border p-1" style={{ borderColor: 'var(--t8-border)' }}>
                <img
                  src={firstPreviewImage}
                  alt="preview"
                  className="max-h-36 w-full object-contain"
                  onLoad={(event) => setPreviewSize({ w: event.currentTarget.naturalWidth, h: event.currentTarget.naturalHeight })}
                />
                <SmallHint>区域坐标使用原图像素；可先添加右下角默认区域再微调。</SmallHint>
              </div>
            )}
            <div className="grid grid-cols-3 gap-2">
              <div>
                <FieldLabel>后端</FieldLabel>
                <select className="t8-select w-full px-2 py-1 text-xs" value={options.backend || 'cv2'} onChange={(e) => patchOptions({ backend: e.target.value as any })}>
                  <option value="cv2">cv2</option>
                  <option value="lama" disabled={!canUseLama}>lama{canUseLama ? '' : ' (未装)'}</option>
                </select>
              </div>
              <div>
                <FieldLabel>方法</FieldLabel>
                <select className="t8-select w-full px-2 py-1 text-xs" value={options.eraseMethod || 'telea'} onChange={(e) => patchOptions({ eraseMethod: e.target.value as any })}>
                  <option value="telea">telea</option>
                  <option value="ns">ns</option>
                </select>
              </div>
              <div>
                <FieldLabel>扩张</FieldLabel>
                <NumberInput value={Number(options.dilate ?? 3)} min={0} max={80} onChange={(value) => patchOptions({ dilate: value === '' ? 3 : value })} />
              </div>
            </div>
            <button type="button" className="t8-btn w-full px-2 py-1 text-xs" onClick={addRegion}>
              <Plus size={12} /> 添加擦除区域
            </button>
            {(options.regions || []).map((region, index) => (
              <div key={index} className="grid grid-cols-[1fr_1fr_1fr_1fr_auto] gap-1">
                {(['x', 'y', 'w', 'h'] as const).map((key) => (
                  <input
                    key={key}
                    className="t8-input w-full px-1 py-1 text-[10px]"
                    type="number"
                    value={region[key]}
                    onChange={(e) => updateRegion(index, { [key]: Number(e.target.value) || 0 } as any)}
                    title={key}
                  />
                ))}
                <button type="button" className="t8-btn px-1" onClick={() => removeRegion(index)} title="删除区域">
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        )}

        {(mode === 'invisible' || (mode === 'smart' && options.runInvisible)) && (
          <div className="space-y-2">
            {!canUseInvisible && (
              <div className="flex items-start gap-1 rounded border px-2 py-1 text-[10px]" style={{ borderColor: 'var(--t8-border)', color: 'var(--t8-text-muted)' }}>
                <AlertTriangle size={12} /> 上游 GPU 可选依赖未就绪，运行时会失败或被后端拦截。
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <FieldLabel>设备</FieldLabel>
                <select className="t8-select w-full px-2 py-1 text-xs" value={options.device || 'auto'} onChange={(e) => patchOptions({ device: e.target.value as any })}>
                  {['auto', 'cpu', 'mps', 'cuda', 'xpu'].map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
              <div>
                <FieldLabel>管线</FieldLabel>
                <select className="t8-select w-full px-2 py-1 text-xs" value={pipeline} onChange={(e) => patchOptions({ pipeline: e.target.value as any })}>
                  <option value="default">default</option>
                  <option value="controlnet" disabled={!canUseControlnet}>controlnet{canUseControlnet ? '' : ' (需 0.8.9)'}</option>
                </select>
                <SmallHint>ControlNet 保留文字 / 人脸结构，替代旧保护开关。</SmallHint>
              </div>
              <div>
                <FieldLabel>步数</FieldLabel>
                <NumberInput value={Number(options.steps ?? 50)} min={4} max={200} onChange={(value) => patchOptions({ steps: value === '' ? 50 : value })} />
              </div>
              <div>
                <FieldLabel>强度</FieldLabel>
                <NumberInput value={options.strength === undefined ? '' : Number(options.strength)} min={0} max={1} step={0.05} onChange={(value) => patchOptions({ strength: value === '' ? undefined : value })} />
                <SmallHint>留空使用 0.8.9 的 OpenAI / Google / 未知来源自适应强度。</SmallHint>
              </div>
              <div>
                <FieldLabel>长边上限</FieldLabel>
                <NumberInput value={Number(options.maxResolution ?? 0)} min={0} max={8192} step={64} onChange={(value) => patchOptions({ maxResolution: value === '' ? 0 : value })} />
                <SmallHint>0 为原图；非 0 会按至少 256px 处理。</SmallHint>
              </div>
              <div>
                <FieldLabel>长边下限</FieldLabel>
                <NumberInput value={Number(options.minResolution ?? 1024)} min={0} max={8192} step={64} onChange={(value) => patchOptions({ minResolution: value === '' ? 1024 : value })} />
                <SmallHint>小图默认升到 1024 再扩散，0 关闭。</SmallHint>
              </div>
              <div>
                <FieldLabel>胶片颗粒</FieldLabel>
                <NumberInput value={Number(options.humanize ?? 0)} min={0} max={20} step={0.5} onChange={(value) => patchOptions({ humanize: value === '' ? 0 : value })} />
              </div>
              <div>
                <FieldLabel>锐化</FieldLabel>
                <NumberInput value={Number(options.unsharp ?? 0)} min={0} max={3} step={0.1} onChange={(value) => patchOptions({ unsharp: value === '' ? 0 : value })} />
              </div>
              <div>
                <FieldLabel>结构强度</FieldLabel>
                <NumberInput value={Number(options.controlnetScale ?? 1)} min={0} max={3} step={0.1} onChange={(value) => patchOptions({ controlnetScale: value === '' ? 1 : value })} />
              </div>
              <div>
                <FieldLabel>脸部权重</FieldLabel>
                <NumberInput value={Number(options.restoreFacesWeight ?? 0.5)} min={0} max={1} step={0.05} onChange={(value) => patchOptions({ restoreFacesWeight: value === '' ? 0.5 : value })} />
              </div>
              <ToggleRow label="自动策略 (0.8.9)" checked={options.auto === true || options.autoTune === true} onChange={(value) => patchOptions({ auto: value })} />
              <ToggleRow label="自适应细节抛光" checked={options.adaptivePolish === true} onChange={(value) => patchOptions({ adaptivePolish: value })} />
              <ToggleRow
                label={`GFPGAN 脸部修复${canUseRestore ? '' : '（可选组件未安装）'}`}
                checked={options.restoreFaces === true && canUseRestore}
                disabled={!canUseRestore}
                title="restore 是上游 remove-ai-watermarks 的可选 GFPGAN 脸部修复能力；缺失时不影响普通去水印、元数据清理或基础隐形水印处理。"
                onChange={(value) => patchOptions({ restoreFaces: value })}
              />
              {canUseAutoTune ? (
                <SmallHint>自动策略会由上游按图像内容选择管线、脸部恢复和细节抛光；手动选 controlnet 会覆盖自动管线。</SmallHint>
              ) : (
                <SmallHint>当前 runtime 不是 0.8.9，新参数会自动降级为旧版可识别参数。</SmallHint>
              )}
              {!canUseRestore && (
                <SmallHint>脸部修复是可选增强项，缺失时只是不能开启 GFPGAN 修脸；其它去水印功能仍可正常使用。</SmallHint>
              )}
            </div>
          </div>
        )}

        {(mode === 'metadata-check' || mode === 'metadata-remove') && (
          <ToggleRow label="保留常规元数据" checked={options.keepStandardMetadata !== false} onChange={(value) => patchOptions({ keepStandardMetadata: value })} />
        )}

        {mode === 'identify' && (
          <ToggleRow label="只查元数据" checked={!!options.noVisible} onChange={(value) => patchOptions({ noVisible: value })} />
        )}

        <button
          type="button"
          className="t8-btn t8-btn-primary w-full px-3 py-2 text-sm"
          disabled={statusText === 'running'}
          onClick={handleRun}
        >
          {statusText === 'running' ? <Loader2 size={14} className="animate-spin" /> : mode === 'erase' ? <Eraser size={14} /> : mode.includes('metadata') || mode === 'identify' ? <FileText size={14} /> : <Sparkles size={14} />}
          {statusText === 'running' ? '处理中...' : '运行'}
        </button>

        {error && (
          <div className="rounded-md border px-2 py-1.5 text-[11px]" style={{ borderColor: '#ef444466', color: '#ef4444' }}>
            {error}
          </div>
        )}

        {!hasAutoOutput && outputUrls.length > 0 && (
          <div className="grid grid-cols-3 gap-1">
            {outputUrls.slice(0, 6).map((url) => (
              <SmartImage key={url} src={url} alt="result" className="h-20 w-full rounded object-cover" thumbSize={240} />
            ))}
          </div>
        )}

        {!hasAutoOutput && outputText && (
          <pre className="max-h-36 overflow-auto whitespace-pre-wrap rounded-md px-2 py-2 text-[10px]" style={{ background: 'var(--t8-bg-panel-muted)', color: 'var(--t8-text-main)' }}>
            {outputText}
          </pre>
        )}
      </div>
    </div>
  );
}

export default memo(RemoveAiWatermarkNode);
