import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Moon, Settings, Sun, Wifi, WifiOff, Sparkles, Cloud, ExternalLink, Copy, Check, Gift, Heart, Youtube, PlayCircle, Bell, Wand2, Globe, MessageCircle, CalendarDays, Rocket, Key, Library, Palette, Skull, Sailboat } from 'lucide-react';
import { useThemeStore } from './stores/theme';
import { useApiKeysStore } from './stores/apiKeys';
import { useShortcutStore } from './stores/shortcuts';
import Sidebar from './components/Sidebar';
import type { AddNodeFn, InsertWorkflowFn } from './components/Canvas';
import AppUpdaterButton from './components/AppUpdaterButton';
import MaterialContextMenu from './components/MaterialContextMenu';
import ErrorBoundary from './components/ErrorBoundary';
import { RHToolsProvider } from './providers/RHToolsProvider';
import * as api from './services/api';
import type { NodeType } from './types/canvas';
import type { ResourceItem } from './services/api';
import { applyThemeTemplate } from './theme/applyTheme';
import { resolveThemeTemplate } from './theme/defaultTemplates';
import { materialSetItemsToData, type MaterialSetKind, type MaterialSetItem } from './utils/materialSet';
import { workflowManifestToFragment } from './utils/workflowResource';
import { matchesAnyShortcut } from './utils/keyboardShortcuts';
import { portraitResourceToNodeData } from './utils/portraitResource';

const Canvas = lazy(() => import('./components/Canvas'));
const ApiSettingsModal = lazy(() => import('./components/ApiSettings'));
const ResourceLibraryDrawer = lazy(() => import('./components/ResourceLibraryDrawer'));
const ThemeTemplateManager = lazy(() => import('./components/ThemeTemplateManager'));

// vite.config 注入的编译期常量（与 package.json 同步），勿硬编码 v1.x.x
declare const __APP_VERSION__: string;

function isShortcutTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT' ||
    target.isContentEditable ||
    Boolean(target.closest('[contenteditable="true"]'))
  );
}

function poseBackupToNodeData(value: unknown): Record<string, any> | null {
  const raw = value && typeof value === 'object' ? (value as Record<string, any>) : null;
  const backup = raw?.schema === 't8-pose-master-resource' ? raw.poseBackup : raw;
  if (!backup || typeof backup !== 'object' || (backup as any).schema !== 't8-pose-master') return null;
  const pose = backup as Record<string, any>;
  const people = Array.isArray(pose.people)
    ? pose.people
    : pose.hasPeople === false
      ? []
      : pose.points
        ? [pose.points]
        : [];
  const prompt = typeof pose.prompt === 'string' ? pose.prompt : '';
  return {
    kind: 'pose-master',
    posePoints: pose.points,
    posePointVersion: Number(pose.pointVersion) || 4,
    poseHasPeople: pose.hasPeople !== false,
    posePeople: people,
    poseActivePersonIndex: 0,
    poseHandControls: pose.handControls,
    posePresetId: typeof pose.presetId === 'string' ? pose.presetId : 'standing',
    poseViewId: typeof pose.viewId === 'string' ? pose.viewId : 'front',
    poseShotId: typeof pose.shotId === 'string' ? pose.shotId : 'full-body',
    poseIntensityId: typeof pose.intensityId === 'string' ? pose.intensityId : 'natural',
    poseLanguage: pose.language === 'zh' ? 'zh' : 'en',
    poseCustomText: typeof pose.custom === 'string' ? pose.custom : '',
    poseCanvasRatioId: typeof pose.canvasRatioId === 'string' ? pose.canvasRatioId : 'default',
    poseCanvasCustomWidth: Number(pose.canvasCustomWidth) || 620,
    poseCanvasCustomHeight: Number(pose.canvasCustomHeight) || 520,
    prompt,
    text: prompt,
    outputText: prompt,
    posePrompt: prompt,
    metadata: {
      schema: 't8-pose-master',
      resourceRestoredAt: Date.now(),
      sourceName: typeof pose.name === 'string' ? pose.name : '',
    },
  };
}

async function poseResourceToNodeData(item: ResourceItem): Promise<Record<string, any> | null> {
  if (item.kind !== 'pose' || !item.fileUrl) return null;
  const res = await fetch(item.fileUrl);
  if (!res.ok) throw new Error(`读取姿势资源失败: HTTP ${res.status}`);
  return poseBackupToNodeData(await res.json());
}

async function workflowResourceToFragment(item: ResourceItem) {
  if (item.kind !== 'workflow' || !item.fileUrl) return null;
  const res = await fetch(item.fileUrl);
  if (!res.ok) throw new Error(`读取工作流资源失败: HTTP ${res.status}`);
  return workflowManifestToFragment(await res.json());
}

function CanvasBootFallback({ isPixel, isDark }: { isPixel: boolean; isDark: boolean }) {
  return (
    <div
      className={`flex-1 min-w-0 flex items-center justify-center ${
        isPixel ? 'px-panel' : isDark ? 'bg-zinc-950 text-zinc-400' : 'bg-zinc-50 text-zinc-500'
      }`}
      style={{ background: 'var(--t8-bg-app)', color: 'var(--t8-text-muted)' }}
    >
      <div className={isPixel ? 'px-panel px-panel--small px-title text-xs' : 'text-xs font-medium'}>
        正在加载画布...
      </div>
    </div>
  );
}

/**
 * T8-penguin-canvas 应用根组件 (Phase 1)
 * 布局: [侧边栏(画布管理 + 节点列表)] [画布主体] + 头部状态栏
 */
function App() {
  const { theme, style, templateId, customTemplates, toggleTheme, loadCustomTemplates } = useThemeStore();
  const { load: loadSettings } = useApiKeysStore();
  const shortcuts = useShortcutStore((s) => s.shortcuts);
  const currentTemplate = useMemo(
    () => resolveThemeTemplate(templateId, customTemplates),
    [templateId, customTemplates],
  );
  const [backendStatus, setBackendStatus] = useState<'checking' | 'ok' | 'error'>('checking');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [resourceOpen, setResourceOpen] = useState(false);
  const [themeManagerOpen, setThemeManagerOpen] = useState(false);
  // 「在线画布」推广浮层开关 + 容器 ref(用于点击外部关闭)
  const [cloudOpen, setCloudOpen] = useState(false);
  const [wxCopied, setWxCopied] = useState(false);
  const cloudWrapRef = useRef<HTMLDivElement>(null);
  // 「视频教程」推广浮层开关
  const [videoOpen, setVideoOpen] = useState(false);
  const videoWrapRef = useRef<HTMLDivElement>(null);
  // 「贞贞工坊」推广浮层开关
  const [zhenOpen, setZhenOpen] = useState(false);
  const zhenWrapRef = useRef<HTMLDivElement>(null);
  // 「最新应用」推广浮层开关
  const [appOpen, setAppOpen] = useState(false);
  const appWrapRef = useRef<HTMLDivElement>(null);
  // 「AIX产品」推广浮层开关
  const [aixOpen, setAixOpen] = useState(false);
  const aixWrapRef = useRef<HTMLDivElement>(null);
  // 画布接收节点添加的 ref(从 Sidebar -> Canvas)
  const addNodeRef = useRef<AddNodeFn | null>(null);
  const insertWorkflowRef = useRef<InsertWorkflowFn | null>(null);

  // 「在线画布」浮层: 点击容器外部 / 按 ESC 自动关闭
  useEffect(() => {
    if (!cloudOpen) return;
    const onDocDown = (e: MouseEvent) => {
      if (!cloudWrapRef.current) return;
      if (!cloudWrapRef.current.contains(e.target as Node)) setCloudOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setCloudOpen(false);
    };
    document.addEventListener('mousedown', onDocDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [cloudOpen]);

  // 「视频教程」浮层: 点击容器外部 / 按 ESC 自动关闭
  useEffect(() => {
    if (!videoOpen) return;
    const onDocDown = (e: MouseEvent) => {
      if (!videoWrapRef.current) return;
      if (!videoWrapRef.current.contains(e.target as Node)) setVideoOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setVideoOpen(false);
    };
    document.addEventListener('mousedown', onDocDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [videoOpen]);

  // 「贞贞工坊」浮层: 点击容器外部 / 按 ESC 自动关闭
  useEffect(() => {
    if (!zhenOpen) return;
    const onDocDown = (e: MouseEvent) => {
      if (!zhenWrapRef.current) return;
      if (!zhenWrapRef.current.contains(e.target as Node)) setZhenOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setZhenOpen(false);
    };
    document.addEventListener('mousedown', onDocDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [zhenOpen]);

  // 「最新应用」浮层: 点击容器外部 / 按 ESC 自动关闭
  useEffect(() => {
    if (!appOpen) return;
    const onDocDown = (e: MouseEvent) => {
      if (!appWrapRef.current) return;
      if (!appWrapRef.current.contains(e.target as Node)) setAppOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAppOpen(false);
    };
    document.addEventListener('mousedown', onDocDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [appOpen]);

  // 「AIX产品」浮层: 点击容器外部 / 按 ESC 自动关闭
  useEffect(() => {
    if (!aixOpen) return;
    const onDocDown = (e: MouseEvent) => {
      if (!aixWrapRef.current) return;
      if (!aixWrapRef.current.contains(e.target as Node)) setAixOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAixOpen(false);
    };
    document.addEventListener('mousedown', onDocDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [aixOpen]);

  useEffect(() => {
    const hasOpenTopSurface = cloudOpen || videoOpen || zhenOpen || appOpen || aixOpen || resourceOpen;
    if (!hasOpenTopSurface) return;

    const onDocPointerDown = (e: PointerEvent) => {
      const target = e.target;
      if (!(target instanceof HTMLElement)) return;
      if (
        target.closest('.t8-topbar') ||
        target.closest('.resource-library-drawer') ||
        target.closest('[data-canvas-floating-ui]') ||
        target.closest('.react-flow__node') ||
        target.closest('.react-flow__edge') ||
        target.closest('.react-flow__controls') ||
        target.closest('.react-flow__minimap') ||
        target.closest('.t8-control-rail')
      ) {
        return;
      }

      setCloudOpen(false);
      setVideoOpen(false);
      setZhenOpen(false);
      setAppOpen(false);
      setAixOpen(false);
      setResourceOpen(false);
    };

    document.addEventListener('pointerdown', onDocPointerDown, true);
    return () => {
      document.removeEventListener('pointerdown', onDocPointerDown, true);
    };
  }, [cloudOpen, videoOpen, zhenOpen, appOpen, aixOpen, resourceOpen]);

  const handleCopyWx = async () => {
    try {
      await navigator.clipboard.writeText('Lovexy_0222');
      setWxCopied(true);
      window.setTimeout(() => setWxCopied(false), 1600);
    } catch {
      // 兼容: 不支持 clipboard API 时降级 prompt 让用户手动复制
      window.prompt('复制企鹅微信号:', 'Lovexy_0222');
    }
  };

  // 将主题状态注入 <html> 供 CSS 选择器使用
  useEffect(() => {
    const root = document.documentElement;
    applyThemeTemplate(currentTemplate, theme);
    // 全局禁用拼写检查(节点提示词为中文/@变量语法,不需红色波浪线干扰)
    // spellcheck 属性 HTML 标准上是可继承的 → 根上设一次,所有后代 textarea/input 都生效
    root.setAttribute('spellcheck', 'false');
    document.body.setAttribute('spellcheck', 'false');
  }, [currentTemplate, theme]);

  // 全局 MutationObserver: 为动态挂载的 textarea / input 自动设置 spellcheck=false
  // (Chromium 对 textarea 默认 spellcheck=true,不会从祖先继承 → 需逐个设置)
  //
  // 同时：全局为所有 textarea / input / select 添加 `nodrag` + `nowheel` className
  // — xyflow v12 识别 `nodrag` 后不触发节点拖动，避免「框选文字时整个节点跟着鼠标走」
  // — `nowheel` 让 textarea 内部可独立滚轮滚动，不被 xyflow 接管为画布缩放
  // — 不覆盖节点原有 className(classList.add 只追加)，零侵入
  useEffect(() => {
    const apply = (el: Element) => {
      const tag = el.tagName;
      if (tag === 'TEXTAREA' || tag === 'INPUT' || tag === 'SELECT') {
        if (tag !== 'SELECT') {
          el.setAttribute('spellcheck', 'false');
          el.setAttribute('autocorrect', 'off');
          el.setAttribute('autocapitalize', 'off');
        }
        // xyflow noDragClassName / noWheelClassName 默认 'nodrag' / 'nowheel'
        // 加上后该元素上的 pointerdown 不会被 xyflow 当作节点拖拽启动
        el.classList.add('nodrag', 'nowheel');
      }
    };
    // 初始扫描
    document.querySelectorAll('textarea, input, select').forEach(apply);
    // 增量监听
    const mo = new MutationObserver((muts) => {
      for (const m of muts) {
        m.addedNodes.forEach((n) => {
          if (n.nodeType !== 1) return;
          const el = n as Element;
          apply(el);
          el.querySelectorAll?.('textarea, input, select').forEach(apply);
        });
      }
    });
    mo.observe(document.body, { childList: true, subtree: true });
    return () => mo.disconnect();
  }, []);

  // 启动探测后端
  useEffect(() => {
    const check = async () => {
      const ok = await api.checkBackendStatus();
      setBackendStatus(ok ? 'ok' : 'error');
    };
    check();
    const t = window.setInterval(check, 15_000);
    return () => window.clearInterval(t);
  }, []);

  // 预加载 settings
  useEffect(() => {
    loadSettings();
    loadCustomTemplates();
  }, [loadSettings, loadCustomTemplates]);

  // 资源库快捷键：未选中任何节点时打开 / 关闭资源库。输入框内不拦截，避免打断提示词编辑。
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!matchesAnyShortcut(shortcuts['global.resource-library'], e)) return;
      if (e.repeat) return;
      if (isShortcutTypingTarget(e.target)) return;
      if (document.querySelector('.react-flow__node.selected')) return;
      e.preventDefault();
      setResourceOpen((open) => !open);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [shortcuts]);

  const isDark = theme === 'dark';
  const isPixel = style === 'pixel';
  const isOp = currentTemplate.visuals?.style === 'op';
  const isRh = currentTemplate.visuals?.style === 'rh';
  const isNaruto = currentTemplate.visuals?.style === 'naruto';
  const isEva = currentTemplate.visuals?.style === 'eva';
  const isYyh = currentTemplate.visuals?.style === 'yyh';
  const isSlamdunk = currentTemplate.visuals?.style === 'slamdunk';
  const isSoccer = currentTemplate.visuals?.style === 'soccer-hero';

  const handleAddNode = (type: NodeType) => {
    addNodeRef.current?.(type);
  };

  const handleInsertResource = async (item: ResourceItem) => {
    const portraitData = portraitResourceToNodeData(item);
    if (portraitData) {
      addNodeRef.current?.('portrait-master', { data: portraitData });
      void api.updateResourceItem(item.id, { touch: true });
      return;
    }
    if (item.kind === 'pose') {
      const poseData = await poseResourceToNodeData(item);
      if (!poseData) throw new Error('姿势资源格式无效');
      addNodeRef.current?.('pose-master', { data: poseData });
      void api.updateResourceItem(item.id, { touch: true });
      return;
    }
    if (item.kind === 'workflow') {
      const fragment = await workflowResourceToFragment(item);
      if (!fragment) throw new Error('工作流资源格式无效');
      insertWorkflowRef.current?.(fragment, { title: item.title || '工作流' });
      void api.updateResourceItem(item.id, { touch: true });
      return;
    }
    if (item.kind === 'set' && item.materialSetKind && item.materialSetItems?.length) {
      addNodeRef.current?.('material-set', {
        data: materialSetItemsToData(
          item.materialSetKind as MaterialSetKind,
          item.materialSetItems as MaterialSetItem[],
        ),
      });
      return;
    }
    const mediaKind = item.kind === 'panorama' ? 'image' : item.kind;
    const data: Record<string, any> = {
      uploadType: mediaKind,
      fileName: item.title || item.originalName || '资源库素材',
      fileSize: item.size || 0,
      mime: item.mime || '',
    };
    if (mediaKind === 'image') {
      data.imageUrl = item.fileUrl;
    } else if (mediaKind === 'video') {
      data.videoUrl = item.fileUrl;
    } else if (mediaKind === 'audio') {
      data.audioUrl = item.fileUrl;
    }
    addNodeRef.current?.('upload', { data });
  };

  return (
    <RHToolsProvider>
    <div
      className={`t8-app-shell h-screen flex flex-col overflow-hidden ${
        isPixel ? '' : isDark ? 'bg-zinc-950 text-white' : 'bg-zinc-50 text-zinc-900'
      } ${isOp ? 't8-app-shell--op' : ''} ${isRh ? 't8-app-shell--rh' : ''} ${isNaruto ? 't8-app-shell--naruto' : ''} ${isEva ? 't8-app-shell--eva' : ''} ${isYyh ? 't8-app-shell--yyh' : ''} ${isSlamdunk ? 't8-app-shell--slamdunk' : ''} ${isSoccer ? 't8-app-shell--soccer' : ''}`}
      style={{ background: 'var(--t8-bg-app)', color: 'var(--t8-text-main)' }}
    >
      {/* 头部状态栏 */}
      <header
        className={`t8-topbar flex items-center justify-between px-4 py-2 border-b ${
          isPixel
            ? 'px-panel'
            : isDark
              ? 'bg-zinc-900 border-white/10'
              : 'bg-white border-black/10'
        }`}
      >
        <div className="flex items-center gap-3">
          {isOp ? (
            <div className="t8-op-brand flex items-center gap-2">
              <span className="t8-op-brand__mark">
                <Skull size={16} />
              </span>
              <div className="min-w-0">
                <h1 className="t8-op-brand__title text-[14px] font-black leading-none">
                  ONE PIECE · 贞贞的无限画布
                </h1>
                <div className="t8-op-brand__sub text-[9px] font-bold tracking-wide leading-none mt-0.5">
                  GRAND LINE CANVAS
                </div>
              </div>
              <Sailboat className="t8-op-brand__ship" size={15} />
            </div>
          ) : isRh ? (
            <div className="t8-rh-brand flex items-center gap-2">
              <span className="t8-rh-brand__mark">
                <Cloud size={16} />
              </span>
              <div className="min-w-0">
                <h1 className="t8-rh-brand__title text-[14px] font-black leading-none">
                  RH · 贞贞的无限画布
                </h1>
                <div className="t8-rh-brand__sub text-[9px] font-bold tracking-wide leading-none mt-0.5">
                  RUNNINGHUB WORKSPACE
                </div>
              </div>
            </div>
          ) : isNaruto ? (
            <div className="t8-naruto-brand flex items-center gap-2">
              <span className="t8-naruto-brand__mark" aria-hidden="true">
                <span className="t8-naruto-brand__leaf" />
              </span>
              <div className="min-w-0">
                <h1 className="t8-naruto-brand__title text-[14px] font-black leading-none">
                  火影 · 贞贞的无限画布
                </h1>
                <div className="t8-naruto-brand__sub text-[9px] font-bold tracking-wide leading-none mt-0.5">
                  SHINOBI CHAKRA CANVAS
                </div>
              </div>
            </div>
          ) : isEva ? (
            <div className="t8-eva-brand flex items-center gap-2">
              <span className="t8-eva-brand__mark" aria-hidden="true">
                <span className="t8-eva-brand__core" />
              </span>
              <div className="min-w-0">
                <h1 className="t8-eva-brand__title text-[14px] font-black leading-none">
                  EVA · 贞贞的无限画布
                </h1>
                <div className="t8-eva-brand__sub text-[9px] font-bold tracking-wide leading-none mt-0.5">
                  NERV HQ - TOKYO-3 / MAGI SYSTEM ONLINE
                </div>
              </div>
              <span className="t8-eva-brand__sync" aria-hidden="true">SYSTEM STATUS: ONLINE</span>
            </div>
          ) : isYyh ? (
            <div className="t8-yyh-brand flex items-center gap-2">
              <span className="t8-yyh-brand__mark" aria-hidden="true">
                <Sparkles size={16} />
              </span>
              <div className="min-w-0">
                <h1 className="t8-yyh-brand__title text-[14px] font-black leading-none">
                  幽游白书 · 贞贞的无限画布
                </h1>
                <div className="t8-yyh-brand__sub text-[9px] font-bold tracking-wide leading-none mt-0.5">
                  SPIRIT DETECTIVE CANVAS / REI MAP ONLINE
                </div>
              </div>
              <span className="t8-yyh-brand__status" aria-hidden="true">REI GUN READY</span>
            </div>
          ) : isSlamdunk ? (
            <div className="t8-slamdunk-brand flex items-center gap-2">
              <span className="t8-slamdunk-brand__mark" aria-hidden="true">
                <span className="t8-slamdunk-brand__ball" />
              </span>
              <div className="min-w-0">
                <h1 className="t8-slamdunk-brand__title text-[14px] font-black leading-none">
                  灌篮高手 · 贞贞的无限画布
                </h1>
                <div className="t8-slamdunk-brand__sub text-[9px] font-bold tracking-wide leading-none mt-0.5">
                  FULL COURT CANVAS / BUZZER BEATER READY
                </div>
              </div>
              <span className="t8-slamdunk-brand__score" aria-hidden="true">T8 10 : 08 AI</span>
            </div>
          ) : isSoccer ? (
            <div className="t8-soccer-brand flex items-center gap-2">
              <span className="t8-soccer-brand__mark" aria-hidden="true">
                <span className="t8-soccer-brand__jersey" />
              </span>
              <div className="min-w-0">
                <h1 className="t8-soccer-brand__title text-[14px] font-black leading-none">
                  足球小将 · 贞贞的无限画布
                </h1>
                <div className="t8-soccer-brand__sub text-[9px] font-bold tracking-wide leading-none mt-0.5">
                  CAPTAIN TSUBASA CANVAS / GOLDEN GOAL READY
                </div>
              </div>
              <span className="t8-soccer-brand__score" aria-hidden="true">Japan 3:2 Brazil</span>
            </div>
          ) : isPixel ? (
            <>
              <h1 className="px-title text-[14px] font-bold tracking-wide leading-none">
                贞贞的无限画布
              </h1>
              <span className="px-chip px-chip--pink text-[10px]">企鹅共创版</span>
            </>
          ) : (
            <h1 className="text-sm font-semibold">贞贞的无限画布（企鹅共创版）</h1>
          )}
          <span
            className={
              isPixel
                ? 'px-chip px-chip--mint text-[10px]'
                : `t8-topbar-status-chip text-[10px] px-1.5 py-0.5 rounded ${
                    isDark ? 'bg-white/10 text-white/60' : 'bg-black/5 text-zinc-500'
                  }`
            }
          >
            v{__APP_VERSION__}
          </span>
          {/* 后端状态 */}
          {isPixel ? (
            <span
              className={`px-chip ${
                backendStatus === 'ok'
                  ? 'px-chip--mint'
                  : backendStatus === 'error'
                    ? 'px-chip--pink'
                    : 'px-chip--yellow'
              }`}
            >
              {backendStatus === 'ok' ? <Wifi size={11} /> : <WifiOff size={11} />}
              {backendStatus === 'ok' && '后端已连接'}
              {backendStatus === 'error' && '后端未连接'}
              {backendStatus === 'checking' && '检测中...'}
            </span>
          ) : (
            <div
              className={`t8-topbar-status-chip flex items-center gap-1.5 text-[11px] ${
                backendStatus === 'ok'
                  ? 'text-emerald-400'
                  : backendStatus === 'error'
                    ? 'text-red-400'
                    : 'text-yellow-400'
              }`}
            >
              {backendStatus === 'ok' ? <Wifi size={12} /> : <WifiOff size={12} />}
              {backendStatus === 'ok' && '后端已连接'}
              {backendStatus === 'error' && '后端未连接'}
              {backendStatus === 'checking' && '检测中...'}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1">
          {/* 「最新应用」推广按钮: 同款胶囊, 主调 橙桃色(区分于 violet/mint/yellow/pink) */}
          <div ref={appWrapRef} className="relative">
            <button
              onClick={() => setAppOpen((v) => !v)}
              className={
                isPixel
                  ? `px-btn px-btn--sm px-btn--peach`
                  : `flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all border ${
                      isDark
                        ? appOpen
                          ? 'bg-orange-500/20 border-orange-400/50 text-orange-200 shadow-[0_0_12px_rgba(249,115,22,0.35)]'
                          : 'bg-orange-500/10 border-orange-500/30 text-orange-300 hover:bg-orange-500/20'
                        : appOpen
                          ? 'bg-orange-100 border-orange-400 text-orange-800'
                          : 'bg-orange-50 border-orange-300 text-orange-700 hover:bg-orange-100'
                    }`
              }
              title="最新应用 · RunningHub 工作流 / API"
            >
              <Rocket size={14} />
              <span className="text-[11px]">最新应用</span>
            </button>

            {/* 推广浮层 */}
            {appOpen && (
              <div
                className={
                  isPixel
                    ? 'absolute right-0 top-full mt-2 z-[60] w-[360px] px-panel rounded-2xl p-3 animate-[fadeIn_.18s_ease-out]'
                    : `absolute right-0 top-full mt-2 z-[60] w-[360px] rounded-xl p-3 border shadow-2xl backdrop-blur-md animate-[fadeIn_.18s_ease-out] ${
                        isDark
                          ? 'bg-zinc-900/95 border-orange-400/20 shadow-orange-500/10'
                          : 'bg-white/95 border-orange-200 shadow-orange-500/10'
                      }`
                }
                style={{ zoom: 1.5 }}
                onMouseDown={(e) => e.stopPropagation()}
              >
                {/* 标题 */}
                <div className={`flex items-center gap-2 ${isPixel ? '' : isDark ? 'text-orange-300' : 'text-orange-700'}`}>
                  <Rocket size={16} className={isPixel ? '' : 'shrink-0'} />
                  <span className={`text-sm font-bold ${isPixel ? 'px-title' : ''}`}>最新应用 · RunningHub</span>
                </div>

                {/* 副标 */}
                <div
                  className={`mt-2 text-[12px] leading-relaxed ${
                    isPixel ? '' : isDark ? 'text-white/80' : 'text-zinc-700'
                  }`}
                >
                  T8 每日教学必用平台，每日同步更新最新工作流、AI 应用、节点、模型，免费教学！强烈推荐 ✨
                </div>

                {/* 国内站跳转按钮 */}
                <a
                  href="https://www.runninghub.cn/user-center/1819214514410942465/webapp?inviteCode=rh-v1121"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setAppOpen(false)}
                  className={
                    isPixel
                      ? 'mt-3 px-btn px-btn--peach w-full justify-center'
                      : `mt-3 flex items-center justify-center gap-1.5 w-full py-2 rounded-lg text-xs font-semibold transition-all border ${
                          isDark
                            ? 'bg-gradient-to-r from-orange-500/20 to-amber-500/20 border-orange-400/40 text-orange-200 hover:from-orange-500/30 hover:to-amber-500/30 hover:border-orange-400/60 hover:shadow-[0_0_16px_rgba(249,115,22,0.35)]'
                            : 'bg-gradient-to-r from-orange-500 to-amber-500 border-amber-600 text-white hover:from-orange-600 hover:to-amber-600 hover:shadow-lg'
                        }`
                  }
                >
                  <Globe size={14} className={isPixel ? '' : 'shrink-0'} />
                  <span>国内站 RunningHub.cn</span>
                  <ExternalLink size={11} className="opacity-70" />
                </a>

                {/* 海外站跳转按钮 */}
                <a
                  href="https://www.runninghub.ai/user-center/1907375370302308353/webapp?inviteCode=rh-v1121"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setAppOpen(false)}
                  className={
                    isPixel
                      ? 'mt-2 px-btn px-btn--yellow w-full justify-center'
                      : `mt-2 flex items-center justify-center gap-1.5 w-full py-2 rounded-lg text-xs font-semibold transition-all border ${
                          isDark
                            ? 'bg-gradient-to-r from-amber-500/20 to-yellow-500/20 border-amber-400/40 text-amber-200 hover:from-amber-500/30 hover:to-yellow-500/30 hover:border-amber-400/60 hover:shadow-[0_0_16px_rgba(245,158,11,0.35)]'
                            : 'bg-gradient-to-r from-amber-400 to-yellow-400 border-amber-500 text-amber-900 hover:from-amber-500 hover:to-yellow-500 hover:shadow-lg'
                        }`
                  }
                >
                  <Globe size={14} className={isPixel ? '' : 'shrink-0'} />
                  <span>海外站 RunningHub.ai</span>
                  <ExternalLink size={11} className="opacity-70" />
                </a>

                {/* RH ApiKey 获取按钮 */}
                <a
                  href="https://www.runninghub.cn/enterprise-api/consumerApi"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setAppOpen(false)}
                  className={
                    isPixel
                      ? 'mt-2 px-btn px-btn--ghost w-full justify-center'
                      : `mt-2 flex items-center justify-center gap-1.5 w-full py-2 rounded-lg text-xs font-semibold transition-all border ${
                          isDark
                            ? 'bg-zinc-800/60 border-zinc-600/60 text-zinc-200 hover:bg-zinc-700/60 hover:border-zinc-500/80'
                            : 'bg-zinc-50 border-zinc-300 text-zinc-700 hover:bg-zinc-100'
                        }`
                  }
                >
                  <Key size={14} className={isPixel ? '' : 'shrink-0'} />
                  <span>获取 RH ApiKey</span>
                  <ExternalLink size={11} className="opacity-70" />
                </a>

                {/* 推荐标语 */}
                <div
                  className={`mt-3 flex items-start gap-1.5 text-[11px] leading-relaxed ${
                    isPixel
                      ? 'px-chip px-chip--mint w-full justify-start py-1.5 px-2'
                      : isDark
                        ? 'text-emerald-200/90 bg-emerald-500/10 border border-emerald-500/30 rounded-md px-2 py-1.5'
                        : 'text-emerald-800 bg-emerald-50 border border-emerald-300 rounded-md px-2 py-1.5'
                  }`}
                >
                  <Sparkles
                    size={12}
                    className={`mt-0.5 shrink-0 ${
                      isPixel ? '' : isDark ? 'text-emerald-300' : 'text-emerald-600'
                    }`}
                  />
                  <span>
                    使用邀请码
                    <span className={isPixel ? 'font-bold' : `font-semibold ${isDark ? 'text-emerald-200' : 'text-emerald-900'}`}> rh-v1121 </span>
                    注册，免费领取1000积分！
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* 「AIX产品」推广按钮: 同款胶囊, 主调 青蓝色 */}
          <div ref={aixWrapRef} className="relative">
            <button
              onClick={() => setAixOpen((v) => !v)}
              className={
                isPixel
                  ? `px-btn px-btn--sm px-btn--sky`
                  : `flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all border ${
                      isDark
                        ? aixOpen
                          ? 'bg-cyan-500/20 border-cyan-400/50 text-cyan-200 shadow-[0_0_12px_rgba(34,211,238,0.35)]'
                          : 'bg-cyan-500/10 border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/20'
                        : aixOpen
                          ? 'bg-cyan-100 border-cyan-400 text-cyan-800'
                          : 'bg-cyan-50 border-cyan-300 text-cyan-700 hover:bg-cyan-100'
                    }`
              }
              title="AIX产品 · T8公司AIX产品"
            >
              <Sparkles size={14} />
              <span className="text-[11px]">AIX产品</span>
            </button>

            {/* 推广浮层 */}
            {aixOpen && (
              <div
                className={
                  isPixel
                    ? 'absolute right-0 top-full mt-2 z-[60] w-[300px] px-panel rounded-2xl p-3 animate-[fadeIn_.18s_ease-out]'
                    : `absolute right-0 top-full mt-2 z-[60] w-[300px] rounded-xl p-3 border shadow-2xl backdrop-blur-md animate-[fadeIn_.18s_ease-out] ${
                        isDark
                          ? 'bg-zinc-900/95 border-cyan-400/20 shadow-cyan-500/10'
                          : 'bg-white/95 border-cyan-200 shadow-cyan-500/10'
                      }`
                }
                style={{ zoom: 1.5 }}
                onMouseDown={(e) => e.stopPropagation()}
              >
                {/* 标题 */}
                <div className={`flex items-center gap-2 ${isPixel ? '' : isDark ? 'text-cyan-300' : 'text-cyan-700'}`}>
                  <Sparkles size={16} className={isPixel ? '' : 'shrink-0'} />
                  <span className={`text-sm font-bold ${isPixel ? 'px-title' : ''}`}>AIX 产品</span>
                </div>

                {/* 副标 */}
                <div
                  className={`mt-2 text-[12px] leading-relaxed ${
                    isPixel ? '' : isDark ? 'text-white/80' : 'text-zinc-700'
                  }`}
                >
                  T8公司AIX产品，欢迎体验
                </div>

                {/* 主行动 CTA: 跳转链接(新窗口) */}
                <a
                  href="https://aix.studio?partnerCode=10562"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setAixOpen(false)}
                  className={
                    isPixel
                      ? 'mt-3 px-btn px-btn--sky w-full justify-center'
                      : `mt-3 flex items-center justify-center gap-1.5 w-full py-2 rounded-lg text-xs font-semibold transition-all border ${
                          isDark
                            ? 'bg-gradient-to-r from-cyan-500/20 to-sky-500/20 border-cyan-400/40 text-cyan-200 hover:from-cyan-500/30 hover:to-sky-500/30 hover:border-cyan-400/60 hover:shadow-[0_0_16px_rgba(34,211,238,0.35)]'
                            : 'bg-gradient-to-r from-cyan-500 to-sky-500 border-cyan-600 text-white hover:from-cyan-600 hover:to-sky-600 hover:shadow-lg'
                        }`
                  }
                >
                  <ExternalLink size={13} />
                  <span>跳转体验（新窗口打开）</span>
                </a>
              </div>
            )}
          </div>

          {/* 「贞贞工坊」推广按钮: 同款胶囊, 主调 紫色(区分于 mint/yellow/pink) */}
          <div ref={zhenWrapRef} className="relative">
            <button
              onClick={() => setZhenOpen((v) => !v)}
              className={
                isPixel
                  ? `px-btn px-btn--sm px-btn--violet`
                  : `flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all border ${
                      isDark
                        ? zhenOpen
                          ? 'bg-violet-500/20 border-violet-400/50 text-violet-200 shadow-[0_0_12px_rgba(139,92,246,0.35)]'
                          : 'bg-violet-500/10 border-violet-500/30 text-violet-300 hover:bg-violet-500/20'
                        : zhenOpen
                          ? 'bg-violet-100 border-violet-400 text-violet-800'
                          : 'bg-violet-50 border-violet-300 text-violet-700 hover:bg-violet-100'
                    }`
              }
              title="贞贞工坊 · 海外站与 Discord"
            >
              <Wand2 size={14} />
              <span className="text-[11px]">贞贞工坊</span>
            </button>

            {/* 推广浮层 */}
            {zhenOpen && (
              <div
                className={
                  isPixel
                    ? 'absolute right-0 top-full mt-2 z-[60] w-[340px] px-panel rounded-2xl p-3 animate-[fadeIn_.18s_ease-out]'
                    : `absolute right-0 top-full mt-2 z-[60] w-[340px] rounded-xl p-3 border shadow-2xl backdrop-blur-md animate-[fadeIn_.18s_ease-out] ${
                        isDark
                          ? 'bg-zinc-900/95 border-violet-400/20 shadow-violet-500/10'
                          : 'bg-white/95 border-violet-200 shadow-violet-500/10'
                      }`
                }
                style={{ zoom: 1.5 }}
                onMouseDown={(e) => e.stopPropagation()}
              >
                {/* 标题 */}
                <div className={`flex items-center gap-2 ${isPixel ? '' : isDark ? 'text-violet-300' : 'text-violet-700'}`}>
                  <Wand2 size={16} className={isPixel ? '' : 'shrink-0'} />
                  <span className={`text-sm font-bold ${isPixel ? 'px-title' : ''}`}>贞贞工坊 · AI 创作社区</span>
                </div>

                {/* 副标 */}
                <div
                  className={`mt-2 text-[12px] leading-relaxed ${
                    isPixel ? '' : isDark ? 'text-white/80' : 'text-zinc-700'
                  }`}
                >
                  访问海外站点，加入 Discord 社区，与全球创作者一起玩转 AI。
                </div>

                {/* 海外站跳转按钮 */}
                <a
                  href="https://ai.t8star.org/"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setZhenOpen(false)}
                  className={
                    isPixel
                      ? 'mt-3 px-btn px-btn--violet w-full justify-center'
                      : `mt-3 flex items-center justify-center gap-1.5 w-full py-2 rounded-lg text-xs font-semibold transition-all border ${
                          isDark
                            ? 'bg-gradient-to-r from-violet-500/20 to-purple-500/20 border-violet-400/40 text-violet-200 hover:from-violet-500/30 hover:to-purple-500/30 hover:border-violet-400/60 hover:shadow-[0_0_16px_rgba(139,92,246,0.35)]'
                            : 'bg-gradient-to-r from-violet-500 to-purple-500 border-purple-600 text-white hover:from-violet-600 hover:to-purple-600 hover:shadow-lg'
                        }`
                  }
                >
                  <Globe size={14} className={isPixel ? '' : 'shrink-0'} />
                  <span>海外站 ai.t8star.org</span>
                  <ExternalLink size={11} className="opacity-70" />
                </a>

                {/* Discord 跳转按钮 */}
                <a
                  href="https://discord.gg/sAK2THPWhZ"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setZhenOpen(false)}
                  className={
                    isPixel
                      ? 'mt-2 px-btn px-btn--sky w-full justify-center'
                      : `mt-2 flex items-center justify-center gap-1.5 w-full py-2 rounded-lg text-xs font-semibold transition-all border ${
                          isDark
                            ? 'bg-indigo-500/10 border-indigo-500/40 text-indigo-300 hover:bg-indigo-500/20 hover:border-indigo-400/60 hover:shadow-[0_0_16px_rgba(99,102,241,0.3)]'
                            : 'bg-indigo-50 border-indigo-400 text-indigo-700 hover:bg-indigo-100'
                        }`
                  }
                >
                  <MessageCircle size={14} className={isPixel ? '' : 'shrink-0'} />
                  <span>Discord 社区群组</span>
                  <ExternalLink size={11} className="opacity-70" />
                </a>

                {/* 公告 */}
                <div
                  className={`mt-3 flex items-start gap-1.5 text-[11px] leading-relaxed ${
                    isPixel
                      ? 'px-chip px-chip--yellow w-full justify-start py-1.5 px-2'
                      : isDark
                        ? 'text-amber-200/90 bg-amber-500/10 border border-amber-500/30 rounded-md px-2 py-1.5'
                        : 'text-amber-800 bg-amber-50 border border-amber-300 rounded-md px-2 py-1.5'
                  }`}
                >
                  <CalendarDays
                    size={12}
                    className={`mt-0.5 shrink-0 ${
                      isPixel ? '' : isDark ? 'text-amber-300' : 'text-amber-600'
                    }`}
                  />
                  <span>
                    贞贞的 AI 工坊预计于
                    <span className={isPixel ? 'font-bold' : `font-semibold ${isDark ? 'text-amber-200' : 'text-amber-900'}`}> 5月27日 — 5月29日 </span>
                    开始恢复注册！
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* 「视频教程」推广按钮: 与右侧【在线画布/主题/风格】同款胶囊, 主调 红色(B 站 / Youtube 调性) */}
          <div ref={videoWrapRef} className="relative">
            <button
              onClick={() => setVideoOpen((v) => !v)}
              className={
                isPixel
                  ? `px-btn px-btn--sm px-btn--mint`
                  : `flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all border ${
                      isDark
                        ? videoOpen
                          ? 'bg-rose-500/20 border-rose-400/50 text-rose-200 shadow-[0_0_12px_rgba(244,63,94,0.35)]'
                          : 'bg-rose-500/10 border-rose-500/30 text-rose-300 hover:bg-rose-500/20'
                        : videoOpen
                          ? 'bg-rose-100 border-rose-400 text-rose-800'
                          : 'bg-rose-50 border-rose-300 text-rose-700 hover:bg-rose-100'
                    }`
              }
              title="视频教程 · 关注 T8 获取免费版本更新"
            >
              <PlayCircle size={14} />
              <span className="text-[11px]">视频教程</span>
            </button>

            {/* 推广浮层 */}
            {videoOpen && (
              <div
                className={
                  isPixel
                    ? 'absolute right-0 top-full mt-2 z-[60] w-[320px] px-panel rounded-2xl p-3 animate-[fadeIn_.18s_ease-out]'
                    : `absolute right-0 top-full mt-2 z-[60] w-[320px] rounded-xl p-3 border shadow-2xl backdrop-blur-md animate-[fadeIn_.18s_ease-out] ${
                        isDark
                          ? 'bg-zinc-900/95 border-rose-400/20 shadow-rose-500/10'
                          : 'bg-white/95 border-rose-200 shadow-rose-500/10'
                      }`
                }
                style={{ zoom: 1.5 }}
                onMouseDown={(e) => e.stopPropagation()}
              >
                {/* 标题 */}
                <div className={`flex items-center gap-2 ${isPixel ? '' : isDark ? 'text-rose-300' : 'text-rose-700'}`}>
                  <PlayCircle size={16} className={isPixel ? '' : 'shrink-0'} />
                  <span className={`text-sm font-bold ${isPixel ? 'px-title' : ''}`}>视频教程 · T8老师</span>
                </div>

                {/* 副标 */}
                <div
                  className={`mt-2 text-[12px] leading-relaxed ${
                    isPixel ? '' : isDark ? 'text-white/80' : 'text-zinc-700'
                  }`}
                >
                  跳转以下平台观看本画布与最新 AI 教程～
                </div>

                {/* B 站 跳转按钮 */}
                <a
                  href="https://space.bilibili.com/385085361"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setVideoOpen(false)}
                  className={
                    isPixel
                      ? 'mt-3 px-btn px-btn--pink w-full justify-center'
                      : `mt-3 flex items-center justify-center gap-1.5 w-full py-2 rounded-lg text-xs font-semibold transition-all border ${
                          isDark
                            ? 'bg-gradient-to-r from-pink-500/20 to-rose-500/20 border-pink-400/40 text-pink-200 hover:from-pink-500/30 hover:to-rose-500/30 hover:border-pink-400/60 hover:shadow-[0_0_16px_rgba(236,72,153,0.35)]'
                            : 'bg-gradient-to-r from-pink-500 to-rose-500 border-rose-600 text-white hover:from-pink-600 hover:to-rose-600 hover:shadow-lg'
                        }`
                  }
                >
                  {/* 小伊主机图标(荷包未内置专用 B 站 logo, 用 PlayCircle + “B” 文字代替) */}
                  <span
                    className={
                      isPixel
                        ? 'inline-flex items-center justify-center w-4 h-4 rounded-sm bg-white text-black text-[10px] font-black border border-black'
                        : 'inline-flex items-center justify-center w-4 h-4 rounded-sm bg-white text-rose-600 text-[10px] font-black'
                    }
                  >
                    B
                  </span>
                  <span>在 B 站订阅（新窗口打开）</span>
                  <ExternalLink size={11} className="opacity-70" />
                </a>

                {/* YouTube 跳转按钮 */}
                <a
                  href="https://space.bilibili.com/385085361"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setVideoOpen(false)}
                  className={
                    isPixel
                      ? 'mt-2 px-btn px-btn--mint w-full justify-center'
                      : `mt-2 flex items-center justify-center gap-1.5 w-full py-2 rounded-lg text-xs font-semibold transition-all border ${
                          isDark
                            ? 'bg-red-500/10 border-red-500/40 text-red-300 hover:bg-red-500/20 hover:border-red-400/60 hover:shadow-[0_0_16px_rgba(239,68,68,0.3)]'
                            : 'bg-red-50 border-red-400 text-red-700 hover:bg-red-100'
                        }`
                  }
                >
                  <Youtube size={14} className={isPixel ? '' : 'shrink-0'} />
                  <span>在 YouTube 订阅（新窗口打开）</span>
                  <ExternalLink size={11} className="opacity-70" />
                </a>

                {/* 关注提示 */}
                <div
                  className={`mt-3 flex items-start gap-1.5 text-[11px] leading-relaxed ${
                    isPixel ? '' : isDark ? 'text-white/70' : 'text-zinc-600'
                  }`}
                >
                  <Bell
                    size={11}
                    className={`mt-0.5 shrink-0 ${
                      isPixel ? '' : isDark ? 'text-amber-300' : 'text-amber-600'
                    }`}
                  />
                  <span>
                    记得关注 <span className={isPixel ? 'font-bold' : `font-semibold ${isDark ? 'text-rose-300' : 'text-rose-700'}`}>T8</span>，随时获取
                    <span className={isPixel ? 'font-bold' : `font-semibold ${isDark ? 'text-emerald-300' : 'text-emerald-700'}`}> 免费版本更新 </span>
                    及最新 AI 教程。
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* 「在线画布」推广按钮: 与右侧主题/风格按钮同款外观, 点击展开浮层 */}
          <div ref={cloudWrapRef} className="relative">
            <button
              onClick={() => setCloudOpen((v) => !v)}
              className={
                isPixel
                  ? `px-btn px-btn--sm ${cloudOpen ? 'px-btn--mint' : 'px-btn--yellow'}`
                  : `flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all border ${
                      isDark
                        ? cloudOpen
                          ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-200 shadow-[0_0_12px_rgba(16,185,129,0.35)]'
                          : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20'
                        : cloudOpen
                          ? 'bg-emerald-100 border-emerald-400 text-emerald-800'
                          : 'bg-emerald-50 border-emerald-300 text-emerald-700 hover:bg-emerald-100'
                    }`
              }
              title="云端创作 · 企鹅画布(还送 10 鹅卵石)"
            >
              <Cloud size={14} />
              <span className="text-[11px]">在线画布</span>
            </button>

            {/* 推广浮层 */}
            {cloudOpen && (
              <div
                className={
                  isPixel
                    ? 'absolute right-0 top-full mt-2 z-[60] w-[320px] px-panel rounded-2xl p-3 animate-[fadeIn_.18s_ease-out]'
                    : `absolute right-0 top-full mt-2 z-[60] w-[320px] rounded-xl p-3 border shadow-2xl backdrop-blur-md animate-[fadeIn_.18s_ease-out] ${
                        isDark
                          ? 'bg-zinc-900/95 border-emerald-400/20 shadow-emerald-500/10'
                          : 'bg-white/95 border-emerald-200 shadow-emerald-500/10'
                      }`
                }
                style={{ zoom: 1.5 }}
                onMouseDown={(e) => e.stopPropagation()}
              >
                {/* 标题 */}
                <div className={`flex items-center gap-2 ${isPixel ? '' : isDark ? 'text-emerald-300' : 'text-emerald-700'}`}>
                  <Cloud size={16} className={isPixel ? '' : 'shrink-0'} />
                  <span className={`text-sm font-bold ${isPixel ? 'px-title' : ''}`}>云端创作 · 企鹅画布</span>
                </div>

                {/* 副标 + 鹅卵石提示 */}
                <div
                  className={`mt-2 text-[12px] leading-relaxed ${
                    isPixel ? '' : isDark ? 'text-white/80' : 'text-zinc-700'
                  }`}
                >
                  云端也能爽用<span className={isPixel ? 'font-bold' : `font-semibold ${isDark ? 'text-emerald-300' : 'text-emerald-700'}`}>企鹅画布</span>～
                  <span
                    className={
                      isPixel
                        ? 'inline-flex items-center gap-1 ml-1 px-chip px-chip--yellow'
                        : `inline-flex items-center gap-1 ml-1 px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                            isDark ? 'bg-amber-500/20 text-amber-300' : 'bg-amber-100 text-amber-700'
                          }`
                    }
                  >
                    <Gift size={10} /> 还送 10 鹅卵石
                  </span>
                </div>

                {/* 主行动 CTA: 跳转链接(新窗口) */}
                <a
                  href="https://cloud.pebbling.cn/user/?invite=T8STAR"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setCloudOpen(false)}
                  className={
                    isPixel
                      ? 'mt-3 px-btn px-btn--mint w-full justify-center'
                      : `mt-3 flex items-center justify-center gap-1.5 w-full py-2 rounded-lg text-xs font-semibold transition-all border ${
                          isDark
                            ? 'bg-gradient-to-r from-emerald-500/20 to-sky-500/20 border-emerald-400/40 text-emerald-200 hover:from-emerald-500/30 hover:to-sky-500/30 hover:border-emerald-400/60 hover:shadow-[0_0_16px_rgba(16,185,129,0.35)]'
                            : 'bg-gradient-to-r from-emerald-500 to-sky-500 border-emerald-600 text-white hover:from-emerald-600 hover:to-sky-600 hover:shadow-lg'
                        }`
                  }
                >
                  <ExternalLink size={13} />
                  <span>立即开通（新窗口打开）</span>
                </a>

                {/* 微信号 + 一键复制 */}
                <div
                  className={`mt-3 rounded-lg p-2 ${
                    isPixel
                      ? 'border-2 border-black bg-[#FFFBF0]'
                      : isDark
                        ? 'bg-white/5 border border-white/10'
                        : 'bg-zinc-50 border border-zinc-200'
                  }`}
                >
                  <div className={`text-[10px] mb-1 ${isPixel ? '' : isDark ? 'text-white/50' : 'text-zinc-500'}`}>
                    加群 · 加企鹅微信
                  </div>
                  <div className="flex items-center gap-2">
                    <code
                      className={`flex-1 text-xs font-mono px-2 py-1 rounded ${
                        isPixel
                          ? 'bg-white border border-black'
                          : isDark
                            ? 'bg-zinc-800 text-emerald-300'
                            : 'bg-white text-emerald-700 border border-zinc-200'
                      }`}
                    >
                      Lovexy_0222
                    </code>
                    <button
                      onClick={handleCopyWx}
                      className={
                        isPixel
                          ? `px-btn px-btn--sm ${wxCopied ? 'px-btn--mint' : 'px-btn--ghost'}`
                          : `flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium transition-colors border ${
                              wxCopied
                                ? isDark
                                  ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-300'
                                  : 'bg-emerald-100 border-emerald-300 text-emerald-700'
                                : isDark
                                  ? 'bg-white/5 border-white/15 text-white/70 hover:bg-white/10'
                                  : 'bg-white border-zinc-300 text-zinc-600 hover:bg-zinc-50'
                            }`
                      }
                      title={wxCopied ? '已复制' : '一键复制微信号'}
                    >
                      {wxCopied ? <Check size={11} /> : <Copy size={11} />}
                      <span>{wxCopied ? '已复制' : '复制'}</span>
                    </button>
                  </div>
                </div>

                {/* 致谢 */}
                <div
                  className={`mt-3 flex items-start gap-1.5 text-[11px] leading-relaxed ${
                    isPixel ? '' : isDark ? 'text-white/60' : 'text-zinc-500'
                  }`}
                >
                  <Heart
                    size={11}
                    className={`mt-0.5 shrink-0 ${
                      isPixel ? '' : isDark ? 'text-pink-400' : 'text-pink-500'
                    }`}
                  />
                  <span>
                    感谢企鹅在我制作本画布时候的帮助，大家多多支持！<span className="text-base">🐧</span>
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* 主题模板 */}
          <button
            onClick={() => setThemeManagerOpen(true)}
            className={
              isPixel
                ? 'px-btn px-btn--sm px-btn--pink max-w-[150px]'
                : `flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors border ${
                    isDark
                      ? 'bg-sky-500/10 border-sky-500/30 text-sky-300 hover:bg-sky-500/20'
                      : 'bg-sky-50 border-sky-300 text-sky-700 hover:bg-sky-100'
                  }`
            }
            title="主题模板"
          >
            <Palette size={14} />
            <span className="text-[11px] truncate">{currentTemplate.name}</span>
          </button>
          <button
            onClick={() => setResourceOpen(true)}
            className={
              isPixel
                ? 'px-btn px-btn--sm px-btn--mint'
                : `flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors border ${
                    isDark
                      ? 'bg-fuchsia-500/10 border-fuchsia-500/30 text-fuchsia-300 hover:bg-fuchsia-500/20'
                      : 'bg-fuchsia-50 border-fuchsia-300 text-fuchsia-700 hover:bg-fuchsia-100'
                  }`
            }
            title="资源库"
          >
            <Library size={14} />
            <span className="text-[11px]">资源库</span>
          </button>
          <AppUpdaterButton isPixel={isPixel} isDark={isDark} />
          <button
            onClick={() => setSettingsOpen(true)}
            className={
              isPixel
                ? 'px-btn px-btn--icon px-btn--ghost'
                : `p-2 rounded-md ${isDark ? 'hover:bg-white/10' : 'hover:bg-black/5'}`
            }
            title="API 设置"
          >
            <Settings size={isPixel ? 14 : 16} />
          </button>
          <button
            onClick={toggleTheme}
            className={
              isPixel
                ? 'px-btn px-btn--icon px-btn--ghost'
                : `p-2 rounded-md ${isDark ? 'hover:bg-white/10' : 'hover:bg-black/5'}`
            }
            title={`切换到${isDark ? '浅色' : '深色'}主题`}
          >
            {isDark ? <Sun size={isPixel ? 14 : 16} /> : <Moon size={isPixel ? 14 : 16} />}
          </button>
        </div>
      </header>

      {/* 主体两栏布局 */}
      <div className="flex-1 flex overflow-hidden">
        <Sidebar onAddNode={handleAddNode} />
        <ErrorBoundary fallbackTitle="画布渲染出错了，已被错误边界捕获">
          <Suspense fallback={<CanvasBootFallback isPixel={isPixel} isDark={isDark} />}>
            <Canvas onAddNodeRef={addNodeRef} onInsertWorkflowRef={insertWorkflowRef} />
          </Suspense>
        </ErrorBoundary>
      </div>

      {/* API 设置弹窗 */}
      <Suspense fallback={null}>
        {settingsOpen && <ApiSettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />}
        {themeManagerOpen && (
          <ThemeTemplateManager open={themeManagerOpen} onClose={() => setThemeManagerOpen(false)} />
        )}
        {resourceOpen && (
          <ResourceLibraryDrawer
            open={resourceOpen}
            onClose={() => setResourceOpen(false)}
            onInsertMaterial={handleInsertResource}
          />
        )}
      </Suspense>
      <MaterialContextMenu />
    </div>
    </RHToolsProvider>
  );
}

export default App;
