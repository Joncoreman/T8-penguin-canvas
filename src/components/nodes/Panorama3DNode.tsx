import { memo, useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import {
  AlertCircle,
  Box,
  CheckCircle2,
  Copy,
  Download,
  Globe2,
  History,
  Loader2,
  PackagePlus,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  Upload,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { useRunTrigger } from '../../hooks/useRunTrigger';
import { uploadDataUrl, uploadFileBlob } from '../../services/imageOps';
import { queryImageStatus, submitImageAsync } from '../../services/generation';
import * as api from '../../services/api';
import { logBus } from '../../stores/logs';
import { taskCompletionSound } from '../../stores/taskCompletionSound';
import {
  PANORAMA_FIXED_PROMPT,
  PANORAMA_PROMPT_TEMPLATES,
  PANORAMA_RATIO_OPTIONS,
  PANORAMA_SIZE_LEVELS,
  buildPanoramaImageRequest,
  buildPanoramaPromptFinal,
  clampPanoramaNumber,
  isLikelyPanoramaImage,
  panoramaRenderSize,
  prependPanoramaHistory,
  resolvePanoramaRatio,
  safePanoramaGenerationMode,
  safePanoramaPanelMode,
  safePanoramaSizeLevel,
  validatePanoramaGeneration,
  type PanoramaGenerationHistoryItem,
  type PanoramaGenerationMode,
  type PanoramaPanelMode,
  type PanoramaRatioId,
  type PanoramaSizeLevel,
} from '../../utils/panorama3d';
import { useUpdateNodeData } from './useUpdateNodeData';
import { useUpstreamMaterials } from './useUpstreamMaterials';
import { useHasAutoOutput } from './useHasAutoOutput';
import SmartImage from '../SmartImage';
import PromptTextarea from '../PromptTextarea';

const COLOR = '#38bdf8';

type ThreeModule = typeof import('three');

interface PanoramaRuntime {
  three?: ThreeModule;
  loadPromise?: Promise<ThreeModule>;
  renderer?: any;
  scene?: any;
  camera?: any;
  sphere?: any;
  texture?: any;
  image?: HTMLImageElement;
  animationId?: number;
  loadToken: number;
}

interface DragState {
  pointerId: number;
  x: number;
  y: number;
  yaw: number;
  pitch: number;
}

function clampFov(value: unknown) {
  return clampPanoramaNumber(value, 35, 100, 75);
}

function clampPitch(value: unknown) {
  return clampPanoramaNumber(value, -85, 85, 0);
}

function cleanFileBase(value: string) {
  return (value.split('/').pop() || 'panorama').split('?')[0].replace(/\.[a-z0-9]{2,8}$/i, '') || 'panorama';
}

function generationModeLabel(mode: PanoramaGenerationMode) {
  return mode === 'image' ? '图生全景' : '文生全景';
}

function compactPrompt(value: string, fallback = '全景场景') {
  const text = value.replace(/\s+/g, ' ').trim();
  if (!text) return fallback;
  return text.length > 24 ? `${text.slice(0, 24)}...` : text;
}

async function copyText(value: string) {
  if (navigator?.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }
  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  textarea.remove();
}

function downloadUrl(url: string, filename: string) {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

async function ensurePanoramaResourceCategory() {
  const categories = await api.getResourceCategories('panorama');
  if (!categories.success) throw new Error(categories.error || '读取资源库分类失败');
  const panoramaCategories = categories.data.filter((cat) => cat.kind === 'panorama');
  if (panoramaCategories.length === 0) {
    throw new Error('后端尚未加载全景资源类型，请重启开发后端后再保存。');
  }
  const existing =
    panoramaCategories.find((cat) => cat.id === 'panorama_uncategorized') ||
    panoramaCategories.find((cat) => cat.name === '未分类') ||
    panoramaCategories[0];
  if (existing) return existing;
  const created = await api.addResourceCategory('panorama', '未分类');
  if (!created.success) throw new Error(created.error || '创建全景分类失败');
  return created.data;
}

const Panorama3DNode = (p: NodeProps) => {
  const update = useUpdateNodeData(p.id);
  const upstream = useUpstreamMaterials(p.id);
  const hasAutoOutput = useHasAutoOutput(p.id);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const refInputRef = useRef<HTMLInputElement | null>(null);
  const runtimeRef = useRef<PanoramaRuntime>({ loadToken: 0 });
  const dragRef = useRef<DragState | null>(null);
  const viewRef = useRef({ yaw: 0, pitch: 0, fov: 75 });
  const d = (p.data as any) || {};

  const connectedSource = upstream.images[0];
  const generationMode = safePanoramaGenerationMode(d.panoramaGenerationMode);
  const generatedSourceUrl = typeof d.panoramaSourceUrl === 'string' ? d.panoramaSourceUrl : '';
  const connectedSourceUrl = connectedSource?.url || '';
  const panelMode: PanoramaPanelMode = safePanoramaPanelMode(
    d.panoramaPanelMode
      ?? d.panoramaGenerationMode
      ?? (generatedSourceUrl || connectedSourceUrl ? 'preview' : 'text'),
  );
  const sourceUrl = panelMode === 'preview' && connectedSourceUrl
    ? connectedSourceUrl
    : generatedSourceUrl || connectedSourceUrl;
  const outputUrl = typeof d.imageUrl === 'string' ? d.imageUrl : '';
  const sizeLevel: PanoramaSizeLevel = safePanoramaSizeLevel(d.panoramaSizeLevel);
  const userPrompt = typeof d.panoramaPrompt === 'string' ? d.panoramaPrompt : '';
  const promptFinal = buildPanoramaPromptFinal(userPrompt);
  const localReferenceUrl = typeof d.panoramaReferenceUrl === 'string' ? d.panoramaReferenceUrl : '';
  const imageReferenceUrl = connectedSource?.url || localReferenceUrl;
  const generatedHistory: PanoramaGenerationHistoryItem[] = Array.isArray(d.panoramaGeneratedHistory)
    ? d.panoramaGeneratedHistory.filter((item: any) => item && typeof item.url === 'string')
    : [];
  const ratioId: PanoramaRatioId = (d.panoramaRatio || 'wide') as PanoramaRatioId;
  const customW = clampPanoramaNumber(d.panoramaCustomW, 1, 999, 16);
  const customH = clampPanoramaNumber(d.panoramaCustomH, 1, 999, 9);
  const yaw = clampPanoramaNumber(d.panoramaYaw, -99999, 99999, 0);
  const pitch = clampPitch(d.panoramaPitch);
  const fov = clampFov(d.panoramaFov);
  const autoRotate = Boolean(d.panoramaAutoRotate);
  const isGenerating = d.status === 'generating';
  const ratio = useMemo(() => resolvePanoramaRatio(ratioId, customW, customH), [customH, customW, ratioId]);
  const renderSize = useMemo(() => panoramaRenderSize(ratio), [ratio]);
  const isLikely = useMemo(
    () => isLikelyPanoramaImage({ url: sourceUrl, label: connectedSource?.label, title: d.title, prompt: d.prompt }),
    [d.prompt, d.title, connectedSource?.label, sourceUrl],
  );

  const [textureStatus, setTextureStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [error, setError] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [copyState, setCopyState] = useState('');
  const [resourceState, setResourceState] = useState('');

  const drawFrame = useCallback(() => {
    const canvas = canvasRef.current;
    const rt = runtimeRef.current;
    const THREE = rt.three;
    if (!canvas || !rt.renderer || !rt.scene || !rt.camera || !rt.sphere || !THREE || !rt.image?.naturalWidth) {
      return false;
    }
    const view = viewRef.current;
    const width = Math.max(1, canvas.width);
    const height = Math.max(1, canvas.height);
    rt.renderer.setSize(width, height, false);
    rt.camera.fov = view.fov;
    rt.camera.aspect = width / Math.max(1, height);
    rt.camera.updateProjectionMatrix();
    const phi = THREE.MathUtils.degToRad(90 - view.pitch);
    const theta = THREE.MathUtils.degToRad(view.yaw);
    const target = new THREE.Vector3(
      500 * Math.sin(phi) * Math.cos(theta),
      500 * Math.cos(phi),
      500 * Math.sin(phi) * Math.sin(theta),
    );
    rt.camera.position.set(0, 0, 0);
    rt.camera.lookAt(target);
    rt.renderer.render(rt.scene, rt.camera);
    return true;
  }, []);

  const ensureRenderer = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return false;
    const rt = runtimeRef.current;
    if (!rt.three) {
      rt.loadPromise = rt.loadPromise || import('three');
      rt.three = await rt.loadPromise;
    }
    const THREE = rt.three;
    if (!rt.renderer) {
      rt.renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: false,
        preserveDrawingBuffer: true,
      });
      rt.renderer.setPixelRatio(1);
      rt.renderer.outputColorSpace = THREE.SRGBColorSpace;
    }
    if (!rt.scene) {
      rt.scene = new THREE.Scene();
      rt.camera = new THREE.PerspectiveCamera(viewRef.current.fov, 16 / 9, 1, 1200);
      const geometry = new THREE.SphereGeometry(500, 96, 64);
      geometry.scale(-1, 1, 1);
      const material = new THREE.MeshBasicMaterial({ color: 0xffffff });
      rt.sphere = new THREE.Mesh(geometry, material);
      rt.scene.add(rt.sphere);
    }
    return true;
  }, []);

  useEffect(() => {
    viewRef.current = { yaw, pitch, fov };
    drawFrame();
  }, [drawFrame, fov, pitch, yaw]);

  const disposeTexture = useCallback(() => {
    const rt = runtimeRef.current;
    rt.texture?.dispose?.();
    rt.texture = undefined;
    if (rt.sphere?.material) {
      rt.sphere.material.map = null;
      rt.sphere.material.needsUpdate = true;
    }
    rt.image = undefined;
  }, []);

  const applyTexture = useCallback((img: HTMLImageElement) => {
    const rt = runtimeRef.current;
    const THREE = rt.three;
    if (!THREE || !rt.sphere || !img.naturalWidth || !img.naturalHeight) return false;
    disposeTexture();
    const texture = new THREE.Texture(img);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
    rt.texture = texture;
    rt.image = img;
    rt.sphere.material.map = texture;
    rt.sphere.material.needsUpdate = true;
    return true;
  }, [disposeTexture]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = renderSize.width;
    canvas.height = renderSize.height;
    drawFrame();
  }, [drawFrame, renderSize.height, renderSize.width]);

  useEffect(() => {
    if (!sourceUrl) {
      runtimeRef.current.loadToken += 1;
      disposeTexture();
      setTextureStatus('idle');
      setError('');
      return;
    }
    const token = ++runtimeRef.current.loadToken;
    setTextureStatus('loading');
    setError('');
    let cancelled = false;

    (async () => {
      try {
        const ready = await ensureRenderer();
        if (!ready || cancelled || token !== runtimeRef.current.loadToken) return;
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          if (cancelled || token !== runtimeRef.current.loadToken) return;
          if (!applyTexture(img)) {
            setTextureStatus('error');
            setError('全景贴图加载失败');
            return;
          }
          setTextureStatus('ready');
          drawFrame();
        };
        img.onerror = () => {
          if (cancelled || token !== runtimeRef.current.loadToken) return;
          setTextureStatus('error');
          setError('图片无法作为 3D 全景加载');
        };
        img.src = sourceUrl;
        if (img.complete && img.naturalWidth) img.onload?.(new Event('load'));
      } catch (e: any) {
        if (cancelled || token !== runtimeRef.current.loadToken) return;
        setTextureStatus('error');
        setError(e?.message || 'Three.js 初始化失败');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [applyTexture, disposeTexture, drawFrame, ensureRenderer, sourceUrl]);

  useEffect(() => {
    const rt = runtimeRef.current;
    if (rt.animationId) cancelAnimationFrame(rt.animationId);
    rt.animationId = undefined;
    if (!autoRotate || textureStatus !== 'ready') {
      return;
    }
    let stopped = false;
    const tick = () => {
      if (stopped) return;
      if (!dragRef.current) {
        viewRef.current = {
          ...viewRef.current,
          yaw: viewRef.current.yaw + 0.12,
        };
      }
      drawFrame();
      rt.animationId = requestAnimationFrame(tick);
    };
    rt.animationId = requestAnimationFrame(tick);
    return () => {
      stopped = true;
      if (rt.animationId) cancelAnimationFrame(rt.animationId);
      rt.animationId = undefined;
    };
  }, [autoRotate, drawFrame, textureStatus]);

  useEffect(() => () => {
    const rt = runtimeRef.current;
    if (rt.animationId) cancelAnimationFrame(rt.animationId);
    disposeTexture();
    rt.sphere?.geometry?.dispose?.();
    rt.sphere?.material?.dispose?.();
    rt.renderer?.dispose?.();
    runtimeRef.current = { loadToken: rt.loadToken + 1 };
  }, [disposeTexture]);

  const setView = (patch: Record<string, any>) => update(patch);

  const onPointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (textureStatus !== 'ready') return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      yaw,
      pitch,
    };
    setIsDragging(true);
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    update({
      panoramaYaw: drag.yaw - dx * 0.18,
      panoramaPitch: clampPitch(drag.pitch + dy * 0.18),
    });
  };

  const endDrag = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    dragRef.current = null;
    setIsDragging(false);
  };

  const onWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    if (textureStatus !== 'ready') return;
    event.preventDefault();
    event.stopPropagation();
    const factor = event.deltaY < 0 ? 0.92 : 1 / 0.92;
    update({ panoramaFov: clampFov(fov * factor) });
  };

  const resetView = () => update({ panoramaYaw: 0, panoramaPitch: 0, panoramaFov: 75 });

  const exportFrame = useCallback(async () => {
    if (textureStatus !== 'ready' || !canvasRef.current) {
      update({ panoramaError: '请先连接并加载全景图' });
      return;
    }
    update({ status: 'generating', progress: '导出中', panoramaError: '' });
    try {
      if (!drawFrame()) throw new Error('当前画面不可导出');
      const dataUrl = canvasRef.current.toDataURL('image/png');
      const imageUrl = await uploadDataUrl(dataUrl, `${cleanFileBase(sourceUrl)}-panorama-frame`);
      const view = viewRef.current;
      update({
        status: 'success',
        panoramaError: '',
        imageUrl,
        imageUrls: [imageUrl],
        urls: [imageUrl],
        panoramaSourceUrl: sourceUrl,
        panoramaYaw: view.yaw,
        panoramaPitch: view.pitch,
        panoramaFov: view.fov,
        panoramaSnapshot: {
          yaw: view.yaw,
          pitch: view.pitch,
          fov: view.fov,
          ratio: ratioId,
          customW,
          customH,
          width: canvasRef.current.width,
          height: canvasRef.current.height,
        },
      });
    } catch (e: any) {
      const msg = e?.message || '导出全景画面失败';
      update({ status: 'error', panoramaError: msg });
      setError(msg);
    }
  }, [customH, customW, drawFrame, ratioId, sourceUrl, textureStatus, update]);

  const applyGeneratedPanorama = useCallback((url: string, params: {
    mode: PanoramaGenerationMode;
    prompt: string;
    promptFinal: string;
    sizeLevel: PanoramaSizeLevel;
    referenceUrl?: string;
  }) => {
    const history = prependPanoramaHistory(generatedHistory, {
      url,
      mode: params.mode,
      sizeLevel: params.sizeLevel,
      prompt: params.prompt,
      promptFinal: params.promptFinal,
      referenceUrl: params.referenceUrl,
      createdAt: new Date().toISOString(),
    });
    update({
      status: 'success',
      progress: '100%',
      error: '',
      panoramaError: '',
      panoramaSourceUrl: url,
      panoramaGeneratedUrl: url,
      panoramaPrompt: params.prompt,
      panoramaPromptFinal: params.promptFinal,
      panoramaGenerationMode: params.mode,
      panoramaPanelMode: params.mode,
      panoramaSizeLevel: params.sizeLevel,
      panoramaGeneratedHistory: history,
      panoramaRatio: 'ultrawide',
      imageUrl: url,
      imageUrls: [url],
      urls: [url],
      usedI2I: params.mode === 'image',
    });
    taskCompletionSound.notifyComplete(p.id, 'image');
  }, [generatedHistory, p.id, update]);

  const generatePanorama = useCallback(async () => {
    const mode: PanoramaGenerationMode = panelMode === 'image' ? 'image' : 'text';
    const prompt = userPrompt.trim();
    const referenceUrl = mode === 'image' ? imageReferenceUrl : '';
    const validation = validatePanoramaGeneration({ mode, prompt, referenceUrl });
    if (!validation.ok) {
      update({
        status: 'error',
        panoramaError: validation.error,
        panoramaPromptFinal: buildPanoramaPromptFinal(prompt),
      });
      setError(validation.error);
      return;
    }
    const request = buildPanoramaImageRequest({ mode, prompt, sizeLevel, referenceUrl });
    const finalPrompt = request.prompt;
    update({
      status: 'generating',
      progress: '提交中',
      error: '',
      panoramaError: '',
      panoramaPrompt: prompt,
      panoramaPromptFinal: finalPrompt,
      panoramaGenerationMode: mode,
      panoramaPanelMode: mode,
      panoramaSizeLevel: sizeLevel,
    });
    logBus.info(
      `提交3D全景: ${generationModeLabel(mode)} 21:9 ${sizeLevel} 参考图=${request.images.length}`,
      `panorama:${p.id.slice(0, 6)}`,
    );
    try {
      const submit = await submitImageAsync(request);
      if (submit.sync && submit.urls?.length) {
        applyGeneratedPanorama(submit.urls[0], { mode, prompt, promptFinal: finalPrompt, sizeLevel, referenceUrl });
        logBus.success(`3D全景生成完成 → ${submit.urls[0]}`, `panorama:${p.id.slice(0, 6)}`);
        return;
      }
      const taskId = submit.taskId;
      if (!taskId) throw new Error('提交成功但未返回任务 ID');
      update({ progress: submit.progress || '0%', taskId });
      const maxPoll = 1800;
      const interval = 2000;
      let lastProgress = '';
      for (let i = 0; i < maxPoll; i++) {
        await new Promise((resolve) => setTimeout(resolve, interval));
        const q = await queryImageStatus(taskId, 'gpt-image-2');
        if (q.progress && q.progress !== lastProgress) {
          lastProgress = q.progress;
          update({ progress: q.progress });
          logBus.debug(`3D全景轮询 ${i + 1}/${maxPoll}: ${q.status} ${q.progress}`, `panorama:${p.id.slice(0, 6)}`);
        }
        if (q.status === 'completed' && q.urls?.length) {
          applyGeneratedPanorama(q.urls[0], { mode, prompt, promptFinal: finalPrompt, sizeLevel, referenceUrl });
          logBus.success(`3D全景生成完成 → ${q.urls[0]}`, `panorama:${p.id.slice(0, 6)}`);
          return;
        }
        if (q.status === 'failed') {
          throw new Error(q.error || '3D全景生成失败');
        }
      }
      throw new Error('3D全景生成超时，请稍后查询或精简提示词重试');
    } catch (e: any) {
      const msg = e?.message || '3D全景生成失败';
      update({
        status: 'error',
        error: msg,
        panoramaError: msg,
        progress: '',
        panoramaPromptFinal: finalPrompt,
      });
      setError(msg);
      logBus.error(msg, `panorama:${p.id.slice(0, 6)}`);
    }
  }, [applyGeneratedPanorama, imageReferenceUrl, p.id, panelMode, sizeLevel, update, userPrompt]);

  const runNode = useCallback(async () => {
    if (panelMode === 'preview') {
      await exportFrame();
      return;
    }
    await generatePanorama();
  }, [exportFrame, generatePanorama, panelMode]);

  const handleReferenceUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      update({ panoramaError: '' });
      const url = await uploadFileBlob(file, file.name || `panorama-reference-${Date.now()}.png`);
      update({
        panoramaReferenceUrl: url,
        panoramaPanelMode: 'image',
        panoramaGenerationMode: 'image',
      });
      logBus.success(`3D全景参考图已上传 → ${url}`, `panorama:${p.id.slice(0, 6)}`);
    } catch (e: any) {
      const msg = e?.message || '参考图上传失败';
      update({ panoramaError: msg });
      setError(msg);
    } finally {
      if (refInputRef.current) refInputRef.current.value = '';
    }
  }, [p.id, update]);

  const copyPrompt = useCallback(async () => {
    try {
      await copyText(promptFinal);
      setCopyState('已复制');
      window.setTimeout(() => setCopyState(''), 1200);
    } catch (e: any) {
      setCopyState(e?.message || '复制失败');
    }
  }, [promptFinal]);

  const savePanoramaResource = useCallback(async () => {
    if (!sourceUrl) {
      setResourceState('没有可保存的全景贴图');
      return;
    }
    setResourceState('保存中');
    try {
      const category = await ensurePanoramaResourceCategory();
      const title = `${compactPrompt(userPrompt || d.prompt || '3D全景贴图')} · ${sizeLevel}`;
      const saved = await api.addResourceItem({
        url: sourceUrl,
        kind: 'panorama',
        categoryId: category.id,
        title,
        tags: ['3D全景', 'panorama', 'VR', sizeLevel, generationModeLabel(generationMode)],
        sourceNodeId: p.id,
        favorite: false,
      });
      if (!saved.success) throw new Error(saved.error || '保存资源失败');
      if (saved.data.kind !== 'panorama') {
        throw new Error('后端未按全景类型保存，请重启开发后端后再试。');
      }
      window.dispatchEvent(new CustomEvent('penguin:resources-changed'));
      setResourceState(saved.data.duplicate ? '已在资源库' : '已保存');
      window.setTimeout(() => setResourceState(''), 1800);
    } catch (e: any) {
      setResourceState(e?.message || '保存资源失败');
    }
  }, [d.prompt, generationMode, p.id, sizeLevel, sourceUrl, userPrompt]);

  const useHistoryItem = useCallback((item: PanoramaGenerationHistoryItem) => {
    update({
      panoramaSourceUrl: item.url,
      panoramaGeneratedUrl: item.url,
      panoramaPrompt: item.prompt || '',
      panoramaPromptFinal: item.promptFinal || buildPanoramaPromptFinal(item.prompt || ''),
      panoramaGenerationMode: item.mode,
      panoramaPanelMode: item.mode,
      panoramaSizeLevel: item.sizeLevel,
      imageUrl: item.url,
      imageUrls: [item.url],
      urls: [item.url],
      status: 'success',
      panoramaError: '',
    });
  }, [update]);

  useRunTrigger(p.id, runNode, 'image');

  const nodeStyle = {
    width: 760,
    borderColor: p.selected ? COLOR : undefined,
    boxShadow: p.selected ? `0 0 0 2px ${COLOR}, var(--t8-shadow-strong, 0 18px 36px rgba(0,0,0,.22))` : undefined,
  };

  const savedError = typeof d.panoramaError === 'string' ? d.panoramaError : '';
  const hasSource = Boolean(sourceUrl);
  const isGeneratedPreview = Boolean(generatedSourceUrl && sourceUrl === generatedSourceUrl);
  const generatedSubtitle = isGenerating
    ? `生成中 · 21:9 · ${sizeLevel}`
    : hasSource
    ? `${PANORAMA_RATIO_OPTIONS.find((x) => x.id === ratioId)?.label || '16:9'} · ${isGeneratedPreview ? `${sizeLevel} · GPT Image 2` : `FOV ${Math.round(fov)}°`}`
    : '文生 / 图生 720VR';
  const hasConnectedReference = Boolean(connectedSource?.url);
  const hasLocalReference = Boolean(localReferenceUrl);
  const activeReferenceUrl = imageReferenceUrl;

  return (
    <div className="t8-node relative transition-all" style={nodeStyle}>
      <Handle type="target" position={Position.Left} style={{ background: COLOR, border: 0 }} />
      <Handle type="source" position={Position.Right} style={{ background: COLOR, border: 0 }} />

      <div className="relative z-10">
        <div className="t8-node-header flex items-center gap-2 px-3 py-2">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: 'color-mix(in srgb, var(--t8-accent) 18%, transparent)', color: 'var(--t8-accent)' }}
          >
            <Globe2 size={15} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-bold text-[var(--t8-text-main)]">3D全景</div>
            <div className="text-[10px] text-[var(--t8-text-muted)]">
              {generatedSubtitle}
            </div>
          </div>
          {isLikely && (
            <span className="rounded-md border border-sky-400/25 bg-sky-400/10 px-1.5 py-0.5 text-[10px] font-bold text-sky-200">
              360
            </span>
          )}
        </div>

        <div className="p-3 space-y-3 nodrag" onMouseDown={(e) => e.stopPropagation()}>
          <div
            className={`relative overflow-hidden rounded-lg border border-[var(--t8-border)] bg-slate-950 ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
            style={{ aspectRatio: `${ratio.w} / ${ratio.h}`, minHeight: 260 }}
            onWheel={onWheel}
          >
            <canvas
              ref={canvasRef}
              className="block h-full w-full"
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
              onPointerLeave={endDrag}
            />
            {!hasSource && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-950 text-center text-xs text-slate-300">
                <Box size={24} className="text-sky-300" />
                <span>连接或生成全景贴图</span>
              </div>
            )}
            {textureStatus === 'loading' && (
              <div className="absolute inset-0 flex items-center justify-center gap-2 bg-slate-950/70 text-xs font-bold text-slate-100">
                <Loader2 size={15} className="animate-spin" />
                加载中
              </div>
            )}
            {isGenerating && (
              <div className="absolute inset-0 flex items-center justify-center gap-2 bg-slate-950/75 text-xs font-bold text-slate-100">
                <Loader2 size={15} className="animate-spin" />
                {d.progress || '生成中'}
              </div>
            )}
            {(textureStatus === 'error' || savedError) && (
              <div className="absolute inset-x-3 bottom-3 flex items-center gap-2 rounded-lg border border-red-400/25 bg-red-950/80 px-2 py-1.5 text-xs text-red-100">
                <AlertCircle size={14} />
                <span className="min-w-0 truncate">{error || savedError}</span>
              </div>
            )}
          </div>

          <input ref={refInputRef} type="file" accept="image/*" className="hidden" onChange={handleReferenceUpload} />

          <div className="grid grid-cols-3 gap-1.5">
            {([
              ['preview', '连接预览'],
              ['text', '文生全景'],
              ['image', '图生全景'],
            ] as Array<[PanoramaPanelMode, string]>).map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                className={`t8-btn min-h-8 px-2 text-[11px] ${panelMode === mode ? 't8-btn-primary' : ''}`}
                onClick={() => update({
                  panoramaPanelMode: mode,
                  ...(mode === 'text' || mode === 'image' ? { panoramaGenerationMode: mode } : {}),
                })}
              >
                {label}
              </button>
            ))}
          </div>

          {panelMode !== 'preview' && (
            <div className="space-y-2 rounded-lg border border-[var(--t8-border)] bg-[var(--t8-bg-panel-muted)] p-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="rounded-md bg-sky-400/15 px-2 py-1 text-[10px] font-bold text-sky-200">GPT Image 2</span>
                <span className="rounded-md bg-amber-400/15 px-2 py-1 text-[10px] font-bold text-amber-200">21:9</span>
                {PANORAMA_SIZE_LEVELS.map((level) => (
                  <button
                    key={level}
                    type="button"
                    className={`t8-btn h-7 px-2 text-[10px] ${sizeLevel === level ? 't8-btn-primary' : ''}`}
                    onClick={() => update({ panoramaSizeLevel: level })}
                  >
                    {level}
                  </button>
                ))}
              </div>

              <div className="rounded-md border border-sky-400/20 bg-sky-950/25 px-2 py-1.5 text-[10px] leading-relaxed text-sky-100">
                {PANORAMA_FIXED_PROMPT}
              </div>

              <PromptTextarea
                title="3D 全景提示词"
                value={userPrompt}
                onValueChange={(value) => update({
                  panoramaPrompt: value,
                  panoramaPromptFinal: buildPanoramaPromptFinal(value),
                })}
                rows={3}
                placeholder={panelMode === 'image' ? '可选补充：场景风格、天气、镜头中心...' : '场景提示词'}
                className="w-full resize-none rounded-md border border-[var(--t8-border)] bg-[var(--t8-bg-panel)] px-2 py-1.5 text-xs text-[var(--t8-text-main)] outline-none"
              />

              <div className="flex flex-wrap gap-1">
                {PANORAMA_PROMPT_TEMPLATES.map((tpl) => (
                  <button
                    key={tpl}
                    type="button"
                    className="t8-btn h-7 px-2 text-[10px]"
                    onClick={() => {
                      const next = userPrompt.trim() ? `${userPrompt.trim()}，${tpl}` : tpl;
                      update({ panoramaPrompt: next, panoramaPromptFinal: buildPanoramaPromptFinal(next) });
                    }}
                  >
                    {tpl}
                  </button>
                ))}
              </div>

              {panelMode === 'image' && (
                <div className="grid grid-cols-[1fr_auto_auto] items-center gap-2 rounded-md bg-[var(--t8-bg-panel)] px-2 py-1.5">
                  <div className="min-w-0 text-[10px] text-[var(--t8-text-muted)]">
                    {hasConnectedReference
                      ? `上游第一张 · ${connectedSource?.label || '参考图'}`
                      : hasLocalReference
                      ? `节点内参考 · ${cleanFileBase(localReferenceUrl)}`
                      : '等待参考图'}
                  </div>
                  <button type="button" className="t8-mini-icon-button" onClick={() => refInputRef.current?.click()} title="上传参考图">
                    <Upload size={13} />
                  </button>
                  <button
                    type="button"
                    className="t8-mini-icon-button"
                    onClick={() => update({ panoramaReferenceUrl: '' })}
                    disabled={!hasLocalReference}
                    title="清除节点内参考"
                  >
                    <RotateCcw size={13} />
                  </button>
                </div>
              )}

              {panelMode === 'image' && activeReferenceUrl && (
                <div className="overflow-hidden rounded-md border border-[var(--t8-border)] bg-slate-950">
                  <SmartImage src={activeReferenceUrl} alt="全景参考图" className="h-20 w-full object-contain" draggable={false} thumbSize={420} />
                </div>
              )}

              <details className="rounded-md bg-[var(--t8-bg-panel)] px-2 py-1 text-[10px] text-[var(--t8-text-muted)]">
                <summary className="cursor-pointer font-bold text-[var(--t8-text-main)]">实际发送</summary>
                <div className="mt-1 max-h-24 overflow-y-auto whitespace-pre-wrap leading-relaxed">{promptFinal}</div>
              </details>

              <div className="grid grid-cols-4 gap-1.5">
                <button type="button" className="t8-btn t8-btn-primary min-h-8 px-2 text-[11px]" onClick={generatePanorama} disabled={isGenerating}>
                  {isGenerating ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                  {d.panoramaGeneratedUrl ? '重新生成' : '生成全景'}
                </button>
                <button type="button" className="t8-btn min-h-8 px-2 text-[11px]" onClick={copyPrompt}>
                  {copyState ? <CheckCircle2 size={13} /> : <Copy size={13} />}
                  {copyState || '复制'}
                </button>
                <button type="button" className="t8-btn min-h-8 px-2 text-[11px]" onClick={savePanoramaResource} disabled={!sourceUrl || resourceState === '保存中'}>
                  {resourceState === '保存中' ? <Loader2 size={13} className="animate-spin" /> : <PackagePlus size={13} />}
                  {resourceState || '资源库'}
                </button>
                <button type="button" className="t8-btn min-h-8 px-2 text-[11px]" onClick={() => sourceUrl && downloadUrl(sourceUrl, `${cleanFileBase(sourceUrl)}-panorama.png`)} disabled={!sourceUrl}>
                  <Download size={13} />
                  贴图
                </button>
              </div>

              {generatedHistory.length > 0 && (
                <div className="space-y-1">
                  <div className="flex items-center gap-1 text-[10px] font-bold text-[var(--t8-text-muted)]">
                    <History size={12} /> 最近生成
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {generatedHistory.map((item) => (
                      <button
                        key={`${item.url}:${item.createdAt}`}
                        type="button"
                        className="group overflow-hidden rounded-md border border-[var(--t8-border)] bg-slate-950 text-left"
                        onClick={() => useHistoryItem(item)}
                        title={item.promptFinal}
                      >
                        <SmartImage src={item.url} alt="全景历史" className="h-12 w-full object-cover" draggable={false} thumbSize={240} />
                        <div className="truncate px-1.5 py-1 text-[9px] text-slate-200">{item.sizeLevel} · {generationModeLabel(item.mode)}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-10 gap-1.5">
            {PANORAMA_RATIO_OPTIONS.map((item) => (
              <button
                key={item.id}
                type="button"
                title={item.label}
                onClick={() => setView({ panoramaRatio: item.id })}
                className={`t8-btn px-1.5 py-1.5 text-[10px] ${ratioId === item.id ? 't8-btn-primary' : ''}`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {ratioId === 'custom' && (
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="mb-1 block text-[10px] font-bold text-[var(--t8-text-muted)]">比例宽</span>
                <input
                  type="number"
                  min={1}
                  max={999}
                  value={customW}
                  onChange={(e) => update({ panoramaCustomW: clampPanoramaNumber(e.target.value, 1, 999, 16) })}
                  className="w-full rounded-md border border-[var(--t8-border)] bg-[var(--t8-bg-panel-muted)] px-2 py-1 text-xs text-[var(--t8-text-main)] outline-none"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-[10px] font-bold text-[var(--t8-text-muted)]">比例高</span>
                <input
                  type="number"
                  min={1}
                  max={999}
                  value={customH}
                  onChange={(e) => update({ panoramaCustomH: clampPanoramaNumber(e.target.value, 1, 999, 9) })}
                  className="w-full rounded-md border border-[var(--t8-border)] bg-[var(--t8-bg-panel-muted)] px-2 py-1 text-xs text-[var(--t8-text-main)] outline-none"
                />
              </label>
            </div>
          )}

          <div className="grid grid-cols-5 gap-2">
            <button type="button" className="t8-btn py-2 text-xs" onClick={() => update({ panoramaFov: clampFov(fov * 0.92) })} title="放大">
              <ZoomIn size={14} />
            </button>
            <button type="button" className="t8-btn py-2 text-xs" onClick={() => update({ panoramaFov: clampFov(fov / 0.92) })} title="缩小">
              <ZoomOut size={14} />
            </button>
            <button type="button" className="t8-btn py-2 text-xs" onClick={resetView} title="重置视角">
              <RotateCcw size={14} />
            </button>
            <button type="button" className={`t8-btn py-2 text-xs ${autoRotate ? 't8-btn-primary' : ''}`} onClick={() => update({ panoramaAutoRotate: !autoRotate })} title="自动旋转">
              {autoRotate ? <Pause size={14} /> : <Play size={14} />}
            </button>
            <button type="button" className="t8-btn t8-btn-primary py-2 text-xs" onClick={exportFrame} disabled={textureStatus !== 'ready' || isGenerating} title="导出当前画面">
              {isGenerating && d.progress === '导出中' ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2 text-[10px] text-[var(--t8-text-muted)]">
            <div className="rounded-md bg-[var(--t8-bg-panel-muted)] px-2 py-1">Yaw {Math.round(yaw)}°</div>
            <div className="rounded-md bg-[var(--t8-bg-panel-muted)] px-2 py-1">Pitch {Math.round(pitch)}°</div>
            <div className="rounded-md bg-[var(--t8-bg-panel-muted)] px-2 py-1">{renderSize.width}×{renderSize.height}</div>
          </div>

          {outputUrl && !hasAutoOutput && (
            <div className="rounded-lg border border-[var(--t8-border)] bg-[var(--t8-bg-panel-muted)] p-2">
              <SmartImage src={outputUrl} alt="导出画面" className="max-h-28 w-full rounded object-contain" draggable={false} thumbSize={720} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default memo(Panorama3DNode);
