import { memo, useEffect, useRef, useState } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { AlertCircle, Loader2, Film, Sparkles, Square, X } from 'lucide-react';
import {
  submitSeedance,
  querySeedance,
  type SeedanceSubmitRequest,
} from '../../services/generation';
import { useUpdateNodeData } from './useUpdateNodeData';
import { useHasAutoOutput } from './useHasAutoOutput';
import { useRunTrigger } from '../../hooks/useRunTrigger';
import { logBus } from '../../stores/logs';
import { useThemeStore } from '../../stores/theme';
import { useUpstreamMaterials } from './useUpstreamMaterials';
import { useOrderedMaterials } from './useOrderedMaterials';
import MaterialPreviewSection from './MaterialPreviewSection';
import { useDragMaterialStore, type MaterialPayload } from '../../stores/dragMaterial';
import { useMaterialDropTarget } from '../../hooks/useMaterialDropTarget';

/**
 * SeedanceNode — 字节 Seedance 2.0 视频分镜节点
 * 完全对齐 gpt-image-2-web runSeedance / pollSeedance:
 *   - 上游 endpoint: /seedance/v3/contents/generations/tasks
 *   - 模型: doubao-seedance-2-0-260128 / doubao-seedance-2-0-fast-260128
 *   - content[]: text + image_url(role=first_frame|last_frame|reference_image)
 *                + video_url(role=reference_video) + audio_url(role=reference_audio)
 *   - 参数: duration / ratio / resolution / generate_audio / return_last_frame
 *           / watermark / web_search(tools) / seed
 *   - 轮询: 默认 10s 间隔, 最多 360 次
 *
 * 上游连接(支持的输入):
 *   - text 节点 → prompt
 *   - image 节点 / upload 节点 → reference_image
 *   - 多张同时可用作 first_frame / last_frame (UI 中按顺序取第 1、2 张)
 */

const MODEL_OPTIONS = [
  { value: 'doubao-seedance-2-0-fast-260128', label: 'seedance-2-0-fast' },
  { value: 'doubao-seedance-2-0-260128', label: 'seedance-2-0' },
];
const RATIO_OPTIONS = ['16:9', '9:16', '1:1', '4:3', '3:4', '21:9', '9:21', 'adaptive'];
const RESOLUTION_OPTIONS = ['480p', '720p', 'native1080p', '1080p', '2k', '4k'];
const DURATION_OPTIONS = [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];

const SeedanceNode = ({ id, data, selected }: NodeProps) => {
  const update = useUpdateNodeData(id);
  const hasAutoOutput = useHasAutoOutput(id);
  const [error, setError] = useState<string | null>(null);
  const pollTimer = useRef<number | null>(null);
  const src = `seedance:${id.slice(0, 6)}`;

  // 主题适配
  const { theme, style: themeStyle } = useThemeStore();
  const isDark = theme === 'dark';
  const isPixel = themeStyle === 'pixel';

  const d = (data as any) || {};
  const model: string = d.model || MODEL_OPTIONS[0].value;
  const duration: number = typeof d.duration === 'number' ? d.duration : 5;
  const ratio: string = d.ratio || '16:9';
  const resolution: string = d.resolution || '480p';
  const generateAudio: boolean = d.generateAudio !== false; // 默认 true
  const returnLastFrame: boolean = d.returnLastFrame === true;
  const watermark: boolean = d.watermark === true;
  const webSearch: boolean = d.webSearch === true;
  const seed: number = typeof d.seed === 'number' ? d.seed : -1;
  const maxPoll: number = typeof d.maxPoll === 'number' ? d.maxPoll : 360;
  const pollInt: number = typeof d.pollInt === 'number' ? d.pollInt : 10;
  // 首/末帧使用模式: 'auto' | 'first' | 'firstlast'
  const frameMode: 'auto' | 'first' | 'firstlast' = d.frameMode || 'auto';

  const status: 'idle' | 'submitting' | 'polling' | 'success' | 'error' = d.status || 'idle';
  const taskId: string | undefined = d.taskId;
  const videoUrl: string | undefined = d.videoUrl;
  const progress: string = d.progress || '';
  const localPrompt: string = d.prompt || '';

  // === 上游素材聚合 (跨节点统一机制) ===
  const upstream = useUpstreamMaterials(id);
  const materialOrder: string[] = Array.isArray(d?.materialOrder) ? d.materialOrder : [];
  const orderedTexts = useOrderedMaterials(upstream.texts, materialOrder);
  const orderedImages = useOrderedMaterials(upstream.images, materialOrder);
  const orderedVideos = useOrderedMaterials(upstream.videos, materialOrder);
  const orderedAudios = useOrderedMaterials(upstream.audios, materialOrder);
  const setMaterialOrder = (newOrder: string[]) => update({ materialOrder: newOrder });

  // === 本地拖入参考素材 (跨节点 Ctrl 拖拽) ===
  const localRefImages: string[] = Array.isArray(d?.localRefImages) ? d.localRefImages : [];
  const localRefVideos: string[] = Array.isArray(d?.localRefVideos) ? d.localRefVideos : [];
  const localRefAudios: string[] = Array.isArray(d?.localRefAudios) ? d.localRefAudios : [];

  // 收集上游 prompt + 参考图 + 参考视频 + 参考音频 (按用户拖拽顺序), 并合并本地拖入素材
  const collectUpstream = (): {
    prompt: string;
    imageUrls: string[];
    videoUrls: string[];
    audioUrls: string[];
  } => {
    const prompts = orderedTexts.map((t) => t.url).filter((s) => !!s);
    const upImg = orderedImages.map((m) => m.url).filter((s) => !!s);
    const upVid = orderedVideos.map((m) => m.url).filter((s) => !!s);
    const upAud = orderedAudios.map((m) => m.url).filter((s) => !!s);
    const dedupe = (arr: string[]) => {
      const out: string[] = [];
      for (const v of arr) if (v && out.indexOf(v) === -1) out.push(v);
      return out;
    };
    return {
      prompt: prompts.join('\n').trim(),
      imageUrls: dedupe([...upImg, ...localRefImages]),
      videoUrls: dedupe([...upVid, ...localRefVideos]),
      audioUrls: dedupe([...upAud, ...localRefAudios]),
    };
  };

  const stopPoll = () => {
    if (pollTimer.current) {
      window.clearInterval(pollTimer.current);
      pollTimer.current = null;
    }
  };

  useEffect(() => () => stopPoll(), []);

  const startPolling = (tid: string) => {
    stopPoll();
    let elapsed = 0;
    const POLL_MS = Math.max(2, pollInt) * 1000;
    const MAX = Math.max(10, maxPoll);
    let lastProgress = '';
    pollTimer.current = window.setInterval(async () => {
      elapsed += 1;
      if (elapsed > MAX) {
        stopPoll();
        update({ status: 'error', error: '轮询超时' });
        setError('轮询超时');
        logBus.error(`Seedance 轮询超时(${MAX}次)`, src);
        return;
      }
      try {
        const r = await querySeedance(tid);
        // 进度条估算 (对齐主项目: 30 + a*65/max)
        const pct = Math.min(95, Math.round(30 + (elapsed * 65) / MAX));
        if (r.progress && r.progress !== lastProgress) {
          lastProgress = r.progress;
          logBus.debug(`[${elapsed}/${MAX}] status=${r.status} progress=${r.progress}`, src);
        } else if (elapsed % 3 === 0) {
          logBus.debug(`[${elapsed}/${MAX}] status=${r.status}`, src);
        }
        if (r.status === 'succeeded' && r.videoUrl) {
          stopPoll();
          update({ status: 'success', videoUrl: r.videoUrl, progress: '100%' });
          logBus.success(`任务完成 → ${r.videoUrl}`, src);
        } else if (r.status === 'failed') {
          stopPoll();
          const msg = r.failReason || '生成失败';
          update({ status: 'error', error: msg });
          setError(msg);
          logBus.error(`生成失败: ${msg}`, src);
        } else {
          update({ status: 'polling', progress: `${pct}%` });
        }
      } catch (e: any) {
        // 偶发失败不停止
        console.warn('Seedance 轮询出错', e?.message);
      }
    }, POLL_MS);
  };

  const handleGenerate = async () => {
    setError(null);
    const { prompt: upstreamPrompt, imageUrls, videoUrls, audioUrls } = collectUpstream();
    const finalPrompt = (upstreamPrompt || localPrompt || '').trim();
    if (!finalPrompt) {
      setError('未连接 text 节点也未填写 prompt');
      logBus.error('生成中止: 缺少 prompt', src);
      return;
    }
    update({ status: 'submitting', error: null, videoUrl: null, taskId: null });

    try {
      // 拆分参考图(对齐主项目 sd_firstFrame / sd_lastFrame / sd_refImgs):
      //  - frameMode='auto'(默认): 全部走 reference_image
      //  - frameMode='first':   第 1 张作为 firstFrame, 其余作为 reference_image
      //  - frameMode='firstlast': 第 1 张 first, 第 2 张 last, 其余作为 reference_image
      let firstFrame: string | undefined;
      let lastFrame: string | undefined;
      let refImages: string[] = [];
      if (frameMode === 'first' && imageUrls.length >= 1) {
        firstFrame = imageUrls[0];
        refImages = imageUrls.slice(1);
      } else if (frameMode === 'firstlast' && imageUrls.length >= 1) {
        firstFrame = imageUrls[0];
        if (imageUrls.length >= 2) lastFrame = imageUrls[1];
        refImages = imageUrls.slice(2);
      } else {
        refImages = imageUrls;
      }

      const payload: SeedanceSubmitRequest = {
        model,
        prompt: finalPrompt,
        duration,
        ratio,
        resolution,
        generate_audio: generateAudio,
        return_last_frame: returnLastFrame,
        watermark,
        web_search: webSearch,
      };
      if (seed !== -1) payload.seed = seed;
      if (firstFrame) payload.firstFrame = firstFrame;
      if (lastFrame) payload.lastFrame = lastFrame;
      if (refImages.length) payload.refImages = refImages;
      if (videoUrls.length) payload.videos = videoUrls;
      if (audioUrls.length) payload.audios = audioUrls;

      logBus.info(
        `提交 Seedance2.0: model=${model} ${duration}s ${ratio} ${resolution} ` +
          `audio=${generateAudio} retLast=${returnLastFrame} ` +
          `frame=${frameMode} refs=${refImages.length}` +
          (firstFrame ? ' +first' : '') +
          (lastFrame ? ' +last' : '') +
          (videoUrls.length ? ` +${videoUrls.length}video` : '') +
          (audioUrls.length ? ` +${audioUrls.length}audio` : '') +
          ` prompt="${finalPrompt.slice(0, 30)}…"`,
        src,
      );

      const r = await submitSeedance(payload);
      update({ status: 'polling', taskId: r.taskId, lastPrompt: finalPrompt, progress: '15%' });
      logBus.info(`异步任务已提交 taskId=${r.taskId}, 进入轮询…`, src);
      startPolling(r.taskId);
    } catch (e: any) {
      const msg = e?.message || '提交失败';
      setError(msg);
      update({ status: 'error', error: msg });
      logBus.error(`提交失败: ${msg}`, src);
    }
  };

  const handleStop = () => {
    stopPoll();
    update({ status: 'idle' });
    logBus.warn('用户主动停止', src);
  };

  // 批量运行接入
  useRunTrigger(id, async () => {
    if (status === 'submitting' || status === 'polling') return;
    await handleGenerate();
  });

  // === 跨节点拖拽: source (输出视频可拖出) ===
  const startDrag = useDragMaterialStore((s) => s.start);
  const beginMaterialDrag = (e: React.MouseEvent, payload: MaterialPayload) => {
    if (e.button !== 0 || !(e.ctrlKey || e.metaKey)) return;
    e.preventDefault();
    e.stopPropagation();
    startDrag(payload, e.clientX, e.clientY);
  };

  // === 跨节点拖拽: target (接收 image/video/audio/text) ===
  const handleDrop = (payload: MaterialPayload) => {
    if (payload.kind === 'image' && payload.url) {
      const cur = Array.isArray(d?.localRefImages) ? d.localRefImages : [];
      if (cur.indexOf(payload.url) !== -1) return;
      update({ localRefImages: [...cur, payload.url] });
    } else if (payload.kind === 'video' && payload.url) {
      const cur = Array.isArray(d?.localRefVideos) ? d.localRefVideos : [];
      if (cur.indexOf(payload.url) !== -1) return;
      update({ localRefVideos: [...cur, payload.url] });
    } else if (payload.kind === 'audio' && payload.url) {
      const cur = Array.isArray(d?.localRefAudios) ? d.localRefAudios : [];
      if (cur.indexOf(payload.url) !== -1) return;
      update({ localRefAudios: [...cur, payload.url] });
    } else if (payload.kind === 'text' && typeof payload.text === 'string') {
      update({ prompt: payload.text });
    }
  };
  const { dropProps, isAccepting } = useMaterialDropTarget({
    id,
    accepts: ['image', 'video', 'audio', 'text'],
    onDrop: handleDrop,
  });

  const isBusy = status === 'submitting' || status === 'polling';
  const refsCount = orderedImages.length + localRefImages.length;

  return (
    <div
      {...dropProps}
      className={`relative rounded-xl border-2 transition-all w-[300px] ${
        selected ? 'border-fuchsia-400 shadow-2xl shadow-fuchsia-500/20' : isAccepting ? 'border-emerald-400' : 'border-white/15 hover:border-white/30'
      }`}
      style={{
        background: 'rgba(20,20,22,.92)',
        backdropFilter: 'blur(8px)',
        boxShadow: isAccepting ? '0 0 0 2px rgba(52,211,153,.45), 0 12px 30px rgba(52,211,153,.18)' : undefined,
      }}
    >
      <Handle type="target" position={Position.Left} className="!bg-fuchsia-400 !border-0" />
      <Handle type="source" position={Position.Right} className="!bg-fuchsia-400 !border-0" />

      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/10">
        <div
          className="w-6 h-6 rounded flex items-center justify-center"
          style={{ background: 'rgba(217,70,239,.2)', color: '#f0abfc', boxShadow: 'inset 0 0 0 1px rgba(217,70,239,.45)' }}
        >
          <Film size={13} />
        </div>
        <div className="flex-1">
          <div className="text-sm font-semibold text-white">SD2.0</div>
          <div className="text-[10px] text-white/40">Seedance 2.0 · 字节</div>
        </div>
      </div>

      <div className="p-2.5 space-y-2" onMouseDown={(e) => e.stopPropagation()}>
        {/* 模型 */}
        <div>
          <label className="text-[10px] text-white/50 block mb-1">Model</label>
          <select
            value={model}
            onChange={(e) => update({ model: e.target.value })}
            className="w-full rounded bg-white/5 border border-white/10 px-2 py-1 text-xs text-white outline-none focus:border-white/30"
          >
            {MODEL_OPTIONS.map((m) => (
              <option key={m.value} value={m.value} className="bg-zinc-900">{m.label}</option>
            ))}
          </select>
        </div>

        {/* Duration / Ratio */}
        <div className="grid grid-cols-2 gap-1.5">
          <div>
            <label className="text-[10px] text-white/50 block mb-1">Duration(s)</label>
            <select
              value={String(duration)}
              onChange={(e) => update({ duration: Number(e.target.value) })}
              className="w-full rounded bg-white/5 border border-white/10 px-2 py-1 text-xs text-white outline-none focus:border-white/30"
            >
              {DURATION_OPTIONS.map((s) => (
                <option key={s} value={s} className="bg-zinc-900">{s}s</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] text-white/50 block mb-1">Ratio</label>
            <select
              value={ratio}
              onChange={(e) => update({ ratio: e.target.value })}
              className="w-full rounded bg-white/5 border border-white/10 px-2 py-1 text-xs text-white outline-none focus:border-white/30"
            >
              {RATIO_OPTIONS.map((r) => (
                <option key={r} value={r} className="bg-zinc-900">{r}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Resolution / Seed */}
        <div className="grid grid-cols-2 gap-1.5">
          <div>
            <label className="text-[10px] text-white/50 block mb-1">Resolution</label>
            <select
              value={resolution}
              onChange={(e) => update({ resolution: e.target.value })}
              className="w-full rounded bg-white/5 border border-white/10 px-2 py-1 text-xs text-white outline-none focus:border-white/30"
            >
              {RESOLUTION_OPTIONS.map((r) => (
                <option key={r} value={r} className="bg-zinc-900">{r}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] text-white/50 block mb-1">Seed (-1=随机)</label>
            <input
              type="number"
              value={seed}
              min={-1}
              max={2147483647}
              onChange={(e) => update({ seed: Number(e.target.value) || -1 })}
              className="w-full rounded bg-white/5 border border-white/10 px-2 py-1 text-xs text-white outline-none focus:border-white/30"
            />
          </div>
        </div>

        {/* 帧使用模式 */}
        <div>
          <label className="text-[10px] text-white/50 block mb-1">参考图模式</label>
          <select
            value={frameMode}
            onChange={(e) => update({ frameMode: e.target.value })}
            className="w-full rounded bg-white/5 border border-white/10 px-2 py-1 text-xs text-white outline-none focus:border-white/30"
          >
            <option value="auto" className="bg-zinc-900">全部作参考图(auto)</option>
            <option value="first" className="bg-zinc-900">上传首帧（图生视频）</option>
            <option value="firstlast" className="bg-zinc-900">传入首帧+尾帧（首尾帧视频）</option>
          </select>
        </div>

        {/* 开关组 */}
        <div className="grid grid-cols-2 gap-1.5">
          <label className="flex items-center gap-1 text-[10px] text-white/60 cursor-pointer">
            <input
              type="checkbox"
              checked={generateAudio}
              onChange={(e) => update({ generateAudio: e.target.checked })}
              className="accent-fuchsia-400"
            />
            生成音频
          </label>
          <label className="flex items-center gap-1 text-[10px] text-white/60 cursor-pointer">
            <input
              type="checkbox"
              checked={returnLastFrame}
              onChange={(e) => update({ returnLastFrame: e.target.checked })}
              className="accent-fuchsia-400"
            />
            返回末帧
          </label>
          <label className="flex items-center gap-1 text-[10px] text-white/60 cursor-pointer">
            <input
              type="checkbox"
              checked={webSearch}
              onChange={(e) => update({ webSearch: e.target.checked })}
              className="accent-fuchsia-400"
            />
            Web Search
          </label>
          <label className="flex items-center gap-1 text-[10px] text-white/60 cursor-pointer">
            <input
              type="checkbox"
              checked={watermark}
              onChange={(e) => update({ watermark: e.target.checked })}
              className="accent-fuchsia-400"
            />
            水印
          </label>
        </div>

        {/* 轮询参数 */}
        <div className="grid grid-cols-2 gap-1.5">
          <div>
            <label className="text-[10px] text-white/50 block mb-1">Max Poll</label>
            <input
              type="number"
              value={maxPoll}
              min={10}
              max={1000}
              onChange={(e) => update({ maxPoll: Math.max(10, Math.min(1000, Number(e.target.value) || 360)) })}
              className="w-full rounded bg-white/5 border border-white/10 px-2 py-1 text-xs text-white outline-none focus:border-white/30"
            />
          </div>
          <div>
            <label className="text-[10px] text-white/50 block mb-1">Interval(s)</label>
            <input
              type="number"
              value={pollInt}
              min={2}
              max={60}
              onChange={(e) => update({ pollInt: Math.max(2, Math.min(60, Number(e.target.value) || 10)) })}
              className="w-full rounded bg-white/5 border border-white/10 px-2 py-1 text-xs text-white outline-none focus:border-white/30"
            />
          </div>
        </div>

        {/* 上游素材聚合预览区 (代替原「上游图像计数」, Seedance 支持四类素材全开) */}
        <MaterialPreviewSection
          texts={orderedTexts}
          images={orderedImages}
          videos={orderedVideos}
          audios={orderedAudios}
          order={materialOrder}
          onReorder={setMaterialOrder}
          selected={!!selected}
          isDark={isDark}
          isPixel={isPixel}
          groups={['text', 'image', 'video', 'audio']}
          title={`上游素材 · 参考图 ${refsCount}`}
        />

        {/* 本地拖入参考素材 */}
        {(localRefImages.length + localRefVideos.length + localRefAudios.length) > 0 && (
          <div className="rounded border border-emerald-400/30 bg-emerald-500/5 p-1.5 space-y-1">
            <div className="text-[10px] text-emerald-200/80">
              本地拖入 · 图{localRefImages.length} 视{localRefVideos.length} 音{localRefAudios.length}
            </div>
            {localRefImages.length > 0 && (
              <div className="flex gap-1 flex-wrap">
                {localRefImages.map((u, i) => (
                  <div key={`i${i}`} className="relative w-10 h-10">
                    <img
                      src={u}
                      alt=""
                      onMouseDown={(e) => beginMaterialDrag(e, { kind: 'image', url: u, sourceNodeId: id, previewUrl: u })}
                      className="w-10 h-10 object-cover rounded border border-white/10 cursor-grab"
                    />
                    <button
                      onClick={() => update({ localRefImages: localRefImages.filter((x) => x !== u) })}
                      className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 text-white flex items-center justify-center"
                    >
                      <X size={9} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {localRefVideos.length > 0 && (
              <div className="space-y-1">
                {localRefVideos.map((u, i) => (
                  <div key={`v${i}`} className="flex items-center gap-1">
                    <video
                      src={u}
                      onMouseDown={(e) => beginMaterialDrag(e, { kind: 'video', url: u, sourceNodeId: id, previewUrl: u })}
                      className="w-12 h-8 object-cover rounded border border-white/10 cursor-grab"
                    />
                    <span className="flex-1 truncate text-[10px] text-white/50">{u.split('/').pop()}</span>
                    <button
                      onClick={() => update({ localRefVideos: localRefVideos.filter((x) => x !== u) })}
                      className="text-rose-300/60 hover:text-rose-200"
                    >
                      <X size={11} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {localRefAudios.length > 0 && (
              <div className="space-y-1">
                {localRefAudios.map((u, i) => (
                  <div key={`a${i}`} className="flex items-center gap-1">
                    <span
                      onMouseDown={(e) => beginMaterialDrag(e, { kind: 'audio', url: u, sourceNodeId: id, previewUrl: u })}
                      className="text-[14px] cursor-grab"
                      title="按住 Ctrl 拖拽"
                    >♪</span>
                    <span className="flex-1 truncate text-[10px] text-white/50">{u.split('/').pop()}</span>
                    <button
                      onClick={() => update({ localRefAudios: localRefAudios.filter((x) => x !== u) })}
                      className="text-rose-300/60 hover:text-rose-200"
                    >
                      <X size={11} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Prompt */}
        <div>
          <label className="text-[10px] text-white/50 block mb-1">本地 Prompt(可选)</label>
          <textarea
            value={localPrompt}
            onChange={(e) => update({ prompt: e.target.value })}
            placeholder="备用:无上游连接时使用"
            className="w-full h-12 resize-none rounded bg-white/5 border border-white/10 px-2 py-1 text-[11px] text-white outline-none focus:border-white/30 placeholder:text-white/30"
          />
        </div>

        {!isBusy ? (
          <button
            onClick={handleGenerate}
            className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded bg-fuchsia-500/20 hover:bg-fuchsia-500/30 text-fuchsia-200 text-xs font-medium transition-colors"
          >
            <Sparkles size={12} /> 生成视频
          </button>
        ) : (
          <button
            onClick={handleStop}
            className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded bg-zinc-500/20 hover:bg-zinc-500/30 text-zinc-200 text-xs font-medium transition-colors"
          >
            <Square size={11} /> 停止({progress || (status === 'submitting' ? '提交中' : '排队中')})
          </button>
        )}

        {isBusy && (
          <div className="flex items-center gap-1 text-[10px] text-fuchsia-200/80">
            <Loader2 size={11} className="animate-spin" />
            {status === 'submitting' ? '提交任务...' : `轮询中 ${progress}`}
            {taskId && <span className="ml-auto text-white/30">{taskId.slice(0, 10)}…</span>}
          </div>
        )}

        {error && (
          <div className="flex items-start gap-1 text-[10px] text-red-300 bg-red-500/10 border border-red-500/20 rounded px-2 py-1">
            <AlertCircle size={11} className="mt-0.5 flex-shrink-0" />
            <span className="break-all">{error}</span>
          </div>
        )}
      </div>

      {videoUrl && !hasAutoOutput && (
        <div className="border-t border-white/10 p-2">
          <video
            src={videoUrl}
            controls
            className="w-full rounded"
            style={{ aspectRatio: ratio === 'adaptive' ? undefined : ratio.replace(':', '/') }}
            onMouseDown={(e) => beginMaterialDrag(e, { kind: 'video', url: videoUrl, sourceNodeId: id, previewUrl: videoUrl })}
            title="按住 Ctrl 拖拽到其他节点"
          />
        </div>
      )}
    </div>
  );
};

export default memo(SeedanceNode);
