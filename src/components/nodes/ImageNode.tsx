import { memo, useMemo, useRef, useState } from 'react';
import { Handle, Position, useReactFlow, type NodeProps } from '@xyflow/react';
import { AlertCircle, Image as ImageIcon, Loader2, Plus, Sparkles, X } from 'lucide-react';
import { useUpstreamMaterials, type Material } from './useUpstreamMaterials';
import { useOrderedMaterials } from './useOrderedMaterials';
import MaterialPreviewSection from './MaterialPreviewSection';
import {
  IMAGE_MODELS,
  FAL_REGISTRY,
  GPT_FAL_SIZES,
  NBPRO_FAL_RATIOS,
  NBPRO_FAL_RESOLUTIONS,
  isFalModel,
  MJ_VERSIONS,
  MJ_RATIOS,
  MJ_SPEEDS,
  MJ_SVS,
  DEFAULT_MJ_VERSION,
  DEFAULT_MJ_RATIO,
  DEFAULT_MJ_SPEED,
} from '../../providers/models';
import {
  submitImageAsync,
  queryImageStatus,
  submitImageFal,
  queryImageFal,
  uploadFile,
  submitMjImagine,
  queryMjTask,
  uploadMjImage,
  buildMjPrompt,
  type MjSpeed,
} from '../../services/generation';
import { useUpdateNodeData } from './useUpdateNodeData';
import { useHasAutoOutput } from './useHasAutoOutput';
import { useRunTrigger } from '../../hooks/useRunTrigger';
import { useThemeStore } from '../../stores/theme';
import { logBus } from '../../stores/logs';
import { useDragMaterialStore, type MaterialPayload } from '../../stores/dragMaterial';
import { useMaterialDropTarget } from '../../hooks/useMaterialDropTarget';

/**
 * ImageNode - 图像生成(ZhenzhenMagic)
 * 多 TAB 切换:GPT2 / 香蕉2 / 香蕉Pro,参数与主项目 gpt-image-2-web 对齐
 * 参数:模型 TAB / 比例 / 尺寸 / 多张参考图 / 本地 prompt
 * 上游 text 节点 → prompt(优先);上游 image 节点 → 参考图(并入 references)
 */
const ImageNode = ({ id, data, selected }: NodeProps) => {
  const update = useUpdateNodeData(id);
  const hasAutoOutput = useHasAutoOutput(id);
  const { getEdges, getNodes } = useReactFlow();
  const { style, theme } = useThemeStore();
  const isPixel = style === 'pixel';
  const isDark = theme === 'dark';
  // 主参考图(referenceImages)上传入口 - 与下面 MJ sref/oref 上传隔离
  const mainFileInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // MJ 上传时区分 sref 还是 oref(共用 fileInputRef)
  const mjUploadKindRef = useRef<'sref' | 'oref'>('sref');

  const [error, setError] = useState<string | null>(null);
  const d = data as any;
  const model = d?.model || IMAGE_MODELS[0].id;
  const modelDef = useMemo(() => IMAGE_MODELS.find((m) => m.id === model) || IMAGE_MODELS[0], [model]);

  const aspectRatio = d?.aspectRatio || modelDef.defaultAspectRatio;
  const sizeLevel = d?.sizeLevel || modelDef.defaultSize;
  // 子模型变体(对齐 gpt-image-2-web 的 g_model/n_model)
  const apiModel = d?.apiModel || modelDef.apiModel;

  // ========== FAL 渠道识别及参数(不影响其他模型) ==========
  const isFal = isFalModel(apiModel);
  const falDef = isFal ? FAL_REGISTRY[apiModel] : undefined;
  const falKind = falDef?.paramKind; // 'gpt-fal' | 'nbpro-fal'
  // FAL 参数(默认对齐主项目初始值)
  // gpt-fal: mode/size/quality/n/format/sync/customW/customH
  const falMode: 'edit' | 'gen' = d?.falMode || 'edit';
  const falSize: string = d?.falSize || 'auto';
  const falCustomW: number = d?.falCustomW ?? 1280;
  const falCustomH: number = d?.falCustomH ?? 1280;
  const falQuality: 'low' | 'medium' | 'high' | 'auto' = d?.falQuality || 'medium';
  const falN: number = d?.falN ?? 1;
  const falFormat: 'png' | 'jpeg' | 'webp' = d?.falFormat || 'png';
  const falSync: boolean = d?.falSync === true;
  // nbpro-fal: aspect_ratio/resolution/safety/imgMode/webSearch/sysPrompt/seed
  const nbAspect: string = d?.nbAspect || 'auto';
  const nbResolution: string = d?.nbResolution || '2K';
  const nbSafety: string = d?.nbSafety || '4';
  const nbImgMode: 'image_url' | 'base64' = d?.nbImgMode || 'image_url';
  const nbWebSearch: boolean = d?.nbWebSearch === true;
  const nbSysPrompt: string = d?.nbSysPrompt || '';
  const nbSeed: number = d?.nbSeed ?? 0;

  // ========== MJ 渠道识别及参数(完全对齐 gpt-image-2-web mj_* 控件 L1552~L1580) ==========
  const isMj = modelDef.paramKind === 'mj';
  const mjVersion: string = d?.mjVersion || DEFAULT_MJ_VERSION;
  const mjAr: string = d?.mjAr || DEFAULT_MJ_RATIO;
  const mjSpeed: MjSpeed = (d?.mjSpeed as MjSpeed) || DEFAULT_MJ_SPEED;
  const mjC: number = d?.mjC ?? 0;
  const mjS: number = d?.mjS ?? 0;
  const mjIw: number = d?.mjIw ?? 0;
  const mjSw: number = d?.mjSw ?? 0;
  const mjSv: string = d?.mjSv || '1';
  const mjNo: string = d?.mjNo || '';
  const mjSeed: number = d?.mjSeed ?? 0;
  const mjMaxPoll: number = d?.mjMaxPoll ?? 300;
  const mjPollInt: number = d?.mjPollInt ?? 3;
  const mjSrefImages: string[] = Array.isArray(d?.mjSrefImages) ? d.mjSrefImages : [];
  const mjOrefImages: string[] = Array.isArray(d?.mjOrefImages) ? d.mjOrefImages : [];
  const MJ_REF_MAX = 2; // sref 与 oref 各最多 2 张

  // 参考图上限(FAL 使用 FAL_REGISTRY.maxRefs,其他走原设计)
  const maxRefs = falDef?.maxRefs ?? modelDef.maxReferenceImages;
  const status: 'idle' | 'generating' | 'success' | 'error' = d?.status || 'idle';
  const imageUrl = d?.imageUrl as string | undefined;
  const localPrompt = d?.prompt || '';
  // 节点内本地上传的参考图(除了上游接入的,这里是手动上传)
  const refImages: string[] = Array.isArray(d?.referenceImages) ? d.referenceImages : [];

  // ============ 上游素材聚合 (新机制) ============
  const upstream = useUpstreamMaterials(id);
  const localImageMaterials: Material[] = useMemo(
    () =>
      refImages.map((url, i) => ({
        id: `local::image:${url}`,
        kind: 'image' as const,
        url,
        sourceNodeId: id,
        origin: 'local' as const,
        label: `本地${i + 1}`,
      })),
    [refImages, id],
  );
  const allImagesUnordered = useMemo(
    () => [...localImageMaterials, ...upstream.images],
    [localImageMaterials, upstream.images],
  );
  const materialOrder: string[] = Array.isArray(d?.materialOrder) ? d.materialOrder : [];
  const orderedImages = useOrderedMaterials(allImagesUnordered, materialOrder);
  const orderedTexts = useOrderedMaterials(upstream.texts, materialOrder);
  const setMaterialOrder = (newOrder: string[]) => update({ materialOrder: newOrder });
  const handleRemoveLocalMaterial = (m: Material) => {
    if (m.origin !== 'local') return;
    update({ referenceImages: refImages.filter((u) => u !== m.url) });
  };

  // 切换模型时,如果当前比例/尺寸不在新模型选项里则重置
  const switchModel = (mId: string) => {
    const newDef = IMAGE_MODELS.find((m) => m.id === mId) || IMAGE_MODELS[0];
    const patch: any = { model: mId, apiModel: newDef.apiModel };
    if (newDef.paramKind === 'mj') {
      if (!d?.mjVersion) patch.mjVersion = DEFAULT_MJ_VERSION;
      if (!d?.mjAr) patch.mjAr = DEFAULT_MJ_RATIO;
      if (!d?.mjSpeed) patch.mjSpeed = DEFAULT_MJ_SPEED;
      if (d?.mjSv === undefined) patch.mjSv = '1';
    } else {
      if (!newDef.aspectRatios.includes(aspectRatio)) patch.aspectRatio = newDef.defaultAspectRatio;
      if (!newDef.sizes.includes(sizeLevel)) patch.sizeLevel = newDef.defaultSize;
    }
    update(patch);
  };

  // 从上游节点 + 本地上传按用户排序后的顺序聚合 prompt + 参考图
  // 注意: 此处只输出已合并、已排序的列表, 不再原地从 edges/nodes 二次收集
  const collectUpstream = (): { prompt: string; images: string[] } => {
    const prompts = orderedTexts.map((t) => t.url).filter((s) => !!s);
    const images: string[] = [];
    for (const m of orderedImages) {
      if (typeof m.url === 'string' && m.url) images.push(m.url);
    }
    void getEdges;
    void getNodes;
    return {
      prompt: prompts.join('\n').trim(),
      images: images.slice(0, modelDef.maxReferenceImages),
    };
  };

  // 手动上传主参考图 (走 mainFileInputRef, 与 MJ sref/oref 隔离)
  const handlePickFile = () => mainFileInputRef.current?.click();
  const handleFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setError(null);
    try {
      const remain = maxRefs - refImages.length;
      const accepted = files.slice(0, Math.max(0, remain));
      const uploaded: string[] = [];
      for (const f of accepted) {
        const r = await uploadFile(f);
        uploaded.push(r.url);
      }
      update({ referenceImages: [...refImages, ...uploaded] });
    } catch (err: any) {
      setError(err?.message || '上传失败');
    } finally {
      if (mainFileInputRef.current) mainFileInputRef.current.value = '';
    }
  };

  // ========== MJ 参考图上传(sref/oref)与移除 ==========
  const handleMjPick = (kind: 'sref' | 'oref') => {
    mjUploadKindRef.current = kind;
    fileInputRef.current?.click();
  };
  const handleMjFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setError(null);
    try {
      const kind = mjUploadKindRef.current;
      const cur = kind === 'sref' ? mjSrefImages : mjOrefImages;
      const remain = MJ_REF_MAX - cur.length;
      const accepted = files.slice(0, Math.max(0, remain));
      const uploaded: string[] = [];
      for (const f of accepted) {
        const url = await uploadMjImage(f, mjSpeed);
        if (url) uploaded.push(url);
      }
      if (kind === 'sref') update({ mjSrefImages: [...cur, ...uploaded] });
      else update({ mjOrefImages: [...cur, ...uploaded] });
    } catch (err: any) {
      setError(err?.message || 'MJ 参考图上传失败');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };
  const removeMjRef = (kind: 'sref' | 'oref', idx: number) => {
    if (kind === 'sref') update({ mjSrefImages: mjSrefImages.filter((_, i) => i !== idx) });
    else update({ mjOrefImages: mjOrefImages.filter((_, i) => i !== idx) });
  };

  const handleGenerate = async () => {
    setError(null);
    const { prompt: upstreamPrompt, images: upstreamImages } = collectUpstream();
    const finalPrompt = (upstreamPrompt || localPrompt || '').trim();
    const src = `image:${id.slice(0, 6)}`;
    if (!finalPrompt) {
      setError('未连接 text 节点也未填写 prompt');
      logBus.error('生成中止: 缺少 prompt', src);
      return;
    }
    update({ status: 'generating', progress: '0%', error: null });
    try {
      // collectUpstream 已返回「本地上传 + 上游接入」按用户拖拽顺序合并后的列表,
      // 这里不再二次叠加 refImages, 避免本地参考图重复传递。
      const allRefs = upstreamImages.slice(0, maxRefs);

      // ============ MJ 路径(对齐 gpt-image-2-web runMJ L4437~L4716) ============
      if (isMj) {
        logBus.info(
          `MJ提交: version=${mjVersion} ar=${mjAr} speed=${mjSpeed} ref=${allRefs.length} sref=${mjSrefImages.length} oref=${mjOrefImages.length} prompt="${finalPrompt.slice(0, 60)}${finalPrompt.length > 60 ? '…' : ''}"`,
          src,
        );
        // 主参考图(垫图): 将 URL 转 base64(主项目只接受 base64Array,上游节点输出的 imageUrl 需下载转换)
        const base64Array: string[] = [];
        for (const u of allRefs) {
          try {
            const resp = await fetch(u);
            const blob = await resp.blob();
            const dataUrl: string = await new Promise((resolve, reject) => {
              const fr = new FileReader();
              fr.onload = () => resolve(String(fr.result || ''));
              fr.onerror = () => reject(new Error('读取失败'));
              fr.readAsDataURL(blob);
            });
            base64Array.push(dataUrl);
          } catch (err: any) {
            logBus.warn(`MJ 主参考图转 base64 失败,跳过: ${u}`, src);
          }
        }
        // sref/oref 允许多张(buildMjPrompt 会为每个 URL 各追加一个 flag)
        const fullPrompt = buildMjPrompt({
          prompt: finalPrompt,
          model: mjVersion,
          ar: mjAr,
          c: mjC || undefined,
          s: mjS || undefined,
          iw: mjIw || undefined,
          sw: mjSw || undefined,
          sv: mjSv || undefined,
          no: mjNo || undefined,
          srefUrls: mjSrefImages,
          orefUrls: mjOrefImages,
        });
        const submit = await submitMjImagine({
          prompt: fullPrompt,
          ar: mjAr,
          c: mjC || undefined,
          s: mjS || undefined,
          iw: mjIw || undefined,
          sw: mjSw || undefined,
          sv: mjSv || undefined,
          no: mjNo || undefined,
          seed: mjSeed || undefined,
          speed: mjSpeed,
          base64Array,
          remix: true,
        });
        const taskId = submit.taskId;
        logBus.info(`MJ 任务已提交 taskId=${taskId} fullPrompt="${fullPrompt.slice(0, 120)}${fullPrompt.length > 120 ? '…' : ''}"`, src);
        update({ progress: '15%', taskId });
        const maxPoll = Math.max(10, Math.min(2000, mjMaxPoll || 300));
        const interval = Math.max(1, Math.min(30, mjPollInt || 3)) * 1000;
        for (let i = 0; i < maxPoll; i++) {
          await new Promise((r) => setTimeout(r, interval));
          const q = await queryMjTask(taskId, mjSpeed);
          if (q.status === 'FAILURE') {
            throw new Error(`MJ 失败: ${q.failReason || '未知错误'}`);
          }
          if (q.progress) {
            const pct = parseInt(String(q.progress)) || 0;
            const out = `${Math.min(99, 15 + Math.floor(pct * 0.85))}%`;
            update({ progress: out });
            if (i % 3 === 2) logBus.debug(`[${i + 1}/${maxPoll}] MJ progress=${q.progress} status=${q.status}`, src);
          }
          if (q.status === 'SUCCESS') {
            const main = q.imageUrl || '';
            const grid = q.imageUrls || [];
            const all = grid.length ? grid : (main ? [main] : []);
            if (!all.length) {
              // 调试：上游字段名可能变化，把原始报文打到日志便于定位
              try {
                const dump = JSON.stringify(q.raw)?.slice(0, 800) || String(q.raw);
                logBus.warn(`MJ 任务完成但未拿到 imageUrl/imageUrls，raw=${dump}`, src);
              } catch {}
              throw new Error('MJ 任务完成但未返回图片');
            }
            const final = main || all[0];
            logBus.success(`MJ 任务完成 → ${final}` + (grid.length ? ` (含 ${grid.length} 张子图)` : ''), src);
            update({
              status: 'success',
              progress: '100%',
              imageUrl: final,
              imageUrls: all,
              lastPrompt: finalPrompt,
              usedI2I: allRefs.length > 0 || mjSrefImages.length > 0 || mjOrefImages.length > 0,
            });
            return;
          }
        }
        throw new Error(`MJ 轮询超时: ${maxPoll} 次 × ${interval / 1000}s`);
      }

      // ============ FAL 路径(对齐 gpt-image-2-web runGPTFal / runNanoFal) ============
      if (isFal && falDef) {
        const sizeDesc = falKind === 'gpt-fal'
          ? (falSize === 'custom' ? `${falCustomW}×${falCustomH}` : falSize)
          : `${nbAspect}/${nbResolution}`;
        logBus.info(
          `FAL提交: model=${apiModel} kind=${falKind} size=${sizeDesc} 参考图=${allRefs.length} prompt="${finalPrompt.slice(0, 60)}${finalPrompt.length > 60 ? '…' : ''}"`,
          src,
        );
        const submit = await submitImageFal({
          apiModel,
          prompt: finalPrompt,
          images: allRefs,
          n: falKind === 'gpt-fal' ? falN : (d?.falN ?? 1),
          format: falFormat,
          sync: falSync,
          // gpt-fal
          mode: falKind === 'gpt-fal' ? falMode : undefined,
          size: falKind === 'gpt-fal' ? falSize : undefined,
          customW: falKind === 'gpt-fal' && falSize === 'custom' ? falCustomW : undefined,
          customH: falKind === 'gpt-fal' && falSize === 'custom' ? falCustomH : undefined,
          quality: falKind === 'gpt-fal' ? falQuality : undefined,
          // nbpro-fal
          aspect_ratio: falKind === 'nbpro-fal' ? nbAspect : undefined,
          resolution: falKind === 'nbpro-fal' ? nbResolution : undefined,
          safety_tolerance: falKind === 'nbpro-fal' ? nbSafety : undefined,
          seed: falKind === 'nbpro-fal' && nbSeed > 0 ? nbSeed : undefined,
          system_prompt: falKind === 'nbpro-fal' ? nbSysPrompt : undefined,
          enable_web_search: falKind === 'nbpro-fal' ? nbWebSearch : undefined,
          image_mode: falKind === 'nbpro-fal' ? nbImgMode : undefined,
        });

        // 同步完成
        if (submit.sync && submit.urls && submit.urls.length) {
          logBus.success(`FAL同步返回 → ${submit.urls[0]}`, src);
          update({
            status: 'success',
            progress: '100%',
            imageUrl: submit.urls[0],
            lastPrompt: finalPrompt,
            usedI2I: allRefs.length > 0,
          });
          return;
        }

        // 异步轮询(主项目默认 maxPoll=1200, pollInt=3s; 这里按 2h 上限会太长,采用 600×3s=30min)
        const { requestId, responseUrl, endpoint } = submit;
        if (!requestId || !responseUrl) throw new Error('FAL 提交后未获得 request_id/response_url');
        logBus.info(`FAL异步任务已提交 requestId=${requestId}`, src);
        update({
          progress: '5%',
          taskId: requestId,
          falResponseUrl: responseUrl,
          falEndpoint: endpoint,
        });
        const maxPoll = 600;
        const interval = 3000;
        for (let i = 0; i < maxPoll; i++) {
          await new Promise((r) => setTimeout(r, interval));
          const q = await queryImageFal({ responseUrl, endpoint, requestId });
          const st = String(q.status || '').toLowerCase();
          if (st === 'completed') {
            const url = q.urls?.[0];
            if (!url) throw new Error('FAL 任务完成但未返回图片');
            logBus.success(`FAL 任务完成 → ${url}`, src);
            update({
              status: 'success',
              progress: '100%',
              imageUrl: url,
              lastPrompt: finalPrompt,
              usedI2I: allRefs.length > 0,
            });
            return;
          }
          if (st === 'failed') {
            throw new Error(q.error || 'FAL 任务失败');
          }
          // 进度估算(15% 起步,到 95% 上限)
          const pct = Math.min(95, 15 + Math.floor((i / maxPoll) * 80));
          if (i % 5 === 4) {
            update({ progress: `${pct}%` });
            logBus.debug(`[${i + 1}/${maxPoll}] FAL 轮询 status=${q.falStatus || 'IN_QUEUE'}`, src);
          }
        }
        throw new Error(`FAL 超时: ${(maxPoll * interval) / 1000}s 未完成`);
      }

      // ============ 原有标准路径(GPT2 standard / nano-banana / nano-banana-pro 未动) ============
      logBus.info(
        `提交任务: model=${apiModel} 比例=${aspectRatio} 尺寸=${sizeLevel} 参考图=${allRefs.length} prompt="${finalPrompt.slice(0, 60)}${finalPrompt.length > 60 ? '…' : ''}"`,
        src,
      );
      const submit = await submitImageAsync({
        model: modelDef.id,
        apiModel: apiModel,
        paramKind: modelDef.paramKind,
        prompt: finalPrompt,
        aspect_ratio: aspectRatio,
        image_size: sizeLevel,
        images: allRefs,
        n: 1,
      });

      // 分支一:同步完成
      if (submit.sync && submit.urls && submit.urls.length) {
        logBus.success(`同步返回 → ${submit.urls[0]}`, src);
        update({
          status: 'success',
          progress: '100%',
          imageUrl: submit.urls[0],
          lastPrompt: finalPrompt,
          usedI2I: allRefs.length > 0,
        });
        return;
      }

      // 分支二:异步任务 → 轮询状态(对齐主项目 gpt-image-2-web pollTask)
      const taskId = submit.taskId;
      if (!taskId) throw new Error('未获取到 taskId 且无同步结果');
      logBus.info(`异步任务已提交 taskId=${taskId} 进入轮询…`, src);
      update({ progress: submit.progress || '5%', taskId });
      // GPT2 / nano-banana / nano-banana-pro 标准路径轮询上限:
      //   maxPoll × interval = 1800 × 2s = 3600s = 60 分钟(避免复杂 prompt / 多参考图任务被 120s 提前中断)
      const maxPoll = 1800;     // 最多 1800 次
      const interval = 2000;    // 每 2 秒一次
      let lastProg = '5%';
      for (let i = 0; i < maxPoll; i++) {
        await new Promise((r) => setTimeout(r, interval));
        const q = await queryImageStatus(taskId, apiModel);
        if (q.progress && q.progress !== lastProg) {
          lastProg = q.progress;
          update({ progress: q.progress });
          logBus.debug(`[${i + 1}/${maxPoll}] status=${q.status} progress=${q.progress}`, src);
        }
        const st = String(q.status || '').toLowerCase();
        if (st === 'completed' || st === 'success' || st === 'done') {
          const url = q.urls?.[0];
          if (!url) throw new Error('任务完成但未返回图片');
          logBus.success(`任务完成 → ${url}`, src);
          update({
            status: 'success',
            progress: '100%',
            imageUrl: url,
            lastPrompt: finalPrompt,
            usedI2I: allRefs.length > 0,
          });
          return;
        }
        if (st === 'failed' || st === 'failure' || st === 'error') {
          throw new Error(q.error || '任务失败');
        }
      }
      throw new Error(`超时:${maxPoll * interval / 1000}s 未完成`);
    } catch (e: any) {
      const msg = e?.message || '生成失败';
      setError(msg);
      logBus.error(`生成失败: ${msg}`, src);
      update({ status: 'error', error: msg });
    }
  };

  // 接入运行总线,供批量运行调起
  useRunTrigger(id, handleGenerate);

  // === 跨节点拖拽: source (从输出图 Ctrl+拖出) ===
  const startDrag = useDragMaterialStore((s) => s.start);
  const beginMaterialDrag = (e: React.MouseEvent, payload: MaterialPayload) => {
    if (e.button !== 0) return;
    if (!(e.ctrlKey || e.metaKey)) return;
    e.preventDefault();
    e.stopPropagation();
    startDrag(payload, e.clientX, e.clientY);
  };

  // === 跨节点拖拽: target (接收图像 → 追加到 referenceImages; 接收文本 → 替换 prompt) ===
  const handleDrop = (payload: MaterialPayload) => {
    if (payload.kind === 'image' && payload.url) {
      const cur = Array.isArray(d?.referenceImages) ? d.referenceImages : [];
      if (cur.indexOf(payload.url) !== -1) return;
      if (cur.length >= maxRefs) return;
      update({ referenceImages: [...cur, payload.url] });
    } else if (payload.kind === 'text' && typeof payload.text === 'string') {
      update({ prompt: payload.text });
    }
  };
  const { dropProps, isAccepting } = useMaterialDropTarget({
    id,
    accepts: ['image', 'text'],
    onDrop: handleDrop,
  });

  return (
    <div
      className={`relative rounded-xl border-2 transition-all w-[320px] ${
        selected ? 'border-amber-400 shadow-2xl shadow-amber-500/20' : 'border-white/15 hover:border-white/30'
      }`}
      style={{
        background: 'rgba(20,20,22,.92)',
        backdropFilter: 'blur(8px)',
        ...(isAccepting ? { borderColor: '#22c55e', boxShadow: '0 0 0 3px rgba(34,197,94,0.25)' } : null),
      }}
      {...dropProps}
    >
      <Handle type="target" position={Position.Left} className="!bg-amber-400 !border-0" />
      <Handle type="source" position={Position.Right} className="!bg-amber-400 !border-0" />

      {/* 头部 */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/10">
        <div
          className="w-6 h-6 rounded flex items-center justify-center"
          style={{ background: 'rgba(245,158,11,.2)', color: '#fcd34d', boxShadow: 'inset 0 0 0 1px rgba(245,158,11,.45)' }}
        >
          <ImageIcon size={13} />
        </div>
        <div className="flex-1">
          <div className="text-sm font-semibold text-white">图像</div>
          <div className="text-[10px] text-white/40">{modelDef.label} · {modelDef.description}</div>
        </div>
      </div>

      {/* 配置区 */}
      <div className="p-2.5 space-y-2" onMouseDown={(e) => e.stopPropagation()}>
        {/* 模型 TAB 切换(对应主项目 gpt-image-2-web Tab 0/1/2) */}
        <div>
          <label className="text-[10px] text-white/50 block mb-1">模型</label>
          <div
            className={`flex gap-0.5 p-0.5 rounded ${isPixel ? '' : 'bg-white/5'}`}
            style={isPixel ? { background: 'var(--px-muted)', border: '1.5px solid var(--px-ink)' } : undefined}
          >
            {IMAGE_MODELS.map((m) => {
              const isActive = m.id === model;
              return (
                <button
                  key={m.id}
                  onClick={() => switchModel(m.id)}
                  title={m.description}
                  className={`flex-1 py-1 text-[10px] font-semibold rounded transition-all ${
                    isActive ? 'bg-amber-500/30 text-amber-200' : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                  style={
                    isPixel && isActive
                      ? { background: 'var(--px-yellow)', color: 'var(--px-ink)', border: '1.5px solid var(--px-ink)', boxShadow: '1px 1px 0 var(--px-ink)' }
                      : isPixel ? { color: 'var(--px-ink-soft)' } : undefined
                  }
                >
                  {m.tabLabel}
                </button>
              );
            })}
          </div>
        </div>

        {/* 子模型选择(对齐主项目 Tab 内的 model 下拉) - MJ 模式隐藏(用下面专属版本选择) */}
        {!isMj && (
          <div>
            <label className="text-[10px] text-white/50 block mb-1">具体模型</label>
            <select
              value={apiModel}
              onChange={(e) => update({ apiModel: e.target.value })}
              style={{ background: '#18181b', color: '#ffffff' }}
              className="w-full rounded border border-white/10 px-2 py-1 text-xs outline-none focus:border-white/30"
            >
              {modelDef.apiModelOptions.map((opt) => (
                <option key={opt.value} value={opt.value} style={{ background: '#18181b', color: '#ffffff' }}>{opt.label}</option>
              ))}
            </select>
          </div>
        )}

        {/* 比例 + 尺寸 并排(非 FAL 且非 MJ 模型) */}
        {!isFal && !isMj && (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-white/50 block mb-1">比例</label>
              <select
                value={aspectRatio}
                onChange={(e) => update({ aspectRatio: e.target.value })}
                style={{ background: '#18181b', color: '#ffffff' }}
                className="w-full rounded border border-white/10 px-2 py-1 text-xs outline-none focus:border-white/30"
              >
                {modelDef.aspectRatios.map((r) => (
                  <option key={r} value={r} style={{ background: '#18181b', color: '#ffffff' }}>{r}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-white/50 block mb-1">尺寸</label>
              <select
                value={sizeLevel}
                onChange={(e) => update({ sizeLevel: e.target.value })}
                style={{ background: '#18181b', color: '#ffffff' }}
                className="w-full rounded border border-white/10 px-2 py-1 text-xs outline-none focus:border-white/30"
              >
                {modelDef.sizes.map((s) => (
                  <option key={s} value={s} style={{ background: '#18181b', color: '#ffffff' }}>{s}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* ========== FAL 专属参数面板(完全对齐 gpt-image-2-web gf_panel / nano_fal_panel) ========== */}
        {isFal && falKind === 'gpt-fal' && (
          <div className="space-y-2 rounded border border-blue-400/30 bg-blue-500/5 p-2">
            <div className="text-[10px] text-blue-300 font-semibold tracking-wide">
              💡 FAL Queue API · openai/gpt-image-2
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-white/50 block mb-1">Mode</label>
                <select
                  value={falMode}
                  onChange={(e) => update({ falMode: e.target.value })}
                  style={{ background: '#18181b', color: '#ffffff' }}
                  className="w-full rounded border border-white/10 px-2 py-1 text-xs outline-none focus:border-white/30"
                >
                  <option value="edit" style={{ background: '#18181b', color: '#ffffff' }}>Edit</option>
                  <option value="gen" style={{ background: '#18181b', color: '#ffffff' }}>Generate</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] text-white/50 block mb-1">Size</label>
                <select
                  value={falSize}
                  onChange={(e) => update({ falSize: e.target.value })}
                  style={{ background: '#18181b', color: '#ffffff' }}
                  className="w-full rounded border border-white/10 px-2 py-1 text-xs outline-none focus:border-white/30"
                >
                  {GPT_FAL_SIZES.map((s) => (
                    <option key={s.value} value={s.value} style={{ background: '#18181b', color: '#ffffff' }}>{s.label}</option>
                  ))}
                </select>
              </div>
            </div>
            {falSize === 'custom' && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-white/50 block mb-1">Width (≈1 6倍)</label>
                  <input
                    type="number" min={256} max={3840} step={16}
                    value={falCustomW}
                    onChange={(e) => update({ falCustomW: parseInt(e.target.value) || 0 })}
                    style={{ background: '#18181b', color: '#ffffff' }}
                    className="w-full rounded border border-white/10 px-2 py-1 text-xs outline-none focus:border-white/30"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-white/50 block mb-1">Height (≈1 6倍)</label>
                  <input
                    type="number" min={256} max={3840} step={16}
                    value={falCustomH}
                    onChange={(e) => update({ falCustomH: parseInt(e.target.value) || 0 })}
                    style={{ background: '#18181b', color: '#ffffff' }}
                    className="w-full rounded border border-white/10 px-2 py-1 text-xs outline-none focus:border-white/30"
                  />
                </div>
              </div>
            )}
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-[10px] text-white/50 block mb-1">Quality</label>
                <select
                  value={falQuality}
                  onChange={(e) => update({ falQuality: e.target.value })}
                  style={{ background: '#18181b', color: '#ffffff' }}
                  className="w-full rounded border border-white/10 px-2 py-1 text-xs outline-none focus:border-white/30"
                >
                  <option value="low" style={{ background: '#18181b', color: '#ffffff' }}>Low</option>
                  <option value="medium" style={{ background: '#18181b', color: '#ffffff' }}>Medium</option>
                  <option value="high" style={{ background: '#18181b', color: '#ffffff' }}>High</option>
                  <option value="auto" style={{ background: '#18181b', color: '#ffffff' }}>Auto</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] text-white/50 block mb-1">N</label>
                <input
                  type="number" min={1} max={4}
                  value={falN}
                  onChange={(e) => update({ falN: Math.max(1, Math.min(4, parseInt(e.target.value) || 1)) })}
                  style={{ background: '#18181b', color: '#ffffff' }}
                  className="w-full rounded border border-white/10 px-2 py-1 text-xs outline-none focus:border-white/30"
                />
              </div>
              <div>
                <label className="text-[10px] text-white/50 block mb-1">Format</label>
                <select
                  value={falFormat}
                  onChange={(e) => update({ falFormat: e.target.value })}
                  style={{ background: '#18181b', color: '#ffffff' }}
                  className="w-full rounded border border-white/10 px-2 py-1 text-xs outline-none focus:border-white/30"
                >
                  <option value="png" style={{ background: '#18181b', color: '#ffffff' }}>PNG</option>
                  <option value="jpeg" style={{ background: '#18181b', color: '#ffffff' }}>JPEG</option>
                  <option value="webp" style={{ background: '#18181b', color: '#ffffff' }}>WebP</option>
                </select>
              </div>
            </div>
            <label className="flex items-center gap-1.5 text-[10px] text-white/60">
              <input
                type="checkbox"
                checked={falSync}
                onChange={(e) => update({ falSync: e.target.checked })}
              />
              <span>同步模式 (sync_mode: 适合快速返回场景)</span>
            </label>
          </div>
        )}

        {isFal && falKind === 'nbpro-fal' && (
          <div className="space-y-2 rounded border border-blue-400/30 bg-blue-500/5 p-2">
            <div className="text-[10px] text-blue-300 font-semibold tracking-wide">
              💡 FAL Queue API · fal-ai/nano-banana-pro/edit (需参考图)
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-[10px] text-white/50 block mb-1">N</label>
                <input
                  type="number" min={1} max={4}
                  value={falN}
                  onChange={(e) => update({ falN: Math.max(1, Math.min(4, parseInt(e.target.value) || 1)) })}
                  style={{ background: '#18181b', color: '#ffffff' }}
                  className="w-full rounded border border-white/10 px-2 py-1 text-xs outline-none focus:border-white/30"
                />
              </div>
              <div>
                <label className="text-[10px] text-white/50 block mb-1">Aspect</label>
                <select
                  value={nbAspect}
                  onChange={(e) => update({ nbAspect: e.target.value })}
                  style={{ background: '#18181b', color: '#ffffff' }}
                  className="w-full rounded border border-white/10 px-2 py-1 text-xs outline-none focus:border-white/30"
                >
                  {NBPRO_FAL_RATIOS.map((r) => (
                    <option key={r} value={r} style={{ background: '#18181b', color: '#ffffff' }}>{r}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] text-white/50 block mb-1">Resolution</label>
                <select
                  value={nbResolution}
                  onChange={(e) => update({ nbResolution: e.target.value })}
                  style={{ background: '#18181b', color: '#ffffff' }}
                  className="w-full rounded border border-white/10 px-2 py-1 text-xs outline-none focus:border-white/30"
                >
                  {NBPRO_FAL_RESOLUTIONS.map((r) => (
                    <option key={r} value={r} style={{ background: '#18181b', color: '#ffffff' }}>{r}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-[10px] text-white/50 block mb-1">Format</label>
                <select
                  value={falFormat}
                  onChange={(e) => update({ falFormat: e.target.value })}
                  style={{ background: '#18181b', color: '#ffffff' }}
                  className="w-full rounded border border-white/10 px-2 py-1 text-xs outline-none focus:border-white/30"
                >
                  <option value="png" style={{ background: '#18181b', color: '#ffffff' }}>PNG</option>
                  <option value="jpeg" style={{ background: '#18181b', color: '#ffffff' }}>JPEG</option>
                  <option value="webp" style={{ background: '#18181b', color: '#ffffff' }}>WebP</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] text-white/50 block mb-1">Safety</label>
                <select
                  value={nbSafety}
                  onChange={(e) => update({ nbSafety: e.target.value })}
                  style={{ background: '#18181b', color: '#ffffff' }}
                  className="w-full rounded border border-white/10 px-2 py-1 text-xs outline-none focus:border-white/30"
                >
                  <option value="1" style={{ background: '#18181b', color: '#ffffff' }}>1 (严)</option>
                  <option value="2" style={{ background: '#18181b', color: '#ffffff' }}>2</option>
                  <option value="3" style={{ background: '#18181b', color: '#ffffff' }}>3</option>
                  <option value="4" style={{ background: '#18181b', color: '#ffffff' }}>4</option>
                  <option value="5" style={{ background: '#18181b', color: '#ffffff' }}>5</option>
                  <option value="6" style={{ background: '#18181b', color: '#ffffff' }}>6 (松)</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] text-white/50 block mb-1">ImgMode</label>
                <select
                  value={nbImgMode}
                  onChange={(e) => update({ nbImgMode: e.target.value })}
                  style={{ background: '#18181b', color: '#ffffff' }}
                  className="w-full rounded border border-white/10 px-2 py-1 text-xs outline-none focus:border-white/30"
                >
                  <option value="image_url" style={{ background: '#18181b', color: '#ffffff' }}>URL</option>
                  <option value="base64" style={{ background: '#18181b', color: '#ffffff' }}>Base64</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-white/50 block mb-1">Seed (0=不传)</label>
                <input
                  type="number" min={0}
                  value={nbSeed}
                  onChange={(e) => update({ nbSeed: Math.max(0, parseInt(e.target.value) || 0) })}
                  style={{ background: '#18181b', color: '#ffffff' }}
                  className="w-full rounded border border-white/10 px-2 py-1 text-xs outline-none focus:border-white/30"
                />
              </div>
              <label className="flex items-center gap-1.5 text-[10px] text-white/60 mt-4">
                <input
                  type="checkbox"
                  checked={nbWebSearch}
                  onChange={(e) => update({ nbWebSearch: e.target.checked })}
                />
                <span>Web Search</span>
              </label>
            </div>
            <div>
              <label className="text-[10px] text-white/50 block mb-1">System Prompt (可选)</label>
              <input
                type="text"
                value={nbSysPrompt}
                onChange={(e) => update({ nbSysPrompt: e.target.value })}
                placeholder="可选系统指令"
                style={{ background: '#18181b', color: '#ffffff' }}
                className="w-full rounded border border-white/10 px-2 py-1 text-xs outline-none focus:border-white/30"
              />
            </div>
          </div>
        )}

        {/* ========== MJ 专属参数面板(完全对齐 gpt-image-2-web mj_* 控件 L1552~L1580) ========== */}
        {isMj && (
          <div className="space-y-2 rounded border border-purple-400/30 bg-purple-500/5 p-2">
            <div className="text-[10px] text-purple-300 font-semibold tracking-wide">
              ✨ Midjourney(严格对齐主项目 runMJ)
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-[10px] text-white/50 block mb-1">版本</label>
                <select
                  value={mjVersion}
                  onChange={(e) => update({ mjVersion: e.target.value })}
                  style={{ background: '#18181b', color: '#ffffff' }}
                  className="w-full rounded border border-white/10 px-2 py-1 text-xs outline-none focus:border-white/30"
                >
                  {MJ_VERSIONS.map((m) => (
                    <option key={m.value} value={m.value} style={{ background: '#18181b', color: '#ffffff' }}>{m.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] text-white/50 block mb-1">比例</label>
                <select
                  value={mjAr}
                  onChange={(e) => update({ mjAr: e.target.value })}
                  style={{ background: '#18181b', color: '#ffffff' }}
                  className="w-full rounded border border-white/10 px-2 py-1 text-xs outline-none focus:border-white/30"
                >
                  {MJ_RATIOS.map((r) => (
                    <option key={r} value={r} style={{ background: '#18181b', color: '#ffffff' }}>{r}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] text-white/50 block mb-1">速度</label>
                <select
                  value={mjSpeed}
                  onChange={(e) => update({ mjSpeed: e.target.value })}
                  style={{ background: '#18181b', color: '#ffffff' }}
                  className="w-full rounded border border-white/10 px-2 py-1 text-xs outline-none focus:border-white/30"
                >
                  {MJ_SPEEDS.map((s) => (
                    <option key={s.value} value={s.value} style={{ background: '#18181b', color: '#ffffff' }}>{s.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-2">
              <div>
                <label className="text-[10px] text-white/50 block mb-1" title="chaos 0~100">--c</label>
                <input
                  type="number" min={0} max={100}
                  value={mjC}
                  onChange={(e) => update({ mjC: Math.max(0, Math.min(100, parseInt(e.target.value) || 0)) })}
                  style={{ background: '#18181b', color: '#ffffff' }}
                  className="w-full rounded border border-white/10 px-2 py-1 text-xs outline-none focus:border-white/30"
                />
              </div>
              <div>
                <label className="text-[10px] text-white/50 block mb-1" title="stylize 0~1000">--s</label>
                <input
                  type="number" min={0} max={1000}
                  value={mjS}
                  onChange={(e) => update({ mjS: Math.max(0, Math.min(1000, parseInt(e.target.value) || 0)) })}
                  style={{ background: '#18181b', color: '#ffffff' }}
                  className="w-full rounded border border-white/10 px-2 py-1 text-xs outline-none focus:border-white/30"
                />
              </div>
              <div>
                <label className="text-[10px] text-white/50 block mb-1" title="image weight 0~3">--iw</label>
                <input
                  type="number" min={0} max={3} step={0.25}
                  value={mjIw}
                  onChange={(e) => update({ mjIw: Math.max(0, Math.min(3, parseFloat(e.target.value) || 0)) })}
                  style={{ background: '#18181b', color: '#ffffff' }}
                  className="w-full rounded border border-white/10 px-2 py-1 text-xs outline-none focus:border-white/30"
                />
              </div>
              <div>
                <label className="text-[10px] text-white/50 block mb-1" title="style ref weight 0~1000">--sw</label>
                <input
                  type="number" min={0} max={1000}
                  value={mjSw}
                  onChange={(e) => update({ mjSw: Math.max(0, Math.min(1000, parseInt(e.target.value) || 0)) })}
                  style={{ background: '#18181b', color: '#ffffff' }}
                  className="w-full rounded border border-white/10 px-2 py-1 text-xs outline-none focus:border-white/30"
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-[10px] text-white/50 block mb-1">--sv</label>
                <select
                  value={mjSv}
                  onChange={(e) => update({ mjSv: e.target.value })}
                  style={{ background: '#18181b', color: '#ffffff' }}
                  className="w-full rounded border border-white/10 px-2 py-1 text-xs outline-none focus:border-white/30"
                >
                  {MJ_SVS.map((o) => (
                    <option key={o.value} value={o.value} style={{ background: '#18181b', color: '#ffffff' }}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] text-white/50 block mb-1" title="seed 0=不传">seed</label>
                <input
                  type="number" min={0}
                  value={mjSeed}
                  onChange={(e) => update({ mjSeed: Math.max(0, parseInt(e.target.value) || 0) })}
                  style={{ background: '#18181b', color: '#ffffff' }}
                  className="w-full rounded border border-white/10 px-2 py-1 text-xs outline-none focus:border-white/30"
                />
              </div>
              <div>
                <label className="text-[10px] text-white/50 block mb-1" title="排除词">--no</label>
                <input
                  type="text"
                  value={mjNo}
                  onChange={(e) => update({ mjNo: e.target.value })}
                  placeholder="text, blurry"
                  style={{ background: '#18181b', color: '#ffffff' }}
                  className="w-full rounded border border-white/10 px-2 py-1 text-xs outline-none focus:border-white/30"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-white/50 block mb-1" title="轮询最大次数">maxPoll</label>
                <input
                  type="number" min={10} max={2000}
                  value={mjMaxPoll}
                  onChange={(e) => update({ mjMaxPoll: Math.max(10, Math.min(2000, parseInt(e.target.value) || 300)) })}
                  style={{ background: '#18181b', color: '#ffffff' }}
                  className="w-full rounded border border-white/10 px-2 py-1 text-xs outline-none focus:border-white/30"
                />
              </div>
              <div>
                <label className="text-[10px] text-white/50 block mb-1" title="轮询间隔(s)">pollInt(s)</label>
                <input
                  type="number" min={1} max={30}
                  value={mjPollInt}
                  onChange={(e) => update({ mjPollInt: Math.max(1, Math.min(30, parseInt(e.target.value) || 3)) })}
                  style={{ background: '#18181b', color: '#ffffff' }}
                  className="w-full rounded border border-white/10 px-2 py-1 text-xs outline-none focus:border-white/30"
                />
              </div>
            </div>
            {/* sref 风格参考图 */}
            <div>
              <label className="text-[10px] text-white/50 block mb-1">--sref 风格参考 · {mjSrefImages.length}/{MJ_REF_MAX}</label>
              <div className="flex flex-wrap gap-1.5">
                {mjSrefImages.map((url, i) => (
                  <div key={i} className="relative w-12 h-12 rounded overflow-hidden border border-purple-300/30">
                    <img src={url} alt={`sref-${i}`} className="w-full h-full object-cover" />
                    <button
                      onClick={() => removeMjRef('sref', i)}
                      className="absolute top-0 right-0 w-4 h-4 bg-red-500/80 hover:bg-red-500 flex items-center justify-center rounded-bl"
                      title="移除"
                    >
                      <X size={9} className="text-white" />
                    </button>
                  </div>
                ))}
                {mjSrefImages.length < MJ_REF_MAX && (
                  <button
                    onClick={() => handleMjPick('sref')}
                    className="w-12 h-12 rounded border-2 border-dashed border-purple-300/30 hover:border-purple-300/60 flex items-center justify-center text-purple-300/60 hover:text-purple-300 transition-colors"
                    title="上传 sref 风格参考图"
                  >
                    <Plus size={14} />
                  </button>
                )}
              </div>
            </div>
            {/* oref 角色参考图 */}
            <div>
              <label className="text-[10px] text-white/50 block mb-1">--oref 角色参考 · {mjOrefImages.length}/{MJ_REF_MAX}</label>
              <div className="flex flex-wrap gap-1.5">
                {mjOrefImages.map((url, i) => (
                  <div key={i} className="relative w-12 h-12 rounded overflow-hidden border border-purple-300/30">
                    <img src={url} alt={`oref-${i}`} className="w-full h-full object-cover" />
                    <button
                      onClick={() => removeMjRef('oref', i)}
                      className="absolute top-0 right-0 w-4 h-4 bg-red-500/80 hover:bg-red-500 flex items-center justify-center rounded-bl"
                      title="移除"
                    >
                      <X size={9} className="text-white" />
                    </button>
                  </div>
                ))}
                {mjOrefImages.length < MJ_REF_MAX && (
                  <button
                    onClick={() => handleMjPick('oref')}
                    className="w-12 h-12 rounded border-2 border-dashed border-purple-300/30 hover:border-purple-300/60 flex items-center justify-center text-purple-300/60 hover:text-purple-300 transition-colors"
                    title="上传 oref 角色参考图"
                  >
                    <Plus size={14} />
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 上游素材聚合预览区 (新机制) - 本地上传 + 上游接入统一呈现, 可拖动排序 */}
        {modelDef.supportsReference && (
          <MaterialPreviewSection
            texts={orderedTexts}
            images={orderedImages}
            order={materialOrder}
            onReorder={setMaterialOrder}
            onRemoveLocal={handleRemoveLocalMaterial}
            selected={!!selected}
            isDark={isDark}
            isPixel={isPixel}
            groups={['text', 'image']}
            title={isMj ? '主参考图 · 上游+本地' : '参考图 · 上游+本地'}
            imageUploadAction={
              refImages.length < maxRefs
                ? {
                    onClick: handlePickFile,
                    title: '上传本地参考图',
                    remaining: maxRefs - refImages.length,
                  }
                : undefined
            }
          />
        )}
        {/* 隐藏的主参考图上传 input - 走 mainFileInputRef + handleFiles */}
        <input
          ref={mainFileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFiles}
          className="hidden"
        />
        {/* 隐藏的 MJ sref/oref 上传 input - 走 fileInputRef + handleMjFiles */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleMjFiles}
          className="hidden"
        />

        {/* 本地 prompt(优先取上游) */}
        <div>
          <label className="text-[10px] text-white/50 block mb-1">本地 Prompt(可选,优先取上游 text)</label>
          <textarea
            value={localPrompt}
            onChange={(e) => update({ prompt: e.target.value })}
            placeholder="备用:无上游连接时使用此提示词"
            className="w-full h-14 resize-none rounded bg-white/5 border border-white/10 px-2 py-1 text-[11px] text-white outline-none focus:border-white/30 placeholder:text-white/30"
          />
        </div>

        {/* 生成按钮(包含异步进度) */}
        <button
          onClick={handleGenerate}
          disabled={status === 'generating'}
          className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-medium disabled:opacity-50 transition-colors"
        >
          {status === 'generating' ? (
            <>
              <Loader2 size={12} className="animate-spin" /> 生成中 {d?.progress || ''}
            </>
          ) : (
            <>
              <Sparkles size={12} /> 生成
            </>
          )}
        </button>

        {error && (
          <div className="flex items-start gap-1 text-[10px] text-red-300 bg-red-500/10 border border-red-500/20 rounded px-2 py-1">
            <AlertCircle size={11} className="mt-0.5 flex-shrink-0" />
            <span className="break-all">{error}</span>
          </div>
        )}
      </div>

      {/* 结果展示：仅在未外挂 OutputNode 时在节点内预览，避免与下游 OutputNode 重复 */}
      {imageUrl && !hasAutoOutput && (
        <div className="border-t border-white/10 p-2">
          <img
            src={imageUrl}
            alt="生成结果"
            className="w-full rounded object-cover"
            data-drag-source
            data-drag-kind="image"
            data-drag-url={imageUrl}
            data-drag-preview={imageUrl}
            data-drag-node-id={id}
            onMouseDown={(e) =>
              beginMaterialDrag(e, { kind: 'image', url: imageUrl, sourceNodeId: id, previewUrl: imageUrl })
            }
            title="Ctrl+拖拽可送到其他节点"
          />
        </div>
      )}
    </div>
  );
};

export default memo(ImageNode);
