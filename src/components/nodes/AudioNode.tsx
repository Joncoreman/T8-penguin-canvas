import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { AlertCircle, Loader2, Music, Sparkles, Square, Upload, X } from 'lucide-react';
import { submitAudio, queryAudio, uploadAudioForSuno, type AudioMode } from '../../services/generation';
import { SUNO_VERSIONS, DEFAULT_SUNO_VERSION } from '../../providers/models';
import { useUpdateNodeData } from './useUpdateNodeData';
import { useHasAutoOutput } from './useHasAutoOutput';
import { useRunTrigger } from '../../hooks/useRunTrigger';
import { logBus } from '../../stores/logs';
import { PORT_COLOR } from '../../config/portTypes';
import { useThemeStore } from '../../stores/theme';
import { useUpstreamMaterials } from './useUpstreamMaterials';
import { useOrderedMaterials } from './useOrderedMaterials';
import MaterialPreviewSection from './MaterialPreviewSection';
import { useDragMaterialStore, type MaterialPayload } from '../../stores/dragMaterial';
import { useMaterialDropTarget } from '../../hooks/useMaterialDropTarget';

/**
 * AudioNode - Suno (generate / cover / extend) — 完全对齐 gpt-image-2-web
 * 参考: gpt-image-2-web/index.html runSuno (L3979) / runSunoCover (L4282) / runSunoExtend (L4313) / pollSuno (L4015) / _sunoUploadAudio (L4210)
 * 该节点不提供 FAL 模式。
 */

const MODES: Array<{ id: AudioMode; label: string }> = [
  { id: 'generate', label: '生成' },
  { id: 'cover', label: '翻唱(Cover)' },
  { id: 'extend', label: '续写(Extend)' },
];

const AudioNode = ({ id, data, selected }: NodeProps) => {
  const update = useUpdateNodeData(id);
  const hasAutoOutput = useHasAutoOutput(id);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const pollTimer = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const src = `audio:${id.slice(0, 6)}`;

  // 主题适配
  const { theme, style: themeStyle } = useThemeStore();
  const isDark = theme === 'dark';
  const isPixel = themeStyle === 'pixel';

  const d = data as any;
  const mode: AudioMode = d?.mode || 'generate';
  const version: string = d?.version || DEFAULT_SUNO_VERSION;
  const title: string = d?.title || '';
  const tags: string = d?.tags || '';
  const localPrompt: string = d?.prompt || '';
  const seed: number = typeof d?.seed === 'number' ? d.seed : 0;
  const continueAt: number = d?.continueAt ?? 28;
  // 预传 clipId(手动调起 _sunoUploadAudio 后保存)
  const uploadedClipId: string = d?.uploadedClipId || '';
  const uploadedFilename: string = d?.uploadedFilename || '';

  const status: 'idle' | 'submitting' | 'polling' | 'success' | 'error' = d?.status || 'idle';
  const taskId: string | undefined = d?.taskId;
  const tracks: Array<{ id?: string; clipId?: string; audioUrl: string; remoteUrl?: string; imageUrl?: string; title?: string; tags?: string }>
    = d?.tracks || [];
  const pollProgress: string = d?.progress || '';

  const stopPoll = () => {
    if (pollTimer.current) {
      window.clearInterval(pollTimer.current);
      pollTimer.current = null;
    }
  };
  useEffect(() => () => stopPoll(), []);

  // === 上游素材聚合 (跨节点统一机制) ===
  const upstream = useUpstreamMaterials(id);
  const materialOrder: string[] = Array.isArray(d?.materialOrder) ? d.materialOrder : [];
  const orderedTexts = useOrderedMaterials(upstream.texts, materialOrder);
  const orderedAudios = useOrderedMaterials(upstream.audios, materialOrder);
  const setMaterialOrder = (newOrder: string[]) => update({ materialOrder: newOrder });

  // === 本地拖入参考音频 (跨节点 Ctrl 拖拽) ===
  const localRefAudio: string = typeof d?.localRefAudio === 'string' ? d.localRefAudio : '';
  
  // 分组动态跟随模式: generate 只要文本, cover/extend 需要参考音频
  const previewGroups = useMemo<ReadonlyArray<'text' | 'image' | 'video' | 'audio'>>(
    () => (mode === 'generate' ? ['text'] : ['text', 'audio']),
    [mode],
  );
  
  // 收集上游: prompt + audioUrl(cover/extend 兼底, 取 ordered 首个, 后补本地拖入)
  const collectUpstream = (): { prompt: string; audioUrl: string } => {
    const prompt = orderedTexts.map((t) => t.url).filter((s) => !!s).join('\n').trim();
    const audioUrl = orderedAudios[0]?.url || localRefAudio || '';
    return { prompt, audioUrl };
  };

  // 上传本地音频 → 获取 clipId
  const uploadFile = async (file: File): Promise<string> => {
    setUploading(true);
    try {
      logBus.info(`上传音频: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`, src);
      const r = await uploadAudioForSuno(file);
      update({ uploadedClipId: r.clipId, uploadedFilename: r.filename });
      logBus.success(`上传成功, clipId=${r.clipId}`, src);
      return r.clipId;
    } finally {
      setUploading(false);
    }
  };

  // 将 URL 抓为 File 后上传(上游节点传入 audioUrl 时)
  const fetchUrlAndUpload = async (url: string): Promise<string> => {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`下载上游音频失败: ${resp.status}`);
    const blob = await resp.blob();
    const ext = (url.match(/\.(mp3|wav|m4a|ogg|flac|aac)/i)?.[1] || 'mp3').toLowerCase();
    const file = new File([blob], `upstream_audio.${ext}`, { type: blob.type || 'audio/mpeg' });
    return await uploadFile(file);
  };

  const onSelectFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setError(null);
    try {
      await uploadFile(f);
    } catch (err: any) {
      setError(err?.message || '上传失败');
      logBus.error(err?.message || '上传失败', src);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const clearUpload = () => update({ uploadedClipId: '', uploadedFilename: '' });

  // 轮询: 3000ms × 60 次 (3 分钟) — 对齐主项目默认 maxPoll/pollInt
  const startPolling = (clipIds: string[]) => {
    stopPoll();
    let elapsed = 0;
    const POLL_INT = 3000;
    const MAX = 60;
    pollTimer.current = window.setInterval(async () => {
      elapsed += 1;
      if (elapsed > MAX) {
        stopPoll();
        update({ status: 'error', error: '轮询超时 (3min)' });
        setError('轮询超时 (3min)');
        logBus.error('轮询超时', src);
        return;
      }
      try {
        const r = await queryAudio(clipIds, true);
        if (r.status === 'SUCCESS' && r.tracks.length > 0) {
          stopPoll();
          // 双输出口: audioUrl=轨1, audioUrl_1=轨2
          update({
            status: 'success',
            tracks: r.tracks,
            audioUrl: r.tracks[0]?.audioUrl || '',
            audioUrl_1: r.tracks[1]?.audioUrl || '',
            progress: `${r.completed}/${r.total}`,
          });
          logBus.success(`完成 ${r.tracks.length} 轨: ${r.tracks.map((t) => t.audioUrl).join(' | ')}`, src);
        } else {
          update({ status: 'polling', progress: `${r.completed}/${r.total} · #${elapsed}` });
          if (elapsed % 3 === 0) logBus.info(`轮询 #${elapsed} · ${r.completed}/${r.total}`, src);
        }
      } catch (e: any) {
        logBus.warn(`轮询出错: ${e?.message}`, src);
      }
    }, POLL_INT);
  };

  const handleGenerate = async () => {
    setError(null);
    const upstream = collectUpstream();
    const finalPrompt = (upstream.prompt || localPrompt || '').trim();
    if (!finalPrompt) {
      setError('请填写歌词 / 提示词');
      return;
    }
    update({ status: 'submitting', error: null, tracks: [], audioUrl: undefined });
    try {
      // cover/extend: 如预传 clipId 为空但上游有 audioUrl, 则自动上传
      let clipIdForRef = uploadedClipId;
      if ((mode === 'cover' || mode === 'extend') && !clipIdForRef && upstream.audioUrl) {
        logBus.info('检测到上游音频 URL, 自动上传 Suno...', src);
        clipIdForRef = await fetchUrlAndUpload(upstream.audioUrl);
      }
      if ((mode === 'cover' || mode === 'extend') && !clipIdForRef) {
        throw new Error(`${mode === 'cover' ? '翻唱' : '续写'}模式需先上传参考音频 (或连接上游音频节点)`);
      }

      logBus.info(`提交 Suno ${version} (${mode})...`, src);
      const r = await submitAudio({
        mode,
        prompt: finalPrompt,
        title: title || '',
        tags: tags || '',
        version,
        seed: seed > 0 ? seed : undefined,
        cover_clip_id: mode === 'cover' ? clipIdForRef : undefined,
        continue_clip_id: mode === 'extend' ? clipIdForRef : undefined,
        continue_at: mode === 'extend' ? continueAt : undefined,
      });
      logBus.success(`taskId=${r.taskId} clips=${(r.clipIds || []).join(',') || '?'}`, src);
      update({ status: 'polling', taskId: r.taskId, clipIds: r.clipIds, lastPrompt: finalPrompt, progress: '0/?' });
      const idsToPoll = r.clipIds && r.clipIds.length > 0 ? r.clipIds : [r.taskId];
      startPolling(idsToPoll);
    } catch (e: any) {
      const msg = e?.message || '提交失败';
      setError(msg);
      logBus.error(msg, src);
      update({ status: 'error', error: msg });
    }
  };

  const handleStop = () => {
    stopPoll();
    update({ status: 'idle' });
  };

  // 接入运行总线
  useRunTrigger(id, async () => {
    if (status === 'submitting' || status === 'polling') return;
    await handleGenerate();
  });

  // === 跨节点拖拽: source (输出 tracks 可拖出) ===
  const startDrag = useDragMaterialStore((s) => s.start);
  const beginMaterialDrag = (e: React.MouseEvent, payload: MaterialPayload) => {
    if (e.button !== 0 || !(e.ctrlKey || e.metaKey)) return;
    e.preventDefault();
    e.stopPropagation();
    startDrag(payload, e.clientX, e.clientY);
  };

  // === 跨节点拖拽: target (接收 audio → localRefAudio, text → prompt) ===
  const handleDrop = (payload: MaterialPayload) => {
    if (payload.kind === 'audio' && payload.url) {
      update({ localRefAudio: payload.url, uploadedClipId: '', uploadedFilename: '' });
      logBus.info('已接受拖入参考音频, 生成时将自动上传', src);
    } else if (payload.kind === 'text' && typeof payload.text === 'string') {
      update({ prompt: payload.text });
    }
  };
  const { dropProps, isAccepting } = useMaterialDropTarget({
    id,
    accepts: ['audio', 'text'],
    onDrop: handleDrop,
  });

  const isBusy = status === 'submitting' || status === 'polling';
  const showRefArea = mode === 'cover' || mode === 'extend';
  const audioColor = PORT_COLOR.audio;

  return (
    <div
      {...dropProps}
      className={`relative rounded-xl border-2 transition-all w-[320px] ${
        selected ? 'border-violet-400 shadow-2xl shadow-violet-500/20' : isAccepting ? 'border-emerald-400' : 'border-white/15 hover:border-white/30'
      }`}
      style={{
        background: 'rgba(20,20,22,.92)',
        backdropFilter: 'blur(8px)',
        boxShadow: isAccepting ? '0 0 0 2px rgba(52,211,153,.45), 0 12px 30px rgba(52,211,153,.18)' : undefined,
      }}
    >
      <Handle type="target" position={Position.Left} style={{ background: audioColor, border: 0 }} />
      {/* 双输出口: 轨道 1 / 轨道 2 */}
      <Handle type="source" id="audio-0" position={Position.Right} style={{ background: audioColor, border: 0, top: '48%' }} />
      <Handle type="source" id="audio-1" position={Position.Right} style={{ background: audioColor, border: 0, top: '52%' }} />
      {/* 轨道标签 */}
      <div className="absolute right-[-2px] text-[8px] font-bold text-violet-300/70 pointer-events-none" style={{ top: '48%', transform: 'translateX(100%) translateY(-50%)' }}>♪1</div>
      <div className="absolute right-[-2px] text-[8px] font-bold text-violet-300/70 pointer-events-none" style={{ top: '52%', transform: 'translateX(100%) translateY(-50%)' }}>♪2</div>

      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/10">
        <div
          className="w-6 h-6 rounded flex items-center justify-center"
          style={{ background: 'rgba(139,92,246,.2)', color: audioColor, boxShadow: 'inset 0 0 0 1px rgba(139,92,246,.45)' }}
        >
          <Music size={13} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-white">音频 Suno</div>
          <div className="text-[10px] text-white/40 truncate">
            {version} · {MODES.find((m) => m.id === mode)?.label}
          </div>
        </div>
      </div>

      <div className="p-2.5 space-y-2" onMouseDown={(e) => e.stopPropagation()}>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] text-white/50 block mb-1">模式</label>
            <select
              value={mode}
              onChange={(e) => update({ mode: e.target.value })}
              className="w-full rounded bg-white/5 border border-white/10 px-2 py-1 text-xs text-white outline-none focus:border-white/30"
            >
              {MODES.map((m) => (
                <option key={m.id} value={m.id} className="bg-zinc-900">
                  {m.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] text-white/50 block mb-1">版本</label>
            <select
              value={version}
              onChange={(e) => update({ version: e.target.value })}
              className="w-full rounded bg-white/5 border border-white/10 px-2 py-1 text-xs text-white outline-none focus:border-white/30"
            >
              {SUNO_VERSIONS.map((v) => (
                <option key={v.value} value={v.value} className="bg-zinc-900">
                  {v.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="text-[10px] text-white/50 block mb-1">标题</label>
          <input
            type="text"
            value={title}
            onChange={(e) => update({ title: e.target.value })}
            placeholder="My Song"
            className="w-full rounded bg-white/5 border border-white/10 px-2 py-1 text-xs text-white outline-none focus:border-white/30 placeholder:text-white/30"
          />
        </div>
        <div>
          <label className="text-[10px] text-white/50 block mb-1">风格 Tags</label>
          <input
            type="text"
            value={tags}
            onChange={(e) => update({ tags: e.target.value })}
            placeholder="pop, electronic, female vocal"
            className="w-full rounded bg-white/5 border border-white/10 px-2 py-1 text-xs text-white outline-none focus:border-white/30 placeholder:text-white/30"
          />
        </div>
        <div>
          <label className="text-[10px] text-white/50 block mb-1">歌词 / 提示词</label>
          <textarea
            value={localPrompt}
            onChange={(e) => update({ prompt: e.target.value })}
            placeholder="[Verse]..."
            className="w-full h-16 resize-none rounded bg-white/5 border border-white/10 px-2 py-1 text-[11px] text-white outline-none focus:border-white/30 placeholder:text-white/30"
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] text-white/50 block mb-1">Seed (0=随机)</label>
            <input
              type="number"
              value={seed}
              onChange={(e) => update({ seed: parseInt(e.target.value) || 0 })}
              className="w-full rounded bg-white/5 border border-white/10 px-2 py-1 text-xs text-white outline-none focus:border-white/30"
            />
          </div>
          {mode === 'extend' && (
            <div>
              <label className="text-[10px] text-white/50 block mb-1">续点 (s)</label>
              <input
                type="number"
                value={continueAt}
                onChange={(e) => update({ continueAt: parseInt(e.target.value) || 28 })}
                className="w-full rounded bg-white/5 border border-white/10 px-2 py-1 text-xs text-white outline-none focus:border-white/30"
              />
            </div>
          )}
        </div>

        {/* 上游素材聚合预览区 (generate=仅文本, cover/extend=文本+音频) */}
        <MaterialPreviewSection
          texts={orderedTexts}
          audios={orderedAudios}
          order={materialOrder}
          onReorder={setMaterialOrder}
          selected={!!selected}
          isDark={isDark}
          isPixel={isPixel}
          groups={previewGroups}
          title={mode === 'generate' ? '上游素材 · 歌词提示' : '上游素材 · 参考音频'}
        />

        {showRefArea && (
          <div className="rounded border border-violet-400/30 bg-violet-500/5 p-2 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-violet-200/80">
                {mode === 'cover' ? '参考音频 (Cover)' : '参考音频 (Extend)'}
              </span>
              {(uploadedClipId || localRefAudio) && (
                <button
                  onClick={() => {
                    clearUpload();
                    if (localRefAudio) update({ localRefAudio: '' });
                  }}
                  className="text-violet-300/60 hover:text-violet-100"
                  title="清除"
                >
                  <X size={11} />
                </button>
              )}
            </div>
            {uploadedClipId ? (
              <div className="text-[10px] text-violet-100/90 truncate">
                🎵 {uploadedFilename || uploadedClipId.slice(0, 12)}
                <span className="text-white/40 ml-1">({uploadedClipId.slice(0, 8)}…)</span>
              </div>
            ) : localRefAudio ? (
              <div className="text-[10px] text-emerald-200/90 truncate">
                📥 本地拖入: {localRefAudio.split('/').pop()}
                <span className="text-white/40 ml-1">(生成时上传)</span>
              </div>
            ) : (
              <div className="text-[10px] text-white/40">未上传 · 连接上游音频节点可自动拉取</div>
            )}
            <div className="flex gap-1.5">
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*"
                className="hidden"
                onChange={onSelectFile}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="flex-1 flex items-center justify-center gap-1 py-1 rounded bg-white/5 hover:bg-white/10 text-violet-100 text-[10px] disabled:opacity-50"
              >
                {uploading ? <Loader2 size={10} className="animate-spin" /> : <Upload size={10} />}
                {uploading ? '上传中…' : '上传本地音频'}
              </button>
            </div>
          </div>
        )}

        {!isBusy ? (
          <button
            onClick={handleGenerate}
            className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded bg-violet-500/20 hover:bg-violet-500/30 text-violet-200 text-xs font-medium transition-colors"
          >
            <Sparkles size={12} /> 生成音频
          </button>
        ) : (
          <button
            onClick={handleStop}
            className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded bg-zinc-500/20 hover:bg-zinc-500/30 text-zinc-200 text-xs font-medium transition-colors"
          >
            <Square size={11} /> 停止
          </button>
        )}

        {isBusy && (
          <div className="flex items-center gap-1 text-[10px] text-violet-200/80">
            <Loader2 size={11} className="animate-spin" />
            {status === 'submitting' ? '提交任务...' : `轮询中 ${pollProgress}`}
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

      {tracks.length > 0 && !hasAutoOutput && (
        <div className="border-t border-white/10 p-2 space-y-2">
          {tracks.map((t, i) => (
            <div key={t.id || i} className="space-y-1">
              <div className="flex items-center gap-1 text-[10px] text-white/60">
                <span className="text-violet-200">#{i + 1}</span>
                {t.title && <span className="truncate">🎵 {t.title}</span>}
                {t.clipId && <span className="ml-auto text-white/30">{t.clipId.slice(0, 8)}…</span>}
              </div>
              <audio
                src={t.audioUrl}
                controls
                className="w-full h-8"
                data-drag-source
                data-drag-kind="audio"
                data-drag-url={t.audioUrl}
                data-drag-preview={t.audioUrl}
                data-drag-node-id={id}
                onMouseDown={(e) => beginMaterialDrag(e, { kind: 'audio', url: t.audioUrl, sourceNodeId: id, previewUrl: t.audioUrl })}
                title="按住 Ctrl 拖拽到其他节点"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default memo(AudioNode);
